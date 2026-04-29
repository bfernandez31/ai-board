# Feature Specification: Health drawer — clickable scan history + visible issue counts

**Feature Branch**: `AIB-759-health-drawer-clickable`
**Created**: 2026-04-29
**Status**: Draft
**Input**: User description: "Health drawer: clickable scan history + visible issue counts (AIB-759). In every health module drawer (Compliance, Security, Tests, Spec Sync, Review Quality, etc.), make each Scan History row clickable so users can review the detailed report of any historic scan, colorize the issue count using the existing unified badge color system (low/med/high friction), and remove the cost ($) and token columns from each history row."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Provide an explicit "Latest" affordance to return to the most recent scan, in addition to allowing re-click on the latest history row.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3 — internal feature, neutral signals, ambiguity offered "either/or" in source)
- **Fallback Triggered?**: Yes — AUTO confidence below 0.5; chose the safer option (explicit, discoverable control) over relying on users to discover re-click behavior.
- **Trade-offs**:
  1. Slightly more UI surface in the history header, but improves discoverability and accessibility for keyboard/screen-reader users.
  2. No timeline impact; both options were already in scope.
- **Reviewer Notes**: Confirm that an always-visible "Latest" button (disabled when latest scan is already selected) is acceptable instead of a hidden affordance.

- **Decision**: When the user selects a historic scan, the report area (Issues / Recommendations / Fixes) replaces in place; the Score Trend chart remains pinned to the full period.
- **Policy Applied**: AUTO (matches explicit description)
- **Confidence**: High (0.9 — described directly in source)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users do not lose their reading position in the trend chart while exploring history.
  2. None significant.
- **Reviewer Notes**: None — direct restatement of source requirement.

- **Decision**: Reuse the existing unified badge color system (kind=`friction`, levels `low` / `med` / `high`) for the history-row issue count, without introducing a new palette or hardcoded colors.
- **Policy Applied**: AUTO (explicit in source)
- **Confidence**: High (0.9 — explicit constraint)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Visual consistency across the product; no design debt.
  2. None.
- **Reviewer Notes**: Verify thresholds: 0 → low, 1–2 → med, 3+ → high.

- **Decision**: Remove the cost ($) and token columns from each history row visually, but keep the underlying data persisted in the database for future use.
- **Policy Applied**: AUTO (explicit in source)
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Less visual clutter in history rows; users see only meaningful metrics.
  2. None — data is preserved, only the rendering is removed.
- **Reviewer Notes**: No schema changes required.

- **Decision**: When a selected historic scan has no associated detailed report (legacy or partial data), the report area shows a neutral empty state ("No detailed report available for this scan") rather than blanking out, and the latest scan remains accessible via the "Latest" control.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3 — source did not address this edge case)
- **Fallback Triggered?**: Yes — preferred a graceful, recoverable empty state over silent failure or auto-redirect.
- **Trade-offs**:
  1. Slightly more code for the empty state, but prevents broken UX on legacy rows.
  2. None.
- **Reviewer Notes**: Confirm whether legacy scans without detail records exist; if not, this is a defensive default.

- **Decision**: The selected scan resets to the most recent (latest) scan whenever the drawer is opened or the underlying ticket/module changes.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3 — not addressed in source)
- **Fallback Triggered?**: Yes — predictable default; users always start from the current state.
- **Trade-offs**:
  1. Selection state is not persisted across drawer reopens; minor convenience cost only.
  2. Avoids confusion where stale selection from a previous session would show outdated data.
- **Reviewer Notes**: If product wants stickiness later, it can be layered on without schema changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Inspect a historic scan report (Priority: P1)

A user opens the health drawer for any module (e.g., Compliance) and wants to compare the current report with a scan from a few days ago to understand whether a regression was introduced or resolved between two specific points in time.

**Why this priority**: This is the core capability the ticket exists for. Without it, users can only ever see the most recent report, which makes it impossible to investigate trends, regressions, or recoveries. Delivering only this story already provides an MVP that resolves the primary pain.

**Independent Test**: Open the health drawer for a project that has at least two historic scans. Click on a non-latest row in Scan History. Verify that the Issues / Recommendations / Fixes area updates to show that scan's report, that the row becomes visually selected, and that the Score Trend chart remains unchanged. Click "Latest" (or the most recent row) and verify the current scan's report returns.

**Acceptance Scenarios**:

1. **Given** the drawer is open with at least 2 historic scans, **When** the user clicks a non-latest history row, **Then** the report area replaces with that scan's detailed report and the row is visually marked as selected.
2. **Given** a historic scan is currently selected, **When** the user clicks "Latest" (or the most recent row), **Then** the report area returns to the most recent scan and the latest row becomes the selected one.
3. **Given** the drawer is reopened on the same ticket, **When** it renders, **Then** the most recent scan is selected by default.
4. **Given** the user switches between historic rows, **When** each is clicked, **Then** the Score Trend chart does not re-render or change its time range.

---

### User Story 2 — Spot regressions at a glance via colorized issue counts (Priority: P1)

A user scanning the history list wants to immediately see which scans had no issues, which had minor issues, and which had a problematic number of issues, without reading every number.

**Why this priority**: Color-coding is the primary signal that turns the history from a passive log into an at-a-glance health timeline. It is independent from clicking and delivers value on its own — even users who never drill into a scan benefit from the colored counts.

**Independent Test**: Display a history list containing scans with 0, 1, 2, and 3+ issues. Verify each row's issue-count badge uses the unified friction palette: green for 0, yellow for 1–2, red for 3+. Verify no hardcoded hex colors are introduced; the colors come from the existing `attribute` / `attribute-tc` badge variants with `kind="friction"`.

**Acceptance Scenarios**:

1. **Given** a scan with 0 issues, **When** the row renders, **Then** the issue count uses the friction `low` (green) variant.
2. **Given** a scan with 1 or 2 issues, **When** the row renders, **Then** the issue count uses the friction `med` (yellow) variant.
3. **Given** a scan with 3 or more issues, **When** the row renders, **Then** the issue count uses the friction `high` (red) variant.
4. **Given** the same drawer is opened on a different module (e.g., Security instead of Compliance), **When** rows render, **Then** colorization behaves identically.

---

### User Story 3 — Read a cleaner history row (Priority: P2)

A user looking at the Scan History wants to see only the metrics that are meaningful to them today: when the scan ran, what commit range it covered, how many issues it found, how long it took, and the resulting score.

**Why this priority**: The cost and token values currently displayed are always zero in production and add visual noise that distracts from real signals. Removing them is a smaller-impact polish step but reinforces stories 1 and 2 by giving the eye fewer things to skip past.

**Independent Test**: Open the health drawer and inspect any history row. Verify the cost ($) icon and value are no longer displayed and the token icon (lightning bolt) and value are no longer displayed. Verify that date, commit range, issue count, duration, and score remain visible. Verify the underlying data is still present in the database (no schema migration).

**Acceptance Scenarios**:

1. **Given** a history row is rendered, **When** the user inspects it, **Then** no `$` cost icon/value and no token-count icon/value appear.
2. **Given** the same scan record, **When** queried from the API/database, **Then** cost and token values are still present (only the rendering changed).

---

### User Story 4 — Use scan history with the keyboard (Priority: P2)

A keyboard or assistive-tech user wants to navigate the history list, select a row, and trigger the report swap without using a mouse.

**Why this priority**: Accessibility is non-negotiable per the constitution; clickable elements introduced by Story 1 must be reachable and operable via keyboard from day one.

**Independent Test**: With keyboard only, Tab through the drawer until the first history row receives focus. Verify a visible focus ring. Press Enter or Space to activate the row. Verify the report area updates and that focus is preserved sensibly. Verify focus order is logical (top to bottom of the list).

**Acceptance Scenarios**:

1. **Given** keyboard focus is on a history row, **When** the user presses Enter, **Then** the corresponding report is shown and the row becomes selected.
2. **Given** keyboard focus is on a history row, **When** the user presses Space, **Then** the corresponding report is shown and the row becomes selected.
3. **Given** the user Tabs through the drawer, **When** focus reaches a history row, **Then** a clearly visible focus indicator is rendered.
4. **Given** the "Latest" control is visible, **When** Tab order reaches it, **Then** it receives focus and Enter/Space activates the same return-to-latest behavior as clicking it.

---

### Edge Cases

- **Single scan in history**: When only one scan exists, that row is the latest; selecting it is the default state. The "Latest" control is either hidden or shown disabled.
- **Empty history**: When no scans have run yet, the history section shows its existing empty state; this feature introduces no regression there.
- **Selected historic scan has no detailed report data**: The report area shows a neutral empty state ("No detailed report available for this scan"), and the user can return to "Latest" without reload.
- **Long history list**: Selection styling and focus behavior remain correct when the list overflows and is scrolled.
- **Rapid clicks across rows**: Switching between rows quickly does not produce flicker, stale data, or out-of-order report renders. The most recently requested scan wins.
- **Drawer closed and reopened**: Selection resets to the latest scan; previous selection is not persisted.
- **Cross-module consistency**: All health modules (Compliance, Security, Tests, Spec Sync, Review Quality, and any future module sharing the drawer) inherit the same behavior and styling without per-module overrides.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render every Scan History row in the health drawer as an interactive element that responds to mouse click, keyboard Enter, and keyboard Space.
- **FR-002**: System MUST, on activation of a history row, replace the content of the detailed report area (Issues / Recommendations / Fixes) with the report associated with the selected scan, without a full page reload.
- **FR-003**: System MUST visually distinguish the currently selected history row from non-selected rows (selected state must be perceivable both with color and with a non-color indicator such as a border, weight change, or icon, to remain accessible).
- **FR-004**: System MUST default the selected scan to the most recent (latest) scan whenever the drawer is opened or the active ticket/module changes.
- **FR-005**: System MUST provide a clearly labeled "Latest" affordance that, when activated, returns the selection and the report area to the most recent scan. The affordance is disabled (or visually inactive) when the latest scan is already selected.
- **FR-006**: System MUST keep the Score Trend chart unchanged across selection changes — it always reflects the full period regardless of which historic scan is selected.
- **FR-007**: System MUST colorize the issue-count indicator on each history row using the existing unified badge color system: `low` (green) when issue count is 0, `med` (yellow) when issue count is 1 or 2, `high` (red) when issue count is 3 or more.
- **FR-008**: System MUST NOT introduce new color tokens, palettes, or hardcoded hex/rgb values to support the colorization. Colors MUST come from the existing `attribute` / `attribute-tc` badge variants with `kind="friction"`.
- **FR-009**: System MUST NOT render the cost ($) icon/value or the token-count icon/value on any history row in the drawer.
- **FR-010**: System MUST preserve the underlying cost and token data in the database. No schema change, no data deletion.
- **FR-011**: System MUST keep the rendering of the currently displayed (non-history) detailed report unchanged in terms of issue-count appearance — the colorization rule applies only to the history list, not to the active report header.
- **FR-012**: System MUST apply the entire feature behavior (clickability, selection, colorization, removed columns, keyboard support) identically across all health modules that use the shared drawer (Compliance, Security, Tests, Spec Sync, Review Quality, and any other module integrated with this drawer).
- **FR-013**: System MUST provide a visible keyboard focus indicator on each history row and on the "Latest" affordance, and MUST ensure the tab order through the drawer is logical and unbroken.
- **FR-014**: System MUST handle the case where a selected historic scan has no associated detailed report by showing a neutral empty state in the report area rather than a broken or blank panel.
- **FR-015**: System MUST ensure that rapid switching between history rows always settles on the most recently requested scan (no stale-render race conditions).

### Key Entities *(include if feature involves data)*

- **Health Scan**: A single execution of a health module (Compliance, Security, Tests, Spec Sync, Review Quality, etc.) for a given ticket or project. Key attributes used by this feature: timestamp, commit range, issue count, duration, resulting score, and a reference to its detailed report.
- **Health Scan Detailed Report**: The Issues, Recommendations, and Fixes payload associated with a scan. Already persisted; this feature only changes how it is selected and displayed.
- **Issue-count Friction Level**: Derived attribute computed from the scan's issue count using the bands 0 / 1–2 / 3+. Drives the badge variant chosen for that row.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From an open health drawer, a user can view the detailed report of any historic scan in fewer than 2 clicks (1 click on the row).
- **SC-002**: From an open health drawer with a historic scan selected, a user can return to the latest scan in 1 click (the "Latest" affordance) or 1 keyboard activation.
- **SC-003**: 100% of history rows that contain an issue count display a color matching the defined thresholds (0 → low/green, 1–2 → med/yellow, 3+ → high/red).
- **SC-004**: 0 hardcoded hex or rgb color values are introduced by this feature; all colors come from existing unified badge tokens.
- **SC-005**: 0 history rows in the drawer display the cost ($) or token-count metric after this change ships.
- **SC-006**: 100% of supported health modules (Compliance, Security, Tests, Spec Sync, Review Quality, and any others sharing the drawer) exhibit identical clickability, selection, colorization, and column-removal behavior.
- **SC-007**: All interactive elements introduced (history rows, "Latest" affordance) are reachable and activatable using only the keyboard, with a visible focus indicator on each.
- **SC-008**: Switching between any two scans in the history updates the displayed report in under 500 ms under normal conditions, so the interaction feels immediate to users.
- **SC-009**: When a selected historic scan has no detailed report, users see a clear empty-state message and can recover (return to "Latest") without reloading the page or closing the drawer.
