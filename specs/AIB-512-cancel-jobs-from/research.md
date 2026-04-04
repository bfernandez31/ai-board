# Research: Cancel Jobs from UI + Rollback Recovery

## Research Question 1: How to track GitHub Actions workflow run ID

**Decision**: Add a `workflowRunId` BigInt field to the Job model in Prisma schema.

**Rationale**: The current Job model has no `workflowRunId` field. GitHub Actions workflow runs are identified by a BigInt run ID. To cancel a running workflow, we need this ID to call `octokit.actions.cancelWorkflowRun()`. The workflow's first status callback (RUNNING) is the natural point to populate this field — workflows already call `PATCH /api/jobs/:id/status` with their status.

**Alternatives considered**:
- Store run ID in job logs field (rejected: unstructured, hard to query)
- Query GitHub API by branch name to find run (rejected: unreliable with concurrent runs)
- Pass run ID back via a separate endpoint (rejected: unnecessary complexity when status endpoint already exists)

**Implementation**: Add `workflowRunId BigInt?` to Job model, extend the job status PATCH schema to accept an optional `workflowRunId` field, populate it when workflows report RUNNING status.

---

## Research Question 2: GitHub Actions cancel API pattern

**Decision**: Use `octokit.actions.cancelWorkflowRun({ owner, repo, run_id })` from the existing Octokit integration.

**Rationale**: The codebase already uses Octokit for `actions.createWorkflowDispatch()`. The cancel API is a simple REST call (`POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel`). Returns 202 on success. Idempotent — calling cancel on an already-completed run returns 409 (conflict), which we handle gracefully.

**Alternatives considered**:
- Direct fetch to GitHub API (rejected: Octokit already initialized in dispatch functions)
- Cancel via workflow dispatch of a "cancel" workflow (rejected: over-engineered)

**Implementation**: Create `cancelWorkflowRun(workflowRunId, githubRepository)` utility in `lib/workflows/`. Handle 202 (success) and 409 (already finished) responses.

---

## Research Question 3: Extending rollback matrix beyond existing two transitions

**Decision**: Extend `lib/stage-transitions.ts` and `rollback-validator.ts` to support all five rollback transitions defined in the spec.

**Rationale**: Currently only BUILD→INBOX (QUICK) and VERIFY→PLAN (FULL) are supported. The spec requires:
- SPECIFY→INBOX (delete branch if present)
- PLAN→SPECIFY (no git action, re-run specify overwrites)
- BUILD→PLAN (backup tag + git reset — like VERIFY→PLAN but from BUILD)
- VERIFY→BUILD (no git action, re-runs verify)
- VERIFY→PLAN (already exists)

Each transition has different git actions and validation rules. The existing `canRollbackToInbox()` / `canRollbackToPlan()` pattern extends naturally to new validators.

**Alternatives considered**:
- Single generic rollback function (rejected: each transition has unique git behavior)
- Separate rollback API endpoint (rejected: spec FR-012 requires integration into existing transition endpoint)

**Implementation**: Add validator functions per new transition. Extend `isValidTransition()` to recognize new rollback paths. Update transition route handler with new cases.

---

## Research Question 4: Backup tag creation/deletion in workflows

**Decision**: Create backup git tags in the rollback-reset workflow before git reset. Clean up tags in verify.yml at the start of successful runs.

**Rationale**: Current rollback-reset.yml uses filesystem backup (`/tmp/spec-backup/`) for spec files but creates no git tags. The spec requires `backup/{ticketKey}/{stage}-{jobId}` tags for recovering partial work via cherry-pick. Tags are persistent across workflow runs, unlike `/tmp/` directories.

**Alternatives considered**:
- Use git stash (rejected: stashes are local, not shared across runs)
- Create backup branches (rejected: tag naming is cleaner, branches pollute branch list)
- Skip backup tags and rely on git reflog (rejected: reflog is local and expires)

**Implementation**: In rollback-reset.yml, add `git tag backup/{ticketKey}/{stage}-{jobId}` before `git reset`. In verify.yml, add cleanup step: `git tag -l "backup/{ticketKey}/*" | xargs -r git push --delete origin`.

---

## Research Question 5: Cancel button UI placement and interaction pattern

**Decision**: Hover-revealed X button on board ticket cards; always-visible cancel button in ticket detail modal job timeline rows.

**Rationale**: The board already uses hover interactions (deploy button appears on hover). Adding a cancel X icon follows the same pattern. The ticket detail modal job timeline always shows full job details, so the cancel button should be always visible there. Existing confirmation dialog pattern (AlertDialog from shadcn/ui) will be reused.

**Alternatives considered**:
- Always-visible cancel on board cards (rejected: visual clutter with multiple action buttons)
- Context menu on right-click (rejected: less discoverable, not mobile-friendly)
- Cancel only from modal (rejected: forces extra click to access modal)

**Implementation**: Add cancel X icon to `ticket-card.tsx` (hover-only, next to job status indicator). Add cancel button to `jobs-timeline.tsx` rows for PENDING/RUNNING jobs. Both trigger CancelConfirmationModal.

---

## Research Question 6: Race condition handling for PENDING job cancel after workflow starts

**Decision**: When a PENDING job is cancelled locally, if the workflow subsequently starts and sends a RUNNING status callback, the status endpoint should detect the CANCELLED state and return an error, signaling the workflow to abort.

**Rationale**: There's a race window between `createWorkflowDispatch()` and the workflow's first status callback. If we cancel during this window, the workflow may start running. The status endpoint already validates state transitions via `canTransition()` — CANCELLED→RUNNING is invalid, so the callback will fail. The workflow should check the response and exit gracefully.

**Alternatives considered**:
- Block cancel until workflowRunId is populated (rejected: poor UX, may never populate if dispatch fails)
- Poll GitHub API to check if run started (rejected: adds latency, complex)

**Implementation**: No code change needed for the status endpoint — it already rejects invalid transitions. Update workflow scripts to check status callback response and abort if job is already CANCELLED.

---

## Research Question 7: Drag-and-drop rollback target highlighting

**Decision**: Extend existing dnd-kit drag handling to compute valid rollback targets based on the rollback matrix and visually highlight/grey out columns.

**Rationale**: The board already tracks `isDragging` and `dragSource` state. Stage columns already support visual feedback (opacity, border changes). We need to compute which columns are valid drop targets based on: (1) current stage, (2) workflow type, (3) last job status. Invalid columns get a greyed-out overlay.

**Alternatives considered**:
- Disable dragging entirely for failed tickets (rejected: rollback IS drag-based per spec)
- Use buttons instead of drag for rollback (rejected: spec explicitly requires drag-and-drop)

**Implementation**: Add `getValidRollbackTargets(stage, workflowType, lastJobStatus)` function. Pass valid targets to StageColumn components. Apply visual styling (opacity, border) based on whether column is a valid target during drag.
