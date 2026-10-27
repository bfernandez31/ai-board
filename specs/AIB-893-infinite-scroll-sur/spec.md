# Feature Specification: Infinite scroll sur la colonne SHIP - remplace Load more

**Feature Branch**: `AIB-893-infinite-scroll-sur`
**Created**: 2026-10-27
**Status**: Draft
**Input**: User description: "Remplacer le bouton « Load more (N remaining) » de la colonne SHIP par un infinite scroll : quand l'utilisateur fait défiler la colonne et approche du bas, le lot suivant se charge automatiquement. Indicateur de chargement, gestion d'erreur avec réessai, pas de doublons ni de requêtes concurrentes, compatibilité polling / drag & drop / mobile (iOS Safari, Chrome Android), remplissage automatique sur grand écran. Hors périmètre : autres colonnes, fil d'activité."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

AUTO scoring: reliability signals (no duplicates, no concurrent requests, no failure loops, polling correctness: +2), mobile compatibility mandatory (+2 reliability), neutral UI feature (+1), internal tool context (-2). netScore = +3 → Medium confidence (0.6), suggested CONSERVATIVE. No fallback needed.

- **Decision**: Prefetch distance — the next batch starts loading when the bottom of the SHIP list comes within roughly one viewport-height's worth of tickets (approx. 300px) of the visible area, not only when the very last card is visible.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6, netScore +3)
- **Fallback Triggered?**: No
- **Trade-offs**: Earlier triggering keeps scroll fluid at the cost of occasionally loading a batch the user never views. Distance is a tunable constant.
- **Reviewer Notes**: Validate that the distance feels natural on both a small phone and a large desktop screen.

- **Decision**: Error handling — after a failed batch load, automatic loading pauses entirely; an inline error message with a "Retry" action appears at the bottom of the column. Only an explicit retry (or a full board reload) resumes loading.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**: Users must tap once to recover from transient errors, but there is zero risk of a request loop. No automatic backoff retries are added.
- **Reviewer Notes**: Confirm the retry control is reachable by touch and keyboard.

- **Decision**: Polling preservation — when the board's periodic refresh occurs, SHIP tickets already loaded beyond the first batch remain in the list (refreshed first-batch data is merged with, not substituted for, already-loaded tickets), and the list stays deduplicated by ticket identity.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**: Tickets loaded from later batches may be slightly stale until the user reloads; tickets that left SHIP are removed only if the refresh reports them in another stage.
- **Reviewer Notes**: Verify that a ticket moved out of SHIP (e.g., to CLOSED) does not linger as a duplicate in SHIP after a refresh.

- **Decision**: Batch size stays unchanged (50 tickets per batch, same as today's initial load and "Load more").
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (existing behavior, no change requested)
- **Fallback Triggered?**: No
- **Trade-offs**: No server-side change needed; fewer, larger requests.
- **Reviewer Notes**: None.

- **Decision**: Accessibility fallback — loading must also trigger when the user reaches the bottom via keyboard navigation or the mobile scroll-down floating button, since both move the same column scroll area; no separate visible "Load more" button is kept.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**: Removes the explicit button as required by the ticket; the loading indicator exposes a status announcement for assistive technologies.
- **Reviewer Notes**: Check screen-reader announcement of "Loading more tickets" / error state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic loading while scrolling SHIP (Priority: P1)

A project member viewing the board scrolls down the SHIP column. As they approach the end of the loaded tickets, the next batch appears automatically without any click, and they can keep scrolling seamlessly until all shipped tickets are visible.

**Why this priority**: This is the core need of the ticket — replacing the manual "Load more" click with seamless loading.

**Independent Test**: Seed a project with more than 100 SHIP tickets, open the board, scroll the SHIP column to the bottom repeatedly, and confirm all tickets load with no button present.

**Acceptance Scenarios**:

1. **Given** a project with 120 SHIP tickets and the first 50 displayed, **When** the user scrolls the SHIP column near its bottom, **Then** the next 50 tickets are appended automatically and the header counter shows `100/120`.
2. **Given** the SHIP column is displayed, **When** the user looks for a "Load more" button, **Then** none is present.
3. **Given** all 120 SHIP tickets are loaded, **When** the user keeps scrolling to the bottom, **Then** no further loading request is made and the header counter shows `120/120`.
4. **Given** a batch is loading, **When** the user looks at the bottom of the SHIP column, **Then** a discreet spinner is visible until the batch arrives.

---

### User Story 2 - Reliable loading (no duplicates, no concurrent requests, errors recoverable) (Priority: P1)

A user scrolling quickly, or on an unreliable network, still sees a consistent list: each ticket appears once, only one batch loads at a time, and failures are clearly reported with a way to retry.

**Why this priority**: Without these guarantees, infinite scroll produces duplicate cards, wasted requests, or infinite failure loops — worse than the current button.

**Independent Test**: Simulate fast repeated scroll-to-bottom events and a failing batch request; verify a single in-flight request, no duplicate ticket IDs, and a visible error with working retry.

**Acceptance Scenarios**:

1. **Given** a batch is already loading, **When** the user scrolls up and down rapidly near the bottom, **Then** no additional request is started until the current one completes.
2. **Given** a batch returns tickets that are already in the list, **When** it is appended, **Then** each ticket still appears exactly once.
3. **Given** a batch request fails, **When** the failure occurs, **Then** an error message with a "Retry" action appears at the bottom of the column and no further automatic request is made.
4. **Given** the error state is shown, **When** the user activates "Retry", **Then** the same batch is requested again and, on success, the error disappears and loading resumes normally.

---

### User Story 3 - Mobile touch scrolling (Priority: P1)

A user on a phone (iOS Safari or Chrome Android) scrolls the SHIP column by touch, inside the column's own scroll area. New batches load automatically, the floating up/down scroll buttons continue to work, and horizontal swiping between columns is unaffected.

**Why this priority**: Mobile support is explicitly mandatory in the ticket.

**Independent Test**: On a mobile viewport, touch-scroll the SHIP column to its bottom and use the floating scroll-down button; verify batches load, position does not jump, and horizontal column swiping still works.

**Acceptance Scenarios**:

1. **Given** a mobile viewport and more SHIP tickets than displayed, **When** the user touch-scrolls the SHIP column near its bottom, **Then** the next batch loads automatically.
2. **Given** a mobile viewport, **When** the user repeatedly taps the floating scroll-down button until reaching the bottom, **Then** the next batch loads and the scroll-down button stays visible while more content exists below.
3. **Given** new tickets are appended, **When** the user is mid-scroll, **Then** the currently visible tickets stay in place (no jump or jitter in scroll position).
4. **Given** the user swipes horizontally between columns, **When** the gesture occurs over the SHIP column, **Then** horizontal navigation behaves as before.

---

### User Story 4 - Auto-fill on tall screens (Priority: P2)

On a large screen where the first batch does not fill the SHIP column height, there is no scrollbar to trigger loading. The board keeps loading batches automatically until the column is filled or all tickets are loaded.

**Why this priority**: Without it, users on large screens could be stuck with no way to load more tickets.

**Independent Test**: Use a very tall viewport with a small batch relative to height; verify batches load until a scrollbar appears or all tickets are loaded.

**Acceptance Scenarios**:

1. **Given** a tall viewport where loaded SHIP tickets do not fill the column and more remain, **When** the board finishes rendering, **Then** the next batch loads automatically, repeating until the column is scrollable or all tickets are loaded.
2. **Given** the auto-fill is ongoing, **When** a batch fails, **Then** auto-fill stops and the error/retry state is shown.

---

### User Story 5 - Compatibility with polling and drag & drop (Priority: P2)

While the board periodically refreshes, or while the user drags a ticket, the SHIP list stays consistent: already loaded tickets do not vanish, and dragging does not trigger spurious loads that disrupt the drop.

**Why this priority**: Prevents regressions in existing core board behavior.

**Independent Test**: Load 2+ batches, wait for several refresh cycles, and verify the count of displayed SHIP tickets does not drop; drag a VERIFY ticket to SHIP and confirm the drop succeeds and the list remains deduplicated.

**Acceptance Scenarios**:

1. **Given** 100 SHIP tickets loaded, **When** the board's periodic refresh runs, **Then** all 100 remain displayed and the counter stays accurate.
2. **Given** a drag operation is in progress, **When** the dragged item passes over the bottom of the SHIP column, **Then** no batch load is triggered until the drag ends.
3. **Given** a ticket is dropped into SHIP, **When** the list updates, **Then** the ticket appears once and the header total increases accordingly.

---

### Edge Cases

- SHIP has 50 or fewer tickets: no loading request is ever made beyond the initial load; no spinner shown.
- SHIP has 0 tickets: the existing empty state is shown; no loading attempt.
- The total changes while scrolling (a ticket is shipped or closed elsewhere): the counter reflects the latest known total; loading stops when loaded count reaches the total or a batch returns no tickets.
- A batch returns fewer tickets than requested or zero tickets: treated as "all loaded"; no further requests.
- A batch overlaps previously loaded tickets (offset shift due to tickets entering/leaving SHIP): duplicates are discarded.
- The user leaves the board (navigates away) while a batch is loading: no error is shown and no state corruption occurs on return.
- Network goes offline mid-scroll: error state with retry appears; no request loop.
- Search/filter on the board: loading behavior applies to the SHIP list as displayed; no infinite loop when filters hide loaded tickets (auto-fill stops once all tickets are loaded or a batch returns empty).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SHIP column MUST NOT display a "Load more" button.
- **FR-002**: The system MUST automatically load the next batch of SHIP tickets when the bottom of the SHIP list approaches the visible area of the column's own scroll region (≈ 300px before the last loaded ticket becomes visible).
- **FR-003**: The system MUST display a discreet loading spinner at the bottom of the SHIP column while a batch is loading.
- **FR-004**: The system MUST allow at most one SHIP batch request in flight at any time; trigger events during an in-flight load MUST be ignored.
- **FR-005**: The system MUST ensure each ticket appears at most once in the SHIP list, discarding duplicates by ticket identity, including when SHIP content changes between batches.
- **FR-006**: The system MUST stop issuing batch requests once the number of loaded SHIP tickets reaches the known total, or once a batch returns no tickets.
- **FR-007**: The SHIP column header counter (`loaded/total`) MUST continue to reflect the actual loaded count and total as batches load.
- **FR-008**: On a failed batch request, the system MUST suspend all automatic loading, display an inline error message with a "Retry" action at the bottom of the SHIP column, and resume automatic loading only after a successful retry.
- **FR-009**: When loaded SHIP tickets do not fill the column height and more tickets remain, the system MUST keep loading batches (one at a time) until the column becomes scrollable, all tickets are loaded, or an error occurs.
- **FR-010**: The board's periodic refresh MUST NOT remove SHIP tickets already loaded from later batches.
- **FR-011**: Batch loading MUST NOT disrupt an in-progress drag & drop; tickets moved into or out of SHIP MUST remain correctly placed and counted.
- **FR-012**: Automatic loading MUST work with touch scrolling inside the SHIP column's own scroll area on iOS Safari and Chrome Android.
- **FR-013**: Appending tickets MUST NOT change the user's scroll position or the position of tickets currently visible (no scroll jump or jitter).
- **FR-014**: The mobile floating scroll up/down buttons and horizontal swiping between board columns MUST keep working unchanged.
- **FR-015**: The loading and error states MUST be exposed to assistive technologies, and remaining tickets MUST stay reachable via keyboard navigation.
- **FR-016**: Other columns (INBOX, SPECIFY, PLAN, BUILD, VERIFY) and the activity feed "Load more" MUST remain unchanged.
- **FR-017**: Existing automated tests covering SHIP "Load more" MUST be updated to cover automatic loading, loading state, deduplication, single in-flight request, stop-when-complete, and error/retry state.

### Key Entities

- **SHIP ticket list (client view)**: Ordered, deduplicated set of SHIP tickets loaded so far for a project; grows by batches of 50.
- **SHIP total**: Count of all SHIP tickets for the project, reported by the server with the initial board load; drives the header counter and the "all loaded" condition.
- **Loading state**: One of idle, loading, error, or complete for the SHIP column; governs spinner, error/retry display, and whether further loads may trigger.

## Assumptions

- The existing server endpoint for paginated SHIP tickets (offset + limit, ordered consistently) is reused unchanged.
- The initial board load continues to return the first 50 SHIP tickets plus the SHIP total.
- "Near the bottom" is measured relative to the SHIP column's internal scroll area, not the page.
- The column's existing ordering of SHIP tickets is preserved; appended tickets go to the end.
- Error message text is in English, consistent with the rest of the board UI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view every SHIP ticket of a project by scrolling alone, with zero clicks, on desktop and on mobile.
- **SC-002**: In 100% of rapid-scroll test sessions, 0 duplicate tickets and no more than one batch request in flight at a time are observed.
- **SC-003**: At a normal scrolling pace, the next batch is visible before the user reaches the end of the list in at least 90% of loads on a normal connection.
- **SC-004**: After all tickets are loaded, 0 additional batch requests are issued during further scrolling.
- **SC-005**: After a failed batch, 0 automatic retries occur until the user activates "Retry"; a successful retry appends the missing tickets.
- **SC-006**: Already loaded SHIP tickets remain displayed across 100% of board refresh cycles during a session.
- **SC-007**: No visible scroll jump occurs when tickets are appended (tickets in view keep the same on-screen position).
