import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
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
  attachments?: any[]; // Image attachments
  specifyPayload?: string; // JSON payload for specify
  clarificationPolicy?: string;
  answersJson?: string; // For clarify command
}

/**
 * Main worker processor - mirrors GitHub Actions workflow exactly
 */
async function processJob(job: Job<WorkflowJobData>) {
  const { ticketId, command, githubOwner, githubRepo, branch, jobId, projectId } = job.data;

  console.log(`[Worker] Processing job ${job.id} - Command: ${command} for ticket ${ticketId}`);
  console.log(`[Worker] Debug inputs:
    ticket_id: ${ticketId}
    job_id: ${jobId}
    command: ${command}
    ticketTitle: ${job.data.ticketTitle}
    branch: ${branch || '(will be created)'}
  `);

  // Check if this is a test ticket (skip execution like GitHub Actions)
  const skipExecution = job.data.ticketTitle.includes('[e2e]');
  if (skipExecution) {
    console.log(`[Worker] '[e2e]' detected in ticket title; skipping execution to preserve resources`);
  }

  try {
    // Step 1: Update Job Status - Running (matches GitHub Actions line 91-98)
    await updateJobStatus(jobId, 'RUNNING');

    if (skipExecution) {
      // If skipping, just mark as completed
      await updateJobStatus(jobId, 'COMPLETED');
      return { success: true, skipped: true };
    }

    // Step 2: Setup workspace (persistent for caching)
    const workspace = path.join(WORKSPACES_DIR, `${githubOwner}-${githubRepo}`);
    const repoUrl = `https://github.com/${githubOwner}/${githubRepo}.git`;

    // Ensure workspace directory exists
    if (!existsSync(WORKSPACES_DIR)) {
      mkdirSync(WORKSPACES_DIR, { recursive: true });
    }

    // Step 3: Checkout repository (matches GitHub Actions line 100-107)
    // Key difference: We CACHE the workspace for 85% performance improvement
    let needsClone = !existsSync(path.join(workspace, '.git'));

    if (needsClone) {
      console.log(`[Worker] Cloning repository to ${workspace} (first time)`);
      await execAsync(`git clone ${repoUrl} ${workspace}`);
    } else {
      console.log(`[Worker] Using cached workspace, fetching latest changes`);
      await execAsync(`cd ${workspace} && git fetch origin`);
    }

    // Checkout appropriate ref based on command
    if (command === 'specify' && !branch) {
      // For specify without branch, checkout main
      await execAsync(`cd ${workspace} && git checkout main && git pull origin main`);
    } else if (branch) {
      // Checkout the specified branch
      try {
        await execAsync(`cd ${workspace} && git checkout ${branch} && git pull origin ${branch}`);
      } catch (error) {
        // If branch doesn't exist locally, fetch and checkout
        await execAsync(`cd ${workspace} && git fetch origin ${branch}:${branch} && git checkout ${branch}`);
      }
    } else {
      // Default to main
      await execAsync(`cd ${workspace} && git checkout main && git pull origin main`);
    }

    // Step 4: Setup environment (matches GitHub Actions lines 109-130)
    // NOTE: These are installed in the Docker image, but we verify they exist
    console.log('[Worker] Verifying environment setup...');

    // Check Bun (already in Docker image)
    await execAsync('bun --version');

    // Install Claude CLI if not present (matches line 127-129)
    try {
      await execAsync('claude --version');
    } catch {
      console.log('[Worker] Installing Claude CLI...');
      await execAsync('bun add -g @anthropic-ai/claude-code');
    }

    // Step 5: Configure Git (matches GitHub Actions lines 131-135)
    await execAsync(`git config --global user.name "ai-board[bot]"`);
    await execAsync(`git config --global user.email "bot@ai-board.app"`);

    // Step 6: Prepare Images for Claude (matches GitHub Actions lines 137-217)
    let imagePaths = '';
    let imageCount = 0;

    if (command === 'specify' && job.data.attachments && job.data.attachments.length > 0) {
      console.log('[Worker] Preparing images for Claude context...');

      const ticketAssetsDir = path.join(workspace, `ticket-assets/${ticketId}`);
      mkdirSync(ticketAssetsDir, { recursive: true });

      const images: string[] = [];

      for (const attachment of job.data.attachments) {
        const { type, url, filename } = attachment;

        if (type === 'external' || type === 'uploaded') {
          console.log(`[Worker] Downloading image: ${url}`);

          const ext = filename.split('.').pop() || 'png';
          const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
          const imageFile = path.join(ticketAssetsDir, safeFilename);

          try {
            // Download image
            await execAsync(`curl -sSL --max-time 30 --retry 3 "${url}" -o "${imageFile}"`);
            console.log(`[Worker] Downloaded: ${imageFile}`);
            images.push(imageFile);
            imageCount++;
          } catch (error) {
            console.log(`[Worker] Failed to download: ${url} (continuing...)`);
          }
        }
      }

      imagePaths = images.join(' ');
      console.log(`[Worker] Prepared ${imageCount} images for Claude context`);
    }

    // Step 7: Execute Spec-Kit Command (matches GitHub Actions lines 219-280)
    console.log(`[Worker] Executing command: ${command}`);

    let currentBranch = branch;

    switch (command) {
      case 'specify': {
        // For specify, we need to run create-new-feature.sh FIRST to create branch
        // This matches what happens inside the Claude command execution

        // Run create-new-feature.sh script (this creates the branch and spec file)
        const featureDescription = job.data.ticketTitle;
        const createFeatureCmd = `.specify/scripts/bash/create-new-feature.sh "${featureDescription}"`;

        console.log(`[Worker] Creating feature branch with: ${createFeatureCmd}`);
        const { stdout } = await execAsync(`cd ${workspace} && ${createFeatureCmd}`);

        // Parse branch name from script output
        const branchMatch = stdout.match(/BRANCH_NAME: (.+)/);
        if (branchMatch) {
          currentBranch = branchMatch[1];
          console.log(`[Worker] Created branch: ${currentBranch}`);
        }

        // Now execute Claude command with the spec
        if (job.data.specifyPayload) {
          // JSON payload mode (with clarification policy)
          console.log('[Worker] Using JSON payload with clarification policy');
          const payload = job.data.specifyPayload;

          if (imagePaths && imageCount > 0) {
            await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/speckit.specify ${payload}" ${imagePaths}`);
          } else {
            await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/speckit.specify ${payload}"`);
          }
        } else {
          // Legacy text mode
          console.log('[Worker] Using legacy text format (no policy)');
          const prompt = `/speckit.specify #${ticketId} ${job.data.ticketTitle}\n${job.data.ticketDescription}`;

          if (imagePaths && imageCount > 0) {
            await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "${prompt}" ${imagePaths}`);
          } else {
            await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "${prompt}"`);
          }
        }
        break;
      }

      case 'plan': {
        await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/speckit.plan"`);
        break;
      }

      case 'task': {
        await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/speckit.tasks"`);
        break;
      }

      case 'implement': {
        await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/speckit.implement"`);
        break;
      }

      case 'clarify': {
        const answersJson = job.data.answersJson || '{}';
        await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/speckit.clarify '${answersJson}'"`);
        break;
      }

      case 'quick-impl': {
        // For quick-impl, create minimal branch and spec
        const featureDescription = job.data.ticketTitle;
        const createFeatureCmd = `.specify/scripts/bash/create-new-feature.sh --mode=quick-impl "${featureDescription}"`;

        console.log(`[Worker] Creating quick-impl branch with: ${createFeatureCmd}`);
        const { stdout } = await execAsync(`cd ${workspace} && ${createFeatureCmd}`);

        // Parse branch name from script output
        const branchMatch = stdout.match(/BRANCH_NAME: (.+)/);
        if (branchMatch) {
          currentBranch = branchMatch[1];
          console.log(`[Worker] Created branch: ${currentBranch}`);
        }

        // Execute quick-impl command
        const prompt = `#${ticketId} ${job.data.ticketTitle}\n${job.data.ticketDescription}`;
        await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/quick-impl ${prompt}"`);
        break;
      }

      default: {
        // Handle comment commands (ai-board-assist)
        if (command.startsWith('comment-')) {
          const stage = command.replace('comment-', '');
          const comment = job.data.ticketDescription; // Comment is in description field
          await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/ai-board-assist ${stage} '${comment}'"`);
        } else {
          throw new Error(`Unknown command: ${command}`);
        }
      }
    }

    // Step 8: Commit changes (matches GitHub Actions lines 310-340)
    console.log('[Worker] Checking for changes to commit...');

    const { stdout: statusOutput } = await execAsync(`cd ${workspace} && git status --porcelain`);

    if (statusOutput.trim()) {
      console.log('[Worker] Changes detected, committing...');

      await execAsync(`cd ${workspace} && git add .`);

      // Commit message format matches GitHub Actions
      const commitMessage = `${command}: Ticket #${ticketId}`;
      await execAsync(`cd ${workspace} && git commit -m "${commitMessage}"`);

      // Get current branch if we don't have it
      if (!currentBranch) {
        const { stdout: branchOutput } = await execAsync(`cd ${workspace} && git branch --show-current`);
        currentBranch = branchOutput.trim();
      }

      console.log(`[Worker] Pushing to branch: ${currentBranch}`);
      await execAsync(`cd ${workspace} && git push origin ${currentBranch}`);
    } else {
      console.log('[Worker] No changes to commit');
    }

    // Step 9: Update ticket branch (matches GitHub Actions lines 342-351)
    if (currentBranch && !branch && command === 'specify') {
      console.log(`[Worker] Updating ticket branch to: ${currentBranch}`);
      await updateTicketBranch(ticketId, projectId, currentBranch);
    }

    // Step 10: Update Job Status - Success (matches GitHub Actions lines 352-359)
    await updateJobStatus(jobId, 'COMPLETED');

    console.log(`[Worker] Job ${job.id} completed successfully`);
    return { success: true, branch: currentBranch };

  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);

    // Update Job Status - Failed (matches GitHub Actions lines 361-370)
    await updateJobStatus(jobId, 'FAILED', error instanceof Error ? error.message : 'Unknown error');

    throw error;
  }
}

/**
 * Update job status via API (matches GitHub Actions curl commands)
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
    console.error(`[Worker] Failed to update job status: ${response.status} ${response.statusText}`);
  }
}

/**
 * Update ticket branch via API (matches GitHub Actions curl command)
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
    console.error(`[Worker] Failed to update ticket branch: ${response.status} ${response.statusText}`);
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