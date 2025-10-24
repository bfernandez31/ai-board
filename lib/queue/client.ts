import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Create Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Create queue instance
export const workflowQueue = new Queue('ai-board-workflows', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
});

// Queue health check
export async function isQueueHealthy(): Promise<boolean> {
  try {
    await workflowQueue.client.ping();
    return true;
  } catch (error) {
    console.error('Redis connection error:', error);
    return false;
  }
}

// Cleanup function for tests
export async function cleanupQueue() {
  await workflowQueue.obliterate({ force: true });
  await workflowQueue.close();
  await connection.quit();
}