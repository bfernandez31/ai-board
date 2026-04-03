# Implementation Plan: Cancel Jobs + Rollback Recovery

**Feature Branch**: `AIB-513-copy-of-cancel`
**Spec**: `specs/AIB-513-copy-of-cancel/spec.md`
**Created**: 2026-04-03

---

## Technical Context

| Aspect | Details |
|--------|---------|
| Database | PostgreSQL 14+ via Prisma 6.x |
| Backend | Next.js 16 App Router, TypeScript 5.9 strict |
| Frontend | React 18, TailwindCSS 3.4, shadcn/ui, @dnd-kit/core |
| State | TanStack Query v5, 2s job polling |
| Auth | NextAuth.js session-based |
| CI/CD | GitHub Actions workflows (speckit, quick-impl, verify, rollback-reset) |
| External API | GitHub REST API via Octokit (`actions:write` scope) |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | Using shadcn/ui (Dialog, Button), extending existing board components |
| III. Test-Driven | PASS | Testing strategy defined below — integration + unit + E2E coverage |
| IV. Security-First | PASS | Session auth on cancel endpoint, Zod validation, no raw SQL |
| V. Database Integrity | PASS | Prisma migration for workflowRunId, transactions for multi-step rollbacks |
| V. Spec Guardrails | PASS | CONSERVATIVE policy applied, auto-resolved decisions documented |

---

## Phase 1: Data Model & Backend

### Task 1.1: Add workflowRunId to Job model
**Files**:
- `prisma/schema.prisma` — Add `workflowRunId BigInt?` field to Job model
- New migration file via `bunx prisma migrate dev`

**Details**: Nullable BigInt column. No index needed (only queried by job ID, never by runId).

### Task 1.2: Extend job state machine for PENDING → CANCELLED
**Files**:
- `app/lib/job-state-machine.ts` — Add `CANCELLED` to PENDING's valid transitions

**Change**: `PENDING: ['PENDING', 'RUNNING']` → `PENDING: ['PENDING', 'RUNNING', 'CANCELLED']`

### Task 1.3: Extend job status update to accept workflowRunId
**Files**:
- `app/lib/job-update-validator.ts` — Add optional `workflowRunId` to Zod schema
- `app/api/jobs/[id]/status/route.ts` — Persist `workflowRunId` on RUNNING transition (only if currently null)

### Task 1.4: Create cancel job endpoint
**Files**:
- `app/api/jobs/[id]/cancel/route.ts` (new) — `POST /api/jobs/:id/cancel`

**Logic**:
1. Verify session auth + project access (via job → ticket → project)
2. Fetch job, validate status is PENDING or RUNNING
3. If RUNNING and `workflowRunId` set: call `octokit.actions.cancelWorkflowRun()`
4. Mark job as CANCELLED with `completedAt = now()`
5. GitHub API failure → log error, still mark CANCELLED locally
6. Return `{ id, status, completedAt }`

**Dependencies**: New helper `lib/workflows/cancel-workflow.ts` for GitHub API call.

### Task 1.5: Extend rollback validator with new paths
**Files**:
- `app/lib/workflows/rollback-validator.ts` — Add `canRollbackToSpecify()`, `canRollbackBuildToPlan()`, `canRollbackToBuild()` functions
- `lib/stage-transitions.ts` — Add new valid transitions: SPECIFY→INBOX (any workflow), PLAN→SPECIFY (any), BUILD→PLAN (FULL), VERIFY→BUILD (FULL)

**Rollback matrix**:
| From → To | Workflow | Job Status | Git Ops |
|-----------|----------|-----------|---------|
| SPECIFY → INBOX | Any | FAILED/CANCELLED | Delete branch |
| PLAN → SPECIFY | Any | FAILED/CANCELLED | None |
| BUILD → PLAN | FULL | FAILED/CANCELLED | Backup tag + rollback-reset |
| BUILD → INBOX | QUICK | FAILED/CANCELLED | Delete job (existing) |
| VERIFY → BUILD | FULL | FAILED/CANCELLED | None |
| VERIFY → PLAN | FULL | COMPLETED/FAILED/CANCELLED | Backup tag + rollback-reset (existing) |

### Task 1.6: Extend transition endpoint for new rollback paths
**Files**:
- `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` — Add handlers for SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD

**SPECIFY→INBOX handler**:
- Validate via `canRollbackToSpecify()` (new, covers SPECIFY→INBOX)
- Delete branch via GitHub API if `ticket.branch` is set
- Transaction: update ticket (stage=INBOX, branch=null, version increment), delete job

**PLAN→SPECIFY handler**:
- Validate via `canRollbackToSpecify()` (covers PLAN→SPECIFY too)
- Transaction: update ticket (stage=SPECIFY, version increment), delete job

**BUILD→PLAN handler** (FULL workflow):
- Validate via `canRollbackBuildToPlan()`
- Transaction: update ticket (stage=PLAN, previewUrl=null, version increment), delete job
- Dispatch rollback-reset workflow (with backup tag creation)

**VERIFY→BUILD handler**:
- Validate via `canRollbackToBuild()`
- Transaction: update ticket (stage=BUILD, previewUrl=null, version increment), delete job

### Task 1.7: Extend rollback-reset workflow for backup tags
**Files**:
- `.github/workflows/rollback-reset.yml` — Add step to create `backup/{ticketKey}/{stage}-{jobId}` tag before hard reset
- `.github/workflows/verify.yml` — Add step to delete `backup/{ticketKey}/*` tags on successful verify start

### Task 1.8: Add branch deletion helper
**Files**:
- `lib/workflows/delete-branch.ts` (new) — Helper to delete a git branch via GitHub API (`octokit.git.deleteRef()`)

---

## Phase 2: Frontend — Cancel UI

### Task 2.1: Cancel button on ticket card (board)
**Files**:
- `components/board/ticket-card.tsx` — Add cancel button (X icon) visible on hover when job is PENDING or RUNNING
- `components/board/job-status-indicator.tsx` — May need adjustment to accommodate cancel button placement

**UX**: X icon button appears on hover next to the job status indicator. Clicking opens confirmation dialog.

### Task 2.2: Cancel action on job timeline (ticket detail modal)
**Files**:
- `components/ticket/jobs-timeline.tsx` — Add cancel button on PENDING/RUNNING job rows

**UX**: Small "Annuler" button or X icon on the right side of the job row for active jobs.

### Task 2.3: Cancel confirmation dialog
**Files**:
- `components/board/cancel-job-dialog.tsx` (new) — Confirmation dialog with French text: "Annuler le workflow {command} en cours ?"

**UX**: shadcn/ui AlertDialog with confirm/cancel buttons. On confirm, calls `POST /api/jobs/:id/cancel`. Disables confirm button after first click (double-click prevention).

### Task 2.4: Cancel mutation hook
**Files**:
- `app/lib/hooks/useCancelJob.ts` (new) — TanStack Query mutation for cancel endpoint

**Details**: Optimistic update sets job status to CANCELLED in query cache. Invalidates ticket queries on settlement. Disables while mutation is pending.

---

## Phase 3: Frontend — Rollback Drag-and-Drop

### Task 3.1: Compute rollback drop targets during drag
**Files**:
- `components/board/board.tsx` — Extend `handleDragStart` to compute valid rollback targets when ticket has FAILED/CANCELLED job. Set state for `validRollbackTargets: Stage[]`.

**Logic**: When dragging a ticket with a FAILED/CANCELLED most-recent job:
- Look up rollback matrix based on current stage + workflowType
- Set valid targets (e.g., BUILD/FULL/FAILED → [PLAN])
- All other columns get greyed-out styling

### Task 3.2: Visual feedback on board columns during rollback drag
**Files**:
- `components/board/board.tsx` — Pass `validRollbackTargets` and `isDraggingRollback` to column components
- `components/board/board-column.tsx` (or equivalent) — Apply `opacity-30` to invalid targets, highlight valid ones

### Task 3.3: Rollback confirmation dialogs
**Files**:
- `components/board/rollback-confirm-dialog.tsx` (new or extend existing) — Stage-specific French confirmation messages

**Messages**:
- SPECIFY→INBOX: "Revenir a Inbox ? La branche sera supprimee."
- PLAN→SPECIFY: "Revenir a Specify ? La specification sera conservee."
- BUILD→PLAN: "Revenir a Plan ? Le code sera reinitialise (backup cree)."
- VERIFY→BUILD: "Revenir a Build ? La verification sera relancee."
- VERIFY→PLAN: "Revenir a Plan ? Le code sera reinitialise (backup cree)." (existing)

### Task 3.4: Extend handleDragEnd for new rollback transitions
**Files**:
- `components/board/board.tsx` — Extend `handleDragEnd` to handle new rollback paths, show appropriate confirmation dialog, call transition endpoint on confirm

---

## Phase 4: Testing

### Task 4.1: Unit tests — job state machine extension
**Type**: Unit test
**File**: `tests/unit/job-state-machine.test.ts` (extend existing)
**Covers**: PENDING→CANCELLED transition validity

### Task 4.2: Unit tests — rollback validator new paths
**Type**: Unit test
**File**: `tests/unit/rollback-validator.test.ts` (extend existing)
**Covers**: `canRollbackToSpecify()`, `canRollbackBuildToPlan()`, `canRollbackToBuild()` — valid/invalid scenarios

### Task 4.3: Unit tests — stage transitions extension
**Type**: Unit test
**File**: `tests/unit/stage-transitions.test.ts` (extend existing or create)
**Covers**: `isValidTransition()` for new rollback paths

### Task 4.4: Integration tests — cancel job endpoint
**Type**: Integration test (Vitest)
**File**: `tests/integration/jobs/cancel.test.ts` (new)
**Covers**:
- Cancel PENDING job (no GitHub API call)
- Cancel RUNNING job with workflowRunId
- Cancel already-CANCELLED job (idempotent)
- Cancel COMPLETED job (rejected)
- Auth: unauthorized user gets 401/403
- Concurrent cancel (optimistic locking)

### Task 4.5: Integration tests — workflowRunId persistence
**Type**: Integration test (Vitest)
**File**: `tests/integration/jobs/status.test.ts` (extend existing)
**Covers**:
- RUNNING status update with workflowRunId persists the value
- Subsequent RUNNING update does not overwrite existing workflowRunId
- workflowRunId not accepted on non-RUNNING status updates

### Task 4.6: Integration tests — new rollback transitions
**Type**: Integration test (Vitest)
**File**: `tests/integration/tickets/transitions.test.ts` (extend existing)
**Covers**:
- SPECIFY→INBOX with FAILED job
- PLAN→SPECIFY with CANCELLED job
- BUILD→PLAN with FAILED job (FULL workflow)
- VERIFY→BUILD with FAILED job
- Rejection when job is RUNNING/PENDING
- Rejection for wrong workflow type

### Task 4.7: Component tests — cancel button
**Type**: Component test (Vitest + RTL)
**File**: `tests/unit/components/cancel-job-dialog.test.tsx` (new)
**Covers**:
- Cancel button visibility on hover for RUNNING/PENDING jobs
- Cancel button hidden for COMPLETED/FAILED jobs
- Confirmation dialog display and text
- Double-click prevention (button disabled after first click)

### Task 4.8: E2E tests — rollback drag-and-drop (new paths)
**Type**: E2E test (Playwright)
**File**: `tests/e2e/rollback-new-paths.spec.ts` (new)
**Covers**:
- Drag SPECIFY ticket with FAILED job to INBOX → confirmation → success
- Drag BUILD ticket (FULL) with FAILED job to PLAN → confirmation → success
- Visual: invalid columns greyed out during rollback drag
- Drag rejection when job is RUNNING (no rollback targets shown)

**Justification for E2E**: Drag-and-drop requires a real browser (@dnd-kit mouse events). Column highlight/grey-out is a visual-only behavior.

---

## Dependency Order

```
1.1 (schema) → 1.2 (state machine) → 1.3 (status endpoint) → 1.4 (cancel endpoint)
                                                                     ↓
1.5 (rollback validator) → 1.6 (transition endpoint) ← 1.8 (delete branch)
                                    ↓
                           1.7 (workflow yaml)
                                    ↓
2.1-2.4 (cancel UI) — can start after 1.4
3.1-3.4 (rollback UI) — can start after 1.6
4.x (tests) — parallel with implementation, per task
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| GitHub API cancel call fails | Mark CANCELLED locally regardless; workflow callbacks rejected for terminal jobs |
| Race: workflow starts after PENDING cancel | State machine rejects CANCELLED→RUNNING; workflow callback returns 400 |
| Backup tag creation fails | Abort rollback, mark job FAILED, preserve current state |
| Branch deletion fails on SPECIFY→INBOX | Log error, proceed with stage change (branch is orphaned but harmless) |
| Large BigInt serialization in JSON | Prisma handles BigInt→string serialization; frontend receives as string |

---

## Generated Artifacts

- `specs/AIB-513-copy-of-cancel/research.md` — Research decisions
- `specs/AIB-513-copy-of-cancel/data-model.md` — Schema changes and entity relationships
- `specs/AIB-513-copy-of-cancel/contracts/cancel-job-api.yaml` — Cancel endpoint contract
- `specs/AIB-513-copy-of-cancel/contracts/rollback-transitions-api.yaml` — Rollback transition extensions
- `specs/AIB-513-copy-of-cancel/contracts/job-status-update-extension.yaml` — workflowRunId extension
