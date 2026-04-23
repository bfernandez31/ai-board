import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

/**
 * Storage Service Configuration
 */
interface StorageServiceConfig {
  bucketName: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

/**
 * Storage Service
 * Handles S3 operations for log storage
 */
export class StorageService {
  private s3Client: S3Client;
  private config: StorageServiceConfig;

  constructor(config: StorageServiceConfig) {
    this.config = config;
    
    // Create S3 client with configuration
    this.s3Client = new S3Client({
      region: config.region,
      credentials: config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
      endpoint: config.endpoint,
      forcePathStyle: config.endpoint ? true : undefined,
    });
  }

  /**
   * Generate storage key for log content
   * Format: logs/{jobId}/{timestamp}.json
   */
  generateStorageKey(jobId: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `logs/${jobId}/${timestamp}.json`;
  }

  /**
   * Calculate content hash (SHA-256)
   */
  calculateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Upload log content to S3
   */
  async uploadLogContent(
    jobId: number,
    content: string,
    contentType: string = 'application/json'
  ): Promise<{ 
    storageKey: string;
    contentSize: number;
    contentHash: string;
    expirationDate: Date;
  }> {
    const storageKey = this.generateStorageKey(jobId);
    const contentHash = this.calculateContentHash(content);
    const contentSize = Buffer.byteLength(content, 'utf8');
    
    // Calculate expiration date (30 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    const putCommand = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: storageKey,
      Body: content,
      ContentType: contentType,
      ContentLength: contentSize,
      Metadata: {
        'x-content-hash': contentHash,
        'x-expiration-date': expirationDate.toISOString(),
      },
    });

    try {
      await this.s3Client.send(putCommand);
      
      return {
        storageKey,
        contentSize,
        contentHash,
        expirationDate,
      };
    } catch (error) {
      console.error('Failed to upload log content to S3:', {
        jobId,
        storageKey,
        error,
      });
      throw new Error(`Failed to upload log content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate presigned URL for log content
   */
  async generatePresignedUrl(storageKey: string, expiresIn: number = 3600): Promise<string> {
    const getCommand = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: storageKey,
    });

    try {
      return await getSignedUrl(this.s3Client, getCommand, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned URL:', {
        storageKey,
        error,
      });
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete log content from S3
   */
  async deleteLogContent(storageKey: string): Promise<void> {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.config.bucketName,
      Key: storageKey,
    });

    try {
      await this.s3Client.send(deleteCommand);
    } catch (error) {
      console.error('Failed to delete log content from S3:', {
        storageKey,
        error,
      });
      throw new Error(`Failed to delete log content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if log content exists in S3
   */
  async contentExists(storageKey: string): Promise<boolean> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: storageKey,
      });
      
      await this.s3Client.send(getCommand);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return false;
      }
      console.error('Error checking if content exists:', {
        storageKey,
        error,
      });
      throw error;
    }
  }

  /**
   * Create storage service instance from environment variables
   */
  static fromEnvironment(): StorageService {
    return new StorageService({
      bucketName: process.env.S3_BUCKET_NAME || 'ai-board-logs',
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
    });
  }
}

/**
 * Singleton storage service instance
 */
let storageServiceInstance: StorageService | null = null;

/**
 * Get or create storage service instance
 */
export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = StorageService.fromEnvironment();
  }
  return storageServiceInstance;
}