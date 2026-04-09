# Research: AIB-585 Retro-Spec Generate

## Unknowns Resolved

### 1. ProjectSetupJob Discriminator Strategy

**Decision**: Add a `command` field (enum: `ONBOARD`, `RETRO_SPEC`) to `ProjectSetupJob` to distinguish job types.

**Rationale**: The existing model already tracks all needed lifecycle fields (status, workflowRunId, errorMessage, artifactSummary, timestamps). A discriminator is the simplest way to reuse this infrastructure while keeping queries clean.

**Alternatives considered**:
- Separate `RetroSpecJob` model: Rejected — identical schema, duplicate code
- Using `artifactSummary` JSON to infer type: Rejected — unreliable for queries

### 2. Retro-Spec Specific Fields

**Decision**: Add optional `depth`, `docUrl`, and `context` fields to `ProjectSetupJob`. These are only relevant for `RETRO_SPEC` jobs.

**Rationale**: Keeps all job configuration in a single record for traceability. These fields are nullable so they don't affect existing ONBOARD jobs.

**Alternatives considered**:
- Storing in `artifactSummary` JSON: Rejected — inputs aren't artifacts, confuses semantics
- Separate config table: Rejected — over-engineering for 3 optional fields

### 3. Concurrent Job Prevention

**Decision**: Extend the existing active-job check in the POST route to also prevent concurrent retro-spec jobs. The check will scope by `command` type so an active onboard job doesn't block retro-spec and vice versa.

**Rationale**: Spec says "only one active retro-spec job per project at a time" (FR-008). The existing `prisma.$transaction` pattern already handles this for onboard jobs.

### 4. Board Banner Placement

**Decision**: Add the spec generation banner as a top-level element within the `Board` component, above the stage columns grid. This follows the same pattern as `OfflineIndicator`.

**Rationale**: The banner is board-scoped and dismissible. Placing it inside the Board component gives it access to projectId and board state.

### 5. Status Badge Placement

**Decision**: Add the spec generation status badge to the Board component header area (above stage columns), similar to how `OfflineIndicator` renders at the top.

**Rationale**: The header component (`components/layout/header.tsx`) is shared across all pages. The badge is board-specific, so it belongs in the Board component.

---

## Existing Files

### Files to Modify

| File | Purpose | Action |
|------|---------|--------|
| `prisma/schema.prisma` | Add `command` enum and fields to ProjectSetupJob | Extend |
| `app/api/projects/[projectId]/setup/jobs/route.ts` | POST: handle retro-spec job creation; GET: return retro-spec jobs | Extend |
| `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` | PATCH: handle retro-spec completion (no config sync needed) | Extend |
| `lib/workflows/dispatch-onboard.ts` | Pattern reference for new `dispatch-retro-spec.ts` | Pattern reference |
| `app/lib/hooks/useSetupJobPolling.ts` | Pattern reference for new retro-spec polling hook | Pattern reference |
| `components/board/board.tsx` | Add retro-spec banner and status badge | Extend |
| `app/projects/[projectId]/board/page.tsx` | Pass `hasSpecs` / `configSyncedAt` to Board component | Extend |
| `app/projects/[projectId]/setup/page.tsx` | Ensure redirect works (already does, verify no regressions) | Verify |
| `components/setup/setup-page-client.tsx` | Ensure redirect on configSyncedAt (already works) | Verify |
| `app/lib/query-keys.ts` | Add retro-spec query keys | Extend |

### Files to Create

| File | Purpose |
|------|---------|
| `lib/workflows/dispatch-retro-spec.ts` | Dispatch retro-spec GitHub workflow |
| `app/lib/hooks/useRetroSpecPolling.ts` | Poll retro-spec job status from board |
| `components/board/retro-spec-banner.tsx` | Dismissible banner prompting spec generation |
| `components/board/retro-spec-modal.tsx` | Modal with depth/docUrl/context inputs |
| `components/board/retro-spec-badge.tsx` | Status badge (generating/ready/error) |
| `.github/workflows/retro-spec.yml` | GitHub Actions workflow for retro-spec |
| `.claude-plugin/commands/ai-board.retro-spec.md` | Agent command for LLM-powered spec generation |

### Test Files

| File | Action | Rationale |
|------|--------|-----------|
| `tests/integration/projects/setup-job.test.ts` | Extend | Add retro-spec job creation/status tests alongside existing onboard tests |
| `tests/unit/components/setup/setup-page.test.tsx` | Verify | Existing redirect tests should still pass |
| `tests/unit/components/board/retro-spec-banner.test.tsx` | Create | New component needs unit tests |
| `tests/integration/projects/retro-spec-job.test.ts` | Create | Retro-spec API has different validation rules than onboard (e.g., requires configSyncedAt) |

---

## Patterns to Follow

### 1. Workflow Dispatch Pattern (from `lib/workflows/dispatch-onboard.ts`)

**Error handling**: Check test mode first → validate credential exists → create Octokit → call `createWorkflowDispatch` in try/catch → throw descriptive error on failure.

**Security**: Credential pre-validation via `getOwnerCredential()` before dispatch. GitHub token from env var, never exposed.

**How to apply**: `dispatch-retro-spec.ts` MUST follow this exact pattern — test mode check, credential validation, Octokit dispatch, error wrapping.

### 2. Job Creation Transaction Pattern (from `app/api/projects/[projectId]/setup/jobs/route.ts:67-95`)

**State management**: Atomic `prisma.$transaction` that checks preconditions (configSyncedAt, active jobs) then creates job. On dispatch failure, immediately marks job as FAILED with error message.

**How to apply**: The retro-spec POST handler MUST use the same transaction pattern but with inverted configSyncedAt check (MUST be set for retro-spec, MUST be null for onboard) and scoped active-job check (only check for active RETRO_SPEC jobs).

### 3. Job Status Update Pattern (from `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts`)

**State machine**: `VALID_TRANSITIONS` map enforces allowed transitions. Idempotent same-status returns. Sets `startedAt` on RUNNING, `completedAt` on terminal states.

**Side effects on completion**: Onboard triggers `syncProjectConfig()`. Retro-spec does NOT need config sync — it should be a no-op on completion (or optionally refresh project health).

**How to apply**: The status PATCH route needs to distinguish job type. For `RETRO_SPEC` jobs, skip the `syncProjectConfig()` call on COMPLETED.

### 4. Frontend Polling Pattern (from `app/lib/hooks/useSetupJobPolling.ts`)

**Polling logic**: React Query with 2s interval, stops on terminal conditions. Returns structured object with job, status flags, and error.

**How to apply**: `useRetroSpecPolling` should follow the same TanStack Query pattern but poll a different endpoint or filter by job command type. Stop polling when job reaches COMPLETED or FAILED.

### 5. Banner/Indicator Pattern (from `components/board/offline-indicator.tsx`)

**UI pattern**: Fixed/sticky banner with role="alert", aria-live="polite". Conditional rendering based on hook state.

**How to apply**: `retro-spec-banner.tsx` should use the same accessibility pattern but with dismissibility (localStorage persistence per FR-005).

### 6. Onboard Workflow Pattern (from `.github/workflows/onboard.yml`)

**Structure**: Inputs (project_id, job_id, githubRepository, agent) → Report RUNNING → Fetch credentials → Clone repo → Execute agent command → Report COMPLETED/FAILED.

**How to apply**: `retro-spec.yml` MUST follow the same structure but with additional inputs (depth, docUrl, context) and a different agent command (`ai-board.retro-spec`).
