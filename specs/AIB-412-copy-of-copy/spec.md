# Feature Specification: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Feature Branch**: `AIB-412-copy-of-copy`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "Health Scan Metrics - Trend Lines, Sparklines and History Enrichment"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Trend Endpoint Default Scan Limit

- **Decision**: The trend endpoint returns the last 20 completed scans per module by default. This provides enough data points for meaningful sparklines and area charts while keeping the payload manageable.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1) — feature is a neutral UI enhancement with no sensitive/compliance or speed signals
- **Fallback Triggered?**: Yes — AUTO confidence < 0.5, promoted to CONSERVATIVE
- **Trade-offs**:
  1. 20 scans provides good chart resolution without excessive data transfer
  2. Could be adjusted later if users need longer history views
- **Reviewer Notes**: Validate that 20 data points is sufficient for meaningful trend visualization. Consider whether the endpoint should accept an optional limit parameter for flexibility.

### Decision 2: Sparkline Visual Style

- **Decision**: Sparklines use a minimal line chart (~40px height) with no axes, labels, or grid — matching the description's specification. The line color follows the module's score color coding (green for excellent, yellow for fair, red for poor) based on the most recent score.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Color-coded sparklines provide at-a-glance health indication beyond just trend direction
  2. Monochrome sparklines would be simpler but less informative
- **Reviewer Notes**: Verify that score-based coloring on sparklines is visually clear and meets WCAG AA contrast requirements against card backgrounds.

### Decision 3: Cost and Token Display Formatting

- **Decision**: Cost values display as USD with 2 decimal places (e.g., "$0.42"). Token counts display as abbreviated numbers (e.g., "12.5k" for 12,500). Duration displays as human-readable time (e.g., "2.3s", "1m 15s"). When a value is null/unavailable, the icon is hidden rather than showing "N/A".
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Hiding null values keeps the UI clean but users may wonder why some scans show fewer icons
  2. Showing "N/A" would be more explicit but adds visual noise
- **Reviewer Notes**: Confirm that hiding null metric icons (rather than showing placeholders) is the preferred UX for scans that predate telemetry collection.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Enriched Scan History Metrics (Priority: P1)

A project owner opens the scan history drawer for a module and sees each completed scan with its score badge alongside compact metric icons for issues found, cost, tokens consumed, and execution duration. Hovering over any icon reveals a tooltip explaining what the metric represents.

**Why this priority**: This is the core data enrichment that makes operational telemetry visible to users. Without it, scan cost and performance data remain hidden despite being collected.

**Independent Test**: Can be fully tested by opening any module's scan history drawer after completing scans and verifying all four metric icons appear with correct values and tooltips.

**Acceptance Scenarios**:

1. **Given** a module with completed scans that have telemetry data, **When** the user opens the scan history drawer, **Then** each scan line shows a score badge plus up to 4 metric icons (issues, cost, tokens, duration) with correct values
2. **Given** a scan line with a metric icon displayed, **When** the user hovers over the icon, **Then** a tooltip appears explaining what the metric represents (e.g., "Cost in USD", "Tokens consumed", "Execution time", "Issues found")
3. **Given** a completed scan where some telemetry fields are null, **When** the history drawer renders, **Then** only icons with available data are shown — no empty or "N/A" icons appear
4. **Given** a scan history line, **When** comparing the old and new display, **Then** the previous "X issues" text format has been replaced by the icon + number format

---

### User Story 2 - View Score Trend Sparklines on Module Cards (Priority: P2)

A project owner views the health dashboard and sees a mini sparkline on each active module card showing how the module's score has trended across recent scans. This gives an at-a-glance trend indicator without needing to open a drawer.

**Why this priority**: Sparklines on module cards provide immediate trend visibility on the main dashboard — a high-value visual that reduces the need for drill-down interactions.

**Independent Test**: Can be fully tested by running 3+ scans for a module and verifying a sparkline appears on its card on the dashboard.

**Acceptance Scenarios**:

1. **Given** an active module with 3 or more completed scans, **When** the health dashboard loads, **Then** a mini sparkline (~40px height, no axes) appears on the module card showing the score trend
2. **Given** an active module with fewer than 3 completed scans, **When** the health dashboard loads, **Then** no sparkline is shown on the module card
3. **Given** a module that transitions from 2 to 3 completed scans, **When** the dashboard data refreshes, **Then** the sparkline appears on the card without requiring a page reload
4. **Given** the sparkline is displayed, **When** inspecting the visual, **Then** it has no axes, labels, or grid — only the trend line

---

### User Story 3 - View Score Trend Area Chart in Module Drawers (Priority: P2)

A project owner opens an active module's drawer and sees a full area chart showing the module's score evolution over time, with date axes, score values, and hover details — matching the pattern already used in the Quality Gate drawer.

**Why this priority**: The area chart provides the detailed trend view that complements the sparkline's at-a-glance summary. It reuses an established pattern (Quality Gate chart) for consistency.

**Independent Test**: Can be fully tested by opening any active module's drawer and verifying the area chart renders with correct historical scores and interactive hover details.

**Acceptance Scenarios**:

1. **Given** an active module with completed scans, **When** the user opens the module drawer, **Then** an area chart displays showing score over time with date axis, score axis (0-100), and data points for each completed scan
2. **Given** the area chart is displayed, **When** the user hovers over a data point, **Then** a tooltip shows the scan date and score value
3. **Given** a module with only 1 completed scan, **When** the drawer opens, **Then** the area chart shows a single data point (or is hidden if the chart requires minimum data)

---

### User Story 4 - Trend Data Fetched Efficiently (Priority: P3)

When the health dashboard mounts, trend data for all active modules is fetched in a single request. This data feeds both the sparklines on module cards and the area charts in drawers. The trend data is not included in the main health polling cycle that runs every 2 seconds during active scans.

**Why this priority**: Performance and efficiency matter but this is an infrastructure concern that supports the visual features above. The separation prevents trend data from bloating the high-frequency polling response.

**Independent Test**: Can be tested by monitoring network requests on dashboard load and verifying a single trend request is made, and that subsequent polling requests do not include trend data.

**Acceptance Scenarios**:

1. **Given** the health dashboard mounts, **When** initial data loading occurs, **Then** a single request fetches trend data for all active modules
2. **Given** scans are actively running, **When** the 2-second health polling fires, **Then** the polling response does not include trend data
3. **Given** trend data has been fetched on mount, **When** the user opens a module drawer, **Then** the area chart renders from the already-fetched data without an additional request

---

### User Story 5 - Scan History API Exposes Telemetry Fields (Priority: P1)

The existing scan history endpoint returns `tokensUsed` and `costUsd` fields for each scan record, enabling the enriched history display.

**Why this priority**: This is a prerequisite for User Story 1 — without the API returning these fields, the UI cannot display them.

**Independent Test**: Can be tested by calling the scan history API and verifying `tokensUsed` and `costUsd` fields are present in the response.

**Acceptance Scenarios**:

1. **Given** a completed scan with telemetry data, **When** the scan history API is called, **Then** the response includes `tokensUsed` (integer or null) and `costUsd` (number or null) for each scan
2. **Given** a completed scan without telemetry data (older scan), **When** the scan history API is called, **Then** `tokensUsed` and `costUsd` are returned as null

---

### Edge Cases

- What happens when a module has exactly 3 completed scans? The sparkline renders with the minimum viable data (3 points).
- How does the sparkline handle a score sequence with extreme jumps (e.g., 95 to 10 to 90)? The sparkline faithfully represents the data without smoothing.
- What happens when all telemetry fields (cost, tokens, duration) are null for a scan? Only the issues icon (derived from issuesFound) appears if non-null; otherwise no metric icons are shown.
- What if a scan is in FAILED status? Failed scans without a score do not contribute data points to sparklines or area charts.
- What happens when the trend endpoint is slow to load? Sparklines and area charts gracefully appear once data arrives without blocking the rest of the dashboard.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scan history display MUST show each completed scan with a score badge and up to four compact metric icons: issues (AlertTriangle), cost (Coins), tokens (Zap), and duration (Clock)
- **FR-002**: Each metric icon MUST display a tooltip on hover explaining what the metric represents
- **FR-003**: Metric icons MUST only appear when the corresponding data value is non-null; null metrics are hidden
- **FR-004**: The scan history API MUST return `tokensUsed` and `costUsd` fields for each scan record
- **FR-005**: Each active module card MUST display a mini sparkline showing score trend when 3 or more completed scans exist for that module
- **FR-006**: Module cards MUST NOT display a sparkline when fewer than 3 completed scans exist
- **FR-007**: Each active module drawer MUST include an area chart showing score evolution over time, following the same visual pattern as the existing Quality Gate drawer chart
- **FR-008**: A dedicated trend endpoint MUST return the last N scores per active module in a single response
- **FR-009**: Trend data MUST be fetched once on dashboard mount and NOT be included in the health polling cycle
- **FR-010**: Only scans with COMPLETED status and a non-null score MUST contribute to sparkline and area chart data
- **FR-011**: All text and visual elements MUST meet WCAG AA contrast requirements (4.5:1 minimum)
- **FR-012**: The previous "X issues" text format in scan history lines MUST be replaced by the icon + number format

### Key Entities *(include if feature involves data)*

- **HealthScan**: Existing entity storing scan results including operational telemetry (`tokensUsed`, `costUsd`, `durationMs`). The `tokensUsed` and `costUsd` fields exist in the database but are not currently returned by the scan history API.
- **Trend Data Point**: A lightweight projection of a HealthScan containing the scan date and score, grouped by module type. Used to render sparklines and area charts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view scan cost, token usage, and duration for any completed scan within the history drawer without navigating away from the health dashboard
- **SC-002**: Users can identify score trends at a glance from module cards without opening any drawer, for modules with 3+ completed scans
- **SC-003**: Users can view detailed score evolution over time in module drawers with interactive hover details
- **SC-004**: Trend data loading does not increase the payload or frequency of the health polling cycle that runs during active scans
- **SC-005**: All scan history metric icons display correct tooltips on hover, enabling users unfamiliar with the icons to understand their meaning
- **SC-006**: All new visual elements meet WCAG AA contrast standards (4.5:1 ratio for normal text)
