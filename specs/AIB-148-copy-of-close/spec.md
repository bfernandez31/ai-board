# Feature Specification: Close Ticket Feature

**Feature Branch**: `AIB-148-copy-of-close`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "Add a CLOSED state allowing users to close tickets from VERIFY stage without shipping them. This provides a clean resolution path for abandoned or cancelled work."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: PR comment message format when closing via ai-board
- **Policy Applied**: AUTO (resolved as PRAGMATIC - internal feature context, no compliance requirements)
- **Confidence**: High (score 0.8) - clear internal tooling context with no external user impact
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simple message format without detailed close reason reduces context for future review
  2. Consistent with existing ai-board automation patterns for simpler maintenance
- **Reviewer Notes**: The PR close comment will use format: "Closed by ai-board - ticket moved to CLOSED state". Consider adding ticket key reference for traceability.

---

- **Decision**: Search result styling for closed tickets
- **Policy Applied**: AUTO (resolved as PRAGMATIC)
- **Confidence**: High (score 0.85) - muted styling with "Closed" badge is standard UX pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Muted styling reduces visual prominence of closed tickets, which is intentional
  2. Badge provides clear status indication without tooltip hover requirement
- **Reviewer Notes**: Muted styling should use reduced opacity (~60%) and gray text color. Badge should use neutral gray background similar to INBOX column styling.

---

- **Decision**: Read-only behavior for closed ticket detail modal
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (score 0.65) - terminal state warrants full edit prevention
- **Fallback Triggered?**: Yes - promoted to CONSERVATIVE due to data integrity implications
- **Trade-offs**:
  1. Prevents accidental modification of archived work
  2. Users cannot correct typos in closed tickets without reopening (acceptable for terminal state)
- **Reviewer Notes**: All edit actions (title, description, attachments, comments) should be disabled. Consider showing visual indicator that ticket is in read-only mode.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Close a Ticket from VERIFY Stage (Priority: P1)

A project manager has a ticket in VERIFY stage where the feature was implemented but is no longer needed. They want to cleanly close the ticket without shipping it, preserving the work done.

**Why this priority**: Core functionality - enables the primary use case of closing abandoned or cancelled work.

**Independent Test**: Can be fully tested by dragging a VERIFY ticket to the SHIP column Close zone and confirming the closure. Delivers the ability to resolve work without deploying.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with no active jobs, **When** user drags the ticket to the SHIP column, **Then** the column displays two drop zones: Ship (top ~60%, purple solid border) and Close (bottom ~40%, red dashed border with "Close" label and archive icon)

2. **Given** a ticket is being dragged over the Close zone, **When** user drops the ticket, **Then** a confirmation modal appears with title "Close Ticket {ticketKey}?" and explains that PR will be closed and ticket removed from board but remains searchable

3. **Given** the confirmation modal is displayed, **When** user clicks "Close Ticket" button, **Then** the ticket stage changes to CLOSED, closedAt timestamp is set, associated GitHub PR(s) are closed with explanatory comment, and ticket disappears from the board

4. **Given** the confirmation modal is displayed, **When** user clicks "Cancel" button, **Then** the modal closes and ticket remains in VERIFY stage

---

### User Story 2 - Search and View Closed Tickets (Priority: P2)

A developer needs to review the work done on a ticket that was closed months ago. They search for the ticket and access its details in read-only mode.

**Why this priority**: Essential for audit trail and historical reference - closed tickets must remain accessible.

**Independent Test**: Can be tested by searching for a closed ticket and verifying it appears with muted styling and can be opened for viewing.

**Acceptance Scenarios**:

1. **Given** a closed ticket exists in the project, **When** user searches for the ticket by key or title, **Then** the ticket appears in search results with muted styling (reduced opacity, gray text) and a "Closed" badge

2. **Given** a closed ticket appears in search results, **When** user clicks on it, **Then** the ticket detail modal opens in read-only mode

3. **Given** the closed ticket modal is open, **When** user attempts to edit any field, **Then** all edit controls are disabled and a visual indicator shows the ticket is read-only

---

### User Story 3 - Validation Prevents Invalid Close Attempts (Priority: P3)

The system prevents closing tickets in invalid scenarios to maintain workflow integrity.

**Why this priority**: Guards against edge cases and ensures data consistency.

**Independent Test**: Can be tested by attempting invalid close operations and verifying appropriate error handling.

**Acceptance Scenarios**:

1. **Given** a ticket NOT in VERIFY stage, **When** user attempts to close it, **Then** the Close drop zone is not available (dual drop zone only appears for VERIFY tickets)

2. **Given** a ticket in VERIFY with PENDING or RUNNING job, **When** user attempts to close it, **Then** the operation is blocked with appropriate error message

3. **Given** project cleanup is in progress (cleanup lock active), **When** user attempts to close a VERIFY ticket, **Then** the operation returns HTTP 423 Locked with explanatory message

4. **Given** a ticket in CLOSED state, **When** any transition is attempted, **Then** the operation is rejected as CLOSED is a terminal state with no outbound transitions

---

### User Story 4 - Handle GitHub PR Edge Cases (Priority: P4)

The close operation handles various GitHub PR states gracefully without failing.

**Why this priority**: Robustness for edge cases - feature works even when GitHub state doesn't match expectations.

**Independent Test**: Can be tested by closing tickets with various PR states and verifying idempotent behavior.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY with no associated GitHub PR, **When** user closes the ticket, **Then** the operation succeeds without error (branch preserved, no PR to close)

2. **Given** a ticket in VERIFY with already-closed PR, **When** user closes the ticket, **Then** the operation succeeds (idempotent - PR already closed)

3. **Given** a ticket in VERIFY with multiple PRs for the branch, **When** user closes the ticket, **Then** all matching open PRs are closed with explanatory comments

### Edge Cases

- What happens if GitHub API fails during PR close? System should set CLOSED state locally but log the GitHub failure for manual resolution
- What happens if user drags ticket to Ship zone instead of Close zone? Existing ship behavior unchanged - ticket progresses through normal ship flow
- What happens to preview URL when ticket is closed? Preview URL remains unchanged - only replaced when another ticket deploys

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add CLOSED as a valid stage in the ticket lifecycle with no outbound transitions (terminal state)
- **FR-002**: System MUST allow transition from VERIFY to CLOSED only when no PENDING or RUNNING jobs exist for the ticket
- **FR-003**: System MUST block VERIFY to CLOSED transition when project cleanup lock is active (return HTTP 423)
- **FR-004**: System MUST display dual drop zones in SHIP column when dragging VERIFY tickets: Ship zone (top ~60%, purple solid border) and Close zone (bottom ~40%, red dashed border with archive icon)
- **FR-005**: System MUST show confirmation modal before closing ticket with title "Close Ticket {ticketKey}?" and destructive-styled "Close Ticket" button
- **FR-006**: System MUST set closedAt timestamp when ticket transitions to CLOSED
- **FR-007**: System MUST close all open GitHub PRs for the ticket's branch with comment explaining closure via ai-board
- **FR-008**: System MUST NOT delete the Git branch when closing (preserves work for future reference)
- **FR-009**: System MUST exclude CLOSED tickets from board column display (not rendered in any stage column)
- **FR-010**: System MUST include CLOSED tickets in search results with muted styling (reduced opacity) and "Closed" badge
- **FR-011**: System MUST render closed ticket detail modal in read-only mode with all edit controls disabled
- **FR-012**: System MUST handle idempotent cases: proceed without error when no open PR exists or PR is already closed

### Key Entities *(include if feature involves data)*

- **Ticket**: Extended with new `closedAt` optional DateTime field to track when ticket was closed. Stage enum extended with CLOSED value.
- **TicketStage (enum)**: New CLOSED value added as terminal state following SHIP in the workflow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can close a VERIFY ticket in under 10 seconds (drag + confirm modal interaction)
- **SC-002**: 100% of close operations result in associated GitHub PRs being closed or graceful handling if PR doesn't exist
- **SC-003**: Closed tickets are accessible via search within 1 second of query
- **SC-004**: Zero closed tickets appear in any board column after refresh
- **SC-005**: All close attempts from non-VERIFY stages are rejected with clear error messaging
- **SC-006**: Close operation success rate is 99.9% excluding external GitHub API failures
