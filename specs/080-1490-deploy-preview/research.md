# Research: Manual Vercel Deploy Preview

**Date**: 2025-11-03 | **Feature**: Manual Vercel Deploy Preview | **Phase**: 0

## Research Questions

Based on Technical Context unknowns and feature requirements, the following areas required research:

1. Vercel Deployment API integration patterns
2. Single-preview constraint enforcement strategy
3. GitHub Actions workflow authentication for Vercel deployments
4. Preview URL lifecycle management (expiration, cleanup)
5. Job status polling integration with deployment progress

## Research Findings

### 1. Vercel Deployment API Integration

**Decision**: Use Vercel CLI (`vercel deploy`) in GitHub Actions workflow, not direct API calls

**Rationale**:
- Vercel CLI handles authentication, environment selection, and deployment lifecycle automatically
- CLI provides `--prebuilt` flag for deploying pre-built Next.js applications
- Official GitHub Actions integration available: `vercel/action@v1` or manual CLI usage
- Deployment URLs returned via CLI stdout, easily captured in workflow scripts

**Alternatives Considered**:
- **Direct Vercel REST API** (`POST /v13/deployments`): More control but requires manual handling of build process, environment variables, and deployment states. CLI is simpler and officially supported.
- **Vercel GitHub Integration**: Automatic deployments on push, but we need manual trigger control and single-preview enforcement. Not suitable for our use case.

**Implementation**:
```yaml
# GitHub Actions workflow snippet
- name: Deploy to Vercel Preview
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  run: |
    npm install -g vercel
    vercel pull --yes --environment=preview --token=$VERCEL_TOKEN
    vercel build --token=$VERCEL_TOKEN
    DEPLOYMENT_URL=$(vercel deploy --prebuilt --token=$VERCEL_TOKEN 2>&1 | grep -oP 'https://[^\s]+')
    echo "DEPLOYMENT_URL=$DEPLOYMENT_URL" >> $GITHUB_OUTPUT
```

**Resources**:
- Vercel CLI docs: https://vercel.com/docs/cli
- Vercel GitHub Actions: https://github.com/vercel/actions

---

### 2. Single-Preview Constraint Enforcement

**Decision**: Use Prisma transaction with conditional preview URL clearing to enforce single active preview

**Rationale**:
- PostgreSQL transactions provide ACID guarantees preventing race conditions
- Prisma `$transaction` API supports complex multi-step operations
- Clearing existing preview URLs before setting new one ensures only one active preview
- Frontend confirmation modal provides user-facing guardrail before backend enforcement

**Alternatives Considered**:
- **Application-level locking**: Requires distributed lock manager (Redis), adds complexity and failure modes. Transactions are simpler.
- **Database unique constraint**: Cannot enforce "only one non-null previewUrl per project" with standard SQL constraints. Application logic required.

**Implementation**:
```typescript
// app/api/projects/[projectId]/tickets/[id]/deploy/route.ts
await prisma.$transaction(async (tx) => {
  // Clear all existing preview URLs in this project
  await tx.ticket.updateMany({
    where: { projectId, previewUrl: { not: null } },
    data: { previewUrl: null }
  });

  // Create deployment job for current ticket
  const job = await tx.job.create({
    data: {
      ticketId,
      projectId,
      command: 'deploy-preview',
      status: 'PENDING',
      branch: ticket.branch,
    }
  });

  return job;
});
```

**Trade-offs**:
- **Pro**: Simple, reliable, no external dependencies
- **Con**: Clears existing preview URLs immediately, not after new deployment succeeds. User must redeploy if new deployment fails.

---

### 3. GitHub Actions Workflow Authentication

**Decision**: Use `WORKFLOW_API_TOKEN` for GitHub API calls, `VERCEL_TOKEN` for Vercel CLI authentication

**Rationale**:
- `WORKFLOW_API_TOKEN`: Personal Access Token (PAT) with `repo` and `workflow` scopes for updating ticket via API
- `VERCEL_TOKEN`: Vercel project token with deployment permissions
- Both stored as GitHub repository secrets (encrypted at rest)
- Workflow dispatched via `workflow_dispatch` event from API route

**Alternatives Considered**:
- **GitHub App authentication**: More secure (scoped permissions), but requires app creation, installation, and webhook setup. PAT is simpler for MVP.
- **Vercel GitHub Integration**: Automatic deployments, but no manual trigger control. Not suitable.

**Implementation**:
```typescript
// app/lib/workflows/dispatch-deploy-preview.ts
export async function dispatchDeployPreviewWorkflow(params: {
  ticketId: number;
  projectId: number;
  branch: string;
  jobId: number;
}) {
  const octokit = new Octokit({ auth: process.env.WORKFLOW_API_TOKEN });

  await octokit.rest.actions.createWorkflowDispatch({
    owner: 'bfernandez31',
    repo: 'ai-board',
    workflow_id: 'deploy-preview.yml',
    ref: 'main',
    inputs: {
      ticket_id: params.ticketId.toString(),
      project_id: params.projectId.toString(),
      branch: params.branch,
      job_id: params.jobId.toString(),
    },
  });
}
```

**Security Considerations**:
- Tokens never exposed to client-side code (server-side only)
- Workflow validates ticket ownership before deployment
- API route validates user authorization before dispatching workflow

---

### 4. Preview URL Lifecycle Management

**Decision**: Preview URLs persist indefinitely until explicitly replaced by new deployment or manual deletion

**Rationale**:
- Vercel preview deployments remain active until project deleted or manually removed
- No automatic expiration in Vercel's free/pro plans (urls remain accessible)
- Simplest implementation: Store URL in database, display until replaced
- Future enhancement: Add "delete preview" button to manually remove deployments

**Alternatives Considered**:
- **Time-based expiration**: Requires cron job or scheduled workflow to check/remove expired URLs. Adds complexity for minimal benefit.
- **Event-based cleanup**: Delete preview when ticket transitions to SHIP stage. May be desirable but not in MVP scope.

**Implementation**:
```prisma
// prisma/schema.prisma
model Ticket {
  id         Int      @id @default(autoincrement())
  previewUrl String?  @db.VarChar(500)  // Nullable, no expiration tracking
  // ... other fields
}
```

**Trade-offs**:
- **Pro**: Simple, no background jobs required
- **Con**: Preview URLs consume Vercel resources indefinitely. Team must manually manage cleanup if needed.

---

### 5. Job Status Polling Integration

**Decision**: Reuse existing `useJobPolling` hook (2-second interval) for deployment progress tracking

**Rationale**:
- Job polling infrastructure already implemented for AI assist feature (see CLAUDE.md)
- Same Job model pattern: PENDING → RUNNING → COMPLETED/FAILED
- Frontend automatically displays loading indicators when job status is PENDING/RUNNING
- Preview icon appears automatically when job status becomes COMPLETED (2-second max delay)

**Alternatives Considered**:
- **Server-Sent Events (SSE)**: Real-time updates, but Vercel serverless doesn't support long-lived connections. Removed in favor of polling (see CLAUDE.md).
- **WebSocket**: Same serverless limitation as SSE. Polling is more reliable on Vercel.

**Implementation**:
```typescript
// components/board/board.tsx (existing pattern)
const { jobs, isPolling } = useJobPolling(projectId);

const deploymentJob = jobs.find(
  (job) => job.ticketId === ticket.id && job.command === 'deploy-preview'
);

const isDeploying = deploymentJob?.status === 'PENDING' || deploymentJob?.status === 'RUNNING';
```

**Performance**:
- Polling endpoint: `GET /api/projects/[projectId]/jobs/status` (<100ms p95)
- Updates every 2 seconds while any job is non-terminal
- Stops polling when all jobs reach COMPLETED/FAILED/CANCELLED

---

## Best Practices Summary

### Vercel Deployment
- Use Vercel CLI in GitHub Actions for official tooling support
- Store `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` as repository secrets
- Capture deployment URL from CLI stdout using grep/regex
- Use `--prebuilt` flag for faster deployments (build before deploy)

### Database Transactions
- Use Prisma `$transaction` for multi-step operations (clear existing previews + create job)
- Keep transactions short (<5 seconds) to avoid lock contention
- Handle transaction failures gracefully (return 500, log error)

### Job Status Pattern
- Reuse existing Job model and status state machine (see CLAUDE.md)
- Create job with PENDING status before workflow dispatch
- Workflow updates job to RUNNING when started, COMPLETED/FAILED when done
- Frontend polls job status every 2 seconds via existing hook

### Security
- Validate user authorization before workflow dispatch (project owner/member)
- Store all secrets in GitHub repository secrets (never in code)
- Validate ticket branch exists before allowing deployment
- HTTPS-only preview URLs (validate with Zod schema)

### Testing
- Unit tests (Vitest): Deployment eligibility logic (stage=VERIFY, job=COMPLETED, branch exists)
- Integration tests (Playwright): Icon rendering based on ticket state, modal confirmation flow
- E2E tests (Playwright): Full workflow with mocked Vercel CLI (stub deployment URL)

---

## Dependencies & Prerequisites

### Required Secrets
- `WORKFLOW_API_TOKEN`: GitHub PAT with `repo` + `workflow` scopes (existing)
- `VERCEL_TOKEN`: Vercel project token (NEW - must be created)
- `VERCEL_ORG_ID`: Vercel organization ID (NEW - must be retrieved)
- `VERCEL_PROJECT_ID`: Vercel project ID (NEW - must be retrieved)

### Required Packages
- `@octokit/rest` (existing): GitHub API client for workflow dispatch
- `vercel` CLI (installed in GitHub Actions runner): Deployment tool

### Database Changes
- New field: `Ticket.previewUrl String? @db.VarChar(500)`
- Migration: `prisma migrate dev --name add_ticket_preview_url`

### Existing Infrastructure
- Job polling hook (`useJobPolling`): Reused for deployment progress
- Job status API (`/api/projects/[projectId]/jobs/status`): No changes required
- Job status update API (`/api/jobs/[id]/status`): Workflow uses this to update job status

---

## Implementation Risks & Mitigations

### Risk 1: Vercel API Rate Limits
- **Mitigation**: Single-preview constraint naturally limits deployment frequency
- **Mitigation**: Add rate limiting to deploy API endpoint (e.g., 1 deployment per minute per user)

### Risk 2: Workflow Dispatch Failures
- **Mitigation**: Catch errors in dispatch function, return 500 to user with retry option
- **Mitigation**: Log all workflow dispatch attempts for debugging

### Risk 3: Race Conditions (Multiple Users Deploying)
- **Mitigation**: Transaction-based single-preview enforcement prevents database-level races
- **Mitigation**: Confirmation modal warns users when replacing existing previews

### Risk 4: Stale Preview URLs (Deployment Deleted in Vercel)
- **Mitigation**: Future enhancement - Add "verify preview" button to check URL accessibility
- **Mitigation**: Document manual cleanup process for stale URLs

### Risk 5: Long Deployment Times (>5 minutes)
- **Mitigation**: Set workflow timeout (10 minutes max)
- **Mitigation**: Display deployment progress in UI (job status badge)
- **Mitigation**: Allow users to navigate away (polling continues in background)

---

## Next Steps (Phase 1)

With research complete, Phase 1 will generate:
1. **data-model.md**: Ticket schema changes, Job command type extension
2. **contracts/**: API endpoint specifications (POST /deploy, PATCH /jobs/:id/status)
3. **quickstart.md**: Developer setup guide for Vercel secrets and local testing
4. **Agent context update**: Add Vercel deployment patterns to CLAUDE.md
