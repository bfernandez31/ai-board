# Vercel Deployment Integration


### Platform Features

**Serverless Functions**:
- API routes run as serverless functions
- 10-second execution limit (hobby plan)
- 50MB payload limit
- No persistent connections (hence polling vs WebSockets)

**Edge Network**:
- Global CDN for static assets
- Automatic HTTPS
- Brotli compression
- Image optimization

**Environment Variables**:
- Set via Vercel dashboard
- Different values for preview vs production
- Encrypted at rest

### Auto-Ship Workflow

**Trigger**: `deployment_status` event from Vercel

```yaml
name: Auto-Ship on Production Deployment

on:
  deployment_status:

jobs:
  auto-ship:
    if: |
      github.event.deployment_status.state == 'success' &&
      github.event.deployment.environment == 'Production' &&
      github.event.sender.login == 'vercel[bot]'
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Auto-ship tickets
        env:
          DEPLOYMENT_SHA: ${{ github.event.deployment.sha }}
          APP_URL: ${{ vars.APP_URL }}
          WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
        run: |
          .claude-plugin/scripts/bash/auto-ship-tickets.sh \
            "${DEPLOYMENT_SHA}" \
            "${APP_URL}" \
            "${WORKFLOW_API_TOKEN}"
```

**Script Logic** (`.claude-plugin/scripts/bash/auto-ship-tickets.sh`):

1. Fetch all VERIFY stage tickets via API
2. For each ticket with branch:
   - Fetch branch from remote
   - Check if branch merged: `git merge-base --is-ancestor <branch> <deployment-sha>`
   - If merged: Transition VERIFY → SHIP via API
   - Post deployment notification comment
3. Generate summary report

### Environment Configuration

**Production**:
```env
DATABASE_URL=<postgresql-connection-string>
NEXTAUTH_URL=https://ai-board.vercel.app
NEXTAUTH_SECRET=<production-secret>
# ... other secrets
```

**Preview**:
```env
DATABASE_URL=<preview-database-connection-string>
NEXTAUTH_URL=https://ai-board-<branch>.vercel.app
NEXTAUTH_SECRET=<preview-secret>
```

### Build Configuration

**vercel.json**:

```json
{
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "DATABASE_URL": "@database_url",
    "NEXTAUTH_SECRET": "@nextauth_secret"
  }
}
```

### Vercel Blob (Agent Log Storage)

**Package**: `@vercel/blob` ^2.3.x. Used to persist gzipped JSONL agent execution transcripts that survive beyond the GitHub Actions retention window.

**Pathname layout**:
- `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` — normalized v1 event stream, written for every terminated job
- `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` — redacted, gzipped native Claude Code session JSONL, written only for Claude jobs that produced session data and whose raw upload succeeded

**Size budget**: 25 MB gzipped per object (each artifact independently). Oversize normalized transcripts are truncated on the runner with a `lifecycle:upstream_error:transcript_truncated` marker; oversize raw artifacts cause Phase 5b to fail non-blockingly and the row's `rawArtifactKey` stays null.

**Credential scope**:
- `BLOB_READ_WRITE_TOKEN` is configured only in the Vercel environment
- The GitHub Actions runner never holds the Blob token — all uploads are streamed through `PUT /api/jobs/:id/logs/artifact` (normalized) or `PUT /api/jobs/:id/logs/raw-artifact` (Claude raw native), both workflow-token-authenticated and forwarded to Blob via `app/lib/blob/client.ts`
- Reads are streamed through `GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw` (normalized) and `GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw-native` (raw native), both session-authenticated via `verifyTicketAccess` with the AIB-724 canonical-key re-derivation; Blob URLs are never rendered client-side

**Retention**: `LOG_RETENTION_DAYS` (default `30`) drives `POST /api/maintenance/prune-logs`, invoked nightly by `.github/workflows/nightly-log-prune.yml` at `15 1 * * *` UTC. Per row, pruning deletes the normalized Blob object first, then the raw Blob object when present (each `404` treated as success), then marks the `JobLog` row `PRUNED` and nulls all four artifact columns so the two artifacts age out together.

### Performance Monitoring

- **Build Time**: <5 minutes
- **Cold Start**: <200ms (API routes)
- **Response Time**: <100ms (p95)
- **Cache Hit Rate**: >80% (static assets)

