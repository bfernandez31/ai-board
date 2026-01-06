# Feature Specification: Close Ticket Feature

**Feature Branch**: `AIB-147-close-ticket-feature`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: Add CLOSED state for tickets in VERIFY stage

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Fallback to CONSERVATIVE due to low AUTO confidence
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) - Net score -1 with insufficient signal strength
- **Fallback Triggered?**: Yes - AUTO detected internal/project management context (-2) and neutral feature (+1), yielding net score -1 with abs score 1. Since confidence < 0.5, defaulted to CONSERVATIVE.
- **Trade-offs**:
  1. Scope: CONSERVATIVE adds explicit confirmation dialogs and detailed error handling, slightly increasing implementation complexity
  2. Quality: Ensures proper user feedback and prevents accidental closures
- **Reviewer Notes**: Validate that the confirmation modal provides adequate context for users before closing tickets. Verify PR closure behavior in edge cases.

---

- **Decision**: PR closure behavior when no open PR exists
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicit requirement in feature description)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Scope: Proceed without error when no PR exists (idempotent operation)
  2. Quality: Graceful handling prevents user confusion
- **Reviewer Notes**: Confirm idempotent behavior is logged for audit purposes.

---

- **Decision**: Branch preservation on ticket closure
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicit requirement: "Do NOT delete the branch")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Scope: Preserves work for potential future reference or revival
  2. Cost: Minor storage overhead from undeleted branches
- **Reviewer Notes**: Consider documenting branch naming for closed tickets to aid future cleanup.

---

- **Decision**: Read-only state for CLOSED tickets accessed via search
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (terminal state implies no modifications)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. UX: Clear visual distinction for closed tickets in search results
  2. Scope: Prevents accidental modifications to resolved tickets
- **Reviewer Notes**: Ensure all edit controls are properly disabled in ticket modal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Close Ticket from VERIFY Stage (Priority: P1)

A project owner has a ticket in VERIFY stage that is no longer needed (abandoned work, requirements changed, or duplicate effort). They want to cleanly close this ticket without shipping it, while preserving the work done for future reference.

**Why this priority**: This is the core functionality of the feature. Without the ability to close tickets from VERIFY, users have no clean resolution path for abandoned work.

**Independent Test**: Can be fully tested by dragging a ticket from VERIFY toward SHIP and dropping on the Close zone, confirming in the modal, and verifying the ticket disappears from the board.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with no active jobs, **When** user drags it toward SHIP column and hovers over the bottom zone, **Then** the Close drop zone highlights with red dashed border and "Close" label with archive icon.

2. **Given** a ticket being dragged toward SHIP from VERIFY, **When** user drops it on the Close zone, **Then** a confirmation modal appears with title "Close Ticket {ticketKey}?" and explains the consequences.

3. **Given** the close confirmation modal is open, **When** user clicks "Close Ticket" button, **Then** the system closes associated GitHub PRs, sets closedAt timestamp, and removes the ticket from the board.

4. **Given** a ticket is successfully closed, **When** user views the board, **Then** the closed ticket does not appear in any column.

---

### User Story 2 - Search for Closed Tickets (Priority: P2)

A team member needs to find a previously closed ticket to reference the work that was done or understand why it was closed. They search for the ticket and can access its details in read-only mode.

**Why this priority**: Searchability ensures closed work is not lost and can be referenced for future decisions or revived if needed.

**Independent Test**: Can be tested by closing a ticket, then using the search functionality to find it and opening its detail modal.

**Acceptance Scenarios**:

1. **Given** a closed ticket exists, **When** user searches for it by ticket key or title, **Then** the ticket appears in search results with muted styling and a "Closed" badge.

2. **Given** a closed ticket appears in search results, **When** user clicks on it, **Then** the ticket detail modal opens in read-only mode.

3. **Given** the detail modal is open for a closed ticket, **When** user views the modal, **Then** all edit controls are disabled or hidden and the ticket displays its full history.

---

### User Story 3 - Ship Zone Split During Drag (Priority: P2)

When dragging a ticket from VERIFY stage, the SHIP column visually splits into two distinct drop zones to make the Ship vs Close decision clear and prevent accidental closures.

**Why this priority**: The dual drop zone UX is essential for discoverability and preventing user error when choosing between ship and close actions.

**Independent Test**: Can be tested by starting a drag from VERIFY and observing the SHIP column split into two visually distinct zones.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage, **When** user starts dragging it, **Then** the SHIP column splits into Ship zone (top ~60%) with purple solid border and Close zone (bottom ~40%) with red dashed border.

2. **Given** the SHIP column is in split mode, **When** user hovers over the Ship zone, **Then** only the Ship zone highlights and Close zone remains unhighlighted.

3. **Given** the SHIP column is in split mode, **When** user hovers over the Close zone, **Then** only the Close zone highlights with the archive icon visible and Ship zone remains unhighlighted.

4. **Given** a ticket from a non-VERIFY stage, **When** user drags it toward SHIP, **Then** the SHIP column does NOT split and behaves as normal single drop zone.

---

### User Story 4 - Validation Blocking Closure (Priority: P3)

The system prevents ticket closure when conditions would make it unsafe or inappropriate, such as during active jobs or cleanup locks.

**Why this priority**: Validation ensures data integrity and prevents race conditions or conflicting operations.

**Independent Test**: Can be tested by attempting to close a ticket with an active job and verifying the operation is blocked with appropriate feedback.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY with a PENDING or RUNNING job, **When** user attempts to close it, **Then** the operation is blocked and user sees an error message explaining why.

2. **Given** a project-level cleanup lock is active, **When** user attempts to close any ticket, **Then** the operation returns HTTP 423 Locked and user sees the cleanup in progress message.

3. **Given** a ticket is already CLOSED, **When** any transition is attempted, **Then** the operation fails because CLOSED is a terminal state with no outbound transitions.

---

### Edge Cases

- What happens when a ticket has no open PR to close? Proceed without error (idempotent - PR closure is skipped gracefully).
- What happens when the PR is already closed? Proceed without error (idempotent - already in desired state).
- What happens when multiple PRs exist for the same branch? Close all matching PRs with the comment explaining closure via ai-board.
- What happens to the preview URL when a ticket is closed? Unchanged - only replaced when another ticket deploys a new preview.
- What happens if GitHub API rate limit is exceeded during PR closure? Retry with exponential backoff; if still failing, log error but allow closure to complete (PR closure is best-effort).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add CLOSED to the TicketStage enum as a new terminal stage.
- **FR-002**: System MUST add `closedAt: DateTime?` field to the Ticket model to record when a ticket was closed.
- **FR-003**: System MUST only allow VERIFY → CLOSED transition; no other stage may transition to CLOSED.
- **FR-004**: System MUST block CLOSED → any stage transitions (terminal state, no outbound transitions allowed).
- **FR-005**: System MUST block closure when ticket has PENDING or RUNNING job.
- **FR-006**: System MUST block closure during active cleanup lock (return HTTP 423).
- **FR-007**: System MUST close all associated GitHub PRs when a ticket is closed, adding a comment explaining the closure was performed via ai-board.
- **FR-008**: System MUST NOT delete the branch when closing a ticket (preserve work for future reference).
- **FR-009**: System MUST set `closedAt` timestamp to current time when ticket is closed.
- **FR-010**: System MUST exclude CLOSED tickets from board display (not shown in any column).
- **FR-011**: System MUST include CLOSED tickets in search results with muted styling and "Closed" badge.
- **FR-012**: System MUST display CLOSED tickets in read-only mode when accessed via search.
- **FR-013**: System MUST display dual drop zones (Ship/Close) in SHIP column only when dragging from VERIFY stage.
- **FR-014**: System MUST display confirmation modal before closing ticket with title "Close Ticket {ticketKey}?", explanation of consequences, and "Close Ticket" (destructive) and "Cancel" buttons.
- **FR-015**: System MUST handle PR closure idempotently (proceed without error if no PR exists or PR already closed).

### Key Entities *(include if feature involves data)*

- **TicketStage Enum**: Extended with CLOSED value representing a terminal state for abandoned or cancelled work.
- **Ticket**: Extended with `closedAt` nullable DateTime field to track when the ticket entered CLOSED state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can close a ticket from VERIFY stage in under 30 seconds (drag + confirm).
- **SC-002**: 100% of closed tickets are excluded from board display while remaining searchable.
- **SC-003**: Associated GitHub PRs are closed within 10 seconds of ticket closure confirmation.
- **SC-004**: Zero data loss from closure operations (branches preserved, all ticket data retained).
- **SC-005**: Validation prevents 100% of invalid closure attempts (active jobs, cleanup locks, wrong stage).
- **SC-006**: Search results display closed tickets with clear visual distinction (muted + badge) on first render.
- **SC-007**: Users experience zero accidental closures due to clear dual drop zone visual separation.
