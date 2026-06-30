# Deployment & CI/CD

GitHub Actions workflows, deployment strategy, and environment configuration.

## GitHub Actions Workflows

### Workflow Files Overview

| Workflow | Trigger | Purpose | Timeout |
|----------|---------|---------|---------|
| `speckit.yml` | workflow_dispatch | Main ai-board workflow execution | 120 min |
| `quick-impl.yml` | workflow_dispatch | Quick-implementation path | 120 min |
| `cleanup.yml` | workflow_dispatch | Diff-based technical debt cleanup | 45 min |
| `verify.yml` | workflow_dispatch | Test verification and PR creation | 45 min |
| `ai-board-assist.yml` | workflow_dispatch | AI-BOARD comment assistance | 60 min |
| `deploy-preview.yml` | workflow_dispatch | Manual Vercel preview deployment | 15 min |
| `auto-ship.yml` | deployment_status | Auto-transition VERIFY → SHIP | 5 min |
| `insights-analyze.yml` | workflow_dispatch | Claude Code `/insights` analysis for the admin Insights page | 50 min |
| `test.yml` | push, pull_request | CI testing (future) | 30 min |

### AI-Board Workflow

**File**: `.github/workflows/speckit.yml`

**Inputs**:
- `ticket_id`: Ticket identifier
- `ticketTitle`: Ticket title (specify command only)
- `ticketDescription`: Ticket description (specify command only)
- `branch`: Feature branch name
- `command`: ai-board command (specify|plan|task|implement|clarify)
- `job_id`: Job record ID
- `project_id`: Project identifier
- `githubRepository`: Target repository (format: owner/repo)
- `needs_postgres` / `needs_redis` / `needs_mysql` / `needs_mongo`: Boolean flags to provision service containers (default: false)
- `postgres_version` / `redis_version` / `mysql_version` / `mongo_version`: Container image version tags (defaults: 14 / 7 / 8 / 7)

**Environment Setup** (Double Checkout with Sparse Pattern):

All workflows use a **double checkout pattern** with **sparse checkout** for efficiency:
- **ai-board** is checked out first with sparse checkout (only `.claude-plugin/` and `.github/scripts/`)
- **target repository** is checked out second (full checkout of the project being worked on)
- Commands are symlinked so Claude can find them in the target context
- Commands always come from **main branch** (stable tools), even when ai-board works on itself

**Why sparse checkout?**
- Downloads only ~1MB instead of full repo (~100MB+)
- Faster workflow startup (~1-2s vs ~5-10s)
- Cleaner separation: ai-board provides tools, target is where work happens

**Why always from main?**
- Commands are **tools** used to do the work
- New/modified commands are the **result** of the work
- Using stable commands ensures predictable behavior

```yaml
steps:
  # Sparse checkout ai-board - only plugin and scripts
  - name: Checkout ai-board (sparse - plugin only)
    uses: actions/checkout@v4
    with:
      path: ai-board
      sparse-checkout: |
        .claude-plugin
        .github/scripts
      sparse-checkout-cone-mode: true

  # Full checkout target repository
  - name: Checkout target repository
    uses: actions/checkout@v4
    with:
      repository: ${{ inputs.githubRepository }}
      ref: ${{ inputs.branch || 'main' }}
      token: ${{ secrets.GH_PAT }}
      fetch-depth: 0
      path: target

  # Symlink ai-board commands to target context
  - name: Setup ai-board commands
    run: |
      mkdir -p target/.claude
      ln -sf ../../ai-board/.claude-plugin/commands target/.claude/commands

  - name: Setup ai-board environment
    run: |
      # Phase-aware: lightweight (symlinks + runtime) for specify/plan,
      # full (+ deps, Prisma, Playwright) for implement/build
      if [[ "${{ inputs.command }}" == "specify" || "${{ inputs.command }}" == "plan" ]]; then
        ai-board/.github/scripts/setup-environment.sh target --phase lightweight
      else
        ai-board/.github/scripts/setup-environment.sh target --phase full
      fi

  - name: Install project dependencies
    run: ai-board/.github/scripts/run-command.sh target install

  - name: Configure Git
    run: |
      git config --global user.name "ai-board[bot]"
      git config --global user.email "bot@ai-board.app"
```

**Conditional Service Containers** (provisioned only when `needs_*` input is true):

```yaml
services:
  postgres:
    image: ${{ inputs.needs_postgres && format('postgres:{0}', inputs.postgres_version) || '' }}
    # ... env, health-check omitted for brevity
  redis:
    image: ${{ inputs.needs_redis && format('redis:{0}', inputs.redis_version) || '' }}
  mysql:
    image: ${{ inputs.needs_mysql && format('mysql:{0}', inputs.mysql_version) || '' }}
  mongo:
    image: ${{ inputs.needs_mongo && format('mongo:{0}', inputs.mongo_version) || '' }}
```

When a `needs_*` flag is false, the corresponding image string is empty and GitHub Actions skips the container entirely — zero overhead.

**Infrastructure Setup** (implement command only, config-driven via `setup-environment.sh` and `run-command.sh`):

```yaml
  - name: Post-install setup (ORM)
    if: inputs.command == 'implement'
    run: ai-board/.github/scripts/setup-environment.sh target --phase post-install

  - name: Setup Test Environment
    if: inputs.command == 'implement'
    run: ../ai-board/.github/scripts/setup-test-env.sh
```

> Database URL, Prisma commands, and test setup are read from `.ai-board/config.yml` — no hardcoded values.

**Command Execution**:

```yaml
  - name: Run Claude Command
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      SKIP_SPECKIT_EXECUTION: ${{ startsWith(inputs.ticketTitle, '[e2e]') && 'true' || 'false' }}
    run: |
      if [[ "${{ inputs.command }}" == "specify" ]]; then
        JSON_PAYLOAD=$(jq -n \
          --arg tk "${{ inputs.ticketKey }}" \
          --arg title "${{ inputs.ticketTitle }}" \
          --arg desc "${{ inputs.ticketDescription }}" \
          --arg policy "$EFFECTIVE_POLICY" \
          '{ticketKey: $tk, title: $title, description: $desc, clarificationPolicy: $policy}')

        claude --dangerously-skip-permissions "/ai-board.specify '${JSON_PAYLOAD}'"

      elif [[ "${{ inputs.command }}" == "plan" ]]; then
        claude --dangerously-skip-permissions "/ai-board.plan"

      elif [[ "${{ inputs.command }}" == "implement" ]]; then
        claude --dangerously-skip-permissions "/ai-board.implement IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests"

      else
        echo "Unknown command: ${{ inputs.command }}"
        exit 1
      fi
```

**Git Operations**:

```yaml
  - name: Commit and Push
    run: |
      git add .

      if [[ -z $(git status --porcelain) ]]; then
        echo "No changes to commit"
        exit 0
      fi

      git commit -m "feat(ticket-${{ inputs.ticket_id }}): ${{ inputs.command }} - automated ai-board execution

      🤖 Generated with [Claude Code](https://claude.com/claude-code)

      Co-Authored-By: Claude <noreply@anthropic.com>"

      git push origin HEAD
```

**Post-Implementation**:

```yaml
  - name: Create PR and Move to VERIFY
    if: success() && inputs.command == 'implement'
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      .claude-plugin/scripts/bash/create-pr-and-transition.sh \
        "${{ inputs.ticket_id }}" \
        "${{ inputs.project_id }}" \
        "${CURRENT_BRANCH}" \
        "${{ vars.APP_URL }}" \
        "${{ secrets.WORKFLOW_API_TOKEN }}"
```

**Status Updates**:

```yaml
  - name: Update Job Status (Success)
    if: success()
    run: |
      curl -X PATCH "${{ vars.APP_URL }}/api/jobs/${{ inputs.job_id }}/status" \
        -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
        -H "Content-Type: application/json" \
        -d '{"status":"COMPLETED"}'

  - name: Update Job Status (Failure)
    if: failure()
    run: |
      curl -X PATCH "${{ vars.APP_URL }}/api/jobs/${{ inputs.job_id }}/status" \
        -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
        -H "Content-Type: application/json" \
        -d '{"status":"FAILED"}'
```

### Quick-Impl Workflow

**File**: `.github/workflows/quick-impl.yml`

**Differences from AI-Board Workflow**:
- No ticketTitle/ticketDescription inputs (uses minimal spec)
- Executes `/ai-board.quick-impl` instead of `/ai-board.specify`
- Creates minimal spec.md via `create-new-feature.sh --mode=quick-impl`
- Same environment setup, Git operations, status updates

**Minimal Spec Creation**:

```bash
.claude-plugin/scripts/bash/create-new-feature.sh \
  --mode=quick-impl \
  --ticket-id="${{ inputs.ticket_id }}" \
  --title="${{ inputs.ticketTitle }}" \
  --description="${{ inputs.ticketDescription }}"
```

### Cleanup Workflow

**File**: `.github/workflows/cleanup.yml`

**Inputs**:
- `ticket_id`: Cleanup ticket identifier
- `project_id`: Project identifier
- `job_id`: Job record ID for status tracking
- `githubRepository`: Target repository (format: owner/repo)

**Environment Setup**:
- Full history checkout (`fetch-depth: 0`) for diff analysis
- PostgreSQL service container for test execution
- Bun, Node.js, Python installed for tooling
- Playwright installed for E2E tests

**Execution Flow**:

```yaml
steps:
  - name: Find Last Cleanup Merge Point
    run: |
      # Find previous cleanup merge commit
      MERGE_SHA=$(git log --merges --grep="cleanup-" --format="%H" -1)

      # Fall back to initial commit if first cleanup
      if [ -z "$MERGE_SHA" ]; then
        MERGE_SHA=$(git rev-list --max-parents=0 HEAD | tail -1)
      fi

  - name: Create Cleanup Branch
    run: |
      # Uses create-new-feature.sh with cleanup mode
      .claude-plugin/scripts/bash/create-new-feature.sh \
        --json --mode=cleanup "Clean $(date +%Y-%m-%d)"

  - name: Execute Cleanup Analysis
    run: |
      # Claude reads CLAUDE.md and constitution for context
      # Uses cleanup-tasks.md to track progress
      claude --dangerously-skip-permissions --model opus \
        "/cleanup ultrathink IMPORTANT: never run the full test suite, only impacted tests"

  - name: Transition to VERIFY
    run: |
      # Triggers verify workflow for tests and PR creation
      .claude-plugin/scripts/bash/transition-to-verify.sh \
        "${{ inputs.ticket_id }}" \
        "${{ inputs.project_id }}"
```

**Key Features**:
- **Diff-Based Analysis**: Analyzes all changes since last cleanup merge
- **Project-Agnostic**: Reads CLAUDE.md and constitution.md for project context
- **Impacted Tests Only**: Never runs full test suite, only affected tests
- **Self-Healing Locks**: Transition lock cleared on job completion

### Deploy Preview Workflow

**File**: `.github/workflows/deploy-preview.yml`

**Inputs**:
- `ticket_id`: Ticket identifier
- `project_id`: Project identifier
- `branch`: Feature branch name to deploy
- `job_id`: Job record ID for status tracking

**Environment Setup**:

```yaml
steps:
  - name: Checkout repository
    uses: actions/checkout@v4
    with:
      ref: ${{ inputs.branch }}

  - name: Install Vercel CLI
    run: npm install --global vercel@latest
```

**Deployment Execution**:

```yaml
  - name: Deploy to Vercel Preview
    id: deploy
    env:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    run: |
      # Deploy to Vercel and capture preview URL
      vercel deploy --token="${VERCEL_TOKEN}" \
        --yes \
        --scope="${VERCEL_ORG_ID}" \
        --meta branch="${{ inputs.branch }}" \
        --meta ticketId="${{ inputs.ticket_id }}" > deployment-url.txt

      PREVIEW_URL=$(cat deployment-url.txt)
      echo "preview_url=${PREVIEW_URL}" >> $GITHUB_OUTPUT
```

**Update Ticket**:

```yaml
  - name: Update Ticket Preview URL
    if: success()
    run: |
      curl -X PATCH "${{ vars.APP_URL }}/api/projects/${{ inputs.project_id }}/tickets/${{ inputs.ticket_id }}/preview-url" \
        -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
        -H "Content-Type: application/json" \
        -d "{\"previewUrl\":\"${{ steps.deploy.outputs.preview_url }}\"}"
```

**Status Updates**:

```yaml
  - name: Update Job Status (Success)
    if: success()
    run: |
      curl -X PATCH "${{ vars.APP_URL }}/api/jobs/${{ inputs.job_id }}/status" \
        -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
        -H "Content-Type: application/json" \
        -d '{"status":"COMPLETED"}'

  - name: Update Job Status (Failure)
    if: failure()
    run: |
      curl -X PATCH "${{ vars.APP_URL }}/api/jobs/${{ inputs.job_id }}/status" \
        -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
        -H "Content-Type: application/json" \
        -d '{"status":"FAILED","logs":"Deployment failed. Check workflow logs for details."}'
```

### Auto-Ship Workflow

**File**: `.github/workflows/auto-ship.yml`

**Trigger**:

```yaml
on:
  deployment_status:

jobs:
  auto-ship:
    if: |
      github.event.deployment_status.state == 'success' &&
      github.event.deployment.environment == 'Production' &&
      github.event.sender.login == 'vercel[bot]'
```

**Script Execution**:

```yaml
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

```bash
#!/bin/bash
set -euo pipefail

DEPLOYMENT_SHA=$1
APP_URL=$2
WORKFLOW_API_TOKEN=$3

# Fetch VERIFY tickets
TICKETS=$(curl -s "${APP_URL}/api/projects/3/tickets?stage=VERIFY" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}")

SHIPPED_COUNT=0
SKIPPED_COUNT=0

# Process each ticket
for TICKET_ID in $(echo "$TICKETS" | jq -r '.tickets[].id'); do
  BRANCH=$(echo "$TICKETS" | jq -r ".tickets[] | select(.id == $TICKET_ID) | .branch")

  if [[ -z "$BRANCH" || "$BRANCH" == "null" ]]; then
    echo "Skipping ticket ${TICKET_ID}: no branch"
    ((SKIPPED_COUNT++))
    continue
  fi

  # Fetch branch and check ancestry
  git fetch origin "$BRANCH" --depth=50 || {
    echo "Failed to fetch branch ${BRANCH}"
    ((SKIPPED_COUNT++))
    continue
  }

  if git merge-base --is-ancestor "origin/${BRANCH}" "${DEPLOYMENT_SHA}"; then
    echo "Shipping ticket ${TICKET_ID} (branch merged)"

    # Transition to SHIP
    curl -X POST "${APP_URL}/api/projects/3/tickets/${TICKET_ID}/transition" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"targetStage":"SHIP"}'

    # Post deployment comment
    curl -X POST "${APP_URL}/api/projects/3/tickets/${TICKET_ID}/comments/ai-board" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"content\":\"🚀 **Deployed to Production**\\n\\nDeployment SHA: \`${DEPLOYMENT_SHA:0:7}\`\\nEnvironment: Production\\nStatus: Live\",\"userId\":\"ai-board-system-user\"}"

    ((SHIPPED_COUNT++))
  else
    echo "Skipping ticket ${TICKET_ID}: branch not merged"
    ((SKIPPED_COUNT++))
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Auto-Ship Complete"
echo "  📦 Shipped: ${SHIPPED_COUNT} ticket(s)"
echo "  ⏭️  Skipped: ${SKIPPED_COUNT} ticket(s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### Insights Analyze Workflow

**File**: `.github/workflows/insights-analyze.yml`

**Trigger**: `workflow_dispatch` only — fired by `POST /api/admin/insights/trigger`. Never scheduled.

**Inputs**:

| Input | Required | Description |
|-------|----------|-------------|
| `report_id` | yes | The `InsightsReport.id` to finalize |
| `job_id` | yes | The companion `Job.id` (for status PATCH and log capture) |
| `period_start` | yes | ISO 8601 timestamp (inclusive lower bound) |
| `period_end` | yes | ISO 8601 timestamp (exclusive upper bound) |
| `app_url` | yes | Base URL of the deployment that triggered the run |

No `githubRepository` input — the workflow does not operate on an external project repo. The corpus comes entirely from blob storage.

**Required secrets**:
- `WORKFLOW_API_TOKEN` — Bearer token for the status PATCH, finalize PUT, and job-enumeration GET callbacks
- `ANTHROPIC_API_KEY` — Authenticates `bunx @anthropic-ai/claude-code /insights`

**Step outline**:
1. PATCH `/api/jobs/:job_id/status` to RUNNING
2. GET `/api/admin/insights/jobs?periodStart&periodEnd` — enumerate every analyzable Claude session in the window via the shared predicate (multiple sessions per ticket, all stages, all projects, no SHIP filter); capture both `session_count` (= `jobs.length`) and `expected_count`
3. GET `/api/admin/insights/jobs/:jobId/raw-native` for each enumerated session — download the gzipped native session JSONL
4. Run `bunx @anthropic-ai/claude-code /insights --sessions ./sessions --output ./report.html` — the genuine slash command, never a free-text prompt
5. Validate the HTML contains the analyzer's characteristic markers (`Suggested CLAUDE.md additions`, `Big wins`, `Horizon`); fail with `Insights output validation failed` otherwise
6. PUT `/api/admin/insights/reports/:report_id/finalize` with the raw HTML body — the server re-runs validation as defense in depth and rejects with 422 on failure
7. PATCH `/api/admin/insights/reports/:report_id/status` with `COMPLETED` plus `sessionsCount`, `expectedSessionsCount`, `ticketsCount`, `analyzedJobIds` (= `[.jobs[].jobId]`), and the artifact pointer — the server writes one coverage row per analyzed session inside the transition transaction (or `FAILED` with a non-secret reason and no coverage advance if any prior step failed)
8. PATCH `/api/jobs/:job_id/status` with the matching terminal status (direct atomic update — insights jobs intentionally bypass push notifications)

**Timeout**: 50 minutes — 10 minutes below the default `INSIGHTS_RUN_TIMEOUT_MINUTES=60` so the workflow's own failure path runs before lazy reconciliation auto-FAILs the row. Operators can raise the timeout via configuration if needed; the workflow timeout should track below it.

**Failure isolation**:
- Step failures during analysis produce a generic `errorReason` (the analyzer's stderr is captured into job logs but never echoed into `errorReason` because logs may contain secrets)
- Structural-marker validation failure → `Insights output validation failed`
- Finalize 422 → `Insights output validation failed`
- Finalize non-422 error → `Artifact upload rejected by storage`
- A workflow that never reports terminal status is reconciled to FAILED by the lazy timeout sweep on the next list or trigger call

**Not in this workflow**: No PR creation, no `gh pr create`, no external-repo clone, no cron schedule. Reports are not committed to git.

## Environment Configuration

### GitHub Secrets

Required secrets in repository settings:

| Secret | Purpose | Example |
|--------|---------|---------|
| `ANTHROPIC_API_KEY` | Claude Code API key | `sk-ant-api03-...` |
| `WORKFLOW_API_TOKEN` | Workflow authentication | Random 32-char string |
| `VERCEL_TOKEN` | Vercel API authentication | `vercel_api_token_...` |
| `VERCEL_ORG_ID` | Vercel organization ID | `team_abc123...` |
| `VERCEL_PROJECT_ID` | Vercel project ID | `prj_xyz789...` |
| `GITHUB_TOKEN` | Automatic (GitHub provides) | N/A |

### GitHub Variables

Repository variables (not secrets):

| Variable | Purpose | Example |
|----------|---------|---------|
| `APP_URL` | Application base URL | `https://ai-board.vercel.app` |

### Vercel Environment Variables

**Production**:

```env
# Database
DATABASE_URL=<postgresql-production-url>

# NextAuth
NEXTAUTH_URL=https://ai-board.vercel.app
NEXTAUTH_SECRET=<production-secret>

# GitHub OAuth
GITHUB_ID=<github-oauth-client-id>
GITHUB_SECRET=<github-oauth-secret>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>

# Workflow (must match GitHub secret)
WORKFLOW_API_TOKEN=<same-as-github-secret>

# Admin Insights
ADMIN_ALLOWLIST=alice@example.com,bob@example.com
INSIGHTS_RUN_TIMEOUT_MINUTES=60
```

**Preview** (optional, different database):

```env
DATABASE_URL=<postgresql-preview-url>
NEXTAUTH_URL=https://ai-board-<git-branch>.vercel.app
# ... same for other variables
```

## Deployment Strategy

### Vercel Platform

**Automatic Deployments**:
- **Production**: Deploys on push to `main` branch
- **Preview**: Deploys on every push to PR branches
- **Development**: Local development server

**Build Configuration**:

```json
{
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

**Build Process**:
1. Install dependencies (`npm install`)
2. Run Prisma generate (`npx prisma generate`)
3. Build Next.js app (`next build`)
4. Deploy serverless functions
5. Deploy static assets to CDN

### Database Migrations

**Development**:

```bash
# Create migration
npx prisma migrate dev --name <migration-name>

# Apply migration
npx prisma migrate dev
```

**Production**:

```bash
# Apply pending migrations
npx prisma migrate deploy
```

**Workflow Integration**:
- Migrations automatically applied in GitHub Actions (implement command)
- Production migrations applied via Vercel build script or manual deploy

### Branch Strategy

**Branch Types**:
- `main`: Production branch (protected)
- `feature/<ticket-id>-<description>`: Feature branches (created by workflows)
- `hotfix/<description>`: Emergency fixes

**Protection Rules** (main branch):
- Require pull request reviews
- Require status checks to pass
- No force pushes
- No deletions

### Rollback Strategy

**Application Rollback** (Vercel):
1. Navigate to Vercel dashboard
2. Select previous deployment
3. Click "Promote to Production"
4. Instant rollback (no build time)

**Database Rollback** (Prisma):
1. Create down migration manually
2. Apply: `npx prisma migrate deploy`
3. Verify data integrity

**Quick-Impl Rollback** (Application):
- User drags ticket BUILD → INBOX
- System validates job FAILED or CANCELLED
- System resets `workflowType` to FULL
- User can retry with either workflow path

## Monitoring & Logging

### GitHub Actions Logs

**Access**:
- Navigate to Actions tab in repository
- Click on workflow run
- View step-by-step logs
- Download logs as ZIP

**Retention**: 90 days (GitHub default)

### Vercel Logs

**Real-Time Logs**:

```bash
# Install Vercel CLI
npm install -g vercel

# Tail production logs
vercel logs --follow
```

**Dashboard Access**:
- Navigate to Vercel project
- Click on deployment
- View logs tab

### Vercel Speed Insights

**Performance Monitoring**:
- Real User Monitoring (RUM) for production traffic
- Automatic metric collection via `@vercel/speed-insights` package
- No configuration required after installation

**Metrics Tracked**:
- **First Contentful Paint (FCP)**: Time to first text/image render
- **Largest Contentful Paint (LCP)**: Time to largest element render
- **First Input Delay (FID)**: Time from first interaction to browser response
- **Cumulative Layout Shift (CLS)**: Visual stability score
- **Time to First Byte (TTFB)**: Server response time

**Dashboard Access**:
- Navigate to Vercel project dashboard
- Click "Analytics" tab
- View "Speed Insights" section
- Filter by page, time range, device type
- Export data for analysis

**Performance Targets**:
- LCP: <2.5s (good), <4.0s (needs improvement), ≥4.0s (poor)
- FID: <100ms (good), <300ms (needs improvement), ≥300ms (poor)
- CLS: <0.1 (good), <0.25 (needs improvement), ≥0.25 (poor)

**Integration**:
```typescript
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### Application Logging

**Server Logs** (API routes):

```typescript
console.log('Operation started:', { ticketId, userId });
console.error('Operation failed:', error);
```

**Job Logs** (stored in database):

```typescript
await prisma.job.update({
  where: { id: jobId },
  data: {
    logs: `Workflow completed successfully\nFiles created: spec.md`,
  },
});
```

## Performance Optimization

### Build Performance

**Caching Strategies**:
- Node modules cached by Vercel
- Next.js build cache persisted
- Playwright browsers cached (GitHub Actions)

**Build Time**:
- Initial build: ~5 minutes
- Cached build: ~2 minutes
- Cache miss: ~4 minutes

### Runtime Performance

**API Routes**:
- Target: <100ms p95 response time
- Database query optimization (indexes)
- Minimal computation in serverless functions

**Static Assets**:
- CDN delivery via Vercel Edge Network
- Automatic compression (Brotli)
- Image optimization (Next.js)

### Workflow Performance

**Dependency Caching**:

```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.cache/ms-playwright
    key: ${{ runner.os }}-deps-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-deps-
```

**Performance Targets**:
- Fresh installation: ~3 minutes
- Cached installation: ~30 seconds
- Database setup: ~2 minutes
- Claude execution: Variable (5-30 minutes)

## Security Best Practices

### Secrets Management
- ✅ Use GitHub Secrets for sensitive data
- ✅ Rotate tokens quarterly
- ✅ Use minimal scope for tokens
- ❌ Never commit secrets to repository

### API Security
- ✅ Validate all workflow requests (Bearer token)
- ✅ Use constant-time comparison for tokens
- ✅ Log all workflow operations
- ❌ Don't expose internal errors to clients

### Deployment Security
- ✅ Protected main branch
- ✅ Required status checks
- ✅ Automated security scans (Dependabot)
- ❌ No direct pushes to production

## Disaster Recovery

### Backup Strategy
- **Database**: Automated daily backups (provider-dependent)
- **Code**: Git repository (GitHub)
- **Assets**: Cloudinary (persistent CDN)
- **Workflows**: GitHub Actions (logs retained 90 days)

### Recovery Procedures

**Database Corruption**:
1. Restore from latest backup
2. Verify data integrity
3. Reapply recent transactions if needed

**Deployment Failure**:
1. Check Vercel deployment logs
2. Rollback to previous deployment
3. Fix issue locally
4. Redeploy via git push

**Workflow Failure**:
1. Check GitHub Actions logs
2. Identify root cause
3. Manual retry if transient error
4. Fix workflow file if systematic issue

## Cost Optimization

### Vercel
- **Free Tier**: Sufficient for development
- **Pro Tier**: $20/month for production
- **Usage**: Monitor bandwidth and function execution

### GitHub Actions
- **Free Tier**: 2,000 minutes/month
- **Usage**: ~100 minutes per workflow execution
- **Optimization**: Cache dependencies, skip unnecessary steps

### Cloudinary
- **Free Tier**: 25GB storage, 25GB bandwidth
- **Usage**: Monitor uploads and transformations
- **Optimization**: Delete orphaned images, optimize upload sizes
