# Feature Specification: Redesign Comparisons Hub as Vertical List with Inline Expand

**Feature Branch**: `AIB-365-redesign-comparisons-hub`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "Redesign comparisons hub as vertical list with inline expand"

## Auto-Resolved Decisions

- **Decision**: Accordion behavior — only one comparison expanded at a time (clicking a new card collapses the previously expanded one)
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (score: 0.3 — internal UX redesign with no compliance/security signals, absScore=1)
- **Fallback Triggered?**: Yes — AUTO recommended PRAGMATIC (netScore=-1) but confidence was below 0.5, promoted to CONSERVATIVE
- **Trade-offs**:
  1. Single-expand prevents users from comparing two expanded comparisons side-by-side, but avoids a very long page with multiple heavy detail sections open
  2. Simpler state management (single expandedId vs. Set of IDs)
- **Reviewer Notes**: If users need multi-expand in the future, the accordion can be changed to allow multiple open sections without architectural changes

---

- **Decision**: Load More page size — use the existing PAGE_SIZE of 10 items per batch
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. 10 items balances initial payload size with usefulness (most users care about recent 5-10 comparisons)
  2. Consistent with the existing API pagination contract (pageSize default of 10)
- **Reviewer Notes**: Page size is already configurable in the API; the UI just needs to accumulate pages rather than replace them

---

- **Decision**: Compact card content — display winner ticket key, winner ticket title, summary snippet, score, and creation date
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Matches the information already shown in the current history sidebar buttons, plus score and date for scannability
  2. More information could clutter the compact view; less would reduce scannability
- **Reviewer Notes**: The existing history list items already show winnerTicketKey, winnerTicketTitle, and summary — this decision preserves that data set and adds score/date

---

- **Decision**: Expand/collapse animation — use a smooth height transition for the detail section
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Smooth animation provides visual continuity and avoids layout jank
  2. Must be performant given the detail content includes charts, tables, and heatmaps
- **Reviewer Notes**: Implementation team should test with large comparison payloads to ensure smoothness

## User Scenarios & Testing

### User Story 1 — Browse Recent Comparisons (Priority: P1)

A project manager navigates to the comparisons hub to review recent comparison results. They see a vertical list of compact cards showing the winner, score, and date for each comparison, ordered newest first. They scroll down naturally through the single-page list without encountering double scroll bars or cramped layouts.

**Why this priority**: Core browsing experience — if users cannot scan comparisons easily, the entire hub fails its purpose.

**Independent Test**: Can be fully tested by loading the comparisons page with existing data and verifying the list renders as compact cards in reverse chronological order with a single scroll context.

**Acceptance Scenarios**:

1. **Given** a project with 15 saved comparisons, **When** the user navigates to the comparisons hub, **Then** the first 10 comparisons appear as compact cards in reverse chronological order showing winner ticket key, title, summary, score, and date.
2. **Given** the comparisons hub is loaded, **When** the user scrolls the page, **Then** only the browser's native page scroll is active — no nested scroll containers exist.
3. **Given** no saved comparisons exist, **When** the user navigates to the hub, **Then** an empty state message is displayed with guidance to launch a comparison.

---

### User Story 2 — Expand Comparison Detail Inline (Priority: P1)

A user clicks on a comparison card to see the full detail (hero card, participant grid, stat cards, unified metrics, decision points, compliance heatmap) expanded inline below the card. They click the same card again to collapse it, or click a different card to switch focus.

**Why this priority**: The inline expand is the primary interaction model replacing the cramped 2-column detail panel.

**Independent Test**: Can be tested by clicking a comparison card and verifying all sub-components render at full width below it, then clicking again to collapse.

**Acceptance Scenarios**:

1. **Given** the comparisons list is displayed, **When** the user clicks a comparison card, **Then** the full comparison detail expands inline below that card using all available page width.
2. **Given** a comparison is expanded, **When** the user clicks the same card, **Then** the detail section collapses.
3. **Given** comparison A is expanded, **When** the user clicks comparison B, **Then** comparison A collapses and comparison B expands.
4. **Given** a comparison is expanded, **When** the detail content renders, **Then** all six sub-components (HeroCard, ParticipantGrid, StatCards, UnifiedMetrics, DecisionPoints, ComplianceHeatmap) are displayed in their existing order.

---

### User Story 3 — Load More Comparisons (Priority: P2)

A user with many saved comparisons scrolls to the bottom of the initial list and clicks "Load More" to append older comparisons without losing their scroll position or the currently expanded detail.

**Why this priority**: Supports users with extensive comparison history, but most users only need the initial page of recent results.

**Independent Test**: Can be tested by loading a project with 25+ comparisons, clicking "Load More", and verifying older items append to the list without page replacement.

**Acceptance Scenarios**:

1. **Given** a project has more comparisons than the initial page size, **When** the initial list loads, **Then** a "Load More" button appears below the last card.
2. **Given** the "Load More" button is visible, **When** the user clicks it, **Then** the next batch of comparisons appends to the existing list and the button remains if more exist.
3. **Given** all comparisons have been loaded, **When** the user views the list, **Then** the "Load More" button is no longer displayed.
4. **Given** a comparison is currently expanded, **When** the user clicks "Load More", **Then** the expanded comparison remains open and the user's scroll position is preserved.

---

### User Story 4 — Deep Link to a Specific Comparison (Priority: P2)

A user receives a link containing a comparisonId query parameter. When they open it, the page loads and automatically expands the targeted comparison so they can see the detail without manual clicking.

**Why this priority**: Enables sharing and bookmarking specific comparisons; important for team collaboration but not the primary interaction flow.

**Independent Test**: Can be tested by navigating to the hub with ?comparisonId=X and verifying that comparison X is auto-expanded, scrolled into view, and visually highlighted.

**Acceptance Scenarios**:

1. **Given** a URL with `?comparisonId=42`, **When** the page loads, **Then** comparison 42 is automatically expanded with its detail visible.
2. **Given** a deep-linked comparison is not in the initial page of results, **When** the page loads, **Then** additional pages are fetched until the targeted comparison is found and expanded.
3. **Given** an invalid comparisonId in the URL, **When** the page loads, **Then** the list displays normally with no comparison expanded and no error shown to the user.

---

### User Story 5 — Launch New Comparison (Priority: P2)

A user clicks the "Compare VERIFY tickets" button in the page header to open the launch sheet, selects tickets, and launches a comparison. The pending launch indicator appears and, upon completion, the new comparison appears at the top of the list.

**Why this priority**: Launching comparisons is an existing flow that must remain accessible; the redesign must not break it.

**Independent Test**: Can be tested by clicking the launch button, selecting VERIFY tickets, launching, and verifying the result appears in the list.

**Acceptance Scenarios**:

1. **Given** the comparisons hub is displayed, **When** the user clicks "Compare VERIFY tickets", **Then** the launch sheet opens with available VERIFY-stage candidates.
2. **Given** a comparison is launched, **When** it completes, **Then** the new comparison appears at the top of the list and can be expanded inline.

### Edge Cases

- What happens when the user rapidly clicks multiple cards in succession? Only the last-clicked card should be expanded; intermediate states should not cause visual glitches.
- What happens when a comparison's detail data fails to load? The expanded area should display an error message within the card's detail section, not crash the entire list.
- What happens on a very narrow mobile screen? The compact cards and expanded detail should stack naturally using full viewport width without horizontal scrolling.
- What happens when "Load More" is clicked while a request is already in flight? The button should show a loading state and prevent duplicate requests.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display comparisons as a vertical list of compact cards in reverse chronological order (newest first).
- **FR-002**: Each compact card MUST show the winner ticket key, winner ticket title, summary snippet, comparison score, and creation date.
- **FR-003**: System MUST expand the full comparison detail inline below a card when the user clicks on it.
- **FR-004**: System MUST collapse the currently expanded detail when the user clicks the expanded card again.
- **FR-005**: System MUST collapse any previously expanded card when a different card is clicked (single-expand accordion behavior).
- **FR-006**: The expanded detail section MUST render all six existing sub-components in order: HeroCard, ParticipantGrid, StatCards, UnifiedMetrics, DecisionPoints, ComplianceHeatmap.
- **FR-007**: All existing sub-components MUST be reused without modification.
- **FR-008**: The expanded detail content MUST use the full available page width.
- **FR-009**: The page MUST have a single scroll context — no nested ScrollArea containers or fixed-height scroll panels.
- **FR-010**: System MUST display a "Load More" button below the list when additional comparisons exist beyond the currently loaded set.
- **FR-011**: Clicking "Load More" MUST append the next batch of comparisons to the existing list without replacing the current items.
- **FR-012**: The "Compare VERIFY tickets" launch button MUST remain accessible in the page header.
- **FR-013**: System MUST support deep linking via `?comparisonId=X` URL parameter, auto-expanding the targeted comparison on page load.
- **FR-014**: The layout MUST work naturally on mobile viewports without requiring special breakpoint handling.
- **FR-015**: A pending comparison launch indicator MUST remain visible while comparisons are being generated.

### Key Entities

- **Comparison (compact view)**: A summary representation showing winner ticket key, winner ticket title, summary snippet, overall score, and creation timestamp — used in the list cards.
- **Comparison (expanded view)**: The full comparison detail including hero card data, participant details, stat metrics, unified metrics, decision points, and compliance assessments — rendered inline when a card is expanded.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can browse and expand any comparison detail within 2 clicks from the hub page (one to navigate, one to expand).
- **SC-002**: The page contains exactly one scroll context at all times — no nested scrollable regions.
- **SC-003**: Users can load the full comparison history without page replacement by repeatedly clicking "Load More" — scroll position is preserved across loads.
- **SC-004**: Deep-linked comparisons via URL parameter are auto-expanded on page load within the initial rendering cycle.
- **SC-005**: All six detail sub-components render at full available width when expanded, providing more horizontal space than the previous 2-column detail panel.
- **SC-006**: Mobile users can access all hub functionality without horizontal scrolling on viewports 320px and wider.
- **SC-007**: Expanding and collapsing comparison details feels responsive with smooth visual transition.
