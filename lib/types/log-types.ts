import type { Agent } from '@prisma/client';

/**
 * Log Entry Message Type
 * Represents the type of log message (INFO, ERROR, WARNING, TOOL)
 */
export type LogMessageType = 'INFO' | 'ERROR' | 'WARNING' | 'TOOL';

/**
 * Log Entry Interface
 * Individual log entry within a job execution log
 */
export interface LogEntry {
  id: number;
  jobLogId: number;
  sequenceNumber: number;
  timestamp: Date | string;
  messageType: LogMessageType;
  content: string;
  toolName?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Log Storage Interface
 * Tracks physical storage of log content
 */
export interface LogStorage {
  id: number;
  jobLogId: number;
  storageProvider: string;
  storageKey: string;
  contentSize: number;
  contentHash: string;
  expirationDate: Date | string;
  createdAt: Date | string;
}

/**
 * Job Log Interface
 * Represents the captured execution log for a job
 */
export interface JobLog {
  id: number;
  jobId: number;
  agentType: Agent;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  timestamp: Date | string;
  previewContent: string;
  fullLogReference: string;
  storageLocation: string;
  contentSize: number;
  contentHash: string;
  expirationDate: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  logEntries?: LogEntry[];
  storage?: LogStorage | null;
}

/**
 * Log Capture Request Interface
 * Request payload for capturing agent execution logs
 */
export interface LogCaptureRequest {
  jobId: number;
  agentType: Agent;
  logContent: string; // Raw log content from agent
  logFormat: 'text' | 'json'; // Format of logContent
}

/**
 * Log Retrieval Response Interface
 * Response payload for retrieving job execution logs
 */
export interface LogRetrievalResponse {
  jobId: number;
  agentType: Agent;
  status: string;
  timestamp: string;
  preview: string;
  fullLogUrl: string; // Presigned S3 URL
  logEntries: LogEntry[];
  contentSize: number;
  expirationDate: string;
}

/**
 * Log Preview Interface
 * Lightweight preview data for inline display
 */
export interface LogPreview {
  jobId: number;
  previewContent: string;
  hasFullLogs: boolean;
  errorCount: number;
  warningCount: number;
}

/**
 * Normalized Log Entry
 * Standardized format for different agent outputs
 */
export interface NormalizedLogEntry {
  sequenceNumber: number;
  timestamp: string;
  messageType: LogMessageType;
  content: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
  rawContent?: string; // Original raw content before normalization
}

/**
 * Log Processing Options
 * Configuration for log processing and normalization
 */
export interface LogProcessingOptions {
  maxPreviewLength?: number;
  includeRawContent?: boolean;
  normalizeTimestamps?: boolean;
}

/**
 * Log Capture Result
 * Result of log capture operation
 */
export interface LogCaptureResult {
  success: boolean;
  jobLogId?: number;
  storageKey?: string;
  previewContent: string;
  error?: string;
}

/**
 * Log Retrieval Options
 * Options for retrieving logs
 */
export interface LogRetrievalOptions {
  includeFullContent?: boolean;
  includeEntries?: boolean;
  messageTypeFilter?: LogMessageType[];
}
