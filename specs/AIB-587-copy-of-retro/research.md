# Research: Retro-Spec — Generate Project Specifications for Existing Codebases

**Feature Branch**: `AIB-587-copy-of-retro`
**Date**: 2026-04-09

---

## Technical Context Resolution

### Q1: Should we extend ProjectSetupJob or create a new model for spec generation?

- **Decision**: Create a new `SpecGenerationJob` model, separate from `ProjectSetupJob`
- **Rationale**: ProjectSetupJob is tightly coupled to onboarding init — it tracks `configSyncedAt` completion, has a guard against `ALREADY_CONFIGURED` projects, and its polling hook (`useSetupJobPolling`) stops when `configSyncedAt` is set. Spec generation is a different lifecycle: it runs AFTER init completes, can be triggered from multiple entry points (setup Step 2, board banner), and needs its own fields (`depth`, `documentationUrl`, `additionalContext`). A separate model cleanly separates concerns.
- **Alternatives considered**:
  1. Add a `jobType` discriminator to ProjectSetupJob — would require conditional logic throughout existing code and risk breaking onboarding flows
  2. Use the ticket-level Job model — spec generation is project-level, not ticket-level; no ticket exists for this operation

### Q2: How to determine if specs exist in the target repo?

- **Decision**: Add a `specsGeneratedAt` field to the `Project` model as a lightweight cache, set when a `SpecGenerationJob` completes successfully
- **Rationale**: Checking the GitHub API on every board load adds latency and API rate limit pressure. The spec decision in the feature spec acknowledges this trade-off and suggests caching. The field also doubles as the skip-detection: null means specs were never generated (banner shows), non-null means specs exist (banner hidden).
- **Alternatives considered**: GitHub API check on every load (slow, rate-limited), session flag (loses state across sessions, no server visibility)

### Q3: How should the setup page transition from Step 1 to Step 2?

- **Decision**: Modify the setup page server component to NOT redirect when `configSyncedAt` is set but `specsGeneratedAt` is null. The client component shows Step 2 in this state.
- **Rationale**: Currently `setup/page.tsx:40-41` redirects to board when `configSyncedAt` exists. We need to keep users on the setup page for Step 2 unless they've already completed or skipped spec generation.

### Q4: How to handle "Skip" tracking?

- **Decision**: Skipping doesn't set `specsGeneratedAt`. The board banner checks `specsGeneratedAt === null && configSyncedAt !== null` to show. Dismissal is session-scoped via `sessionStorage`.
- **Rationale**: Simpler than adding a dedicated skip flag. The banner reappearing on new sessions is the desired behavior per spec.

---

## Existing Files

### Files to Modify

| File | What it covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` | Database models | Add `SpecGenerationJob` model, `SpecDepth` enum, `specsGeneratedAt` field on Project |
| `app/projects/[projectId]/setup/page.tsx` | Setup page server component | Change redirect logic to support Step 2 |
| `components/setup/setup-page-client.tsx` | Setup page client UI | Add Step 2 UI (depth picker, doc URL, context, generate/skip) |
| `app/api/projects/[projectId]/setup/jobs/route.ts` | Setup job API | Reference pattern for new spec-gen API |
| `components/board/board.tsx` | Board kanban component | Add spec generation badge and banner |
| `app/projects/[projectId]/board/page.tsx` | Board page server component | Pass `specsGeneratedAt` and owner check to Board |
| `app/lib/query-keys.ts` | TanStack Query key registry | Add `specGenerationJob` key |
| `app/lib/hooks/useSetupJobPolling.ts` | Reference polling hook | Pattern reference for new `useSpecGenPolling` |

### Files to Create

| File | Purpose |
|------|---------|
| `app/api/projects/[projectId]/spec-generation/jobs/route.ts` | POST (create) + GET (poll) spec generation jobs |
| `app/api/projects/[projectId]/spec-generation/jobs/[jobId]/status/route.ts` | PATCH status (workflow callback) |
| `lib/workflows/dispatch-spec-generation.ts` | GitHub workflow dispatch for retro-spec |
| `app/lib/hooks/useSpecGenPolling.ts` | TanStack Query polling hook for spec generation |
| `components/board/spec-gen-badge.tsx` | Progress badge for board header area |
| `components/board/spec-gen-banner.tsx` | Dismissable banner for "no specs" state |
| `components/board/spec-gen-modal.tsx` | Modal with depth/doc URL/context fields |
| `.github/workflows/retro-spec.yml` | GitHub Actions workflow for spec generation |
| `.claude-plugin/commands/ai-board.retro-spec.md` | Claude command for retro-spec skill |

### Test Files

| File | Action | Rationale |
|------|--------|-----------|
| `tests/integration/projects/setup-job.test.ts` | Extend with Step 2 redirect tests | Already covers setup job flows |
| `tests/integration/projects/spec-generation-job.test.ts` | **Create** | New API endpoints need dedicated integration tests |
| `tests/unit/components/setup/setup-page.test.tsx` | Extend with Step 2 UI tests | Already covers setup page rendering |
| `tests/unit/components/board/spec-gen-badge.test.tsx` | **Create** | New component |
| `tests/unit/components/board/spec-gen-banner.test.tsx` | **Create** | New component |

---

## Patterns to Follow

### Pattern 1: Dispatch-Then-Rollback (from `lib/workflows/dispatch-onboard.ts` + `app/api/projects/[projectId]/setup/jobs/route.ts:108-130`)

When creating a job and dispatching a workflow:
1. Create the job in DB first (within a transaction that checks for conflicts)
2. Attempt workflow dispatch OUTSIDE the transaction
3. On dispatch failure, update the job to FAILED with error message
4. Never leave a PENDING job with no running workflow

```
// Pattern from setup jobs route.ts:108-130
const job = await prisma.$transaction(async (tx) => {
  // Check guards (already configured, active job, etc.)
  // Create job with PENDING status
  return tx.specGenerationJob.create(...);
});
try {
  await dispatchSpecGenerationWorkflow(inputs);
} catch (error) {
  await prisma.specGenerationJob.update({
    where: { id: job.id },
    data: { status: 'FAILED', errorMessage: error.message }
  });
}
```

### Pattern 2: Workflow Status Callback (from `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts`)

- Auth: `validateWorkflowAuth()` (workflow token only, not user session)
- Valid state transitions enforced with a map
- Zod schema for request validation
- Sets `startedAt` on first RUNNING, `completedAt` on terminal status
- On COMPLETED: trigger side effect (config sync for setup, set `specsGeneratedAt` for spec gen)

### Pattern 3: Polling Hook (from `app/lib/hooks/useSetupJobPolling.ts`)

- TanStack Query `useQuery` with `refetchInterval` as a function
- Terminal statuses stop polling
- Returns job DTO + relevant state flags
- Query key follows `queryKeys.projects.*` pattern
- Default 2s interval

### Pattern 4: Test Mode Detection (from `app/lib/workflows/test-mode.ts`)

All dispatch functions check `isWorkflowTestMode(githubToken)` and return early in test mode. New dispatch function MUST follow this pattern.

### Pattern 5: Credential Validation (from `lib/workflows/dispatch-onboard.ts:32-39`)

Before dispatch, validate the owner has the required AI credential via `getOwnerCredential()`. Map agent to provider via `AGENT_PROVIDER_MAP`.

### Pattern 6: Session Storage for Dismissals (from `components/board/board.tsx:197-207`)

The codebase uses `localStorage` for persistent dismissals (e.g., `shortcuts-hint-dismissed`). For session-scoped dismissal, use `sessionStorage` with the same pattern but scoped to the project: `spec-banner-dismissed-${projectId}`.

### Pattern 7: Workflow YAML Structure (from `.github/workflows/onboard.yml`)

- `workflow_dispatch` trigger with typed inputs
- Environment variables block with APP_URL, WORKFLOW_API_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, telemetry
- Status reporting via curl to PATCH endpoint
- Uses `run-agent.sh` for agent execution
- Sparse checkout of ai-board repo + full clone of target repo
- Artifact summary JSON in status update

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Job model | New `SpecGenerationJob` model | Separate lifecycle from setup jobs |
| Spec existence tracking | `specsGeneratedAt` on Project | Avoids GitHub API calls on every board load |
| Banner dismiss scope | `sessionStorage` | Per spec: session-scoped, reappears in new sessions |
| Depth levels | `SpecDepth` enum: QUICK, STANDARD, COMPREHENSIVE | Maps directly to spec FR-002 |
| Workflow file | `retro-spec.yml` | Follows naming convention of existing workflows |
| Conflict guard | DB unique partial index on `projectId` where status IN (PENDING, RUNNING) | Prevents concurrent spec generation per FR-009 |
