# Research: Cancel Jobs + Rollback Recovery

## Decision 1: GitHub Actions Workflow Cancellation API

- **Decision**: Use `octokit.actions.cancelWorkflowRun({ owner, repo, run_id })` to cancel running workflows
- **Rationale**: This is the official GitHub REST API method. It requires `actions:write` scope on the token. Returns 202 on success. The workflow transitions to "cancelled" state asynchronously — the API returns immediately but the workflow may take a few seconds to actually stop.
- **Alternatives considered**:
  - Direct REST call via fetch — rejected, Octokit is already used throughout the codebase for workflow dispatch
  - GitHub GraphQL API — no equivalent mutation exists for cancellation

## Decision 2: Job State Machine Extension for PENDING → CANCELLED

- **Decision**: Extend the PENDING valid transitions to `[PENDING, RUNNING, CANCELLED]` in `app/lib/job-state-machine.ts`
- **Rationale**: Users need to cancel jobs that haven't started running yet (no workflow run ID). The state machine currently blocks PENDING → CANCELLED. No GitHub API call needed for PENDING cancellations — just a local DB update.
- **Alternatives considered**:
  - Bypass state machine for PENDING cancels — rejected, breaks consistency and validation guarantees

## Decision 3: workflowRunId Storage Strategy

- **Decision**: Add `workflowRunId BigInt?` field to the Job model in Prisma schema. Populate it when the job status callback reports RUNNING.
- **Rationale**: GitHub run IDs are large integers (up to 10+ digits). The status PATCH endpoint (`/api/jobs/:id/status`) already receives callbacks from workflows — extend it to accept an optional `workflowRunId` field. Only set on first RUNNING transition, never overwritten.
- **Alternatives considered**:
  - Store in a separate table — rejected, 1:1 relationship doesn't warrant a separate table
  - Store as String — rejected, BigInt is semantically correct and Prisma supports it

## Decision 4: Cancel API Endpoint Design

- **Decision**: New endpoint `POST /api/jobs/:id/cancel` with session auth (not workflow token auth). Validates job is PENDING or RUNNING, calls GitHub API if RUNNING (has workflowRunId), marks as CANCELLED.
- **Rationale**: Cancel is a user-initiated action distinct from the workflow status callback. Separate endpoint keeps concerns clean. Uses session auth since users (not workflows) trigger cancellation.
- **Alternatives considered**:
  - Extend existing PATCH status endpoint — rejected, that endpoint uses workflow token auth, not user session auth
  - Add cancel to transition endpoint — rejected, cancel is a job operation, not a ticket stage transition

## Decision 5: New Rollback Paths Implementation

- **Decision**: Extend `isValidTransition()` and `rollback-validator.ts` to support new paths: SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD. All require most recent job FAILED or CANCELLED.
- **Rationale**: The spec defines a fixed rollback matrix. These are new paths beyond the existing BUILD→INBOX (QUICK) and VERIFY→PLAN (FULL). The transition endpoint already handles rollback logic — extend the pattern.
- **Implementation details**:
  - SPECIFY→INBOX: Delete branch if exists (via GitHub API), reset ticket to INBOX
  - PLAN→SPECIFY: Simple stage change, no git operations needed
  - BUILD→PLAN: Destructive — requires backup tag + rollback-reset workflow dispatch
  - VERIFY→BUILD: Simple stage change (BUILD code exists, just re-verify)
- **Alternatives considered**:
  - Separate rollback API — rejected, spec explicitly requires integration into existing transition endpoint (FR-014)

## Decision 6: Backup Tag Creation in Rollback Workflow

- **Decision**: Extend `rollback-reset.yml` workflow to create a git tag `backup/{ticketKey}/{stage}-{jobId}` before performing the hard reset. Add cleanup step in verify workflow.
- **Rationale**: Tags are lightweight git objects that persist even after branch reset. Named convention allows programmatic cleanup. The rollback-reset workflow already does the hard reset — adding a tag step before it is minimal.
- **Alternatives considered**:
  - Create a new branch instead of tag — rejected, branches pollute the branch list and may confuse users
  - Store commit SHA in DB — rejected, tags are self-documenting and visible in git tooling

## Decision 7: Board Drag Visual Feedback for Rollback

- **Decision**: During drag of a ticket with FAILED/CANCELLED job, compute valid rollback targets from the rollback matrix and pass them as highlighted columns. All other columns get `opacity-30 pointer-events-none` styling.
- **Rationale**: The board already has @dnd-kit drag infrastructure. The `handleDragStart` callback already detects active job state. Extend it to compute rollback targets and set state that columns read for visual styling.
- **Alternatives considered**:
  - Disable drag entirely for failed tickets — rejected, drag IS the rollback mechanism
  - Show a separate rollback button instead of drag — rejected, spec requires drag-and-drop UX
