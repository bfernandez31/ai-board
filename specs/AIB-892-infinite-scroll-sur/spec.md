# Feature Specification: Infinite Scroll on the SHIP Column

**Feature Branch**: `AIB-892-infinite-scroll-sur`
**Created**: 2026-10-27
**Status**: Draft
**Input**: User description: "Infinite scroll on the SHIP column — replaces the 'Load more' button"

## Auto-Resolved Decisions

- **Decision**: Pre-load margin ("a bit before the last ticket") is set to roughly one screen-height of the column before the bottom, so the next batch is requested before the user hits the end.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (score +3: reliability/smoothness signals, neutral UI context)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A larger margin gives smoother scrolling but may fetch slightly earlier than strictly needed.
  2. No cost or timeline impact.
- **Reviewer Notes**: Validate the margin feels smooth on mobile and desktop.

- **Decision**: Error state shows an inline message with a "Retry" action at the bottom of the column; automatic loading pauses until the user retries.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score +5: reliability signals, no conflicting buckets)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requires one explicit user action after failure, avoiding request loops.
  2. Slightly more UI states to maintain and test.
- **Reviewer Notes**: Confirm the error and retry wording matches the product tone.

- **Decision**: Scope limited to the SHIP column board view; other columns and the activity feed keep current behavior.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (explicitly stated out of scope in ticket)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The activity feed retains its "Load more" button, leaving an inconsistency.
  2. Keeps the change small and low-risk.
- **Reviewer Notes**: Consider a follow-up ticket for the activity feed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic loading while scrolling SHIP (Priority: P1)

A user with many shipped tickets scrolls down the SHIP column. As they approach the bottom, the next batch of tickets appears automatically, with no button to click.

**Why this priority**: This is the core value: removing the manual click to browse shipped tickets.

**Independent Test**: Seed a project with more SHIP tickets than one batch, scroll the SHIP column to near the bottom, and verify the next batch appears without any click and no "Load more" button exists.

**Acceptance Scenarios**:

1. **Given** SHIP has more tickets than the loaded batch, **When** the user scrolls close to the bottom of the column, **Then** the next batch loads automatically and is appended below existing tickets.
2. **Given** the SHIP column is displayed, **When** the user views its footer, **Then** no "Load more" button is shown.
3. **Given** a batch is loading, **When** the user looks at the bottom of the column, **Then** a discreet spinner is visible until the batch arrives.
4. **Given** all SHIP tickets are loaded, **When** the user scrolls to the bottom, **Then** no further request is made and the header counter shows loaded/total with equal values.

---

### User Story 2 - Reliable behavior under fast scrolling and failures (Priority: P1)

A user scrolls quickly, or the network drops. The list stays consistent and the user can recover.

**Why this priority**: Duplicate or looping requests would degrade data quality and server load.

**Independent Test**: Scroll rapidly past the trigger point several times and count requests; simulate a failed request and verify the error and retry.

**Acceptance Scenarios**:

1. **Given** a batch is loading, **When** the user keeps scrolling at the bottom, **Then** no second concurrent request is issued and no ticket appears twice.
2. **Given** a batch request fails, **When** the failure occurs, **Then** an error message with a "Retry" action appears and no automatic repeat requests are sent.
3. **Given** the error state is shown, **When** the user activates "Retry", **Then** the load is attempted again and, on success, the error disappears and tickets are appended.

---

### User Story 3 - Large screens and board refresh (Priority: P2)

On a tall screen the first batch may not fill the SHIP column; the board also refreshes periodically and supports drag and drop.

**Why this priority**: Without it, tall-screen users could never scroll and so never trigger loading.

**Independent Test**: Use a tall viewport with a small first batch and verify loading continues until the column is filled or tickets run out; trigger a board refresh and a drag and drop mid-way.

**Acceptance Scenarios**:

1. **Given** the first batch does not fill the column height and more tickets exist, **When** the board is displayed, **Then** further batches load until the column is filled or all tickets are loaded.
2. **Given** additional batches are loaded, **When** the board's periodic refresh runs, **Then** previously loaded SHIP tickets remain visible.
3. **Given** a drag and drop is in progress, **When** the SHIP bottom becomes visible, **Then** the board stays consistent and the dragged ticket is unaffected.

---

### User Story 4 - Mobile touch scrolling (Priority: P1)

A mobile user (iOS Safari, Chrome Android) scrolls the SHIP column with a finger.

**Why this priority**: Mobile support is mandatory per the ticket.

**Independent Test**: On a mobile viewport, touch-scroll the SHIP column's internal scroll to the bottom and verify the next batch loads; use the floating up/down buttons and swipe horizontally between columns.

**Acceptance Scenarios**:

1. **Given** a mobile device, **When** the user touch-scrolls inside the SHIP column near the bottom, **Then** the next batch loads automatically.
2. **Given** the floating scroll up/down buttons are shown, **When** the user taps "down" to reach the bottom, **Then** loading triggers the same way as manual scrolling.
3. **Given** the user swipes horizontally between columns, **When** SHIP comes into view, **Then** horizontal navigation is not disrupted by loading.
4. **Given** new tickets are appended, **When** they render, **Then** the visible scroll position does not jump or stutter.

### Edge Cases

- Total SHIP count changes (ticket shipped or removed) while scrolling: counter and list reflect the real state without duplicates.
- SHIP column is empty or has fewer tickets than one batch: no spinner, no request loop.
- Column is resized (rotation, window resize) so more room appears: loading continues if the column is no longer filled.
- User scrolls back up and down repeatedly: no repeat requests once everything is loaded.
- Error occurs, then the board refresh succeeds: error state does not cause request loops.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SHIP column MUST NOT display a "Load more" button.
- **FR-002**: The next batch of SHIP tickets MUST load automatically when the bottom of the list approaches the visible area, ahead of the last ticket.
- **FR-003**: A discreet loading indicator MUST appear at the bottom of the column while a batch is loading.
- **FR-004**: At most one batch request MUST be in flight at a time.
- **FR-005**: The SHIP list MUST never show the same ticket twice.
- **FR-006**: Once all tickets are loaded, no further load requests MUST be issued, and the header counter MUST show the accurate loaded/total values.
- **FR-007**: On load failure, the column MUST show an error message with a retry action, and MUST NOT automatically re-attempt in a loop.
- **FR-008**: Already loaded SHIP tickets MUST remain visible across periodic board refreshes.
- **FR-009**: Loading MUST work correctly while a drag and drop is in progress.
- **FR-010**: If the loaded tickets do not fill the column height and more exist, loading MUST continue until the column is filled or tickets are exhausted.
- **FR-011**: Auto-loading MUST work with touch scrolling inside the column's own scroll area on iOS Safari and Chrome Android.
- **FR-012**: Auto-loading MUST remain compatible with the floating scroll up/down buttons and horizontal column navigation on mobile.
- **FR-013**: Appending tickets MUST NOT cause a visible scroll position jump.
- **FR-014**: Other columns and the activity feed MUST remain unchanged.
- **FR-015**: Existing tests covering the SHIP "Load more" behavior MUST be updated to cover the infinite scroll behavior (loading, no duplicates, no concurrent requests, stop when complete, error and retry).

### Key Entities

- **SHIP ticket batch**: A group of shipped tickets fetched together; ordered, appended to the list without overlap.
- **SHIP column counter**: Header display of loaded versus total shipped tickets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users reach any shipped ticket by scrolling alone, with zero clicks required.
- **SC-002**: In rapid-scroll testing, 0 duplicate tickets and 0 overlapping loads occur across 20 consecutive fast scrolls.
- **SC-003**: After all tickets are loaded, 0 additional load requests are made on further scrolling.
- **SC-004**: After a failed load, 100% of cases show an error with retry, and no repeat attempts happen without user action.
- **SC-005**: On a tall screen, the SHIP column is filled (or fully loaded) without any user scrolling.
- **SC-006**: On mobile, touch scrolling to the bottom loads the next batch in 100% of tested devices (iOS Safari, Chrome Android), with no visible position jump.
