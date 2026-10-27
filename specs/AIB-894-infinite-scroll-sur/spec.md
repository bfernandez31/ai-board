# Feature Specification: Infinite scroll sur la colonne SHIP - remplace Load more

**Feature Branch**: `AIB-894-infinite-scroll-sur`
**Created**: 2026-10-27
**Status**: Draft
**Input**: User description: "Remplacer le bouton « Load more (N remaining) » de la colonne SHIP par un infinite scroll : le lot suivant se charge automatiquement quand l'utilisateur approche du bas de la colonne, sur desktop comme sur mobile, avec spinner, état d'erreur avec réessai, sans doublons ni requêtes concurrentes, compatible polling et drag & drop. Hors périmètre : autres colonnes, fil d'activité."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

Effective policy: **AUTO** → recommended CONSERVATIVE (netScore +3: neutral feature +1, reliability signals "no duplicates / no concurrent requests / no failing-request loop" +2; Medium confidence 0.6, no conflicting buckets).

- **Decision**: Pre-load trigger distance — the next batch starts loading when the end of the SHIP list comes within roughly one viewport-height-fraction (≈ 300px / a few ticket cards) of the visible area, not only when the very last card is reached.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — description says "un peu avant le dernier ticket" without a number.
- **Fallback Triggered?**: No — AUTO recommendation used directly.
- **Trade-offs**: 1. Slightly earlier loads may fetch a batch the user never views. 2. No cost/timeline impact.
- **Reviewer Notes**: Confirm the margin feels smooth on both a small phone and a large desktop screen.

- **Decision**: Error handling — after a failed batch load, automatic loading pauses; an inline error message with a "Retry" action appears at the bottom of the column. Automatic loading resumes only after a successful retry.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — description requires retry and "no loop", leaves the exact mechanism open.
- **Fallback Triggered?**: No.
- **Trade-offs**: 1. User must act once after a failure (no silent auto-retry with back-off). 2. Simpler, predictable behavior.
- **Reviewer Notes**: Validate the error copy and that scrolling alone never re-triggers a failed request.

- **Decision**: Duplicate protection — newly loaded tickets whose identity is already present in the board are discarded (dedupe by ticket identity), covering offset shifts caused by tickets entering/leaving SHIP between loads.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — offset-based batches can overlap when SHIP content changes concurrently.
- **Fallback Triggered?**: No.
- **Trade-offs**: 1. A ticket could in rare cases be skipped if the list shifts backward; acceptable as polling/refresh reconciles. 2. No extra request cost.
- **Reviewer Notes**: Check that the header `loaded/total` count stays consistent after deduplication.

- **Decision**: Batch size stays unchanged (same size as today's initial SHIP batch and "Load more" batch); no server-side contract change is required beyond what is needed for correctness.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — ticket is UX-only; changing batch size is not requested.
- **Fallback Triggered?**: No.
- **Trade-offs**: 1. Keeps scope narrow. 2. No API or performance re-tuning needed.
- **Reviewer Notes**: None beyond confirming the existing batch size still feels right with auto-loading.

- **Decision**: Accessibility fallback — the loading indicator and error state are announced to assistive technologies, and keyboard users reaching the end of the column trigger the same automatic load (focus/scroll into the bottom region); no visible "Load more" button is kept.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Low (0.3) — not mentioned in the description; conservative default keeps the board accessible.
- **Fallback Triggered?**: Yes — low confidence, fell back to CONSERVATIVE (include accessibility guarantees).
- **Trade-offs**: 1. Small extra effort for live-region announcements. 2. Avoids an accessibility regression from removing the button.
- **Reviewer Notes**: Verify with keyboard-only navigation and a screen reader that remaining tickets are reachable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-load next SHIP batch while scrolling (Priority: P1)

A project member viewing a board with many shipped tickets scrolls down the SHIP column. As they approach the bottom, the next batch of shipped tickets appears automatically, without any click, and they can keep scrolling continuously until all shipped tickets are visible.

**Why this priority**: This is the core value of the ticket — replacing the manual "Load more" click with seamless browsing.

**Independent Test**: Seed a project with more SHIP tickets than one batch, open the board, scroll the SHIP column to its bottom, and verify additional tickets appear with no button present.

**Acceptance Scenarios**:

1. **Given** a project with more SHIP tickets than one batch, **When** the board loads, **Then** the SHIP column shows the first batch and no "Load more" button is displayed.
2. **Given** the first batch is displayed, **When** the user scrolls the SHIP column so that its end approaches the visible area, **Then** the next batch is loaded and appended below existing tickets before the user reaches the last card.
3. **Given** a batch is loading, **When** the user looks at the bottom of the SHIP column, **Then** a discreet loading spinner is visible.
4. **Given** all SHIP tickets have been loaded, **When** the user scrolls to the bottom again, **Then** no further request is sent and no spinner appears.
5. **Given** batches are being loaded, **When** the user reads the SHIP column header, **Then** the `loaded/total` counter reflects the actual number of loaded tickets out of the real total.

---

### User Story 2 - Safe loading: no duplicates, no concurrent requests, recoverable errors (Priority: P1)

While the user scrolls quickly or the network misbehaves, the SHIP column never shows the same ticket twice, never fires overlapping batch requests, and clearly reports failures with a way to retry.

**Why this priority**: Without these guarantees, auto-loading can flood the server or corrupt the displayed list; they are explicit acceptance criteria.

**Independent Test**: Simulate fast scrolling and a failing batch request; verify only one request is in flight at a time, no duplicate tickets appear, and an error with a retry action is shown.

**Acceptance Scenarios**:

1. **Given** a batch is already loading, **When** the user keeps scrolling at the bottom of the column, **Then** no additional request is started until the current one completes.
2. **Given** SHIP content changed between two batch loads (a ticket moved into or out of SHIP), **When** the next batch arrives, **Then** no ticket appears more than once in the column.
3. **Given** a batch request fails, **When** the failure occurs, **Then** the spinner disappears, an error message with a "Retry" action is shown at the bottom of the column, and no further automatic request is sent.
4. **Given** the error state is visible, **When** the user activates "Retry", **Then** the same batch is requested again and, on success, tickets are appended and automatic loading resumes.

---

### User Story 3 - Works on mobile touch scrolling (Priority: P1)

A user on a phone (iOS Safari, Chrome Android) swipes vertically inside the SHIP column. Subsequent batches load automatically as they approach the bottom, without jumps, and the floating scroll-up/down buttons and horizontal swipe between columns keep working.

**Why this priority**: Mobile support is explicitly mandatory in the request.

**Independent Test**: On a mobile viewport, open the board, navigate horizontally to the SHIP column, swipe down inside it, and verify batches load; use the floating scroll buttons and horizontal swipe afterwards.

**Acceptance Scenarios**:

1. **Given** a mobile viewport showing the SHIP column, **When** the user swipes down inside the column toward its end, **Then** the next batch loads automatically.
2. **Given** new tickets are appended, **When** they appear, **Then** the user's current scroll position and the cards in view do not jump or flicker.
3. **Given** more tickets have been loaded, **When** the user taps the floating "scroll to bottom" button, **Then** the column scrolls to its current end (which may trigger the next batch), and the "scroll to top" button returns to the top.
4. **Given** the SHIP column has loaded extra batches, **When** the user swipes horizontally, **Then** navigation between columns behaves exactly as before.

---

### User Story 4 - Fill tall columns automatically (Priority: P2)

On a large screen where the first batch does not fill the SHIP column height, additional batches load automatically until the column is filled (scrollable) or all tickets are loaded.

**Why this priority**: Without this, users on large screens would have no scroll to trigger loading and could never see remaining tickets.

**Independent Test**: Use a very tall viewport with a small first batch relative to the height; verify batches keep loading until the column overflows or the total is reached.

**Acceptance Scenarios**:

1. **Given** the first batch does not fill the column height and more tickets exist, **When** the board finishes rendering, **Then** the next batch loads automatically, one at a time, until the column becomes scrollable or all tickets are loaded.
2. **Given** a batch failed during this fill process, **When** the failure occurs, **Then** the fill process stops and the error/retry state is shown.

---

### User Story 5 - Stable during polling and drag & drop (Priority: P2)

While the board refreshes periodically and while the user drags tickets, the SHIP tickets already loaded remain visible and the auto-load behavior stays coherent.

**Why this priority**: Regressions here would make previously loaded tickets vanish or corrupt drag interactions.

**Independent Test**: Load several SHIP batches, wait for a board refresh cycle, and verify the loaded tickets remain; start a drag and verify no batch load disrupts it.

**Acceptance Scenarios**:

1. **Given** several SHIP batches are loaded, **When** the board refreshes in the background, **Then** all already loaded SHIP tickets remain visible and the counter stays correct.
2. **Given** a drag operation is in progress, **When** the drag passes over or near the bottom of the SHIP column, **Then** no batch load disrupts the drag (loading may be deferred until the drop completes) and the dropped ticket ends in the right place without duplicates.
3. **Given** a ticket is dropped into SHIP, **When** later batches load, **Then** that ticket is not duplicated and the `loaded/total` counter remains accurate.

---

### Edge Cases

- SHIP has zero tickets: the empty state is shown, no spinner, no request.
- SHIP has fewer tickets than one batch: everything is shown, no further request is ever sent.
- Total is an exact multiple of the batch size: the last batch completes and no extra empty request loops; if an empty batch is returned, loading stops.
- A batch returns fewer tickets than expected or zero tickets while the counter says more remain (e.g., tickets left SHIP): loading stops for that cycle without looping; counter reconciles with the real total on next refresh.
- User scrolls away from SHIP (horizontal swipe on mobile) while a batch is loading: the batch still completes and is appended without moving the user's view.
- User leaves the board page during a load: no errors are surfaced afterwards.
- Network goes offline: the error/retry state appears; no repeated requests.
- Board filters/search narrow visible SHIP tickets: auto-loading keeps working against the underlying SHIP list and does not loop endlessly when filtered results don't fill the column (stops once all SHIP tickets are loaded).
- Very fast flick scroll to bottom: at most one request in flight.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SHIP column MUST NOT display a "Load more" button.
- **FR-002**: The system MUST automatically load the next SHIP batch when the end of the SHIP list approaches the visible area of the column's own scroll region, before the very last loaded ticket is reached.
- **FR-003**: The system MUST display a discreet loading indicator at the bottom of the SHIP column while a batch is loading.
- **FR-004**: The system MUST allow at most one SHIP batch request in flight at any time.
- **FR-005**: The system MUST NOT display any ticket more than once in the SHIP column, including when SHIP content changes between batches.
- **FR-006**: The system MUST stop sending batch requests once the number of loaded SHIP tickets reaches the total, or when a batch returns no tickets.
- **FR-007**: The SHIP column header MUST keep showing an accurate `loaded/total` counter as batches load.
- **FR-008**: On a failed batch load, the system MUST stop automatic loading, show an error message with a "Retry" action at the bottom of the column, and resume automatic loading only after a successful retry.
- **FR-009**: When loaded SHIP tickets do not fill the column height and more remain, the system MUST continue loading batches (one at a time) until the column is scrollable, all tickets are loaded, or an error occurs.
- **FR-010**: Background board refreshes MUST NOT remove SHIP tickets that were already loaded through scrolling.
- **FR-011**: Batch loading MUST NOT disrupt an in-progress drag & drop; tickets moved into or out of SHIP MUST remain correctly placed and counted.
- **FR-012**: Auto-loading MUST work with touch scrolling inside the SHIP column on mobile browsers (iOS Safari, Chrome Android).
- **FR-013**: Appending a batch MUST NOT change the user's scroll position or visibly shift the cards currently in view.
- **FR-014**: The mobile floating scroll-to-top/bottom buttons and horizontal swiping between columns MUST continue to work unchanged.
- **FR-015**: The loading and error states MUST be perceivable by assistive technologies, and remaining tickets MUST remain reachable via keyboard navigation.
- **FR-016**: Other board columns (INBOX → VERIFY) and the activity feed's "Load more" MUST remain unchanged.
- **FR-017**: Existing automated tests covering the SHIP "Load more" behavior MUST be updated to cover automatic loading, the loading indicator, deduplication, the single-request guarantee, stop-at-total, and error with retry.

### Key Entities

- **SHIP batch**: A fixed-size slice of tickets in the SHIP stage, ordered consistently, fetched by position after the tickets already loaded.
- **SHIP total**: The real number of tickets currently in SHIP for the project; drives the header counter and the stop condition.
- **Loaded SHIP list**: The tickets currently displayed in the SHIP column, unique by ticket identity, which persists across background refreshes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can browse every shipped ticket of a project with zero clicks, by scrolling alone, on desktop and on mobile.
- **SC-002**: In 100% of tested scroll sessions (including fast flick scrolling), no ticket appears twice and no more than one batch request is in flight at a time.
- **SC-003**: When the user scrolls at a normal pace, the next batch is visible before they reach the end of the list in at least 90% of loads under normal network conditions (no visible "waiting at the bottom").
- **SC-004**: After all tickets are loaded, further scrolling generates zero additional batch requests.
- **SC-005**: After a failed load, zero automatic retries occur until the user activates "Retry"; a successful retry appends the missing tickets.
- **SC-006**: Already loaded SHIP tickets remain visible across 100% of background refresh cycles during a session.
- **SC-007**: No visible scroll jump occurs when a batch is appended (cards in view remain at the same on-screen position).

## Assumptions

- The existing SHIP batch size and ordering are kept; only the loading trigger and states change.
- The SHIP column already has its own internal vertical scroll region; auto-loading is driven by that region, not by page scroll.
- The header counter's total comes from the same source as today and is refreshed by background polling.
- No changes to permissions: anyone who can view the board can load SHIP tickets.
