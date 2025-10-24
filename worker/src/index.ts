import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);
const prisma = new PrismaClient();

/**
 * Execute Claude command with real-time output logging
 */
function execClaude(command: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Keep CLAUDE_CODE_OAUTH_TOKEN - it's needed for non-interactive auth with Max plan
    const env = { ...process.env };

    // Log token presence for debugging
    console.log('[Worker] CLAUDE_CODE_OAUTH_TOKEN present in exec env:', !!env.CLAUDE_CODE_OAUTH_TOKEN);

    const child = spawn('/bin/sh', ['-c', command], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    // Close stdin immediately
    child.stdin.end();

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      console.log('[Worker] Claude stdout:', text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      console.log('[Worker] Claude stderr:', text);
    });

    child.on('close', (code) => {
      console.log('[Worker] Claude process exited with code:', code);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}`) as any;
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    child.on('error', (err) => {
      console.log('[Worker] Claude process error:', err);
      reject(err);
    });

    // Log if process is still running after 30 seconds
    setTimeout(() => {
      if (!child.killed) {
        console.log('[Worker] Claude still running after 30s, stdout so far:', stdout.substring(0, 500));
      }
    }, 30000);
  });
}

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
        // The Claude command /speckit.specify will call create-new-feature.sh internally
        // We just need to pass the right parameters to Claude

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
          // Legacy text mode - match GitHub Actions format exactly
          console.log('[Worker] Using legacy text format (no policy)');
          const prompt = `/speckit.specify #${ticketId} ${job.data.ticketTitle}\n${job.data.ticketDescription}`;

          console.log('[Worker] Executing Claude command...');
          console.log('[Worker] Prompt:', prompt.substring(0, 200));
          console.log('[Worker] Working directory:', workspace);
          console.log('[Worker] PATH:', process.env.PATH);
          console.log('[Worker] CLAUDE_CODE_OAUTH_TOKEN present:', !!process.env.CLAUDE_CODE_OAUTH_TOKEN);

          // Test Claude accessibility
          console.log('[Worker] Testing Claude accessibility...');
          try {
            const { stdout: claudeVersion } = await execAsync(`cd ${workspace} && which claude && claude --version`);
            console.log('[Worker] ✅ Claude found:', claudeVersion.trim());
          } catch (versionError: any) {
            console.error('[Worker] ❌ Claude not accessible:', versionError.message);
            throw new Error(`Claude CLI not found in PATH. Make sure Claude is installed and accessible.`);
          }

          try {
            let result;

            // Use execClaude with stdin closed to prevent interactive mode blocking
            const claudeCommand = imagePaths && imageCount > 0
              ? `claude --dangerously-skip-permissions "${prompt}" ${imagePaths}`
              : `claude --dangerously-skip-permissions "${prompt}"`;

            console.log('[Worker] Full command:', claudeCommand);
            console.log('[Worker] Working directory:', workspace);
            console.log('[Worker] Executing with closed stdin to prevent interactive blocking...');

            result = await execClaude(claudeCommand, workspace);

            console.log('[Worker] ✅ Claude execution completed successfully');
            console.log('[Worker] Claude stdout length:', result.stdout.length);
            console.log('[Worker] Claude stdout (first 500 chars):', result.stdout.substring(0, 500));
            console.log('[Worker] Claude stdout (last 500 chars):', result.stdout.substring(Math.max(0, result.stdout.length - 500)));
            if (result.stderr) {
              console.log('[Worker] Claude stderr:', result.stderr);
            }
          } catch (error: any) {
            console.error('[Worker] ❌ Claude execution failed');
            console.error('[Worker] Error type:', error.constructor.name);
            console.error('[Worker] Error message:', error.message);
            console.error('[Worker] Exit code:', error.code);
            console.error('[Worker] Signal:', error.signal);
            if (error.stdout) {
              console.error('[Worker] Stdout before error:', error.stdout.substring(0, 1000));
            }
            if (error.stderr) {
              console.error('[Worker] Stderr:', error.stderr);
            }
            throw error;
          }
        }

        // After Claude execution, get the current branch (Claude created it)
        const { stdout: branchOutput } = await execAsync(`cd ${workspace} && git branch --show-current`);
        currentBranch = branchOutput.trim();
        console.log(`[Worker] Claude created branch: ${currentBranch}`);

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
        // Claude's /quick-impl command will handle branch creation internally
        // We just pass the ticket info to Claude
        const prompt = `#${ticketId} ${job.data.ticketTitle}\n${job.data.ticketDescription}`;

        console.log('[Worker] Executing quick-impl command');
        await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "/quick-impl ${prompt}"`);

        // After Claude execution, get the current branch (Claude created it)
        const { stdout: branchOutput } = await execAsync(`cd ${workspace} && git branch --show-current`);
        currentBranch = branchOutput.trim();
        console.log(`[Worker] Claude created branch: ${currentBranch}`);

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