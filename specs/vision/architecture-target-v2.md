# Target Architecture V2 - Platform-Agnostic Worker System

## Overview

The V2 architecture replaces GitHub Actions with a **platform-agnostic worker system** based on Redis queue and persistent workers. This approach provides:

- ✅ **Platform independence**: Works with GitHub, GitLab, Bitbucket, any Git provider
- ✅ **Local E2E testing**: Complete workflow execution on localhost
- ✅ **Low latency**: 3-15s execution time (vs 20-40s for GitHub Actions)
- ✅ **Horizontal scalability**: Add workers by spawning containers
- ✅ **Unified codebase**: Same worker code for local development and production
- ✅ **Workspace caching**: Reuse cloned repositories for iterative work

**Key Benefits:**
- ⚡ **85% faster iteration**: 3s for cached workspaces vs 30s+ for GitHub Actions
- 🌐 **Multi-platform support**: Not locked to GitHub ecosystem
- 💰 **Cost-effective**: ~$15-30/month for production (vs GitHub Actions minutes)
- 🧪 **Developer experience**: Test full workflow locally without cloud dependencies

**Trade-offs:**
- ⚠️ Requires Redis infrastructure (Upstash in production, local Docker in dev)
- ⚠️ Additional operational complexity (worker monitoring, queue management)
- ⚠️ Higher minimum cost (~$15/month vs $0 for GitHub Actions free tier)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│  - Drag ticket between stages                           │
│  - @ai-board mentions in comments                       │
│  - Real-time job status updates                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ API Request
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Layer (Vercel)                  │
│  - Validate transitions                                 │
│  - Create Job record in PostgreSQL                      │
│  - Enqueue job to Redis queue (BullMQ)                  │
│  - Return immediately (async execution)                 │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Job metadata
                   ▼
┌─────────────────────────────────────────────────────────┐
│                Redis Queue (Upstash/Local)               │
│  - Job queue with priority and retry logic              │
│  - Durable persistence                                  │
│  - Concurrency control                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Worker polls queue
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Worker Service (Railway/Local)              │
│  - Poll Redis for pending jobs                          │
│  - Manage workspace cache (TTL-based)                   │
│  - Execute Claude CLI commands                          │
│  - Git operations (clone, commit, push)                 │
│  - Call API back to update status                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Status updates via HTTPS
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Layer (Vercel)                  │
│  PATCH /api/jobs/:id/status                             │
│  PATCH /api/tickets/:id/branch                          │
│  - Update Job status (RUNNING → COMPLETED/FAILED)       │
│  - Update Ticket metadata                               │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Client polling (2s interval)
                   ▼
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│  - Display job status in real-time                      │
│  - Show progress indicators                             │
│  - Handle errors and retries                            │
└─────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. API Layer (Next.js on Vercel)

**Responsibilities:**
- Handle HTTP requests from frontend (ticket transitions, comments)
- Validate requests and check permissions
- Create Job records in PostgreSQL with PENDING status
- Enqueue jobs to Redis queue with metadata
- Provide status endpoints for frontend polling
- Accept status updates from workers via authenticated API

**Key Endpoints:**
- `POST /api/projects/:projectId/tickets/:id/transition` - Trigger workflow
- `GET /api/projects/:projectId/jobs/status` - Poll job status (2s interval)
- `PATCH /api/jobs/:id/status` - Worker updates job status (authenticated)
- `PATCH /api/tickets/:id/branch` - Worker updates ticket branch (authenticated)

**Authentication:**
- User requests: NextAuth session cookies
- Worker requests: Bearer token (`WORKFLOW_API_TOKEN`)

### 2. Job Queue (Redis + BullMQ)

**Responsibilities:**
- Queue job execution requests with metadata
- Provide durable persistence (jobs survive worker restarts)
- Handle concurrency control (max N parallel jobs)
- Implement retry logic with exponential backoff
- Track job progress and status

**Configuration:**
- **Queue name**: `ai-board-workflows`
- **Retry attempts**: 3 with exponential backoff (5s, 10s, 20s)
- **Job retention**: 100 completed jobs (24h), 500 failed jobs (7 days)
- **Concurrency**: Configurable per worker (default: 3)

**Job Types:**
- `execute-workflow` - Run spec-kit commands (specify, plan, implement)
- `cleanup-workspace` - Clean up workspace for shipped tickets

**Infrastructure:**
- **Local dev**: Redis via Docker Compose (localhost:6379)
- **Production**: Upstash Redis (managed, serverless, global edge)

### 3. Worker Service (Node.js Container)

**Responsibilities:**
- Poll Redis queue for pending jobs
- Manage workspace cache with TTL-based retention (24h)
- Clone/reuse Git repositories
- Execute Claude CLI commands in workspace context
- Commit and push changes to Git
- Call API back to update job status and ticket metadata
- Handle errors and logging

**Workspace Management:**
- **Cache location**: `/tmp/ai-board-workspaces/ticket-{id}`
- **TTL**: 24 hours from last use
- **Cleanup strategy**: Automatic hourly cleanup of expired workspaces
- **Reuse logic**: If workspace exists and < 24h old, reuse with `git pull`

**Execution Flow:**
1. Poll Redis queue for job
2. Check if workspace exists for ticket
3. **If exists + fresh (< 24h)**: Reuse workspace (3-5s total)
4. **If expired or missing**: Clone repository (15s total)
5. Execute Claude CLI command in workspace
6. Commit and push changes
7. Update job status via API (COMPLETED/FAILED)

**Infrastructure:**
- **Local dev**: Docker container with mounted volumes
- **Production**: Railway container with persistent disk

### 4. Database (PostgreSQL)

**Key Tables:**
- **Job**: Tracks workflow execution (status, logs, timestamps)
- **Ticket**: Links to active Job, stores branch name
- **Project**: GitHub repository metadata (owner, repo)

**Job Lifecycle:**
```
PENDING → RUNNING → COMPLETED
                 ↘ FAILED
                 ↘ CANCELLED
```

---

## Execution Scenarios

### Scenario 1: Fresh Ticket (First Workflow)

```
User Action:
  Drag ticket from INBOX → SPECIFY

API Processing (localhost:3000 or production):
  1. Create Job (status: PENDING)
  2. Enqueue to Redis: { jobId, ticketId, command: "specify", ... }
  3. Return 200 OK immediately

Worker Processing:
  1. Poll Redis queue (< 1s)
  2. Update Job status → RUNNING (via API)
  3. No workspace exists → Clone repository (15s)
  4. Execute: /speckit.specify
  5. Commit changes
  6. Push to new feature branch
  7. Update Job status → COMPLETED (via API)
  8. Update Ticket branch field (via API)

Frontend:
  Polls /api/projects/:id/jobs/status every 2s
  Displays: PENDING → RUNNING → COMPLETED
  Shows ticket updated with branch name

Total time: ~20s (clone + execution)
```

### Scenario 2: Iterative Work (Cached Workspace)

```
User Action:
  Comment "@ai-board can you add validation to the form?"

API Processing:
  1. Detect @ai-board mention
  2. Create Job (command: "ai-board-assist")
  3. Enqueue to Redis

Worker Processing:
  1. Poll Redis queue (< 1s)
  2. Update Job status → RUNNING (via API)
  3. Workspace exists + fresh (< 24h) → REUSE (1s)
  4. Execute: git pull (1s)
  5. Execute: /ai-board-assist (2-5s depending on task)
  6. Commit changes
  7. Push to existing branch
  8. Update Job status → COMPLETED (via API)

Frontend:
  Polls and displays progress
  Shows AI-BOARD response in comments

Total time: ~3-8s (85% faster than fresh clone!)
```

### Scenario 3: Multiple Transitions (Same Day)

```
Timeline:
  10:00 - INBOX → SPECIFY     (clone: 20s)
  11:00 - SPECIFY → PLAN      (reuse: 5s)  ✅ 75% faster
  14:00 - @ai-board help      (reuse: 3s)  ✅ 85% faster
  16:00 - PLAN → BUILD        (reuse: 5s)  ✅ 75% faster
  18:00 - @ai-board review    (reuse: 3s)  ✅ 85% faster

Total: 36s (vs 150s with GitHub Actions = 76% faster)
```

### Scenario 4: Workspace Expiry (> 24h)

```
Timeline:
  Day 1, 10:00 - /specify     (clone: 20s)
  Day 1, 15:00 - @ai-board    (reuse: 3s)
  Day 2, 11:00 - @ai-board    (expired → re-clone: 20s)
  Day 2, 14:00 - @ai-board    (reuse: 3s)

Workspace lifecycle:
  - Created: Day 1, 10:00
  - Last used: Day 1, 15:00
  - Auto-cleanup: Day 2, 15:00 (hourly task)
  - Re-created: Day 2, 11:00 (on demand)
```

---

## Local Development Workflow

### Setup

```bash
# Start local environment
docker-compose up

# Services started:
# - postgres:5432 (database)
# - redis:6379 (job queue)
# - app:3000 (Next.js)
# - worker (background service)
```

### Development Flow

```
1. Open http://localhost:3000
2. Drag ticket INBOX → SPECIFY
3. Worker executes locally in Docker
4. Worker calls http://localhost:3000/api/jobs/:id/status
5. Frontend polls and displays status
6. Changes committed to local Git repository
```

**Key Point**: Worker can call `localhost:3000` because it runs on the same Docker network (`network_mode: host` or shared network).

### Testing

```bash
# Run E2E tests with local workers
npm run test:e2e

# Tests verify:
# - Job creation and enqueueing
# - Worker execution
# - Status updates via API
# - Workspace caching behavior
# - Git operations
```

---

## Production Deployment

### Infrastructure Stack

| Service | Provider | Purpose | Cost |
|---------|----------|---------|------|
| **Frontend/API** | Vercel | Next.js hosting | $0 (Hobby) or $20/month (Pro) |
| **PostgreSQL** | Neon/Supabase | Primary database | $0 (Free) or $19/month (Scale) |
| **Redis** | Upstash | Job queue | $0 (Free tier) or $10/month |
| **Worker** | Railway | Docker container | $5-10/month (1-2 instances) |
| **Git Provider** | GitHub/GitLab | Source control | $0 (public) or $4/month (private) |
| **Claude API** | Anthropic | AI execution | Pay-as-you-go (~$10-30/month) |
| **Total** | - | - | **$15-50/month** |

### Deployment Configuration

**Vercel (Next.js)**:
- Environment variables: `DATABASE_URL`, `REDIS_URL`, `WORKFLOW_API_TOKEN`
- Auto-deploy from `main` branch
- Edge functions for streaming chat (future feature)

**Upstash (Redis)**:
- Global edge network (low latency worldwide)
- Durable persistence
- REST API support (optional)
- Connection URL provided as `REDIS_URL`

**Railway (Worker)**:
- Deploy from `worker/Dockerfile`
- Persistent volume for workspaces: `/workspaces` (optional, for >24h TTL)
- Auto-restart on failure
- Environment variables: `REDIS_URL`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `WORKFLOW_API_TOKEN`, `GITHUB_TOKEN`

**Neon/Supabase (PostgreSQL)**:
- Managed PostgreSQL with connection pooling
- Automatic backups
- Branching support (for feature environments)

---

## Workspace Caching Strategy

### Simple TTL Approach (Phase 1)

**Policy**: Clean up workspaces older than 24 hours

**Benefits**:
- ✅ Simple to implement and understand
- ✅ Predictable behavior
- ✅ Low storage cost (only active tickets cached)
- ✅ No workspace drift issues

**Trade-offs**:
- ⚠️ Re-clone needed after 24h of inactivity (15s overhead)
- ⚠️ Not optimized for long-running features (> 1 week)

**Lifecycle**:
```
Create:     First workflow execution → Clone repo (15s)
Reuse:      Subsequent executions within 24h → git pull (3s)
Expire:     After 24h of inactivity → Auto-cleanup
Re-create:  Next execution → Clone repo again (15s)
```

**Storage**:
- **Per workspace**: ~700 MB (Git history + node_modules + build cache)
- **10 active tickets**: ~7 GB total
- **Cost (Railway)**: ~$1.75/month (7 GB × $0.25/GB)

**Cleanup Schedule**:
- Automatic hourly task checks all workspaces
- Removes workspaces with `lastUsed > 24h ago`
- Logs cleanup operations for monitoring

### Future Enhancements (Optional)

**Adaptive TTL** (if storage costs become issue):
- Active tickets (< 24h): Keep in cache
- Warm tickets (24h-7d): Compress and archive
- Cold tickets (> 7d): Delete and re-clone on demand

**Manual Cleanup**:
- UI button to force workspace cleanup
- Automatic cleanup on ticket → SHIP transition
- Bulk cleanup for shipped tickets

---

## Migration from GitHub Actions

### Phase 1: Parallel Run (Testing)

```
Deployment:
  - Keep GitHub Actions workflows active
  - Deploy worker system in parallel
  - Add feature flag: USE_WORKER_QUEUE=false (default)

Testing:
  - Test worker system on non-critical tickets
  - Verify job execution, status updates, Git operations
  - Monitor performance and error rates
  - Validate workspace caching behavior

Duration: 1-2 weeks
```

### Phase 2: Gradual Migration

```
Rollout:
  - Enable worker queue for specific projects (feature flag)
  - Monitor for issues
  - Gradually increase percentage of traffic
  - Keep GitHub Actions as fallback

Monitoring:
  - Job success rate (target: >99%)
  - Average execution time (target: <15s)
  - Cache hit rate (target: >80% within 24h)
  - Error patterns and retry behavior

Duration: 2-4 weeks
```

### Phase 3: Full Migration

```
Cutover:
  - Set USE_WORKER_QUEUE=true globally
  - Disable GitHub Actions workflows
  - Archive old GitHub Actions logs
  - Remove GitHub Actions-specific code

Cleanup:
  - Remove .github/workflows/*.yml files
  - Remove GitHub Actions dispatch logic
  - Simplify codebase

Duration: 1 week
```

---

## Platform Independence

### Multi-Git Provider Support

The worker system is **completely agnostic** to the Git hosting provider. It only needs:

1. **Git clone URL**: Works with any Git provider
2. **Authentication**: SSH keys or access tokens
3. **Push access**: To commit and push changes

**Supported Providers**:
- ✅ GitHub (current)
- ✅ GitLab (same worker code)
- ✅ Bitbucket (same worker code)
- ✅ Self-hosted Git (Gitea, GitLab CE, etc.)
- ✅ Any Git-compatible service

**Configuration** (per project):
```typescript
{
  gitProvider: 'github' | 'gitlab' | 'bitbucket' | 'custom',
  repoUrl: 'https://github.com/owner/repo.git',
  authMethod: 'token' | 'ssh',
  credentials: {
    token: 'ghp_...' | 'glpat-...' | 'custom-token',
    // OR
    sshKey: '-----BEGIN RSA PRIVATE KEY-----...'
  }
}
```

**Worker Implementation**:
- Uses standard Git commands (clone, pull, push)
- No provider-specific APIs or SDKs
- Authentication via environment variables or mounted SSH keys

### Future Multi-Platform Features

**GitLab Integration**:
- Same worker code, different `repoUrl` format
- GitLab API for merge request creation (VERIFY stage)
- GitLab CI/CD webhooks for deployment tracking

**Bitbucket Integration**:
- Same worker code, Bitbucket authentication
- Bitbucket pull request API
- Bitbucket Pipelines integration (optional)

**Hybrid Environments**:
- Different projects can use different Git providers
- Worker auto-detects provider from `repoUrl`
- Unified job queue for all providers

---

## Monitoring & Observability

### Key Metrics

**Job Metrics**:
- Job success rate (COMPLETED / total jobs)
- Average execution time by command type
- Retry rate (failed jobs requiring retry)
- Queue depth (pending jobs waiting for workers)

**Workspace Metrics**:
- Active workspaces count
- Cache hit rate (reuse vs re-clone)
- Total disk usage
- Cleanup frequency

**Performance Metrics**:
- P50, P95, P99 execution times
- Worker idle time (workers waiting for jobs)
- Redis queue latency
- API callback latency

### Logging Strategy

**Worker Logs**:
- Job start/complete events
- Workspace cache hit/miss
- Git operations (clone, pull, push)
- Claude CLI execution output
- Error stack traces

**API Logs**:
- Job creation events
- Status update requests
- Authentication failures
- Rate limiting events

**Infrastructure Logs**:
- Redis connection issues
- Database query performance
- Worker restarts
- Queue backlog warnings

### Alerting

**Critical Alerts** (PagerDuty/Slack):
- Job failure rate > 5%
- Queue depth > 50 pending jobs
- Worker unresponsive > 5 minutes
- Redis connection errors

**Warning Alerts** (Slack only):
- Job execution time > 60s
- Cache hit rate < 50%
- Disk usage > 80%
- Workspace cleanup failures

---

## Security Considerations

### Authentication

**API Authentication**:
- User requests: NextAuth session cookies (existing)
- Worker requests: Bearer token authentication (`WORKFLOW_API_TOKEN`)
- Token rotation: Manual (initial phase), automated (future)

**Git Authentication**:
- SSH keys mounted as Docker volumes (read-only)
- Personal access tokens stored in environment variables
- Per-project credentials support (future)

### Secrets Management

**Development**:
- `.env.local` for local secrets (gitignored)
- Docker Compose environment variables
- No secrets in Git repository

**Production**:
- Vercel environment variables (encrypted at rest)
- Railway environment variables (encrypted at rest)
- Upstash connection strings (TLS-encrypted)
- No secrets logged or exposed in responses

### Network Security

**Worker → API Communication**:
- HTTPS only (TLS 1.2+)
- Bearer token authentication
- Rate limiting on status endpoints
- IP allowlist (optional, Railway static IPs)

**Worker → Git Communication**:
- SSH keys or HTTPS tokens
- TLS-encrypted Git operations
- No credentials stored in workspace

### Container Isolation

**Worker Containers**:
- Run as non-root user (future enhancement)
- Read-only root filesystem where possible
- Limited CPU and memory (Railway resource limits)
- Ephemeral workspaces (deleted after TTL)

---

## Cost Analysis

### Development (Local)

```
Infrastructure:        $0 (Docker on localhost)
Redis:                 $0 (local container)
PostgreSQL:            $0 (local container)
Claude API:            Pay-as-you-go (~$5-10/month for testing)
Total:                 $5-10/month
```

### Production (Small Scale, 10-20 tickets/day)

```
Vercel (Hobby):        $0
Neon PostgreSQL:       $0 (free tier)
Upstash Redis:         $0 (free tier: 10K commands/day)
Railway Worker:        $5-10/month (1 instance)
Claude API:            ~$10-20/month
Total:                 $15-30/month
```

### Production (Medium Scale, 50-100 tickets/day)

```
Vercel (Pro):          $20/month
Neon PostgreSQL:       $19/month (scale tier)
Upstash Redis:         $10/month (pay-as-you-go)
Railway Worker:        $20-30/month (2-3 instances)
Claude API:            ~$30-50/month
Total:                 $99-129/month
```

### Cost Comparison vs GitHub Actions

| Scenario | GitHub Actions | Worker System | Savings |
|----------|---------------|---------------|---------|
| **Local dev** | N/A | $0 | - |
| **Small scale** | $0 (free tier) | $15-30/month | -$15-30 |
| **Medium scale** | $40-80/month | $99-129/month | -$19 to -$49 |
| **Large scale** | $200+/month | $99-129/month | **+$71-101** ✅ |

**Break-even point**: ~50-100 tickets/day

**Non-monetary benefits**:
- ✅ Platform independence (priceless for multi-Git setups)
- ✅ Local testing capability (huge DX improvement)
- ✅ Faster iteration (85% time savings)
- ✅ Better debugging (direct logs and workspace access)

---

## Performance Targets

### Execution Time

| Command | Fresh Clone | Cached Workspace | Target |
|---------|-------------|------------------|--------|
| **specify** | 15-20s | 3-5s | <20s |
| **plan** | 15-20s | 3-5s | <20s |
| **implement** | 20-30s | 5-10s | <30s |
| **ai-board-assist** | 15-20s | 2-3s | <20s |

**Cache hit rate target**: >80% (within 24h window)

### Scalability

| Metric | Single Worker | 3 Workers | 10 Workers |
|--------|--------------|-----------|------------|
| **Max throughput** | 12 jobs/hour | 36 jobs/hour | 120 jobs/hour |
| **Concurrent jobs** | 3 | 9 | 30 |
| **Queue latency** | <5s | <2s | <1s |

### Reliability

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Job success rate** | >99% | (COMPLETED / total) × 100 |
| **Retry success rate** | >95% | (retried COMPLETED / retried total) × 100 |
| **Worker uptime** | >99.9% | Railway health checks |
| **Redis availability** | >99.99% | Upstash SLA |

---

## Implementation Roadmap

### Week 1-2: Core Infrastructure

**Deliverables**:
- Redis queue setup (BullMQ + Upstash)
- Worker service basic implementation
- Job enqueue in API transition logic
- Local Docker Compose environment

**Testing**:
- Manual testing with local environment
- Verify job creation and execution
- Test worker → API callbacks

### Week 3-4: Workspace Management

**Deliverables**:
- WorkspaceManager with TTL-based caching
- Git operations (clone, pull, push)
- Claude CLI execution in workspace context
- Automatic cleanup task (hourly)

**Testing**:
- Verify workspace reuse behavior
- Test cache expiry and cleanup
- Measure execution times (fresh vs cached)

### Week 5-6: Production Deployment

**Deliverables**:
- Deploy worker to Railway
- Configure Upstash Redis in production
- Update Vercel environment variables
- Implement monitoring and logging

**Testing**:
- Deploy to staging environment
- Run E2E tests against staging
- Load testing (simulate 50+ jobs)
- Monitor metrics and alerts

### Week 7-8: Migration & Optimization

**Deliverables**:
- Feature flag for gradual rollout
- Parallel run with GitHub Actions
- Performance optimization based on metrics
- Documentation and runbooks

**Testing**:
- Gradual rollout (10% → 50% → 100%)
- Monitor error rates and performance
- Validate cost projections
- User acceptance testing

---

## Future Enhancements

### Phase 2 Features

**Streaming Chat Interface** (Vercel Edge Functions):
- Real-time Claude responses in UI
- Interactive spec refinement
- Collaborative ticket assistance

**CI/CD Integration**:
- Run tests in worker before merge
- Auto-fix test failures via Claude
- Deploy previews for feature branches

**Feature Environments** (Railway Preview Deploys):
- Isolated environment per feature branch
- Persistent database per environment
- Auto-cleanup on merge

### Phase 3 Features

**Advanced Workspace Management**:
- Adaptive TTL based on ticket activity
- Workspace archiving (compression for long-term storage)
- Shared workspace pool (multiple tickets on same branch)

**Multi-Worker Orchestration**:
- Auto-scaling based on queue depth
- Worker specialization (specify, plan, implement)
- Priority queues (urgent vs normal)

**Observability & Analytics**:
- Grafana dashboards for real-time metrics
- Cost attribution per project/user
- Performance regression detection
- Predictive alerts (queue depth forecasting)

---

## Decision Log

### Why Redis Queue Instead of Direct Execution?

**Pros**:
- ✅ Decouples API from execution (faster response times)
- ✅ Built-in retry logic and error handling
- ✅ Horizontal scalability (add workers easily)
- ✅ Job persistence (survives worker crashes)
- ✅ Priority and scheduling support

**Cons**:
- ⚠️ Additional infrastructure dependency (Redis)
- ⚠️ Slightly more complex debugging (async flow)

**Verdict**: Queue provides essential production features (retries, scaling, durability) that justify the complexity.

### Why 24h TTL for Workspaces?

**Alternatives considered**:
- 7 days: Higher storage cost, risk of workspace drift
- 1 hour: Too aggressive, low cache hit rate
- No TTL: Unbounded storage growth

**Verdict**: 24h provides optimal balance:
- ✅ High cache hit rate for active development (same-day iterations)
- ✅ Low storage cost (only active tickets cached)
- ✅ Simple to understand and debug
- ✅ Easy to adjust later if needed

### Why Platform-Agnostic Instead of GitHub-Specific?

**Rationale**:
- Future-proof for GitLab, Bitbucket, self-hosted Git
- Reduces vendor lock-in
- Same code for all Git providers (simpler maintenance)
- Minimal additional complexity (standard Git commands work everywhere)

**Trade-off**: Slight performance overhead for Git operations vs GitHub-native APIs (acceptable for flexibility gained).

---

## References

- [architecture-target.md](./architecture-target.md) - Original Docker + Workers vision
- [mvp-quickstart.md](./mvp-quickstart.md) - GitHub Actions MVP implementation
- [feasibility.md](./feasibility.md) - Comparison of architecture approaches
- [BullMQ Documentation](https://docs.bullmq.io/) - Job queue library
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted) - Managed Redis provider
- [Railway Docs](https://docs.railway.app/) - Container deployment platform
