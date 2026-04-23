import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogService } from '@/lib/services/log-service';
import { StorageService } from '@/lib/services/storage-service';
import { prisma } from '@/lib/db/client';

// Mock the storage service
vi.mock('@/lib/services/storage-service', () => ({
  getStorageService: vi.fn(() => ({
    uploadLogContent: vi.fn().mockResolvedValue({
      storageKey: 'logs/123/2024-04-23T14-30-22.json',
      contentSize: 1024,
      contentHash: 'abc123',
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }),
    generatePresignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/logs/123.json?presigned'),
  })),
}));

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    jobLog: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    logEntry: {
      create: vi.fn(),
    },
    logStorage: {
      create: vi.fn(),
    },
  },
}));

describe('LogService', () => {
  let logService: LogService;

  beforeEach(() => {
    logService = new LogService();
    vi.clearAllMocks();
  });

  describe('captureLogs', () => {
    it('should capture logs successfully', async () => {
      // Mock Prisma responses
      const mockJobLog = {
        id: 1,
        jobId: 123,
        agentType: 'CLAUDE',
        status: 'COMPLETED',
        previewContent: 'Preview content',
        fullLogReference: 'logs/123/2024-04-23T14-30-22.json',
        storageLocation: 'S3',
        contentSize: 1024,
        contentHash: 'abc123',
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.jobLog.create).mockResolvedValue(mockJobLog);
      vi.mocked(prisma.logEntry.create).mockResolvedValue({ id: 1, ...mockJobLog });
      vi.mocked(prisma.logStorage.create).mockResolvedValue({
        id: 1,
        jobLogId: mockJobLog.id,
        storageProvider: 'S3',
        storageKey: mockJobLog.fullLogReference,
        contentSize: mockJobLog.contentSize,
        contentHash: mockJobLog.contentHash,
        expirationDate: mockJobLog.expirationDate,
        createdAt: new Date(),
      });

      const result = await logService.captureLogs({
        jobId: 123,
        agentType: 'CLAUDE',
        logContent: 'Test log content',
        logFormat: 'text',
      });

      expect(result.success).toBe(true);
      expect(result.jobLogId).toBe(1);
      expect(result.previewContent).toContain('Test log content');
      expect(prisma.jobLog.create).toHaveBeenCalled();
      expect(prisma.logEntry.create).toHaveBeenCalled();
      expect(prisma.logStorage.create).toHaveBeenCalled();
    });

    it('should handle log capture failure', async () => {
      // Mock Prisma to throw an error
      vi.mocked(prisma.jobLog.create).mockRejectedValue(new Error('Database error'));

      const result = await logService.captureLogs({
        jobId: 123,
        agentType: 'CLAUDE',
        logContent: 'Test log content',
        logFormat: 'text',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('normalizeLogContent', () => {
    it('should normalize text format logs', () => {
      const result = logService['normalizeLogContent'](
        'Line 1\nLine 2\n[ERROR] Error line',
        'text'
      );

      expect(result.length).toBe(3);
      expect(result[0].content).toBe('Line 1');
      expect(result[1].content).toBe('Line 2');
      expect(result[2].messageType).toBe('ERROR');
      expect(result[2].content).toBe('[ERROR] Error line');
    });

    it('should normalize JSON format logs', () => {
      const jsonContent = JSON.stringify([
        { timestamp: '2024-04-23T14:30:22Z', message: 'Test message', level: 'INFO' },
        { timestamp: '2024-04-23T14:30:23Z', message: 'Error message', level: 'ERROR' },
      ]);

      const result = logService['normalizeLogContent'](jsonContent, 'json');

      expect(result.length).toBe(2);
      expect(result[0].messageType).toBe('INFO');
      expect(result[0].content).toBe('Test message');
      expect(result[1].messageType).toBe('ERROR');
      expect(result[1].content).toBe('Error message');
    });

    it('should handle malformed JSON with fallback', () => {
      const result = logService['normalizeLogContent'](
        'Not valid JSON',
        'json'
      );

      expect(result.length).toBe(1);
      expect(result[0].messageType).toBe('ERROR');
      expect(result[0].content).toContain('Failed to parse log content');
    });
  });

  describe('detectMessageType', () => {
    it('should detect message types from text', () => {
      expect(logService['detectMessageTypeFromText']('[ERROR] Test')).toBe('ERROR');
      expect(logService['detectMessageTypeFromText']('WARNING: Test')).toBe('WARNING');
      expect(logService['detectMessageTypeFromText']('TOOL: Test')).toBe('TOOL');
      expect(logService['detectMessageTypeFromText']('INFO: Test')).toBe('INFO');
    });
  });

  describe('generatePreviewContent', () => {
    it('should generate preview content from log entries', () => {
      const entries = [
        { sequenceNumber: 1, timestamp: '2024-04-23T14:30:22Z', messageType: 'INFO', content: 'First message' },
        { sequenceNumber: 2, timestamp: '2024-04-23T14:30:23Z', messageType: 'ERROR', content: 'Error message' },
      ];

      const result = logService['generatePreviewContent'](entries as any);
      expect(result).toContain('First message');
      expect(result).toContain('Error message');
      expect(result.length).toBeLessThanOrEqual(2000);
    });
  });
});

describe('LogService Integration', () => {
  it('should integrate storage service and database operations', async () => {
    const logService = new LogService();

    // Mock successful operations
    vi.mocked(prisma.jobLog.create).mockResolvedValue({
      id: 1,
      jobId: 123,
      agentType: 'CLAUDE',
      status: 'COMPLETED',
      previewContent: 'Preview',
      fullLogReference: 'logs/123/test.json',
      storageLocation: 'S3',
      contentSize: 1024,
      contentHash: 'abc123',
      expirationDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(prisma.logEntry.create).mockResolvedValue({ id: 1, jobLogId: 1, sequenceNumber: 1, timestamp: new Date(), messageType: 'INFO', content: 'Test', toolName: null, metadata: null });
    vi.mocked(prisma.logStorage.create).mockResolvedValue({ id: 1, jobLogId: 1, storageProvider: 'S3', storageKey: 'logs/123/test.json', contentSize: 1024, contentHash: 'abc123', expirationDate: new Date(), createdAt: new Date() });

    const result = await logService.captureLogs({
      jobId: 123,
      agentType: 'CLAUDE',
      logContent: 'Test content',
      logFormat: 'text',
    });

    expect(result.success).toBe(true);
    expect(result.jobLogId).toBe(1);
  });
});