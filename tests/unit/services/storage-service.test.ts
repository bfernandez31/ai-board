import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '@/lib/services/storage-service';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
const mockS3Client = {
  send: vi.fn(),
};

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => mockS3Client),
  PutObjectCommand: vi.fn((params) => ({ ...params, commandType: 'PutObject' })),
  GetObjectCommand: vi.fn((params) => ({ ...params, commandType: 'GetObject' })),
  DeleteObjectCommand: vi.fn((params) => ({ ...params, commandType: 'DeleteObject' })),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });

    vi.clearAllMocks();
  });

  describe('generateStorageKey', () => {
    it('should generate storage key with correct format', () => {
      const key = storageService.generateStorageKey(123);
      expect(key).toMatch(/^logs\/123\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('calculateContentHash', () => {
    it('should calculate SHA-256 hash of content', () => {
      const hash = storageService.calculateContentHash('test content');
      expect(hash).toBe('916f0027a575074ce72a331777c3386b5c1c2b877e4d6d8e658e6b7a4b3b5c5c');
    });
  });

  describe('uploadLogContent', () => {
    it('should upload log content to S3', async () => {
      mockS3Client.send.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3.example.com/presigned-url');

      const result = await storageService.uploadLogContent(123, 'test content');

      expect(result.storageKey).toMatch(/^logs\/123\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
      expect(result.contentSize).toBeGreaterThan(0);
      expect(result.contentHash).toBe('916f0027a575074ce72a331777c3386b5c1c2b877e4d6d8e658e6b7a4b3b5c5c');
      expect(result.expirationDate).toBeInstanceOf(Date);
      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      const error = new Error('S3 upload failed');
      mockS3Client.send.mockRejectedValue(error);

      await expect(storageService.uploadLogContent(123, 'test content'))
        .rejects
        .toThrow('Failed to upload log content');
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate presigned URL for S3 object', async () => {
      const testUrl = 'https://s3.example.com/presigned-url';
      vi.mocked(getSignedUrl).mockResolvedValue(testUrl);

      const result = await storageService.generatePresignedUrl('logs/123/test.json');
      expect(result).toBe(testUrl);
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should handle presigned URL generation failure', async () => {
      const error = new Error('Failed to generate presigned URL');
      vi.mocked(getSignedUrl).mockRejectedValue(error);

      await expect(storageService.generatePresignedUrl('logs/123/test.json'))
        .rejects
        .toThrow('Failed to generate presigned URL');
    });
  });

  describe('deleteLogContent', () => {
    it('should delete log content from S3', async () => {
      mockS3Client.send.mockResolvedValue({});

      await storageService.deleteLogContent('logs/123/test.json');
      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should handle delete failure', async () => {
      const error = new Error('S3 delete failed');
      mockS3Client.send.mockRejectedValue(error);

      await expect(storageService.deleteLogContent('logs/123/test.json'))
        .rejects
        .toThrow('Failed to delete log content');
    });
  });

  describe('fromEnvironment', () => {
    it('should create storage service from environment variables', () => {
      // Set environment variables
      process.env.S3_BUCKET_NAME = 'env-bucket';
      process.env.AWS_REGION = 'us-west-2';
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.S3_ENDPOINT = 'https://custom-endpoint.com';

      const service = StorageService.fromEnvironment();
      
      // Note: We can't easily test the internal S3Client configuration,
      // but we can verify the method doesn't throw
      expect(service).toBeInstanceOf(StorageService);

      // Clean up
      delete process.env.S3_BUCKET_NAME;
      delete process.env.AWS_REGION;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.S3_ENDPOINT;
    });
  });

  describe('getStorageService singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const { getStorageService } = require('@/lib/services/storage-service');
      
      const instance1 = getStorageService();
      const instance2 = getStorageService();
      
      expect(instance1).toBe(instance2);
    });
  });
});