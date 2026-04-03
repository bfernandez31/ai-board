# Feature Specification: Cancel Jobs from UI + Rollback Recovery After Fail/Cancel

**Feature Branch**: `AIB-512-cancel-jobs-from`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Cancel jobs from UI + rollback recovery after fail/cancel"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Rollback Scope — Which Stage Transitions to Support

- **Decision**: Support all five rollback transitions from the rollback matrix (SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD, VERIFY→PLAN) rather than limiting to only the two existing ones (BUILD→INBOX, VERIFY→PLAN)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9, netScore=7 — reliability/destructive signals dominate, zero conflicting buckets)
- **Fallback Triggered?**: No — AUTO recommended CONSERVATIVE with high confidence
- **Trade-offs**:
  1. Broader scope increases implementation effort but provides complete recovery coverage for all failure scenarios
  2. Existing rollback-reset workflow must be extended (not replaced) to support BUILD→PLAN in addition to VERIFY→PLAN
- **Reviewer Notes**: Verify that PLAN→SPECIFY transition (no git action) is safe — confirm that re-running specify overwrites partial plan artifacts without leaving orphaned state

### Decision 2: Cancel Button Visibility — Hover vs Always Visible

- **Decision**: Cancel button appears on hover for board ticket cards (small "X" icon next to status indicator) and is always visible in the ticket detail modal job timeline row. This prevents visual clutter on the board while ensuring discoverability in the detail view.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — the description explicitly specifies hover behavior on board cards
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Hover-only on board cards may be less discoverable on touch devices, but the modal provides an always-visible alternative
  2. Consistent with existing board card hover patterns (deploy button behavior)
- **Reviewer Notes**: Confirm that the existing board card hover interaction pattern is suitable for cancel actions (no accidental clicks)

### Decision 3: Race Condition Handling for Cancel Requests

- **Decision**: Apply optimistic UI with server-side idempotency. When a user clicks cancel, immediately show a "cancelling" state in the UI. The server validates the job is still in a cancellable state (PENDING or RUNNING) before attempting GitHub Actions cancellation. If the job has already completed/failed by the time the cancel request is processed, return a conflict response and refresh the job status.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — destructive operation warrants careful state management
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Optimistic UI provides instant feedback but may show a brief "cancelling" state that reverts if the job already finished
  2. Server-side validation prevents double-cancellation and ensures data integrity
- **Reviewer Notes**: Ensure the cancel endpoint returns the current job status on conflict so the UI can self-correct without an additional polling cycle

### Decision 4: PENDING Job Cancellation Behavior

- **Decision**: Allow cancellation of PENDING jobs (before workflowRunId is populated). For PENDING jobs, skip the GitHub Actions API call (no workflow run to cancel) and directly mark the job as CANCELLED. This handles the case where a workflow dispatch was triggered but the run hasn't started yet.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — explicitly called out in acceptance criteria as edge case
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A PENDING job with no workflowRunId means the GitHub run may still start after we mark it CANCELLED locally; the workflow's first status callback (RUNNING) should detect the CANCELLED state and abort
  2. Simpler than blocking cancel until workflowRunId is populated
- **Reviewer Notes**: The workflow status callback endpoint should check if the job is already CANCELLED and, if so, return an error to signal the workflow to stop

### Decision 5: Backup Tag Naming Convention and Cleanup Scope

- **Decision**: Use `backup/{ticketKey}/build-{jobId}` and `backup/{ticketKey}/verify-{jobId}` tag naming. Auto-cleanup in verify.yml deletes all `backup/{ticketKey}/*` tags at the start of a successful verify run. Tags are not deleted on failed verify runs to preserve recovery options.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — explicitly specified in the description
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Keeping tags on failed verify preserves maximum recovery surface at the cost of tag accumulation
  2. Job ID in tag name ensures uniqueness across multiple build attempts
- **Reviewer Notes**: Confirm that the tag cleanup step in verify.yml runs early enough (before any destructive operations) and handles the case where no backup tags exist gracefully

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancel a Running Job from the Board (Priority: P1)

A user notices a workflow job is running (or pending) on a ticket and wants to stop it — perhaps they realized the spec was wrong, or they want to make changes before the workflow completes.

**Why this priority**: This is the core new capability — without cancel, users must wait for workflows to finish or manually intervene via GitHub Actions. Unblocking users from stuck workflows is the primary value.

**Independent Test**: Can be fully tested by creating a ticket with a RUNNING job, clicking the cancel button, and verifying the job transitions to CANCELLED and the GitHub Actions run is terminated.

**Acceptance Scenarios**:

1. **Given** a ticket on the board with a RUNNING job, **When** the user hovers over the ticket card, **Then** a cancel button (X icon) appears next to the job status indicator
2. **Given** the cancel button is visible, **When** the user clicks it, **Then** a confirmation dialog appears: "Annuler le workflow {command} en cours ?"
3. **Given** the user confirms the cancellation, **When** the system processes the request, **Then** the GitHub Actions workflow run is cancelled, the job status changes to CANCELLED, and the UI reflects the new status
4. **Given** a ticket with a PENDING job (no workflow run started yet), **When** the user cancels it, **Then** the job is marked CANCELLED directly without calling GitHub Actions
5. **Given** a job that has already completed by the time cancel is processed, **When** the cancel request reaches the server, **Then** the system returns the current job status and the UI updates accordingly (no error shown to user)

---

### User Story 2 - Rollback a Failed Ticket via Drag-and-Drop (Priority: P1)

A user sees a ticket stuck with a FAILED or CANCELLED job and wants to move it back to a valid earlier stage to retry the workflow from a clean state.

**Why this priority**: Equal to cancel in importance — rollback completes the recovery loop. Cancel without rollback leaves tickets stranded. Together they form the minimum viable recovery experience.

**Independent Test**: Can be tested by setting a ticket to BUILD stage with a FAILED job, dragging it to PLAN, and verifying the backup tag is created and the branch is reset.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with a FAILED job, **When** the user starts dragging it, **Then** only the PLAN column is highlighted as a valid drop target; other columns are greyed out
2. **Given** the user drops the ticket on PLAN, **When** the confirmation dialog appears ("Revenir a Plan ? Le code sera reinitialise (backup cree)."), **Then** dropping confirms triggers the rollback-reset workflow with backup tag creation
3. **Given** a ticket in VERIFY stage with a CANCELLED job, **When** the user drags it, **Then** both BUILD and PLAN columns are valid drop targets
4. **Given** a ticket in SPECIFY stage with a FAILED job, **When** the user drags it to INBOX, **Then** a confirmation dialog explains the branch will be deleted, and upon confirmation the branch is removed
5. **Given** a ticket in PLAN stage with a FAILED job, **When** the user drags it to SPECIFY, **Then** a confirmation dialog explains the partial plan will be overwritten on next run, and the stage changes without git action

---

### User Story 3 - Cancel a Job from the Ticket Detail Modal (Priority: P2)

A user viewing the ticket detail modal sees a running job in the job timeline and wants to cancel it directly from there.

**Why this priority**: Provides an alternative access point for cancel that is always visible (not hover-dependent). Important for accessibility and discoverability but secondary since board hover cancel covers the primary flow.

**Independent Test**: Can be tested by opening a ticket detail modal with a RUNNING job, clicking the cancel button on the job timeline row, confirming, and verifying cancellation.

**Acceptance Scenarios**:

1. **Given** a ticket detail modal is open with a RUNNING job in the timeline, **When** the user views the job row, **Then** a cancel button is visible on the timeline row
2. **Given** the cancel button is clicked, **When** the confirmation dialog appears, **Then** confirming cancels the job and the timeline row updates to show CANCELLED status

---

### User Story 4 - Git Backup Tag Preservation and Cleanup (Priority: P2)

When a destructive rollback occurs (BUILD→PLAN or VERIFY→PLAN), the system creates a backup tag so partial work can be recovered via cherry-pick. When the next verify run succeeds, old backup tags are automatically cleaned up.

**Why this priority**: Backup tags are a safety net for destructive rollbacks. Important for data preservation but operates in the background — users don't interact with tags directly.

**Independent Test**: Can be tested by performing a BUILD→PLAN rollback, verifying a backup tag exists, then running a successful verify workflow and confirming the backup tags are deleted.

**Acceptance Scenarios**:

1. **Given** a BUILD→PLAN rollback is triggered, **When** the rollback-reset workflow runs, **Then** a tag `backup/{ticketKey}/build-{jobId}` is created before the git reset
2. **Given** a VERIFY→PLAN rollback is triggered, **When** the rollback-reset workflow runs, **Then** a tag `backup/{ticketKey}/verify-{jobId}` is created before the git reset
3. **Given** backup tags exist for a ticket, **When** the verify.yml workflow starts successfully, **Then** all `backup/{ticketKey}/*` tags are deleted at the beginning of the run

---

### User Story 5 - Workflow Run ID Tracking (Priority: P3)

The system records the GitHub Actions workflow run ID on each job so it can be referenced for cancellation and debugging.

**Why this priority**: Infrastructure concern that enables cancel functionality. Lower priority because it is a supporting mechanism, not a user-facing flow.

**Independent Test**: Can be tested by triggering a workflow, verifying the RUNNING status callback populates the workflowRunId on the job record, and confirming it matches the actual GitHub Actions run ID.

**Acceptance Scenarios**:

1. **Given** a new job is created with status PENDING, **When** the GitHub Actions workflow starts and sends its first RUNNING status callback, **Then** the workflowRunId field is populated with the BigInt run ID
2. **Given** a job with a populated workflowRunId, **When** the cancel endpoint is called, **Then** the system uses the workflowRunId to cancel the correct GitHub Actions run

---

### Edge Cases

- What happens when the user double-clicks the cancel button? The UI must disable the button after first click and the server must handle duplicate cancel requests idempotently.
- What happens when a PENDING job is cancelled but the workflow starts running afterward? The workflow's first status callback should detect the CANCELLED state and self-terminate.
- What happens when the GitHub Actions API is unreachable during cancel? The system should return an error and leave the job in its current state (no partial state change).
- What happens when a user tries to drag a ticket with a RUNNING job to a rollback stage? The drag should be blocked — rollback is only valid when the last job is FAILED or CANCELLED.
- What happens when the backup tag already exists (e.g., re-running a rollback)? Use a unique tag name (includes jobId) to prevent collisions.
- What happens when a ticket has no branch (SPECIFY→INBOX rollback for ticket that never had a branch created)? Skip the branch deletion step gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store the GitHub Actions workflow run identifier on each job record, populated when the job transitions to running status
- **FR-002**: System MUST provide a cancellation endpoint that terminates the associated GitHub Actions workflow run and marks the job as cancelled
- **FR-003**: System MUST allow cancellation of pending jobs (before a workflow run has started) by directly marking them as cancelled without calling the GitHub Actions API
- **FR-004**: System MUST display a cancel action on board ticket cards (on hover) when the ticket has a running or pending job
- **FR-005**: System MUST display a cancel action in the ticket detail modal job timeline for running or pending jobs
- **FR-006**: System MUST show a confirmation dialog before executing any cancel or rollback action, with contextual messaging specific to the action
- **FR-007**: System MUST support the following rollback stage transitions when the last job is failed or cancelled:
  - SPECIFY → INBOX (deletes branch if present)
  - PLAN → SPECIFY (no git action)
  - BUILD → PLAN (creates backup tag, resets branch)
  - VERIFY → BUILD (no git action, re-runs verify)
  - VERIFY → PLAN (creates backup tag, resets branch)
- **FR-008**: System MUST create a backup tag (`backup/{ticketKey}/{stage}-{jobId}`) before any destructive git reset operation during rollback
- **FR-009**: System MUST automatically delete all backup tags for a ticket when the verify workflow starts a new successful run
- **FR-010**: System MUST visually indicate valid rollback drop targets on the board when a ticket with a failed or cancelled job is being dragged, greying out invalid targets
- **FR-011**: System MUST handle race conditions on cancel: disable the cancel button after first click, return current job status on server conflict, and handle duplicate requests idempotently
- **FR-012**: System MUST integrate rollback transitions into the existing stage transition system (same endpoint), not as a separate API
- **FR-013**: System MUST block rollback drag for tickets with running or pending jobs — rollback is only valid when the last job is failed or cancelled
- **FR-014**: System MUST update existing tests to cover the new cancel and rollback behaviors

### Key Entities *(include if feature involves data)*

- **Job**: Extended with a workflow run identifier field (large integer) to track the corresponding GitHub Actions run. This enables the cancel capability by linking the internal job to the external workflow execution.
- **Backup Tag**: A git tag created before destructive rollback operations, named `backup/{ticketKey}/{stage}-{jobId}`, preserving partial work for potential cherry-pick recovery.
- **Rollback Transition**: A stage transition moving a ticket backward in the workflow pipeline, constrained by the rollback matrix and gated by the last job's terminal failure/cancelled status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can cancel a running or pending job from the UI within 3 seconds (from click to confirmed cancellation status)
- **SC-002**: Users can recover a failed or cancelled ticket to a valid earlier stage within 5 seconds (from drag initiation to rollback confirmation)
- **SC-003**: 100% of destructive rollbacks (BUILD→PLAN, VERIFY→PLAN) create a backup tag before any git reset operation
- **SC-004**: Backup tags are automatically cleaned up on the next successful verify run, preventing tag accumulation
- **SC-005**: Zero data loss during rollback — spec files are preserved through all rollback transitions
- **SC-006**: Cancel and rollback operations are idempotent — repeated actions on the same job produce consistent results without errors
- **SC-007**: Users can identify valid rollback targets visually on the board without consulting documentation (valid targets highlighted, invalid targets greyed out)
- **SC-008**: All existing stage transition tests continue to pass after rollback integration
