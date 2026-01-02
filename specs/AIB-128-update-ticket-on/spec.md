# Feature Specification: Ticket Modal Real-Time Data Refresh

**Feature Branch**: `AIB-128-update-ticket-on`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "When a ticket is moved to Specify and then the job is completed, the job status is correctly updated. However, if I open the ticket modal, I don't see the branch or the Spec button to display the specification. I have to reload the page to get the ticket modal with up-to-date data. The same issue occurs with the stats: they are not up to date when opening them. Add relevant tests"

## Auto-Resolved Decisions

- **Decision**: Scope limited to ticket modal data synchronization only (not global polling overhaul)
- **Policy Applied**: AUTO (scoring: internal feature context +1, speed directive -3, neutral -2 = net -4 → PRAGMATIC)
- **Confidence**: High (0.9) - Clear bug fix with well-defined boundaries
- **Fallback Triggered?**: No - PRAGMATIC recommendation accepted
- **Trade-offs**:
  1. Focused fix improves modal UX without redesigning entire data layer
  2. Minimal code changes reduce risk of regression
- **Reviewer Notes**: Verify that job completion triggers proper cache invalidation cascade

---

- **Decision**: Use existing TanStack Query invalidation patterns rather than introducing new polling mechanisms
- **Policy Applied**: PRAGMATIC
- **Confidence**: High - Codebase already uses query invalidation for similar scenarios
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with existing architecture patterns
  2. No additional network overhead from new polling intervals
- **Reviewer Notes**: Ensure invalidation covers both ticket and job data caches

---

- **Decision**: Stats tab updates will follow same invalidation pattern as job buttons
- **Policy Applied**: PRAGMATIC
- **Confidence**: High - Same root cause, same solution pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Single fix addresses both reported issues (buttons and stats)
  2. Unified approach simplifies testing
- **Reviewer Notes**: Verify stats computations use fresh job data after invalidation

## User Scenarios & Testing

### User Story 1 - Job Completion Updates Modal Buttons (Priority: P1)

As a project manager viewing a ticket modal, after a workflow job completes, I need to see the Spec/Plan/Summary buttons appear immediately without refreshing the page, so I can access the generated artifacts right away.

**Why this priority**: This is the core user-facing issue - users cannot access completed work without manual page refresh, breaking the workflow continuity.

**Independent Test**: Can be fully tested by triggering a specify job, waiting for completion, then verifying the Spec button appears in the open modal without page refresh.

**Acceptance Scenarios**:

1. **Given** a ticket is in SPECIFY stage with a running specify job and the modal is open, **When** the job completes, **Then** the Spec button appears within 5 seconds without requiring page refresh
2. **Given** a ticket is in PLAN stage with a running plan job and the modal is open, **When** the job completes, **Then** the Plan button appears within 5 seconds without requiring page refresh
3. **Given** a ticket is in BUILD stage with a running implement job and the modal is open, **When** the job completes, **Then** the Summary button appears within 5 seconds without requiring page refresh
4. **Given** the modal is closed when a job completes, **When** the user opens the modal, **Then** the appropriate artifact button is visible immediately

---

### User Story 2 - Branch Field Updates in Modal (Priority: P1)

As a project manager viewing a ticket modal, after a workflow creates a branch, I need to see the branch name appear in the modal without refreshing the page, so I can reference it for code review.

**Why this priority**: Branch visibility is tightly coupled with button visibility and represents the same underlying data synchronization issue.

**Independent Test**: Can be fully tested by moving a ticket to SPECIFY, waiting for branch creation, then verifying the branch field displays in the open modal.

**Acceptance Scenarios**:

1. **Given** a ticket is moved to SPECIFY stage and the modal is open, **When** the workflow creates the branch, **Then** the branch name displays in the modal within 5 seconds
2. **Given** a ticket has no branch assigned and the modal is open, **When** a workflow assigns a branch, **Then** the branch field updates from empty to showing the branch name

---

### User Story 3 - Stats Tab Reflects Current Job Data (Priority: P2)

As a project manager viewing ticket stats in the modal, I need the statistics to reflect the latest job execution data without refreshing the page, so I can monitor workflow progress accurately.

**Why this priority**: Stats accuracy is important but secondary to core functionality (accessing artifacts).

**Independent Test**: Can be fully tested by opening the Stats tab, running a job, then verifying stats update to reflect the completed job.

**Acceptance Scenarios**:

1. **Given** a ticket modal is open on the Stats tab with a running job, **When** the job completes, **Then** the job duration and status stats update within 5 seconds
2. **Given** a ticket has multiple completed jobs and a new job finishes, **When** viewing the Stats tab, **Then** the aggregated statistics include the newly completed job
3. **Given** a job transitions from PENDING to RUNNING, **When** viewing the Stats tab, **Then** the running job count updates appropriately

---

### User Story 4 - Consistent Data Across Modal Tabs (Priority: P2)

As a project manager switching between modal tabs, I need all tabs to show consistent, up-to-date data, so I don't see conflicting information between tabs.

**Why this priority**: Data consistency builds user trust but is a quality-of-life improvement over core functionality.

**Independent Test**: Can be fully tested by switching between tabs while a job completes and verifying all tabs show consistent job status.

**Acceptance Scenarios**:

1. **Given** the modal is open and a job completes, **When** switching between Description and Stats tabs, **Then** both tabs reflect the same job completion status
2. **Given** job data updates while viewing one tab, **When** switching to another tab, **Then** the new tab shows the updated data immediately (no stale data flash)

---

### Edge Cases

- What happens when multiple jobs complete simultaneously while the modal is open?
  - All completed jobs should be reflected in the UI within the standard refresh window
- How does the system handle if a job fails while the modal is open?
  - Job failure status should update the UI the same way as job completion
- What happens if the user rapidly opens/closes the modal during job completion?
  - Modal should always display current data when opened, regardless of prior state
- How does the system handle network errors during data refresh?
  - Current job polling error handling should be preserved; stale data shown with appropriate indicators if refresh fails

## Requirements

### Functional Requirements

- **FR-001**: System MUST update ticket data in an open modal when job status changes to a terminal state (COMPLETED, FAILED, CANCELLED)
- **FR-002**: System MUST update job data in an open modal when job polling detects status changes
- **FR-003**: System MUST display artifact buttons (Spec, Plan, Summary) immediately when their corresponding jobs complete, without page refresh
- **FR-004**: System MUST update the branch field in the modal when a branch is assigned to a ticket via workflow
- **FR-005**: System MUST update Stats tab data when job data changes
- **FR-006**: System MUST maintain data consistency across all modal tabs when updates occur
- **FR-007**: System MUST preserve existing 2-second job polling interval behavior
- **FR-008**: System MUST handle job updates for modals that are opened after job completion (no stale initial data)

### Key Entities

- **Ticket**: Board item that tracks branch assignment and workflow stage; modal displays ticket details
- **Job**: Workflow execution record with status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED); determines button visibility
- **Query Cache**: TanStack Query cache entries for tickets and jobs; invalidation triggers UI refresh

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users see updated artifact buttons within 5 seconds of job completion without page refresh
- **SC-002**: Branch field updates appear within 5 seconds of workflow branch creation without page refresh
- **SC-003**: Stats tab data updates within 5 seconds of job status changes
- **SC-004**: Zero reported instances of stale data in ticket modal after data synchronization fix
- **SC-005**: All modal tabs display consistent job data when switching between tabs
- **SC-006**: Test coverage includes integration tests for job completion triggering modal data refresh
- **SC-007**: Test coverage includes component tests for button visibility based on job status
