# Implementation Plan: Retro-Spec — Generate Project Specifications for Existing Codebases

**Feature Branch**: `AIB-587-copy-of-retro`
**Date**: 2026-04-09
**Status**: Ready for implementation

---

## Technical Context

| Area | Current State | Change Required |
|------|--------------|-----------------|
| Database | `ProjectSetupJob` model for onboarding init | Add `SpecGenerationJob` model, `SpecDepth` enum, `specsGeneratedAt` on Project |
| Setup page | Redirects to board when `configSyncedAt` set | Add Step 2 for spec generation; conditional redirect logic |
| Board | No spec-related indicators | Add progress badge, "no specs" banner, generate modal |
| Workflows | `onboard.yml` for project init | Add `retro-spec.yml` for spec generation |
| API | Setup job endpoints at `/api/projects/:id/setup/jobs` | Add parallel endpoints at `/api/projects/:id/spec-generation/jobs` |
| Polling | `useSetupJobPolling` hook | Add `useSpecGenPolling` hook |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | shadcn/ui components, feature-based structure |
| III. Test-Driven | PASS | Integration tests for API, component tests for UI |
| IV. Security-First | PASS | Zod validation, owner-only access, workflow token auth |
| V. Database Integrity | PASS | Prisma migration, transaction for job creation, no orphaned rows |
| V. Spec Clarification | PASS | Auto-resolved decisions documented in spec |

---

## Implementation Phases

### Phase 1: Database Schema & Migration

**Files**:
- `prisma/schema.prisma` — Add `SpecDepth` enum, `SpecGenerationJob` model, `specsGeneratedAt` field on Project, `specGenerationJobs` relation on Project

**Tasks**:
1. Add `SpecDepth` enum (`QUICK`, `STANDARD`, `COMPREHENSIVE`)
2. Add `SpecGenerationJob` model (see `data-model.md`)
3. Add `specsGeneratedAt DateTime?` to Project model
4. Add `specGenerationJobs SpecGenerationJob[]` relation to Project
5. Run `bunx prisma migrate dev --name add-spec-generation-job`
6. Run `bunx prisma generate`

**Validation**: `bun run type-check` passes

---

### Phase 2: API Endpoints

**Pattern reference**: Follow dispatch-then-rollback pattern from `app/api/projects/[projectId]/setup/jobs/route.ts:67-130`

#### 2a: POST + GET `/api/projects/:projectId/spec-generation/jobs`

**File**: `app/api/projects/[projectId]/spec-generation/jobs/route.ts`

POST handler:
1. Validate projectId, authenticate, verify project ownership
2. Parse body with Zod (`createSpecGenJobSchema`)
3. Pre-flight credential check via `getOwnerCredential(projectId, provider)`
4. Transaction:
   - Verify `configSyncedAt` is set (409 `NOT_CONFIGURED` if null)
   - Check no active job (PENDING/RUNNING) for this project (409 `JOB_ACTIVE`)
   - Create `SpecGenerationJob` with PENDING status
5. Dispatch `retro-spec.yml` workflow outside transaction
6. On dispatch failure: update job to FAILED

GET handler:
1. Validate projectId, authenticate, verify project access (owner or member)
2. Fetch latest `SpecGenerationJob` ordered by `createdAt DESC`
3. Fetch `project.specsGeneratedAt`
4. Return `{ job, specsGeneratedAt }`

#### 2b: PATCH `/api/projects/:projectId/spec-generation/jobs/:jobId/status`

**File**: `app/api/projects/[projectId]/spec-generation/jobs/[jobId]/status/route.ts`

Follow pattern from `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts`:
1. `validateWorkflowAuth()`
2. Zod-validate body
3. Enforce state transition rules
4. Set timestamps (`startedAt`, `completedAt`)
5. On COMPLETED: set `project.specsGeneratedAt = now()`

---

### Phase 3: Workflow Dispatch Utility

**File**: `lib/workflows/dispatch-spec-generation.ts`

**Pattern reference**: Follow `lib/workflows/dispatch-onboard.ts`

```typescript
interface SpecGenDispatchInputs {
  project_id: string;
  job_id: string;
  githubRepository: string;
  agent: Agent;
  depth: string;
  documentation_url: string;
  additional_context: string;
}
```

1. Check `isWorkflowTestMode()` → return early if test
2. Validate credential via `getOwnerCredential()`
3. Create Octokit client
4. Dispatch `retro-spec.yml` with inputs
5. Throw on failure with descriptive message

---

### Phase 4: Frontend — Query Keys & Polling Hook

#### 4a: Query Keys

**File**: `app/lib/query-keys.ts`

Add under `projects`:
```typescript
specGenJob: (projectId: number) =>
  ['projects', projectId, 'spec-generation', 'job'] as const,
```

#### 4b: Polling Hook

**File**: `app/lib/hooks/useSpecGenPolling.ts`

**Pattern reference**: Follow `app/lib/hooks/useSetupJobPolling.ts`

- Poll GET `/api/projects/:projectId/spec-generation/jobs`
- Interval: 2000ms (matches existing polling patterns)
- Stop on: terminal status (COMPLETED, FAILED) or `specsGeneratedAt` set
- Return: `{ job, specsGeneratedAt, isPolling, error }`

---

### Phase 5: Frontend — Setup Page Step 2

#### 5a: Server Component Update

**File**: `app/projects/[projectId]/setup/page.tsx`

Current (line 40-41): Redirects to board when `configSyncedAt` is set.

Change to:
- Fetch `specsGeneratedAt` alongside `configSyncedAt`
- If `configSyncedAt` AND `specsGeneratedAt` → redirect to board
- If `configSyncedAt` AND NOT `specsGeneratedAt` → show Step 2
- If NOT `configSyncedAt` → show Step 1 (existing behavior)
- Also check for active/completed spec gen job → if completed, redirect to board

Pass additional props to `SetupPageClient`: `showStep2: boolean`

#### 5b: Client Component Update

**File**: `components/setup/setup-page-client.tsx`

Add Step 2 UI when `showStep2` is true:
1. Depth picker (3 radio cards: Quick/Standard/Comprehensive with descriptions and estimated times)
2. Optional documentation URL input field
3. Optional additional context textarea
4. "Generate Specs" button → POST to spec-generation/jobs API, redirect to board on success
5. "Skip for now" button → redirect to board immediately
6. Job status display (reuse patterns from Step 1: loading spinner, error with retry)
7. Use `useSpecGenPolling` for status tracking

**Agent selection**: Inherit from Step 1 (use project's `defaultAgent`) — no need to re-select

---

### Phase 6: Frontend — Board Integration

#### 6a: Board Page Update

**File**: `app/projects/[projectId]/board/page.tsx`

- Fetch `project.specsGeneratedAt` and `project.userId`
- Pass to Board component: `specsGeneratedAt`, `isOwner`

#### 6b: Spec Generation Badge

**File**: `components/board/spec-gen-badge.tsx`

- Shows in the board area (above columns) when a spec gen job is active
- States:
  - PENDING/RUNNING: "Generating specs..." with pulse animation
  - COMPLETED: "Specs ready" with check icon, fades after 30s (CSS animation + `setTimeout` to unmount)
  - FAILED: Error badge with retry option
- Uses `useSpecGenPolling` hook

#### 6c: Spec Generation Banner

**File**: `components/board/spec-gen-banner.tsx`

- Shown when: `specsGeneratedAt === null` AND `configSyncedAt !== null` AND no active spec gen job AND not dismissed in session
- Dismissible via `sessionStorage` key: `spec-banner-dismissed-${projectId}`
- Content: "Project specs not generated — Specs improve health scans, ticket workflows, and code review quality"
- Buttons: "Generate" (opens modal), "Dismiss" (hides for session)
- Uses `role="banner"` and accessible dismiss button

#### 6d: Spec Generation Modal

**File**: `components/board/spec-gen-modal.tsx`

- Radix Dialog with same fields as Step 2: depth picker, doc URL, additional context
- On submit: POST to spec-generation/jobs API
- On success: close modal, badge appears automatically via polling
- Follow pattern from `components/board/new-ticket-modal.tsx` (Dialog + Zod + loading states)

#### 6e: Board Component Integration

**File**: `components/board/board.tsx`

- Add `specsGeneratedAt` and `isOwner` to `BoardProps`
- Render `<SpecGenBanner>` above the DndContext (only for owners)
- Render `<SpecGenBadge>` above the columns area

---

### Phase 7: GitHub Workflow

**File**: `.github/workflows/retro-spec.yml`

Follow pattern from `.github/workflows/onboard.yml`. See `workflows/retro-spec-workflow.md` for full specification.

Key differences from onboard.yml:
- Additional inputs: `depth`, `documentation_url`, `additional_context`
- Status endpoint: `/api/projects/:id/spec-generation/jobs/:id/status` (not setup/jobs)
- Runs `ai-board.retro-spec` command instead of `ai-board.onboard`
- Longer timeout (30 min vs 10 min)
- On COMPLETED: sets `specsGeneratedAt` via status callback

---

### Phase 8: Agent Command

**File**: `.claude-plugin/commands/ai-board.retro-spec.md`

See `workflows/retro-spec-command.md` for full specification.

---

## Testing Strategy

### Integration Tests

**File**: `tests/integration/projects/spec-generation-job.test.ts` (NEW)

Tests for the 3 API endpoints:
- POST: happy path, validation errors, missing credentials, active job conflict, not-configured guard, owner-only
- GET: returns latest job, returns null when none, returns specsGeneratedAt
- PATCH: valid transitions, invalid transitions, COMPLETED sets specsGeneratedAt, workflow token auth

### Component Tests

**File**: `tests/unit/components/setup/setup-page.test.tsx` (EXTEND)

Add tests for Step 2:
- Renders depth picker when `showStep2` is true
- Generate button dispatches API call
- Skip button redirects to board
- Shows loading/error states

**File**: `tests/unit/components/board/spec-gen-banner.test.tsx` (NEW)

- Banner renders when `specsGeneratedAt` is null
- Banner hidden when `specsGeneratedAt` is set
- Dismiss hides banner for session
- Generate button opens modal

**File**: `tests/unit/components/board/spec-gen-badge.test.tsx` (NEW)

- Shows "Generating specs..." when job is RUNNING
- Shows "Specs ready" when COMPLETED
- Fades after 30 seconds
- Shows error state when FAILED

### Unit Tests

**File**: `tests/unit/workflows/dispatch-spec-generation.test.ts` (NEW — only if complex logic warrants it)

- Test mode skips dispatch
- Credential validation before dispatch

---

## Dependency Order

```
Phase 1 (schema) → Phase 2 (API) → Phase 3 (dispatch)
                                        ↓
Phase 4 (query keys + polling) → Phase 5 (setup page) → Phase 6 (board)
                                                              ↓
Phase 7 (workflow) → Phase 8 (command)
```

Phases 7-8 (workflow + command) can be developed in parallel with Phases 4-6 (frontend) since they only share the API contract.

---

## Artifacts Generated

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-587-copy-of-retro/research.md` |
| Data Model | `specs/AIB-587-copy-of-retro/data-model.md` |
| API Contracts | `specs/AIB-587-copy-of-retro/contracts/spec-generation-api.md` |
| Workflow Spec | `specs/AIB-587-copy-of-retro/workflows/retro-spec-workflow.md` |
| Command Spec | `specs/AIB-587-copy-of-retro/workflows/retro-spec-command.md` |
| Plan | `specs/AIB-587-copy-of-retro/plan.md` |
