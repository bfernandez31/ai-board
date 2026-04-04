# Implementation Plan: Cancel Jobs from UI + Rollback Recovery

**Feature Branch**: `AIB-512-cancel-jobs-from`
**Created**: 2026-04-03
**Status**: Ready for Implementation

## Technical Context

| Aspect | Details |
|--------|---------|
| Database | PostgreSQL 14+ via Prisma 6.x. Job model needs `workflowRunId BigInt?` field. |
| Backend | Next.js 16 App Router, TypeScript 5.9 strict. Existing transition endpoint at `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`. |
| Frontend | React 18, TanStack Query v5.95.2, dnd-kit for drag-and-drop, shadcn/ui + Radix UI. |
| Workflows | GitHub Actions via Octokit. Existing rollback-reset.yml, verify.yml need extension for backup tags. |
| Auth | NextAuth.js session-based. `verifyProjectAccess()` for authorization. |
| Polling | 2s job polling via `useJobPolling` hook. Cancel state reflected within one polling cycle. |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | Uses shadcn/ui AlertDialog for confirmations, feature-based folders |
| III. Test-Driven | PASS | Integration tests for cancel/rollback endpoints, component tests for UI, E2E for drag-drop rollback |
| IV. Security-First | PASS | Zod validation on cancel endpoint, session auth, project access checks |
| V. Database Integrity | PASS | Prisma migration for new field, transactions for rollback operations |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented with CONSERVATIVE policy |

## Implementation Phases

### Phase 1: Schema + Cancel Infrastructure (Backend)

**Goal**: Add workflowRunId tracking and cancel endpoint.

#### 1.1 Prisma Schema Migration

**Files**: `prisma/schema.prisma`

- Add `workflowRunId BigInt?` field to Job model
- Add `@@index([workflowRunId])` for lookup performance
- Run `bunx prisma migrate dev --name add-workflow-run-id`
- Run `bunx prisma generate`

#### 1.2 Extend Job Status Endpoint

**Files**: `app/api/jobs/[id]/status/route.ts`

- Extend `jobStatusUpdateSchema` to accept optional `workflowRunId` (positive BigInt)
- On RUNNING status update: if `workflowRunId` provided and job's `workflowRunId` is null, populate it (first-write-wins)
- If job is already CANCELLED when RUNNING callback arrives: return 409 with `{ error: "Job already cancelled", status: "CANCELLED" }` — workflow should abort

#### 1.3 Cancel Workflow Run Utility

**Files**: `lib/workflows/cancel-workflow-run.ts` (new)

```typescript
export async function cancelWorkflowRun(
  workflowRunId: bigint,
  githubRepository: string
): Promise<{ cancelled: boolean; alreadyFinished: boolean }>
```

- Parse `owner/repo` from `githubRepository`
- Call `octokit.actions.cancelWorkflowRun({ owner, repo, run_id: Number(workflowRunId) })`
- Handle 202 (success): return `{ cancelled: true, alreadyFinished: false }`
- Handle 409 (already done): return `{ cancelled: false, alreadyFinished: true }`
- Handle other errors: throw with context

#### 1.4 Cancel Job Endpoint

**Files**: `app/api/jobs/[id]/cancel/route.ts` (new)

- POST handler with session auth
- Fetch job with ticket → project relationship
- `verifyProjectAccess(project.id)` authorization
- If already terminal: return 200 with `alreadyTerminal: true`
- If PENDING (no workflowRunId): mark CANCELLED directly
- If RUNNING (has workflowRunId): call `cancelWorkflowRun()`, then mark CANCELLED
- If GitHub API fails: return 502, do NOT change job status

#### 1.5 Update Workflow Scripts

**Files**: All workflow `.yml` files that report RUNNING status

- Include `GITHUB_RUN_ID` (`${{ github.run_id }}`) in the RUNNING status callback:
  ```bash
  curl -X PATCH ... -d '{"status": "RUNNING", "workflowRunId": '${{ github.run_id }}'}'
  ```
- Add check after status callback: if response is 409, exit workflow gracefully

---

### Phase 2: Extended Rollback Transitions (Backend)

**Goal**: Support all five rollback transitions through the existing transition endpoint.

#### 2.1 Extend Stage Transition Validation

**Files**: `lib/stage-transitions.ts`

- Add new valid transitions to `isValidTransition()`:
  - SPECIFY → INBOX (FULL workflow)
  - PLAN → SPECIFY (FULL workflow)
  - BUILD → PLAN (FULL workflow)
  - VERIFY → BUILD (FULL workflow)
- Keep existing: BUILD → INBOX (QUICK), VERIFY → PLAN (FULL)

#### 2.2 Extend Rollback Validators

**Files**: `app/lib/workflows/rollback-validator.ts`

Add new validator functions:

```typescript
// SPECIFY → INBOX: delete branch, clear state
canRollbackSpecifyToInbox(ticket, lastJob): RollbackValidation

// PLAN → SPECIFY: no git action, stage change only
canRollbackPlanToSpecify(ticket, lastJob): RollbackValidation

// BUILD → PLAN: backup tag + git reset (reuse rollback-reset workflow)
canRollbackBuildToPlan(ticket, lastJob): RollbackValidation

// VERIFY → BUILD: no git action, stage change only
canRollbackVerifyToBuild(ticket, lastJob): RollbackValidation
```

All validators check:
- Correct source stage
- Correct workflow type (FULL for all new transitions)
- Last job is FAILED or CANCELLED (not RUNNING/PENDING)

#### 2.3 Extend Transition Route Handler

**Files**: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

Add cases for each new rollback:

- **SPECIFY → INBOX**: Delete branch via Octokit (if exists), update ticket (stage=INBOX, branch=null, workflowType=FULL, version=1), delete job
- **PLAN → SPECIFY**: Update ticket (stage=SPECIFY, version++), delete job. No git action.
- **BUILD → PLAN**: Create rollback-reset job, dispatch rollback-reset workflow, update ticket (stage=PLAN, previewUrl=null, version++), delete failed job
- **VERIFY → BUILD**: Update ticket (stage=BUILD, version++), delete job. No git action.

#### 2.4 Extend Rollback-Reset Workflow for Backup Tags

**Files**: `.github/workflows/rollback-reset.yml`

Before the `git reset --hard` step:
```bash
# Create backup tag before destructive reset
git tag "backup/${{ inputs.ticket_id }}/${STAGE}-${{ inputs.job_id }}"
git push origin "backup/${{ inputs.ticket_id }}/${STAGE}-${{ inputs.job_id }}"
```

Accept new input `stage` (e.g., "build" or "verify") for tag naming.

#### 2.5 Add Backup Tag Cleanup to Verify Workflow

**Files**: `.github/workflows/verify.yml`

At the start of a successful verify run, before any other operations:
```bash
# Clean up backup tags for this ticket
TAGS=$(git ls-remote --tags origin "refs/tags/backup/${{ inputs.ticket_id }}/*" | awk '{print $2}' | sed 's|refs/tags/||')
if [ -n "$TAGS" ]; then
  for TAG in $TAGS; do
    git push origin --delete "refs/tags/$TAG" || true
  done
fi
```

---

### Phase 3: Board UI — Cancel Button (Frontend)

**Goal**: Add cancel functionality to board ticket cards and ticket detail modal.

#### 3.1 Cancel Confirmation Modal

**Files**: `components/board/cancel-confirmation-modal.tsx` (new)

- Uses AlertDialog (shadcn/ui) — same pattern as `delete-confirmation-modal.tsx`
- Props: `open`, `onOpenChange`, `onConfirm`, `jobCommand`, `isCancelling`
- Message: "Annuler le workflow {command} en cours ?"
- Destructive action button (red): "Confirmer l'annulation"
- Cancel button: "Garder le workflow"

#### 3.2 Cancel Job Mutation Hook

**Files**: `lib/hooks/mutations/useCancelJob.ts` (new)

```typescript
export function useCancelJob(projectId: number) {
  return useMutation({
    mutationFn: (jobId: number) => fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.jobsStatus(projectId) });
    },
  });
}
```

#### 3.3 Cancel Button on Ticket Card

**Files**: `components/board/ticket-card.tsx`

- Add X icon button (lucide-react `X` or `XCircle`) that appears on hover
- Only visible when ticket has a PENDING or RUNNING workflow job
- Positioned next to job status indicator
- `onClick` (with `stopPropagation` to prevent card click): open CancelConfirmationModal
- Button disabled while `isCancelling` mutation is in-flight

#### 3.4 Cancel Button on Job Timeline

**Files**: `components/ticket/jobs-timeline.tsx`

- Add always-visible cancel button on timeline rows for PENDING/RUNNING jobs
- Small icon button with XCircle icon
- Same confirmation modal pattern
- Disabled after first click (prevent double-cancel)

---

### Phase 4: Board UI — Rollback Drag-and-Drop (Frontend)

**Goal**: Enable drag-based rollback with visual target highlighting.

#### 4.1 Rollback Target Computation

**Files**: `lib/stage-transitions.ts` (extend)

```typescript
export function getValidRollbackTargets(
  stage: Stage,
  workflowType: WorkflowType,
  lastJobStatus: JobStatus | null
): Stage[]
```

Returns array of valid target stages based on rollback matrix. Returns empty array if no rollback is possible (e.g., job still running).

#### 4.2 Extend Board Drag Handler

**Files**: `components/board/board.tsx`

- On `handleDragStart`: compute valid rollback targets using `getValidRollbackTargets()`
- Store in state: `validRollbackTargets: Stage[]`
- Pass to StageColumn components
- On `handleDragEnd`: detect rollback transitions and show appropriate confirmation modal

#### 4.3 Stage Column Visual Feedback

**Files**: `components/board/stage-column.tsx`

- When `isDragging` is true and ticket has failed/cancelled job:
  - Valid rollback targets: highlight with stage color border (existing pattern)
  - Invalid targets: grey overlay with reduced opacity
- Forward-only targets also greyed out during rollback drag
- Drag source column: no highlight (can't drop on self)

#### 4.4 Rollback Confirmation Modals

**Files**: `components/board/board.tsx` (extend existing modal handling)

New confirmation modals for new rollback transitions:

- **SPECIFY → INBOX**: "Revenir a Inbox ? La branche sera supprimee."
- **PLAN → SPECIFY**: "Revenir a Specify ? Le plan partiel sera ecrase au prochain lancement."
- **BUILD → PLAN**: "Revenir a Plan ? Le code sera reinitialise (backup cree)." (reuse RollbackVerifyModal pattern)
- **VERIFY → BUILD**: "Revenir a Build ? Le code actuel sera conserve, verify sera relance."

Reuse existing modal patterns — extend `RollbackVerifyModal` or create stage-specific variants as needed.

#### 4.5 Block Drag for Active Jobs

**Files**: `components/board/board.tsx`

- Extend existing `draggedTicketHasJob` logic to block rollback drag when last job is RUNNING or PENDING
- Only allow rollback drag when last job is FAILED or CANCELLED (per FR-013)

---

### Phase 5: Testing

**Goal**: Comprehensive test coverage for all new functionality.

#### 5.1 Integration Tests — Cancel Endpoint

**Files**: `tests/integration/jobs/cancel-job.test.ts` (new)

Test cases:
- Cancel a RUNNING job → returns CANCELLED, GitHub API called
- Cancel a PENDING job → returns CANCELLED, no GitHub API call
- Cancel an already-COMPLETED job → returns 200 with alreadyTerminal
- Cancel with invalid job ID → returns 404
- Cancel without auth → returns 401/403
- Double-cancel (idempotent) → returns 200 both times

#### 5.2 Integration Tests — Extended Rollback Transitions

**Files**: `tests/integration/tickets/rollback-transitions.test.ts` (new or extend existing)

Test cases per transition:
- SPECIFY → INBOX with FAILED job → success, branch deleted
- PLAN → SPECIFY with FAILED job → success, no git action
- BUILD → PLAN with FAILED job → success, rollback-reset dispatched
- VERIFY → BUILD with FAILED job → success, stage updated
- Each transition with RUNNING job → rejected (400)
- Each transition with wrong workflow type → rejected (400)

#### 5.3 Integration Tests — Job Status Extension

**Files**: `tests/integration/jobs/job-status.test.ts` (extend existing)

Test cases:
- RUNNING status with workflowRunId → field populated
- RUNNING status without workflowRunId → field stays null
- RUNNING status on already-CANCELLED job → returns 409
- Second RUNNING callback with different workflowRunId → first-write-wins

#### 5.4 Component Tests — Cancel UI

**Files**: `tests/unit/components/cancel-confirmation-modal.test.tsx` (new)

- Renders with correct message including command name
- Confirm button triggers onConfirm
- Cancel button closes modal
- Disabled state while cancelling

#### 5.5 Component Tests — Rollback Target Highlighting

**Files**: `tests/unit/stage-transitions.test.ts` (extend)

- `getValidRollbackTargets()` returns correct targets for each stage/workflowType/jobStatus combination
- Returns empty array for non-terminal job statuses
- Returns empty array for stages with no rollback options

#### 5.6 E2E Tests — Board Drag Rollback (Browser Required)

**Files**: `tests/e2e/board-rollback.spec.ts` (new)

- Drag ticket from BUILD to PLAN → confirmation appears → confirm → stage changes
- Drag ticket with RUNNING job → drag blocked
- Valid/invalid column highlighting during drag

**Test Type Rationale**:
- Cancel endpoint: **Integration** (API + DB, no browser needed)
- Rollback transitions: **Integration** (API + DB + workflow dispatch mock)
- Cancel UI components: **Component** (React rendering + user interaction)
- Rollback target computation: **Unit** (pure function)
- Board drag-and-drop: **E2E** (requires browser for dnd-kit drag simulation)

---

## Dependency Graph

```
Phase 1.1 (Schema) ──┬── Phase 1.2 (Status Extension)
                      ├── Phase 1.3 (Cancel Utility)
                      └── Phase 1.4 (Cancel Endpoint) ── Phase 3 (Cancel UI)

Phase 2.1 (Stage Validation) ──┬── Phase 2.2 (Validators)
                                └── Phase 2.3 (Route Handler) ── Phase 4 (Rollback UI)

Phase 1.5 (Workflow Scripts) ── independent, can be done in parallel
Phase 2.4 (Backup Tags) ── depends on 2.3
Phase 2.5 (Tag Cleanup) ── independent of app code

Phase 5 (Testing) ── after Phases 1-4
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Race condition: cancel after job completes | Medium | Low | Idempotent cancel endpoint, return current status on conflict |
| PENDING cancel but workflow starts | Medium | Low | Status endpoint rejects CANCELLED→RUNNING, workflow aborts |
| Backup tag accumulation on failed verify | Low | Low | Tags are lightweight; manual cleanup possible; auto-cleanup on next success |
| BigInt handling in JavaScript | Low | Medium | Prisma handles BigInt natively; serialize as string in JSON if needed |
| dnd-kit drag events conflicting with cancel button | Medium | Medium | `stopPropagation` on cancel button click, separate drag handle if needed |

## Artifacts

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-512-cancel-jobs-from/research.md` |
| Data Model | `specs/AIB-512-cancel-jobs-from/data-model.md` |
| Cancel Contract | `specs/AIB-512-cancel-jobs-from/contracts/cancel-job.md` |
| Status Extension | `specs/AIB-512-cancel-jobs-from/contracts/job-status-extension.md` |
| Rollback Contract | `specs/AIB-512-cancel-jobs-from/contracts/rollback-transitions.md` |
| Quickstart | `specs/AIB-512-cancel-jobs-from/quickstart.md` |
