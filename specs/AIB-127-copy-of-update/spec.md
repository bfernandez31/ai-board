# Feature Specification: Real-Time Ticket Modal Data Synchronization

**Feature Branch**: `AIB-127-copy-of-update`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "When a ticket is moved to Specify and then the job is completed, the job status is correctly updated. However, if I open the ticket modal, I don't see the branch or the Spec button to display the specification. I have to reload the page to get the ticket modal with up-to-date data. The same issue occurs with the stats: they are not up to date when opening them. Add relevant tests"

## Auto-Resolved Decisions

- **Decision**: The ticket modal should receive real-time ticket data updates when job status transitions to terminal state
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score: 0) - Bug fix with clear expected behavior matching existing patterns
- **Fallback Triggered?**: No - AUTO recommended CONSERVATIVE due to neutral context
- **Trade-offs**:
  1. Scope: Implementing proper cache invalidation maintains data consistency; may require refactoring existing hooks
  2. Performance: More frequent invalidations may increase API calls, but existing 2s polling is already aggressive
- **Reviewer Notes**: Verify that cache invalidation triggers ticket data refresh correctly in all terminal job states (COMPLETED, FAILED, CANCELLED)

---

- **Decision**: Stats tab should use the same reactive data source as the rest of the modal
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - Consistency with existing UI patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Scope: Stats must derive from same ticket/job data as other tabs
  2. Quality: Single source of truth prevents data inconsistencies
- **Reviewer Notes**: Ensure stats calculations use the same job data that powers job status indicators

---

- **Decision**: Testing should cover both integration tests (cache invalidation) and component tests (UI updates)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - Explicit requirement from user, aligns with Testing Trophy architecture
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Coverage: Multiple test types ensure both logic and UI work correctly
  2. Maintenance: More tests to maintain, but catches regressions early
- **Reviewer Notes**: Prioritize integration tests per Testing Trophy architecture; use RTL component tests for interactive behavior

## User Scenarios & Testing

### User Story 1 - View Updated Ticket After Job Completion (Priority: P1)

A project manager moves a ticket from INBOX to SPECIFY stage. The system dispatches a workflow that creates the branch and runs the specify command. When the job completes, the user opens the ticket modal and expects to see the branch name and Spec button without refreshing the page.

**Why this priority**: Core functionality - users expect real-time feedback after workflow completion. Without this, users lose confidence in the system and resort to manual page refreshes.

**Independent Test**: Can be tested by moving a ticket to SPECIFY, waiting for job completion, then opening the modal and verifying branch and Spec button visibility.

**Acceptance Scenarios**:

1. **Given** a ticket in INBOX stage and job polling is active, **When** the user drags the ticket to SPECIFY and the job completes with status COMPLETED, **Then** opening the ticket modal shows the branch name in the ticket details
2. **Given** a ticket with a completed specify job, **When** the user opens the ticket modal, **Then** the "View Specification" button is visible and functional
3. **Given** a ticket modal is already open, **When** the associated job transitions to COMPLETED, **Then** the modal content updates automatically to show branch and Spec button

---

### User Story 2 - Real-Time Stats Updates in Ticket Modal (Priority: P2)

A user opens the ticket modal and navigates to the Stats tab to view job execution metrics. The stats should reflect the current state of all jobs associated with the ticket, including recently completed jobs.

**Why this priority**: Secondary to seeing basic ticket data, but still important for users monitoring workflow progress and performance.

**Independent Test**: Can be tested by opening a ticket modal's Stats tab before and after job completion, verifying that stats update without page reload.

**Acceptance Scenarios**:

1. **Given** a ticket with jobs in various states, **When** the user opens the Stats tab, **Then** the stats reflect the current job statuses
2. **Given** the Stats tab is open, **When** a job transitions from RUNNING to COMPLETED, **Then** the stats update automatically to reflect the completion
3. **Given** the Stats tab is open, **When** a job fails (FAILED status), **Then** the stats show the failure appropriately

---

### User Story 3 - Modal Updates During Open State (Priority: P2)

A user has the ticket modal open while a workflow is running. When the job status changes, the modal should update in real-time without requiring the user to close and reopen it.

**Why this priority**: Enhances user experience for users actively monitoring workflow progress, but less common than opening modal after completion.

**Independent Test**: Can be tested by opening modal during RUNNING job, then observing automatic updates when job reaches terminal state.

**Acceptance Scenarios**:

1. **Given** the ticket modal is open with a job in RUNNING status, **When** the job completes, **Then** the modal updates to show new ticket data including branch
2. **Given** the ticket modal is open showing no Spec button, **When** the specify job completes, **Then** the Spec button appears without user action

---

### Edge Cases

- What happens when a job fails? The modal should still update to reflect failure status but not show Spec button if specify job failed
- What happens when multiple jobs complete in quick succession? All updates should be reflected in the modal
- What happens when the modal is opened during job transition? The modal should show current state and update when transition completes
- What happens when network connectivity is interrupted during polling? The system should gracefully handle polling failures and resume when connection is restored
- What happens when job polling is stopped (all jobs terminal)? Opening modal should still show latest ticket data from cache

## Requirements

### Functional Requirements

- **FR-001**: System MUST invalidate ticket cache when any job transitions to a terminal status (COMPLETED, FAILED, CANCELLED)
- **FR-002**: Ticket modal MUST display current ticket data including branch name when opened
- **FR-003**: Ticket modal MUST show "View Specification" button when both ticket has a branch AND a completed specify job exists
- **FR-004**: Stats tab MUST derive data from the same reactive data source as the main ticket details
- **FR-005**: System MUST update open modal content when underlying ticket data changes
- **FR-006**: Job polling MUST continue to trigger cache invalidation correctly for terminal job transitions
- **FR-007**: System MUST handle the case where modal is opened before job completion and update when job completes

### Key Entities

- **Ticket**: Represents a work item with branch, stage, version, and associated jobs. Key attributes: id, branch (string, nullable), stage, version
- **Job**: Represents a workflow execution. Key attributes: id, ticketId, status (PENDING|RUNNING|COMPLETED|FAILED|CANCELLED), command
- **Query Cache**: TanStack Query cache storing ticket and job data. Key invalidation points: job terminal transition triggers ticket cache invalidation

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can see updated ticket data (branch, buttons) within 5 seconds of job completion without page refresh
- **SC-002**: Stats tab displays accurate job counts and statuses matching the actual job states
- **SC-003**: 100% of terminal job transitions trigger appropriate cache invalidation
- **SC-004**: Modal content updates automatically for users who have it open during job completion
- **SC-005**: Test coverage includes integration tests for cache invalidation logic and component tests for modal reactivity
