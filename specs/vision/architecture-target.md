# Target Architecture - Docker & Workers

## Overview

The target architecture uses **Docker containers** and **worker processes** for scalable, low-latency spec-kit execution. This approach provides better control, faster execution, and horizontal scalability compared to the MVP GitHub Actions approach.

**Key Benefits:**
- ✅ Low latency: ~5-10s execution time (vs 20-40s for GitHub Actions)
- ✅ Horizontal scalability: spawn multiple workers
- ✅ Full control over execution environment
- ✅ Better resource isolation and security
- ✅ Real-time job status updates via WebSockets

**Trade-offs:**
- ⚠️ Requires container infrastructure (Fly.io, Railway, Render)
- ⚠️ More complex deployment and monitoring
- ⚠️ Higher operational cost (~$20-50/month minimum)

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          User Browser                                    │
│  - Drag ticket to SPECIFY/PLAN/BUILD                                     │
│  - WebSocket connection for real-time updates                            │
└─────────────────────┬────────────────────────────────────────────────────┘
                      │ HTTPS POST /api/tickets/[id]/transition
                      │ WebSocket /ws/jobs
                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              Next.js API Routes + WebSocket Server                       │
│                        (Vercel Serverless)                               │
│  - Validate transition                                                   │
│  - Create job in PostgreSQL                                              │
│  - Enqueue job to Redis queue (BullMQ)                                   │
│  - Broadcast status via WebSocket                                        │
└─────────────────────┬───────────────┬───────────────────┬────────────────┘
                      │               │                   │
                      ▼               ▼                   ▼
         ┌─────────────────┐  ┌──────────────┐   ┌────────────────┐
         │  PostgreSQL     │  │   Redis      │   │   GitHub API   │
         │  (Neon/Supabase)│  │   (Upstash)  │   │   (Octokit)    │
         │                 │  │              │   │                │
         │ - Projects      │  │ - Job Queue  │   │ - Clone repo   │
         │ - Tickets       │  │ - Job Status │   │ - Fetch files  │
         │ - Jobs          │  │ - Locks      │   │ - Push commits │
         └─────────────────┘  └──────┬───────┘   └────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
         ┌─────────────────────┐         ┌─────────────────────┐
         │   Worker Process 1  │         │   Worker Process N  │
         │   (Fly.io Machine)  │         │   (Fly.io Machine)  │
         │                     │         │                     │
         │ 1. Poll Redis       │         │ 1. Poll Redis       │
         │ 2. Acquire lock     │         │ 2. Acquire lock     │
         │ 3. Spawn container  │         │ 3. Spawn container  │
         │ 4. Monitor          │         │ 4. Monitor          │
         │ 5. Update status    │         │ 5. Update status    │
         └──────────┬──────────┘         └──────────┬──────────┘
                    │                               │
                    ▼                               ▼
         ┌─────────────────────┐         ┌─────────────────────┐
         │  Docker Container   │         │  Docker Container   │
         │  (ephemeral)        │         │  (ephemeral)        │
         │                     │         │                     │
         │ - Clone repo        │         │ - Clone repo        │
         │ - Checkout branch   │         │ - Checkout branch   │
         │ - Run spec-kit      │         │ - Run spec-kit      │
         │ - Commit changes    │         │ - Commit changes    │
         │ - Push to GitHub    │         │ - Push to GitHub    │
         │ - Cleanup & destroy │         │ - Cleanup & destroy │
         └─────────────────────┘         └─────────────────────┘
```

## Component Architecture

### 1. API Layer (Next.js on Vercel)

**Responsibilities:**
- Handle HTTP requests from frontend
- Validate tickets and transitions
- Create job records in PostgreSQL
- Enqueue jobs to Redis
- Provide WebSocket server for real-time updates
- Serve spec files from GitHub API

**Implementation:**
```typescript
// app/api/tickets/[id]/transition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/db/client';

const specKitQueue = new Queue('speckit-jobs', {
  connection: redis,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ticketId = parseInt(params.id);
  const { targetStage } = await request.json();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { project: true },
  });

  const commandMap: Record<string, string> = {
    SPECIFY: 'specify',
    PLAN: 'plan',
    BUILD: 'implement',
  };

  const command = commandMap[targetStage];

  if (command) {
    // Create job
    const job = await prisma.job.create({
      data: {
        ticketId,
        command,
        status: 'pending',
        branch: `feature/ticket-${ticketId}`,
      },
    });

    // Enqueue to Redis
    await specKitQueue.add('execute', {
      jobId: job.id,
      ticketId,
      command,
      branch: `feature/ticket-${ticketId}`,
      repoUrl: ticket.project.githubRepoUrl,
    });

    return NextResponse.json({ success: true, jobId: job.id });
  }

  // No spec-kit command, just update stage
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { stage: targetStage },
  });

  return NextResponse.json({ success: true });
}
```

### VERIFY Stage PR Workflow

- On transition to VERIFY:
  - **Auto Mode**: Claude Code service (running inside worker) opens a PR from the feature branch to `main`, leaves structured review comments, and self-approves/merges once validations and tests succeed.
  - **Manual Mode**: Worker opens the PR but assigns human reviewers; merge occurs only after manual approval in GitHub.
- Persist PR metadata (`prUrl`, `branch`) so the dashboard can show real-time status.
- Ticket remains in VERIFY until merge callbacks fire.

### SHIP Stage Trigger

- Subscribe to GitHub webhooks via the GitHub App for `pull_request` and `check_suite` events.
- When a tracked PR merges into `main`, update the ticket to SHIP, capture deployment status, and enqueue optional post-merge tasks (e.g., cleanup branch).
- CI/CD hooks (Vercel, Fly.io deployment) execute automatically on merge.

### 2. Job Queue (Redis + BullMQ)

**Responsibilities:**
- Queue job execution requests
- Provide concurrency control
- Handle job retries on failure
- Track job progress

**Configuration:**
```typescript
// lib/queue/config.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '@/lib/redis';

export const specKitQueue = new Queue('speckit-jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 3600, // 7 days
    },
  },
});

export const queueEvents = new QueueEvents('speckit-jobs', {
  connection: redis,
});
```

### 3. Worker Process (Fly.io Machines)

**Responsibilities:**
- Poll Redis queue for pending jobs
- Spawn Docker containers
- Monitor container execution
- Update job status in PostgreSQL
- Handle errors and retries

**Implementation:**
```typescript
// workers/speckit-worker.ts
import { Worker } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from './db';
import { redis } from './redis';

const execAsync = promisify(exec);

const worker = new Worker(
  'speckit-jobs',
  async (job) => {
    const { jobId, ticketId, command, branch, repoUrl } = job.data;

    try {
      // Update job status to running
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'running' },
      });

      // Spawn Docker container
      const containerName = `speckit-${jobId}-${Date.now()}`;

      const dockerCmd = `
        docker run --rm --name ${containerName} \
          -e ANTHROPIC_API_KEY="${process.env.ANTHROPIC_API_KEY}" \
          -e GITHUB_TOKEN="${process.env.GITHUB_TOKEN}" \
          -e REPO_URL="${repoUrl}" \
          -e BRANCH="${branch}" \
          -e COMMAND="${command}" \
          speckit-runner:latest
      `;

      const { stdout, stderr } = await execAsync(dockerCmd);

      // Update job status to completed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          logs: stdout + stderr,
          completedAt: new Date(),
        },
      });

      return { success: true, logs: stdout };
    } catch (error) {
      // Update job status to failed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          logs: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 3, // Process up to 3 jobs simultaneously
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});
```

### 4. Docker Container (Ephemeral Execution Environment)

**Dockerfile:**
```dockerfile
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3.11 \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install spec-kit
RUN pip install uv && uv pip install spec-kit

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

**Entrypoint Script:**
```bash
#!/bin/bash
set -e

echo "🚀 Starting spec-kit execution"
echo "Repo: $REPO_URL"
echo "Branch: $BRANCH"
echo "Command: $COMMAND"

# Clone repository
echo "📦 Cloning repository..."
git clone -b $BRANCH $REPO_URL /workspace
cd /workspace

# Configure Git
git config user.name "ai-board[bot]"
git config user.email "bot@ai-board.app"

# Execute spec-kit command
echo "🤖 Executing /$COMMAND..."
case "$COMMAND" in
  specify)
    claude /specify
    ;;
  plan)
    claude /plan && claude /task
    ;;
  implement)
    claude /implement
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    exit 1
    ;;
esac

# Commit changes
echo "💾 Committing changes..."
git add .
if git diff --staged --quiet; then
  echo "ℹ️ No changes to commit"
else
  git commit -m "feat: $COMMAND execution by ai-board"
fi

# Push to remote
echo "⬆️ Pushing to GitHub..."
git push origin $BRANCH

echo "✅ Spec-kit execution completed successfully"
```

### 5. WebSocket Server (Real-time Updates)

**Implementation:**
```typescript
// app/api/ws/route.ts
import { Server } from 'socket.io';
import { queueEvents } from '@/lib/queue/config';

const io = new Server({
  cors: { origin: '*' },
});

// Listen to queue events
queueEvents.on('completed', ({ jobId }) => {
  io.emit('job:completed', { jobId });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  io.emit('job:failed', { jobId, error: failedReason });
});

queueEvents.on('progress', ({ jobId, data }) => {
  io.emit('job:progress', { jobId, progress: data });
});

export { io };
```

**Frontend Integration:**
```typescript
// lib/hooks/useJobStatus.ts
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useJobStatus(jobId: number) {
  const [status, setStatus] = useState<'pending' | 'running' | 'completed' | 'failed'>('pending');

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL);

    socket.on('job:completed', (data) => {
      if (data.jobId === jobId) {
        setStatus('completed');
      }
    });

    socket.on('job:failed', (data) => {
      if (data.jobId === jobId) {
        setStatus('failed');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  return status;
}
```

## Infrastructure Stack

### Core Services

| Service | Provider | Purpose | Cost |
|---------|----------|---------|------|
| **Frontend/API** | Vercel | Next.js hosting | $0 (Hobby) or $20/month (Pro) |
| **PostgreSQL** | Neon | Primary database | $0 (Free) or $19/month (Scale) |
| **Redis** | Upstash | Job queue & cache | $0 (Free) or $10/month (Pay-as-you-go) |
| **Workers** | Fly.io Machines | Docker host | ~$20-40/month (2-4 machines) |
| **Docker Registry** | Docker Hub | Container images | $0 (Free tier) |
| **Claude API** | Anthropic | Spec generation | Pay-as-you-go (~$10-30/month) |

### Deployment Architecture

```
                     ┌─────────────────────────┐
                     │   Cloudflare CDN        │
                     │   (Optional)            │
                     └──────────┬──────────────┘
                                │
                     ┌──────────▼──────────────┐
                     │   Vercel Edge Network   │
                     │   - Next.js Frontend    │
                     │   - API Routes          │
                     │   - WebSocket Server    │
                     └──────────┬──────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Neon Postgres  │  │  Upstash Redis   │  │  GitHub API      │
│  - Multi-region │  │  - Global Edge   │  │  - REST API      │
│  - Auto-scale   │  │  - Durable Queue │  │  - Git operations│
└─────────────────┘  └──────────────────┘  └──────────────────┘
                                │
                     ┌──────────▼──────────────┐
                     │   Fly.io Global         │
                     │   Worker Machines       │
                     │                         │
                     │  ┌──────┐  ┌──────┐    │
                     │  │ VM 1 │  │ VM 2 │    │
                     │  └──┬───┘  └──┬───┘    │
                     └─────┼─────────┼─────────┘
                           │         │
                     ┌─────▼─────────▼──────┐
                     │  Docker Containers   │
                     │  (Ephemeral)         │
                     └──────────────────────┘
```

## Deployment Guide

### 1. Build Docker Image

```bash
# Build image
docker build -t speckit-runner:latest -f Dockerfile.worker .

# Test locally
docker run --rm \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e GITHUB_TOKEN="ghp_..." \
  -e REPO_URL="https://github.com/owner/repo" \
  -e BRANCH="main" \
  -e COMMAND="specify" \
  speckit-runner:latest

# Push to Docker Hub
docker tag speckit-runner:latest your-username/speckit-runner:latest
docker push your-username/speckit-runner:latest
```

### 2. Deploy Workers to Fly.io

**Create `fly.toml`:**
```toml
app = "aiboard-workers"
primary_region = "iad"

[build]
  image = "your-username/speckit-runner:latest"

[env]
  REDIS_URL = "redis://..."

[[services]]
  internal_port = 3000
  protocol = "tcp"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

**Deploy:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Create app
fly apps create aiboard-workers

# Set secrets
fly secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  GITHUB_TOKEN="ghp_..." \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..."

# Deploy
fly deploy

# Scale workers
fly scale count 2 --region iad
```

### 3. Setup Redis Queue (Upstash)

```bash
# Create account at https://upstash.com
# Create Redis database
# Copy connection URL

# Update .env
REDIS_URL="redis://default:password@region.upstash.io:6379"
```

### 4. Configure Vercel

```bash
# Set environment variables in Vercel dashboard
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
GITHUB_TOKEN="ghp_..."
ANTHROPIC_API_KEY="sk-ant-..."
```

## Monitoring & Observability

### Logging

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Usage in worker
logger.info({ jobId, command }, 'Starting job execution');
logger.error({ jobId, error }, 'Job execution failed');
```

### Metrics

```typescript
// lib/metrics.ts
import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();

export const jobsTotal = new Counter({
  name: 'speckit_jobs_total',
  help: 'Total number of spec-kit jobs',
  labelNames: ['command', 'status'],
  registers: [register],
});

export const jobDuration = new Histogram({
  name: 'speckit_job_duration_seconds',
  help: 'Job execution duration in seconds',
  labelNames: ['command'],
  registers: [register],
});

// Expose metrics endpoint
// app/api/metrics/route.ts
export async function GET() {
  return new Response(await register.metrics(), {
    headers: { 'Content-Type': register.contentType },
  });
}
```

### Error Tracking (Sentry)

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Worker error tracking
worker.on('failed', (job, err) => {
  Sentry.captureException(err, {
    tags: {
      jobId: job?.id,
      command: job?.data.command,
    },
  });
});
```

## Scaling Strategy

### Horizontal Scaling

```bash
# Scale workers based on queue depth
fly scale count 4 --region iad  # US East
fly scale count 2 --region fra  # Europe
```

### Auto-scaling (Advanced)

```typescript
// workers/autoscaler.ts
import { Queue } from 'bullmq';
import { exec } from 'child_process';

const queue = new Queue('speckit-jobs');

setInterval(async () => {
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();

  const load = waiting + active;

  if (load > 10) {
    // Scale up
    exec('fly scale count 4');
  } else if (load < 2) {
    // Scale down
    exec('fly scale count 1');
  }
}, 60000); // Check every minute
```

## Cost Optimization

### Strategies

1. **Container Image Caching**: Pre-build images with dependencies
2. **Worker Pool**: Keep 1-2 workers running, scale as needed
3. **Redis TTL**: Set expiration on completed jobs
4. **Database Indexing**: Optimize query performance
5. **CDN Caching**: Cache static spec files

### Cost Comparison

| Component | Low Traffic | Medium Traffic | High Traffic |
|-----------|-------------|----------------|--------------|
| Vercel | $0 | $20/month | $20/month |
| Neon Postgres | $0 | $19/month | $69/month |
| Upstash Redis | $0 | $10/month | $30/month |
| Fly.io Workers | $10/month | $40/month | $100/month |
| Claude API | $5/month | $20/month | $100/month |
| **Total** | **$15/month** | **$109/month** | **$319/month** |

## Security Considerations

### Container Isolation

- Run containers with `--security-opt=no-new-privileges`
- Use read-only root filesystem where possible
- Limit container resources (CPU, memory)

### Secrets Management

```typescript
// Use environment variables, never hardcode
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Encrypt sensitive data in database
import { encrypt, decrypt } from '@/lib/crypto';

const encryptedToken = encrypt(token, process.env.ENCRYPTION_KEY);
```

### Network Security

- Whitelist worker IPs in GitHub
- Use VPC peering for database connections
- Enable TLS for all external connections

## Migration from MVP

### Phase 1: Parallel Run
1. Deploy workers alongside GitHub Actions
2. Route 10% of traffic to new system
3. Monitor performance and errors
4. Gradually increase traffic percentage

### Phase 2: Full Migration
1. Route 100% of traffic to workers
2. Disable GitHub Actions workflow
3. Archive old job logs

### Phase 3: Optimization
1. Implement auto-scaling
2. Add performance monitoring
3. Optimize container startup time

## Next Steps

- Add APM (Application Performance Monitoring)
- Implement circuit breakers for external APIs
- Add job prioritization (urgent vs. normal)
- Implement job cancellation
- Add job scheduling (delayed execution)

See `feasibility.md` for comparison with MVP approach.
