# Feature Specification: Show Duplicated Ticket

**Feature Branch**: `AIB-145-show-duplicated-ticket`
**Created**: 2026-01-05
**Status**: Draft
**Input**: User description: "When we duplicate a ticket, the ticket is not present in inbox, we have to refresh to see him. Fix it to display the ticket un inbox without the need to refresh the screen. Add relevant test"

## Auto-Resolved Decisions

- **Decision**: Use optimistic update with fallback to cache invalidation
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: +4) — Internal feature context (+1), speed directive in description (-3 via "Fix it to display... without need to refresh")
- **Fallback Triggered?**: No — Clear signal pattern for performance-focused fix
- **Trade-offs**:
  1. Optimistic update provides immediate feedback but requires rollback logic on error
  2. Cache invalidation is simpler but already exists and isn't working correctly
- **Reviewer Notes**: Verify the existing `invalidateQueries` call in the duplicate handler is executing properly. The root cause may be timing or cache key mismatch rather than missing invalidation.

---

- **Decision**: Test approach - RTL component test over E2E
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: +3) — Testing trophy architecture favors integration/component tests; no browser-specific features (no drag-drop, OAuth, viewport)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. RTL tests are faster and more focused but test in isolation
  2. E2E tests provide full stack verification but are slower and reserved for browser-required features
- **Reviewer Notes**: Per CLAUDE.md testing guidelines, RTL component tests are appropriate for "Interactive UI (forms, modals, user interactions)" which this falls under.

## User Scenarios & Testing

### User Story 1 - Duplicate Ticket Appears Immediately (Priority: P1)

A user views a ticket in the detail modal and wants to create a copy. After clicking the duplicate button, the new ticket should appear in the INBOX column immediately without requiring a page refresh.

**Why this priority**: This is the core bug fix - the entire purpose of this ticket. Without this working, the feature provides no value.

**Independent Test**: Can be fully tested by duplicating a ticket and verifying the new ticket appears in the INBOX column within the same browser session without refresh.

**Acceptance Scenarios**:

1. **Given** a user has the ticket detail modal open, **When** they click the Duplicate button and the duplication succeeds, **Then** the new duplicated ticket appears in the INBOX column immediately without page refresh
2. **Given** a user duplicates a ticket, **When** the new ticket is created, **Then** the toast notification displays the new ticket key (e.g., "Ticket ABC-124 created")
3. **Given** a user duplicates a ticket, **When** the duplication completes, **Then** the modal closes and the board shows the updated state

---

### User Story 2 - Error Handling on Duplicate Failure (Priority: P2)

When a duplication fails due to server error or network issues, the user receives clear feedback and the UI remains in a consistent state.

**Why this priority**: Error handling ensures a robust user experience but is secondary to the main fix.

**Independent Test**: Can be tested by simulating a failed duplicate API call and verifying error toast appears and UI state is consistent.

**Acceptance Scenarios**:

1. **Given** a user clicks Duplicate, **When** the server returns an error, **Then** an error toast is displayed with details and no orphaned UI state exists
2. **Given** a user is duplicating a ticket, **When** the network request fails, **Then** the Duplicate button returns to its enabled state

### Edge Cases

- What happens when the user rapidly clicks duplicate multiple times? (Should be prevented by loading state)
- How does the system handle concurrent users duplicating the same ticket? (Both should succeed with unique ticket numbers)
- What happens if the ticket list cache is cleared during duplication? (Should still work via server response)

## Requirements

### Functional Requirements

- **FR-001**: System MUST update the board UI to show newly duplicated tickets in the INBOX column immediately after successful duplication
- **FR-002**: System MUST NOT require a page refresh to display the duplicated ticket
- **FR-003**: System MUST continue to display the success toast with the new ticket key after duplication
- **FR-004**: System MUST maintain the existing duplicate behavior (closes modal, shows toast, copies relevant fields)
- **FR-005**: System MUST prevent multiple duplicate requests while one is in progress (loading state)

### Key Entities

- **Ticket**: The entity being duplicated; new ticket created with "Copy of" prefix title, same description/attachments, placed in INBOX stage
- **Board/Column**: UI container that displays tickets grouped by stage; must reflect new ticket without refresh

## Success Criteria

### Measurable Outcomes

- **SC-001**: Duplicated tickets appear in the INBOX column within 1 second of successful API response (no manual refresh required)
- **SC-002**: 100% of successful duplicate operations result in the new ticket being visible without refresh
- **SC-003**: Test coverage includes at least one passing test that verifies the duplicate-and-display behavior
- **SC-004**: No regression in existing duplicate functionality (toast notification, modal close, copied fields)
