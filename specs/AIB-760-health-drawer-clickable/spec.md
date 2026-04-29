# Feature Specification: Health Drawer — Clickable Scan History + Visible Issue Counts

**Feature Branch**: `AIB-760-health-drawer-clickable`
**Created**: 2026-04-29
**Status**: Draft
**Ticket**: AIB-760

## Auto-Resolved Decisions

- **Decision**: When a non-latest scan row is selected, display a "Back to latest" affordance; hide it when the latest scan is already displayed.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Low (net score +1, absScore 1 < 3 threshold)
- **Fallback Triggered?**: Yes — LOW confidence triggered CONSERVATIVE fallback
- **Trade-offs**:
  1. Showing the button only when needed reduces visual clutter without sacrificing discoverability.
  2. Always-visible button alternative was rejected as it adds noise for the common case (user viewing latest scan).
- **Reviewer Notes**: Confirm UX preference — "Back to latest" button vs. inline "Latest" badge on the most recent row are both valid alternatives.

---

- **Decision**: If a historical scan has no persisted report (null/missing), show an inline message "Report not available for this scan" in the issues panel.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Low (no explicit guidance in ticket)
- **Fallback Triggered?**: Yes — CONSERVATIVE chosen to avoid silent failures
- **Trade-offs**:
  1. Explicit message prevents user confusion about empty states; marginal implementation cost.
  2. No retry mechanism needed — historical data is either persisted or not.
- **Reviewer Notes**: Verify whether null reports can realistically exist for COMPLETED scans in production data.

---

- **Decision**: Keyboard navigation: each row is focusable via Tab; Enter and Space activate it. Arrow-key navigation within the list is not required for this ticket.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Low — ticket specifies Enter/Space but not full arrow-key nav
- **Fallback Triggered?**: Yes — minimal but complete keyboard support, avoiding over-engineering
- **Trade-offs**:
  1. Tab + Enter/Space satisfies WCAG 2.1 SC 2.1.1 without complex listbox role implementation.
  2. Arrow-key navigation (full listbox pattern) can be added as a future enhancement.
- **Reviewer Notes**: If the list grows long, arrow-key navigation would improve UX. Consider as follow-up.

---

- **Decision**: Issue count thresholds (0=green, 1–2=yellow, 3+=red) apply uniformly to ALL health module types.
- **Policy Applied**: PRAGMATIC (explicitly stated in ticket)
- **Confidence**: High — ticket explicitly states this
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Single threshold definition is easy to maintain and consistent across all modules.
  2. Different module types may have different severity contexts, but the ticket explicitly mandates a universal threshold.
- **Reviewer Notes**: If future modules need module-specific thresholds, the helper function should accept an optional threshold config parameter.

## User Scenarios & Testing

### User Story 1 — View a Historical Scan's Report (Priority: P1)

A developer notices a compliance score regression from last week. They open the Compliance health drawer, click on the scan row from that date in the history list, and the issues panel immediately updates to show that historical scan's report without reloading the page. They can return to the latest scan by clicking "Back to latest."

**Why this priority**: Core feature value — without this, users cannot investigate regressions by reviewing historical reports.

**Independent Test**: Open any health drawer with ≥2 completed scans, click a non-latest row, verify the issues panel updates to that historical scan's report.

**Acceptance Scenarios**:

1. **Given** the health drawer is open showing the latest scan's report, **When** the user clicks on a previous scan row, **Then** the issues/recommendations panel updates to display that historical scan's report without a page reload.
2. **Given** a historical scan row is selected, **When** the user clicks "Back to latest", **Then** the panel reverts to the latest scan's report and the historical row is deselected.
3. **Given** a historical scan is selected, **When** the user looks at the score trend chart, **Then** the chart remains unchanged (still shows the full timeline for all scans).
4. **Given** a historical scan has no persisted report, **When** the user selects it, **Then** the issues panel shows "Report not available for this scan" instead of an empty or broken state.

---

### User Story 2 — Visually Identify Issue Count Severity at a Glance (Priority: P2)

A team lead scans the history list and immediately spots a red issue count on a scan from last Tuesday — 4 issues. The color makes the regression immediately visible without clicking into each row.

**Why this priority**: Improves scannability of the history list; regressions become visible at a glance.

**Independent Test**: Open any health drawer; verify issue count badge color is green for 0, yellow for 1–2, red for 3+ across all module types.

**Acceptance Scenarios**:

1. **Given** a scan row with `issuesFound = 0`, **When** the user views the history list, **Then** the issue count is displayed in the "low" (green) color from the unified badge system.
2. **Given** a scan row with `issuesFound = 1` or `2`, **When** the user views the history list, **Then** the issue count is displayed in the "med" (yellow/warning) color from the unified badge system.
3. **Given** a scan row with `issuesFound = 3` or more, **When** the user views the history list, **Then** the issue count is displayed in the "high" (red) color from the unified badge system.
4. **Given** any health module type (Compliance, Security, Tests, Spec Sync, Review Quality), **When** the scan history is rendered, **Then** the same color thresholds apply uniformly.

---

### User Story 3 — Clean Scan History Without Cost/Token Noise (Priority: P3)

A developer opens the security health drawer. The scan history rows no longer show "$0.00" cost and "0 tokens" columns. Visible columns are: date, commit range, issue count (colored), duration, and score.

**Why this priority**: Pure UI cleanup — removes misleading zero-value telemetry that adds noise without value.

**Independent Test**: Open any health drawer; confirm no cost or token values appear in scan history rows.

**Acceptance Scenarios**:

1. **Given** any health drawer is open, **When** the user views the scan history list, **Then** no cost (coin icon + "$X.XX") or token (zap icon + count) values are displayed on any row.
2. **Given** the removal of cost/token display, **When** the user inspects the remaining row layout, **Then** date, commit range, issue count (colored), duration, and score are all still present and clearly readable.

---

### User Story 4 — Keyboard-Accessible Scan History Navigation (Priority: P2)

A keyboard-only user tabs through the scan history list, sees a clear focus indicator on each row, and presses Enter to load a historical report.

**Why this priority**: Accessibility requirement explicitly listed in ticket acceptance criteria.

**Independent Test**: Using keyboard only, Tab to a scan history row, press Enter, verify the issues panel updates to that scan's report with a visible focus ring on the active row.

**Acceptance Scenarios**:

1. **Given** the scan history list is rendered, **When** the user presses Tab, **Then** focus moves to each scan row in sequence with a clearly visible focus ring.
2. **Given** a scan history row is focused, **When** the user presses Enter or Space, **Then** the issues panel updates to show that scan's report (same behavior as mouse click).
3. **Given** a row is activated via keyboard, **When** the user visually inspects it, **Then** the row shows the same selected-state visual indicator as a mouse-clicked row.

---

### Edge Cases

- What happens when the scan history list has only one scan (the latest)? The row should still be clickable/focusable; "Back to latest" should not appear since there is no other scan to return from.
- What if the user clicks a row while a previous report is still loading? The new request replaces the in-flight one; the issues panel shows the newly requested scan's report.
- What if `issuesFound` is null or undefined on a scan row? Treat as 0 and display in green.
- What if the drawer is closed and reopened? The selected scan resets to the latest scan (default state).

## Requirements

### Functional Requirements

- **FR-001**: Each scan history row MUST be interactive — users MUST be able to activate it by clicking with a pointer cursor, or by pressing Enter/Space when the row is focused.
- **FR-002**: Activating a scan history row MUST replace the issues/recommendations/fixes panel content with that scan's persisted report, without a full page reload.
- **FR-003**: The currently selected scan history row MUST be visually distinguished from unselected rows (distinct background or border treatment) and from the hover state.
- **FR-004**: When viewing a historical (non-latest) scan's report, a "Back to latest" control MUST be present and keyboard-accessible; activating it MUST restore the latest scan's report and clear the historical selection.
- **FR-005**: When the latest scan is active (default state), the "Back to latest" control MUST NOT be displayed.
- **FR-006**: The score trend chart MUST remain unchanged regardless of which scan row is selected — it always displays the full timeline.
- **FR-007**: The issue count on each scan history row MUST be rendered using "low" (green) color token when `issuesFound` is 0, "med" (yellow) when `issuesFound` is 1 or 2, and "high" (red) when `issuesFound` is 3 or more.
- **FR-008**: The color tokens MUST be sourced exclusively from the existing unified badge system (`kind="friction"`, levels `low`/`med`/`high`) — no hardcoded hex values or new color definitions are permitted.
- **FR-009**: Cost (coin icon + "$X.XX") and token usage (zap icon + count) display MUST be removed from every scan history row. The underlying data MUST remain persisted in the database.
- **FR-010**: All interactive scan history rows MUST have a visible focus indicator meeting WCAG 2.1 SC 2.4.7 (Focus Visible).
- **FR-011**: All behaviors (FR-001 through FR-010) MUST be consistent across all health module types: Compliance, Security, Tests, Spec Sync, Review Quality, and any future module using the shared drawer component.
- **FR-012**: If report data for a selected historical scan is unavailable, the issues panel MUST display "Report not available for this scan" rather than an empty or error state.

### Key Entities

- **ScanHistoryItem**: A past health scan record. Key display attributes: id, scanType, status, score, issuesFound (integer ≥ 0), baseCommit, headCommit, durationMs, startedAt/completedAt. Fields `costUsd` and `tokensUsed` remain in the data model but are removed from the UI display.
- **ScanReport**: The detailed report for a completed scan — includes issues, recommendations, and fixes categorized by module type. Already persisted; this feature exposes historical reports in the issues panel by scan id.
- **SelectedScanState**: Client-side UI state tracking which scan row is currently active (null = latest). Resets when the drawer is closed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view any historical scan's full report within a single interaction (click or keyboard activation) from the history list, with no page reload.
- **SC-002**: Issue count colors display correctly (green/yellow/red) on 100% of scan history rows based on the defined thresholds, across all health module types.
- **SC-003**: Zero cost or token usage values are visible in the scan history list for all health module drawers.
- **SC-004**: All scan history rows are reachable and activatable via keyboard-only navigation, with visible focus indicators at all times.
- **SC-005**: The feature is implemented in the shared history component, covering all current and future health module types with no per-module special cases.
- **SC-006**: The selected scan row is visually distinguishable from unselected rows without relying solely on color (meets WCAG 2.1 SC 1.4.1 — Use of Color).

## Assumptions

- Historical scan reports are fully persisted in the database and retrievable by scan ID via the existing health scan API endpoint using `includeReport=true`.
- The existing API endpoint supports fetching the report for any specific scan by ID without requiring new backend routes.
- The unified badge system's color tokens for `kind="friction"` levels (`low`, `med`, `high`) are already defined and accessible as CSS utility classes.
- The `drawer/drawer-history.tsx` component is the single entry point for scan history rendering across all module types, so changes there apply universally.
- "Back to latest" is a client-side state reset; no additional API call is needed if the latest scan data is already loaded in the component.
