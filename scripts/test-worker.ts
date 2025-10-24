#!/usr/bin/env bun

/**
 * Test script to verify worker queue is functioning
 * Run with: bun scripts/test-worker.ts
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Create Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Create queue instance
const queue = new Queue('ai-board-workflows', { connection });

async function testEnqueue() {
  console.log('🧪 Testing worker queue...\n');

  // Check Redis connection
  try {
    await connection.ping();
    console.log('✅ Redis connection successful');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    process.exit(1);
  }

  // Create a test job
  const testJob = {
    ticketId: 999,
    projectId: 1,
    command: 'specify',
    ticketTitle: 'Test Worker Queue',
    ticketDescription: 'This is a test job to verify the worker is functioning',
    branch: null,
    githubOwner: 'test',
    githubRepo: 'test-repo',
    jobId: 999,
  };

  try {
    // Enqueue the job
    const job = await queue.add('test', testJob, {
      jobId: `test-${Date.now()}`,
    });

    console.log(`✅ Job enqueued successfully with ID: ${job.id}`);
    console.log('\n📋 Job details:');
    console.log(JSON.stringify(testJob, null, 2));

    // Check queue status
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();

    console.log('\n📊 Queue status:');
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}`);

  } catch (error) {
    console.error('❌ Failed to enqueue job:', error);
    process.exit(1);
  }

  // Clean up
  await queue.close();
  await connection.quit();

  console.log('\n✨ Test completed successfully!');
  console.log('Check the worker logs to see if the job was processed.');
}

// Run the test
testEnqueue().catch(console.error);