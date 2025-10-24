# AI Board Worker Service

This is the V2 worker service that replaces GitHub Actions for processing AI Board workflows.

## Architecture

The worker service uses:
- **BullMQ** for job queue management
- **Redis** for queue persistence
- **Docker** for containerization
- **Bun** as the JavaScript runtime

## Setup

### Local Development

1. **Start the services**:
   ```bash
   docker-compose up
   ```

   This will start:
   - PostgreSQL (port 5432)
   - Redis (port 6379)
   - Worker service (monitoring the queue)

2. **Install dependencies** (if running outside Docker):
   ```bash
   cd worker
   bun install
   ```

3. **Run the worker locally** (outside Docker):
   ```bash
   cd worker
   bun run dev
   ```

## Environment Variables

The worker requires these environment variables:

- `REDIS_URL` - Redis connection URL (default: `redis://localhost:6379`)
- `DATABASE_URL` - PostgreSQL connection URL
- `API_URL` - AI Board API URL (default: `http://localhost:3000`)
- `WORKFLOW_API_TOKEN` - Authentication token for API callbacks
- `GITHUB_TOKEN` - GitHub personal access token
- `ANTHROPIC_API_KEY` - Claude API key
- `WORKSPACES_DIR` - Directory for git repositories (default: `/workspaces`)
- `WORKER_CONCURRENCY` - Number of concurrent jobs (default: `1`)

## How It Works

1. **API enqueues job**: When a ticket transitions, the API enqueues a job to Redis
2. **Worker picks up job**: The worker polls Redis and picks up pending jobs
3. **Workspace management**: Worker clones/pulls the repository to a local workspace
4. **Execute command**: Worker runs the appropriate Claude command
5. **Git operations**: Worker commits and pushes changes to GitHub
6. **Update status**: Worker calls back to the API to update job status

## Job Commands

The worker processes these commands:

- `specify` - Run `/speckit.specify` to create specification
- `plan` - Run `/speckit.plan` to create implementation plan
- `implement` - Run `/speckit.implement` to implement the feature
- `quick-impl` - Run `/quick-impl` for quick implementation
- `comment-*` - Handle AI Board mentions in comments

## Testing

Test the worker queue:
```bash
bun scripts/test-worker.ts
```

This will:
1. Connect to Redis
2. Enqueue a test job
3. Show queue status
4. Verify the worker picks up the job

## Monitoring

View worker logs:
```bash
docker logs ai-board-worker -f
```

Check queue status:
```bash
bun scripts/test-worker.ts
```

## Deployment

For production deployment:

1. Use Upstash Redis or Redis Cloud
2. Deploy worker to Railway or similar container service
3. Set production environment variables
4. Scale workers horizontally as needed

## Troubleshooting

### Worker not processing jobs

1. Check Redis connection:
   ```bash
   docker exec -it ai-board-redis redis-cli ping
   ```

2. Check worker logs:
   ```bash
   docker logs ai-board-worker
   ```

3. Verify queue has jobs:
   ```bash
   bun scripts/test-worker.ts
   ```

### Git operations failing

1. Ensure GITHUB_TOKEN is set
2. Check workspace directory permissions
3. Verify repository access

### API callbacks failing

1. Check WORKFLOW_API_TOKEN is set
2. Verify API_URL is correct
3. Check network connectivity between worker and API