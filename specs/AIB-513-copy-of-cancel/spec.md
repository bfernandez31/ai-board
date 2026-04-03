# Feature Specification: Cancel Jobs from UI + Rollback Recovery

**Feature Branch**: `AIB-513-copy-of-cancel`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Cancel jobs from UI + rollback recovery after fail/cancel"

## Auto-Resolved Decisions

### Decision 1: AUTO Policy Fallback to CONSERVATIVE

- **Decision**: AUTO policy resolved to CONSERVATIVE due to low confidence score
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1, absScore: 1) — feature has neutral context signals only (user-facing UI, +1), no strong sensitivity or speed indicators
- **Fallback Triggered?**: Yes — confidence 0.3 < 0.5 threshold, so AUTO defaults to CONSERVATIVE
- **Trade-offs**:
  1. More thorough edge case handling and validation requirements
  2. Slightly more effort to implement, but appropriate for a feature involving destructive git operations
- **Reviewer Notes**: CONSERVATIVE is appropriate here — the feature involves destructive git operations (force push, branch deletion, hard reset) where data loss is a real risk

### Decision 2: Race Condition Handling on Cancel

- **Decision**: Cancel requests on jobs without a workflow run ID (PENDING state) should mark the job as CANCELLED locally without attempting a GitHub API call, since no workflow run exists yet
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — this is the only safe behavior since there is no GitHub run to cancel
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users can cancel PENDING jobs immediately without waiting for a run ID
  2. If a workflow starts between the cancel request and DB update, a brief race window exists; the workflow will run but its status callback will be ignored since the job is already CANCELLED
- **Reviewer Notes**: Verify that the job status state machine correctly rejects transitions from CANCELLED to RUNNING

### Decision 3: Rollback Drag Behavior Scope

- **Decision**: Rollback drag targets are determined by a fixed matrix (SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD, VERIFY→PLAN) and only enabled when the ticket's most recent job is FAILED or CANCELLED. All other columns are visually greyed out during drag.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the rollback matrix is explicitly defined in the requirements
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clear, predictable UX with no ambiguity about where tickets can go
  2. No support for skipping stages during rollback (e.g., BUILD→INBOX for full workflow tickets)
- **Reviewer Notes**: Confirm the PLAN→SPECIFY rollback is desired — the existing codebase only supports BUILD→INBOX (quick) and VERIFY→PLAN rollbacks today. SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, and VERIFY→BUILD are new rollback paths.

### Decision 4: Confirmation Dialog Language

- **Decision**: Confirmation dialogs use French text as specified in the requirements. The application already uses a mix of French UI text in some areas.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicit French strings provided in requirements
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with the provided requirements
  2. No internationalization overhead for this feature
- **Reviewer Notes**: Ensure French text is consistent with the rest of the application's language choices

### Decision 5: Double-Click Prevention

- **Decision**: Cancel and rollback actions use optimistic locking (job version/status check) and UI-level button disabling after first click to prevent duplicate operations
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — standard pattern already used in the codebase for stage transitions (version-based optimistic concurrency)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Robust against duplicate requests at both UI and API level
  2. Minimal additional complexity since the pattern already exists
- **Reviewer Notes**: Existing transition endpoint already uses optimistic version locking — extend the same pattern

## User Scenarios & Testing

### User Story 1 - Cancel a Running Job from the Board (Priority: P1)

A user sees a ticket on the board with a running or pending workflow job. They want to stop the job immediately — perhaps they realized the spec was wrong or want to change approach. They hover over the ticket card, see a cancel button near the status indicator, click it, confirm the cancellation, and the job is marked as cancelled.

**Why this priority**: This is the core capability that unblocks all other workflows. Without the ability to cancel, users are stuck waiting for failed or unwanted workflows to complete before they can take any recovery action.

**Independent Test**: Can be fully tested by creating a ticket with a RUNNING job and verifying that the cancel button appears on hover, the confirmation dialog displays, and the job transitions to CANCELLED status.

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY stage with a RUNNING job, **When** the user hovers over the ticket card, **Then** a cancel button (X icon) appears next to the job status indicator
2. **Given** the cancel button is visible, **When** the user clicks it, **Then** a confirmation dialog appears with the message "Annuler le workflow {command} en cours ?"
3. **Given** the confirmation dialog is shown, **When** the user confirms, **Then** the system cancels the GitHub Actions workflow run and marks the job as CANCELLED
4. **Given** a ticket with a PENDING job (no workflow run ID yet), **When** the user cancels the job, **Then** the job is marked as CANCELLED locally without a GitHub API call
5. **Given** a ticket with a COMPLETED job, **When** the user hovers over the ticket, **Then** no cancel button appears

---

### User Story 2 - Cancel a Job from the Ticket Detail Modal (Priority: P1)

A user opens the ticket detail modal to review job history. On the job timeline, they see a running job and want to cancel it directly from this view. A cancel action is available on the active job's timeline row.

**Why this priority**: Same core capability as Story 1, but from a different access point. Users who are reviewing job details need the same cancel ability without returning to the board view.

**Independent Test**: Can be fully tested by opening a ticket detail modal with a RUNNING job and verifying the cancel action appears on the timeline row and functions correctly.

**Acceptance Scenarios**:

1. **Given** a ticket detail modal is open with a RUNNING or PENDING job in the timeline, **When** the user views the job row, **Then** a cancel action is available on that row
2. **Given** the user clicks the cancel action on a job timeline row, **When** the confirmation dialog appears and the user confirms, **Then** the job is cancelled and the timeline updates to show CANCELLED status

---

### User Story 3 - Rollback a Failed Ticket via Drag-and-Drop (Priority: P1)

A ticket's job has failed or been cancelled. The user wants to recover by dragging the ticket to a previous stage. When they start dragging, the board highlights only the valid rollback targets (based on the rollback matrix) and greys out invalid columns. They drop on a valid target, see a confirmation dialog explaining what will happen, and confirm to execute the rollback.

**Why this priority**: This is the primary recovery mechanism. Without it, tickets with failed jobs remain stuck with no path forward from the UI.

**Independent Test**: Can be fully tested by creating a ticket with a FAILED job in BUILD stage, dragging it to PLAN, confirming the dialog, and verifying the ticket moves to PLAN with appropriate git operations triggered.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with a FAILED job, **When** the user starts dragging the ticket, **Then** only the PLAN column is highlighted as a valid drop target; all other columns are greyed out
2. **Given** a ticket in VERIFY stage with a CANCELLED job, **When** the user starts dragging, **Then** both BUILD and PLAN columns are highlighted as valid drop targets
3. **Given** the user drops a ticket on a valid rollback target, **When** the confirmation dialog appears, **Then** the dialog shows the appropriate contextual message (e.g., "Revenir a Plan ? Le code sera reinitialise (backup cree).")
4. **Given** the user confirms a BUILD→PLAN rollback, **When** the transition completes, **Then** a backup git tag is created before the reset and the ticket moves to PLAN stage
5. **Given** a ticket with a COMPLETED (non-failed) job, **When** the user tries to drag it, **Then** no rollback targets are shown (normal forward transitions apply)

---

### User Story 4 - Store Workflow Run ID for Cancel Capability (Priority: P2)

When a workflow job transitions from PENDING to RUNNING, the GitHub Actions workflow reports its run ID back to the system. This run ID is stored on the job record to enable future cancellation via the GitHub API.

**Why this priority**: This is a prerequisite data model change that enables the cancel functionality. It is lower priority because it is an infrastructure concern, not a direct user-facing feature.

**Independent Test**: Can be fully tested by dispatching a workflow, verifying the RUNNING status callback includes the workflow run ID, and confirming it is persisted on the Job record.

**Acceptance Scenarios**:

1. **Given** a job in PENDING status, **When** the workflow sends a RUNNING status callback, **Then** the workflow run ID is stored on the job record
2. **Given** a job already has a workflow run ID, **When** a subsequent status update arrives, **Then** the existing run ID is preserved (not overwritten)

---

### User Story 5 - Git Tag Backup Before Destructive Rollback (Priority: P2)

When a rollback involves a destructive git operation (BUILD→PLAN or VERIFY→PLAN), the system creates a backup git tag before performing the reset. This preserves access to any partial work (e.g., partially implemented files) for potential cherry-pick recovery.

**Why this priority**: Important safety net for destructive operations, but secondary to the core cancel and rollback UX.

**Independent Test**: Can be fully tested by triggering a BUILD→PLAN rollback and verifying a tag named `backup/{ticketKey}/build-{jobId}` exists on the repository pointing to the pre-reset commit.

**Acceptance Scenarios**:

1. **Given** a BUILD→PLAN rollback is triggered, **When** the rollback workflow runs, **Then** a tag `backup/{ticketKey}/build-{jobId}` is created before the git reset
2. **Given** a VERIFY→PLAN rollback is triggered, **When** the rollback workflow runs, **Then** a tag `backup/{ticketKey}/verify-{jobId}` is created before the git reset
3. **Given** the verify workflow runs successfully (BUILD succeeded), **When** the verify workflow starts, **Then** any existing `backup/{ticketKey}/*` tags are deleted (cleanup)

---

### User Story 6 - SPECIFY→INBOX Rollback with Branch Cleanup (Priority: P3)

A ticket in SPECIFY stage with a failed job can be rolled back to INBOX. If a branch was created, it is deleted as part of the rollback.

**Why this priority**: Less common scenario since SPECIFY failures are rarer, but needed for completeness of the rollback matrix.

**Independent Test**: Can be fully tested by creating a ticket in SPECIFY with a FAILED job and branch, dragging to INBOX, and verifying the branch is deleted and ticket returns to INBOX.

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY with a FAILED job and an existing branch, **When** the user drags the ticket to INBOX and confirms, **Then** the branch is deleted and the ticket moves to INBOX
2. **Given** a ticket in SPECIFY with a FAILED job and no branch, **When** the user drags to INBOX and confirms, **Then** the ticket moves to INBOX with no git operation

---

### Edge Cases

- What happens when the user cancels a job but the GitHub API call fails? The system should still mark the job as CANCELLED locally and log the GitHub API failure. The workflow may continue running on GitHub but will be unable to update job status since the job is already in a terminal state.
- What happens when two users try to cancel the same job simultaneously? Optimistic locking ensures only the first cancel succeeds; the second receives a conflict error.
- What happens when a user tries to rollback a ticket that has a RUNNING job? The rollback is blocked — only FAILED or CANCELLED jobs allow rollback. The user must cancel the running job first.
- What happens when the backup tag creation fails during a destructive rollback? The rollback should abort and the job should be marked as FAILED, preserving the current state rather than risking data loss without a backup.
- What happens when a PENDING job has no workflow run ID and the user cancels? The job is marked as CANCELLED locally. If a workflow subsequently starts, its status callbacks are rejected because the job is already in a terminal state.

## Requirements

### Functional Requirements

- **FR-001**: System MUST store the workflow run identifier on the Job record when a job transitions to RUNNING status
- **FR-002**: System MUST provide a cancel endpoint that cancels the corresponding GitHub Actions workflow run and marks the job as CANCELLED
- **FR-003**: System MUST allow cancellation of PENDING jobs by marking them CANCELLED locally without requiring a workflow run identifier
- **FR-004**: System MUST display a cancel button on board ticket cards (on hover) when the ticket has a RUNNING or PENDING job
- **FR-005**: System MUST display a cancel action on job timeline rows in the ticket detail modal for RUNNING or PENDING jobs
- **FR-006**: System MUST show a confirmation dialog before executing any cancel or rollback action
- **FR-007**: System MUST support the following rollback transitions when the most recent job is FAILED or CANCELLED: SPECIFY→INBOX, PLAN→SPECIFY, BUILD→PLAN, VERIFY→BUILD, VERIFY→PLAN
- **FR-008**: System MUST delete the ticket branch (if present) during a SPECIFY→INBOX rollback
- **FR-009**: System MUST create a backup git tag before any destructive rollback (BUILD→PLAN, VERIFY→PLAN) in the format `backup/{ticketKey}/{stage}-{jobId}`
- **FR-010**: System MUST automatically clean up backup tags for a ticket when a subsequent verify workflow begins
- **FR-011**: System MUST visually indicate valid rollback drop targets on the board when dragging a ticket with a FAILED or CANCELLED job, greying out invalid targets
- **FR-012**: System MUST show stage-specific confirmation messages in French for each rollback transition
- **FR-013**: System MUST prevent double-click and race conditions on cancel and rollback actions using optimistic locking and UI-level disabling
- **FR-014**: System MUST integrate rollback transitions into the existing stage transition system (same endpoint), not as a separate API
- **FR-015**: System MUST update existing tests to cover the new cancel and rollback functionality

### Key Entities

- **Job**: Extended with a workflow run identifier field. This field is populated when the job starts running and is used to cancel the corresponding GitHub Actions workflow via the API. The field is a large integer to accommodate GitHub's run ID format.
- **Ticket**: No schema changes. Rollback behavior is determined by the ticket's current stage, workflow type, and most recent job status. The existing version field provides optimistic concurrency control for rollback transitions.
- **Backup Tag**: A git tag created before destructive rollbacks to preserve partial work. Named by convention (`backup/{ticketKey}/{stage}-{jobId}`), not stored in the database. Automatically cleaned up when the ticket successfully moves past the point that triggered the backup.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can cancel a running or pending job within 3 seconds of clicking the cancel button (including confirmation)
- **SC-002**: 100% of destructive rollbacks (BUILD→PLAN, VERIFY→PLAN) create a backup tag before any git reset operation
- **SC-003**: Users can recover a failed or cancelled ticket to a valid previous stage within 10 seconds via drag-and-drop
- **SC-004**: Zero data loss from rollback operations — all partial work is preserved via backup tags
- **SC-005**: All valid rollback transitions are visually distinguishable on the board (valid targets highlighted, invalid greyed out) within 200ms of starting a drag
- **SC-006**: Existing test suite is updated to cover cancel and rollback scenarios with no regression in current tests

## Assumptions

- The GitHub API token used by the system has sufficient permissions to cancel workflow runs (requires `actions:write` scope)
- The existing job status state machine correctly rejects invalid transitions (e.g., CANCELLED→RUNNING)
- The rollback-reset workflow (already implemented for VERIFY→PLAN) can be extended to support BUILD→PLAN with the same git reset logic
- Backup tag cleanup in verify.yml is safe because reaching the verify stage implies BUILD succeeded and the backup is no longer needed
- French confirmation dialog text is intentional and consistent with the application's existing language choices
