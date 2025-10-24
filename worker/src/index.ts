import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Workspace directory
const WORKSPACES_DIR = process.env.WORKSPACES_DIR || '/workspaces';

interface WorkflowJobData {
  ticketId: number;
  projectId: number;
  command: string;
  ticketTitle: string;
  ticketDescription: string;
  branch: string | null;
  githubOwner: string;
  githubRepo: string;
  jobId: number;
}

/**
 * Main worker processor
 */
async function processJob(job: Job<WorkflowJobData>) {
  const { ticketId, command, githubOwner, githubRepo, branch, jobId } = job.data;

  console.log(`[Worker] Processing job ${job.id} - Command: ${command} for ticket ${ticketId}`);

  try {
    // Update job status to RUNNING
    await updateJobStatus(jobId, 'RUNNING');

    // Setup workspace
    const workspace = path.join(WORKSPACES_DIR, `ticket-${ticketId}`);
    const repoUrl = `https://github.com/${githubOwner}/${githubRepo}.git`;

    // Ensure workspace directory exists
    if (!existsSync(WORKSPACES_DIR)) {
      mkdirSync(WORKSPACES_DIR, { recursive: true });
    }

    // Clone or pull repository
    if (!existsSync(workspace)) {
      console.log(`[Worker] Cloning repository to ${workspace}`);
      await execAsync(`git clone ${repoUrl} ${workspace}`);
    } else {
      console.log(`[Worker] Pulling latest changes in ${workspace}`);
      await execAsync(`cd ${workspace} && git fetch origin && git reset --hard origin/main`);
    }

    // Handle branch management
    let workingBranch = branch;
    if (!branch && command === 'specify') {
      // Create new branch for specify command
      workingBranch = `${ticketId}-${slugify(job.data.ticketTitle)}`;
      console.log(`[Worker] Creating new branch: ${workingBranch}`);
      await execAsync(`cd ${workspace} && git checkout -b ${workingBranch}`);
    } else if (branch) {
      // Checkout existing branch
      console.log(`[Worker] Checking out branch: ${branch}`);
      try {
        await execAsync(`cd ${workspace} && git checkout ${branch}`);
      } catch (error) {
        // If branch doesn't exist locally, fetch and checkout
        await execAsync(`cd ${workspace} && git fetch origin ${branch}:${branch} && git checkout ${branch}`);
      }
    }

    // Map command to Claude CLI command
    const claudeCommand = mapToClaudeCommand(command);

    // TODO: Execute Claude command (requires Claude CLI setup)
    console.log(`[Worker] Would execute: claude ${claudeCommand}`);

    // For now, create a placeholder file to test the workflow
    const testFile = path.join(workspace, `test-${command}-${Date.now()}.md`);
    await execAsync(`echo "# Test file for ${command}\n\nTicket: ${job.data.ticketTitle}" > ${testFile}`);

    // Stage, commit and push changes
    const commitMessage = `${command}: ${job.data.ticketTitle}`;
    await execAsync(`cd ${workspace} && git add .`);
    await execAsync(`cd ${workspace} && git commit -m "${commitMessage}" || true`); // || true to handle no changes

    if (workingBranch) {
      await execAsync(`cd ${workspace} && git push origin ${workingBranch}`);
    }

    // Update ticket branch if new branch was created
    if (!branch && workingBranch) {
      await updateTicketBranch(ticketId, projectId, workingBranch);
    }

    // Update job status to COMPLETED
    await updateJobStatus(jobId, 'COMPLETED');

    console.log(`[Worker] Job ${job.id} completed successfully`);
    return { success: true, branch: workingBranch };

  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);

    // Update job status to FAILED
    await updateJobStatus(jobId, 'FAILED', error instanceof Error ? error.message : 'Unknown error');

    throw error;
  }
}

/**
 * Map internal commands to Claude CLI commands
 */
function mapToClaudeCommand(command: string): string {
  const commandMap: Record<string, string> = {
    'specify': '/speckit.specify',
    'plan': '/speckit.plan',
    'implement': '/speckit.implement',
    'quick-impl': '/quick-impl',
    'comment-specify': '/ai-board-assist specify',
    'comment-plan': '/ai-board-assist plan',
    'comment-build': '/ai-board-assist build',
    'comment-verify': '/ai-board-assist verify',
  };
  return commandMap[command] || command;
}

/**
 * Convert title to URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
    .substring(0, 50); // Limit length
}

/**
 * Update job status via API
 */
async function updateJobStatus(jobId: number, status: string, logs?: string) {
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const token = process.env.WORKFLOW_API_TOKEN;

  const response = await fetch(`${apiUrl}/api/jobs/${jobId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify({ status, logs }),
  });

  if (!response.ok) {
    console.error(`Failed to update job status: ${response.status} ${response.statusText}`);
  }
}

/**
 * Update ticket branch via API
 */
async function updateTicketBranch(ticketId: number, projectId: number, branch: string) {
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const token = process.env.WORKFLOW_API_TOKEN;

  const response = await fetch(`${apiUrl}/api/projects/${projectId}/tickets/${ticketId}/branch`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify({ branch }),
  });

  if (!response.ok) {
    console.error(`Failed to update ticket branch: ${response.status} ${response.statusText}`);
  }
}

// Create and start the worker
const worker = new Worker('ai-board-workflows', processJob, {
  connection,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1'),
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

// Worker event listeners
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[Worker] AI Board worker started and waiting for jobs...');
console.log(`[Worker] Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
console.log(`[Worker] API: ${process.env.API_URL || 'http://localhost:3000'}`);
console.log(`[Worker] Concurrency: ${process.env.WORKER_CONCURRENCY || '1'}`);
console.log(`[Worker] Workspaces: ${WORKSPACES_DIR}`);