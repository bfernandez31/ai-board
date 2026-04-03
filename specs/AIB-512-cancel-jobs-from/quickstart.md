# Quickstart: Cancel Jobs + Rollback Recovery

## Prerequisites

- PostgreSQL running with schema migrated
- `bun install` completed
- Environment variables configured (see `.env.example`)
- GitHub token with `actions:write` scope (for workflow cancel)

## Development Flow

### 1. Apply Schema Migration

```bash
# Add workflowRunId field to Job model
bunx prisma migrate dev --name add-workflow-run-id
bunx prisma generate
```

### 2. Start Dev Server

```bash
bun run dev
```

### 3. Test Cancel Flow

1. Create a ticket and trigger a workflow (SPECIFY, PLAN, or BUILD)
2. While the job is PENDING or RUNNING, hover over the ticket card on the board
3. Click the X cancel button that appears
4. Confirm in the dialog
5. Verify the job status changes to CANCELLED

### 4. Test Rollback Flow

1. Set up a ticket in BUILD stage with a FAILED job (or cancel a running build)
2. Drag the ticket card from BUILD column to PLAN column
3. Confirm in the rollback dialog
4. Verify a backup tag is created and the branch is reset

### 5. Run Tests

```bash
# Unit tests for rollback validators and cancel logic
bun run test:unit

# Integration tests for cancel endpoint and extended transitions
bun run test:integration

# E2E tests for board drag-and-drop rollback (browser-required)
bun run test:e2e
```

## Key Files to Modify

| Area | Files |
|------|-------|
| Schema | `prisma/schema.prisma` |
| Cancel endpoint | `app/api/jobs/[id]/cancel/route.ts` (new) |
| Status endpoint | `app/api/jobs/[id]/status/route.ts` (extend) |
| Transition logic | `lib/stage-transitions.ts`, `app/lib/workflows/rollback-validator.ts` |
| Transition endpoint | `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` |
| Cancel utility | `lib/workflows/cancel-workflow-run.ts` (new) |
| Board UI | `components/board/ticket-card.tsx`, `components/board/board.tsx` |
| Modal UI | `components/ticket/jobs-timeline.tsx` |
| Confirmation | `components/board/cancel-confirmation-modal.tsx` (new) |
| Workflows | `.github/workflows/rollback-reset.yml`, `.github/workflows/verify.yml` |
