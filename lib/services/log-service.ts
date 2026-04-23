import { prisma } from '@/lib/db/client';
import { getStorageService } from './storage-service';
import type { 
  LogCaptureRequest, 
  LogCaptureResult, 
  LogRetrievalResponse,
  NormalizedLogEntry,
  LogProcessingOptions 
} from '@/lib/types/log-types';
import type { Agent, JobLog, LogEntry, LogStorage } from '@prisma/client';

// Simple in-memory cache for log retrieval
const logCache = new Map<number, {
  data: LogRetrievalResponse;
  timestamp: number;
  expiresAt: number;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Log Service
 * Core business logic for log capture and retrieval
 */
export class LogService {
  private storageService: ReturnType<typeof getStorageService>;

  constructor() {
    this.storageService = getStorageService();
  }

  /**
   * Execute operation with retries
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed, retrying...`, {
          error: error instanceof Error ? error.message : String(error),
        });
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    console.error(`All ${maxAttempts} attempts failed`);
    throw lastError;
  }

  /**
   * Capture agent execution logs with retry logic
   */
  async captureLogs(request: LogCaptureRequest): Promise<LogCaptureResult> {
    const { jobId, agentType, logContent, logFormat } = request;

    try {
      // Normalize log content with retry
      const normalizedEntries = await this.withRetry(
        () => this.normalizeLogContent(logContent, logFormat),
        3,
        500
      );
      
      // Generate preview content (first 2000 characters)
      const previewContent = this.generatePreviewContent(normalizedEntries);
      
      // Convert to JSON for storage
      const storageContent = JSON.stringify({
        jobId,
        agentType,
        timestamp: new Date().toISOString(),
        entries: normalizedEntries,
      }, null, 2);

      // Upload to S3 with retry
      const storageResult = await this.withRetry(
        () => this.storageService.uploadLogContent(jobId, storageContent),
        3,
        1000
      );

      // Create JobLog record in database with retry
      const jobLog = await this.withRetry(
        async () => {
          return await prisma.jobLog.create({
            data: {
              jobId,
              agentType,
              status: 'COMPLETED',
              previewContent,
              fullLogReference: storageResult.storageKey,
              storageLocation: 'S3',
              contentSize: storageResult.contentSize,
              contentHash: storageResult.contentHash,
              expirationDate: storageResult.expirationDate,
            },
            include: {
              logEntries: true,
            },
          });
        },
        3,
        1000
      );

      // Create LogEntry records with retry
      const logEntries = await this.withRetry(
        async () => {
          return await Promise.all(
            normalizedEntries.map((entry, index) =>
              prisma.logEntry.create({
                data: {
                  jobLogId: jobLog.id,
                  sequenceNumber: index + 1,
                  timestamp: new Date(entry.timestamp),
                  messageType: entry.messageType,
                  content: entry.content,
                  toolName: entry.toolName,
                  metadata: entry.metadata,
                },
              })
            )
          );
        },
        3,
        1000
      );

      // Create LogStorage record with retry
      await this.withRetry(
        async () => {
          await prisma.logStorage.create({
            data: {
              jobLogId: jobLog.id,
              storageProvider: 'S3',
              storageKey: storageResult.storageKey,
              contentSize: storageResult.contentSize,
              contentHash: storageResult.contentHash,
              expirationDate: storageResult.expirationDate,
            },
          });
        },
        3,
        1000
      );

      return {
        success: true,
        jobLogId: jobLog.id,
        storageKey: storageResult.storageKey,
        previewContent,
      };
    } catch (error) {
      console.error('Failed to capture logs after retries:', {
        jobId,
        agentType,
        error,
      });
      
      return {
        success: false,
        previewContent: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Retrieve logs for a job with caching
   */
  async getJobLogs(jobId: number): Promise<LogRetrievalResponse | null> {
    // Check cache first
    const now = Date.now();
    const cached = logCache.get(jobId);
    
    if (cached && cached.expiresAt > now) {
      console.log(`[LogService] Cache hit for job ${jobId}`);
      return cached.data;
    }

    try {
      // Find job log with entries
      const jobLog = await prisma.jobLog.findUnique({
        where: { jobId },
        include: {
          logEntries: {
            orderBy: { sequenceNumber: 'asc' },
          },
          storage: true,
        },
      });

      if (!jobLog) {
        return null;
      }

      // Generate presigned URL for full log access
      let fullLogUrl = '';
      if (jobLog.storage?.storageKey) {
        fullLogUrl = await this.storageService.generatePresignedUrl(jobLog.storage.storageKey);
      }

      const response: LogRetrievalResponse = {
        jobId,
        agentType: jobLog.agentType,
        status: jobLog.status,
        timestamp: jobLog.timestamp.toISOString(),
        preview: jobLog.previewContent,
        fullLogUrl,
        logEntries: jobLog.logEntries.map(entry => ({
          id: entry.id,
          jobLogId: entry.jobLogId,
          sequenceNumber: entry.sequenceNumber,
          timestamp: entry.timestamp,
          messageType: entry.messageType,
          content: entry.content,
          toolName: entry.toolName,
          metadata: entry.metadata,
        })),
        contentSize: jobLog.contentSize,
        expirationDate: jobLog.expirationDate.toISOString(),
      };

      // Cache the response
      logCache.set(jobId, {
        data: response,
        timestamp: now,
        expiresAt: now + CACHE_TTL_MS,
      });

      console.log(`[LogService] Cached logs for job ${jobId} (TTL: ${CACHE_TTL_MS}ms)`);
      return response;
    } catch (error) {
      console.error('Failed to retrieve logs:', {
        jobId,
        error,
      });
      throw new Error(`Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear cache for a specific job
   */
  clearJobCache(jobId: number): void {
    logCache.delete(jobId);
    console.log(`[LogService] Cleared cache for job ${jobId}`);
  }

  /**
   * Clear all cached logs
   */
  clearAllCache(): void {
    const count = logCache.size;
    logCache.clear();
    console.log(`[LogService] Cleared all cache entries (${count} removed)`);
  }

  /**
   * Normalize log content from different agent formats
   */
  normalizeLogContent(
    logContent: string,
    logFormat: 'text' | 'json'
  ): NormalizedLogEntry[] {
    try {
      if (logFormat === 'json') {
        // Parse JSON format
        const parsed = JSON.parse(logContent);
        
        if (Array.isArray(parsed)) {
          // Array of log entries
          return parsed.map((entry, index) => ({
            sequenceNumber: index + 1,
            timestamp: entry.timestamp || new Date().toISOString(),
            messageType: this.detectMessageType(entry),
            content: typeof entry.message === 'string' ? entry.message : JSON.stringify(entry),
            toolName: entry.toolName || entry.tool,
            metadata: entry.metadata || entry.additionalData,
            rawContent: JSON.stringify(entry),
          }));
        } else if (parsed.entries) {
          // Object with entries array
          return parsed.entries.map((entry: any, index: number) => ({
            sequenceNumber: index + 1,
            timestamp: entry.timestamp || new Date().toISOString(),
            messageType: this.detectMessageType(entry),
            content: typeof entry.message === 'string' ? entry.message : JSON.stringify(entry),
            toolName: entry.toolName || entry.tool,
            metadata: entry.metadata || entry.additionalData,
            rawContent: JSON.stringify(entry),
          }));
        }
      } else {
        // Parse text format (line-based)
        const lines = logContent.split('\n').filter(line => line.trim() !== '');
        
        return lines.map((line, index) => ({
          sequenceNumber: index + 1,
          timestamp: new Date().toISOString(),
          messageType: this.detectMessageTypeFromText(line),
          content: line,
          toolName: undefined,
          metadata: undefined,
          rawContent: line,
        }));
      }
    } catch (error) {
      console.error('Failed to normalize log content:', {
        error,
        logContent: logContent.substring(0, 200) + '...',
      });
      
      // Fallback: create a single error entry
      return [{
        sequenceNumber: 1,
        timestamp: new Date().toISOString(),
        messageType: 'ERROR',
        content: `Failed to parse log content: ${error instanceof Error ? error.message : String(error)}`,
        toolName: undefined,
        metadata: undefined,
        rawContent: logContent.substring(0, 1000),
      }];
    }

    // Fallback for empty content
    return [{
      sequenceNumber: 1,
      timestamp: new Date().toISOString(),
      messageType: 'INFO',
      content: 'No log content available',
      toolName: undefined,
      metadata: undefined,
    }];
  }

  /**
   * Detect message type from JSON entry
   */
  private detectMessageType(entry: any): 'INFO' | 'ERROR' | 'WARNING' | 'TOOL' {
    if (entry.level) {
      const level = entry.level.toUpperCase();
      if (level.includes('ERROR')) return 'ERROR';
      if (level.includes('WARN')) return 'WARNING';
      if (level.includes('TOOL')) return 'TOOL';
      return 'INFO';
    }
    
    if (entry.type) {
      const type = entry.type.toUpperCase();
      if (type.includes('ERROR')) return 'ERROR';
      if (type.includes('WARN')) return 'WARNING';
      if (type.includes('TOOL')) return 'TOOL';
      return 'INFO';
    }
    
    if (entry.message && typeof entry.message === 'string') {
      return this.detectMessageTypeFromText(entry.message);
    }
    
    return 'INFO';
  }

  /**
   * Detect message type from text line
   */
  private detectMessageTypeFromText(line: string): 'INFO' | 'ERROR' | 'WARNING' | 'TOOL' {
    const upperLine = line.toUpperCase();
    
    if (upperLine.includes('[ERROR]') || upperLine.includes('ERROR:')) {
      return 'ERROR';
    }
    
    if (upperLine.includes('[WARN]') || upperLine.includes('WARNING:')) {
      return 'WARNING';
    }
    
    if (upperLine.includes('[TOOL]') || upperLine.includes('TOOL:')) {
      return 'TOOL';
    }
    
    return 'INFO';
  }

  /**
   * Generate preview content from log entries
   */
  private generatePreviewContent(entries: NormalizedLogEntry[]): string {
    // Limit to first 2000 characters
    const content = entries
      .map(entry => `[${entry.messageType}] ${entry.content}`)
      .join('\n');
    
    return content.substring(0, 2000);
  }

  /**
   * Get log preview for inline display
   */
  async getLogPreview(jobId: number): Promise<{ 
    previewContent: string;
    hasFullLogs: boolean;
    errorCount: number;
    warningCount: number;
  } | null> {
    try {
      const jobLog = await prisma.jobLog.findUnique({
        where: { jobId },
        include: {
          logEntries: {
            where: {
              messageType: { in: ['ERROR', 'WARNING'] },
            },
          },
        },
      });

      if (!jobLog) {
        return null;
      }

      const errorCount = jobLog.logEntries.filter(e => e.messageType === 'ERROR').length;
      const warningCount = jobLog.logEntries.filter(e => e.messageType === 'WARNING').length;

      return {
        previewContent: jobLog.previewContent,
        hasFullLogs: jobLog.contentSize > 0,
        errorCount,
        warningCount,
      };
    } catch (error) {
      console.error('Failed to get log preview:', {
        jobId,
        error,
      });
      return null;
    }
  }

  /**
   * Check if logs exist for a job
   */
  async logsExist(jobId: number): Promise<boolean> {
    const count = await prisma.jobLog.count({
      where: { jobId },
    });
    return count > 0;
  }

  /**
   * Prune expired logs
   */
  async pruneExpiredLogs(): Promise<{ prunedCount: number; errorCount: number }> {
    let prunedCount = 0;
    let errorCount = 0;

    try {
      const now = new Date();
      
      // Find expired job logs
      const expiredLogs = await prisma.jobLog.findMany({
        where: {
          expirationDate: { lt: now },
        },
        include: {
          storage: true,
        },
      });

      for (const log of expiredLogs) {
        try {
          // Delete from S3 first
          if (log.storage?.storageKey) {
            try {
              await this.storageService.deleteLogContent(log.storage.storageKey);
            } catch (s3Error) {
              console.warn('Failed to delete S3 content during pruning:', {
                storageKey: log.storage.storageKey,
                error: s3Error,
              });
            }
          }

          // Delete database records
          await prisma.$transaction([
            prisma.logEntry.deleteMany({ where: { jobLogId: log.id } }),
            prisma.logStorage.deleteMany({ where: { jobLogId: log.id } }),
            prisma.jobLog.delete({ where: { id: log.id } }),
          ]);

          prunedCount++;
        } catch (error) {
          console.error('Failed to prune log:', {
            jobLogId: log.id,
            jobId: log.jobId,
            error,
          });
          errorCount++;
        }
      }

      return { prunedCount, errorCount };
    } catch (error) {
      console.error('Failed to prune expired logs:', {
        error,
      });
      return { prunedCount: 0, errorCount: expiredLogs?.length || 0 };
    }
  }
}

/**
 * Singleton log service instance
 */
let logServiceInstance: LogService | null = null;

/**
 * Get or create log service instance
 */
export function getLogService(): LogService {
  if (!logServiceInstance) {
    logServiceInstance = new LogService();
  }
  return logServiceInstance;
}