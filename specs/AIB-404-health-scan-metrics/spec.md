# Feature Specification: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Feature Branch**: `AIB-404-health-scan-metrics`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "Health Scan Metrics - Trend Lines, Sparklines and History Enrichment"

## Auto-Resolved Decisions

- **Decision**: Number of historical data points returned by the trend endpoint set to 20
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 7) — WCAG compliance keyword present, no conflicting signals
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Returning 20 data points balances useful trend visibility with response size
  2. Fewer points would reduce data transfer but may produce misleading sparklines
- **Reviewer Notes**: 20 is a reasonable default; adjust if scan frequency varies significantly across projects

---

- **Decision**: Sparkline minimum data threshold set to 3 completed scans (as stated in ticket)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — explicitly stated in acceptance criteria
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 3 points is the minimum for a meaningful visual trend
  2. Could require 2 points for faster visibility, but trend direction would be ambiguous
- **Reviewer Notes**: Threshold matches acceptance criteria; no change needed

---

- **Decision**: Area chart in module drawers follows the existing Quality Gate drawer chart pattern
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — explicit requirement in ticket to follow existing pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistency with existing UI reduces learning curve
  2. Module-specific charts may benefit from different visualizations in the future
- **Reviewer Notes**: Reusing the chart pattern ensures visual consistency across all drawers

---

- **Decision**: Trend endpoint is fetched once on mount, not polled
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — explicitly stated in ticket requirements
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reduces server load by avoiding repeated trend queries during active scans
  2. Trend data may become stale if user leaves dashboard open for extended periods; acceptable since trends change slowly
- **Reviewer Notes**: If real-time trend updates are desired later, polling can be added at a longer interval (e.g., 60s)

---

- **Decision**: Null telemetry values display as dash "—" in scan history metrics
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — industry-standard pattern for missing numeric data
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dash is universally understood as "no data available"
  2. Alternative: hide the metric entirely, but this would cause inconsistent row layouts
- **Reviewer Notes**: Consistent with common dashboard conventions

## User Scenarios & Testing

### User Story 1 - Dedicated Trend Data Service (Priority: P1)

The system provides a single endpoint that returns the last N scores per active module, fetched once on dashboard mount. This keeps trend data separate from the main health polling response that runs every 2 seconds during active scans.

**Why this priority**: This is the data backbone powering both sparklines and area charts — must be in place before any visualization work.

**Independent Test**: Can be tested by calling the trend endpoint and verifying it returns score arrays for all active modules in a single response.

**Acceptance Scenarios**:

1. **Given** a project has completed scans, **When** the trend endpoint is called, **Then** it returns the last 20 scores per active module (Security, Compliance, Tests, Spec Sync) with timestamps
2. **Given** the dashboard mounts, **When** trend data is fetched, **Then** it is fetched exactly once and not refetched on the 2-second polling interval
3. **Given** a module has no completed scans, **When** the trend endpoint returns, **Then** that module's array is empty

---

### User Story 2 - Viewing Enriched Scan History (Priority: P1)

A project manager opens the scan detail drawer and sees each historical scan line enriched with compact metric icons showing issues found, cost, tokens consumed, and execution time alongside the existing score badge. Hovering over any icon reveals a tooltip explaining the metric.

**Why this priority**: This is the most visible enhancement — it surfaces telemetry data already stored in the database, providing immediate value with every drawer open.

**Independent Test**: Can be fully tested by opening any module's scan history drawer and verifying all 4 metric icons appear with correct values and tooltips.

**Acceptance Scenarios**:

1. **Given** a module has completed scans with telemetry data, **When** the user opens the scan detail drawer, **Then** each history line displays 4 metric icons (issues, cost, tokens, duration) with correct values from the database
2. **Given** a scan history line is displayed, **When** the user hovers over any metric icon, **Then** a tooltip appears explaining the metric (e.g., "Cost in USD", "Tokens consumed", "Execution time", "Issues found")
3. **Given** a scan has no telemetry data for a metric (null value), **When** the history line renders, **Then** the metric icon displays a dash "—" instead of a number
4. **Given** the scan history API is called, **When** the response is returned, **Then** it includes `tokensUsed` and `costUsd` fields for each scan record

---

### User Story 3 - Sparkline Score Trends on Module Cards (Priority: P2)

A team lead glances at the health dashboard and sees a small sparkline on each active module card showing the score trend across recent scans. This provides at-a-glance trend awareness without opening any drawer.

**Why this priority**: Sparklines on the main dashboard give the highest information density improvement — users see trends without any clicks.

**Independent Test**: Can be tested by verifying sparklines appear on module cards when 3+ completed scans exist and are absent when fewer scans are available.

**Acceptance Scenarios**:

1. **Given** an active module (Security, Compliance, Tests, or Spec Sync) has 3 or more completed scans, **When** the dashboard loads, **Then** a mini sparkline (~40px height, no axes) appears on the module card showing the score trend
2. **Given** an active module has fewer than 3 completed scans, **When** the dashboard loads, **Then** no sparkline is displayed on that module card
3. **Given** sparklines are displayed, **When** the user views the dashboard, **Then** all sparkline visual elements meet WCAG AA contrast requirements
4. **Given** trend data is available, **When** the dashboard mounts, **Then** trend data is fetched once and not included in the 2-second polling cycle

---

### User Story 4 - Area Chart in Module Drawers (Priority: P3)

A developer opens a module's detail drawer and sees a full area chart showing score evolution over time, with date axis, score axis, and hover details — matching the pattern already established in the Quality Gate drawer.

**Why this priority**: Complements the sparklines with detailed drill-down; lower priority because the Quality Gate drawer already demonstrates this pattern and the sparklines provide the primary trend visibility.

**Independent Test**: Can be tested by opening each active module's drawer and verifying the area chart renders with correct data, axes, and hover behavior.

**Acceptance Scenarios**:

1. **Given** an active module has completed scans with scores, **When** the user opens the module drawer, **Then** an area chart displays showing score evolution over time with date axis, score axis (0-100 range), and hover details
2. **Given** the area chart is displayed, **When** the user hovers over a data point, **Then** a tooltip shows the date and score for that point
3. **Given** a module has fewer than 2 completed scans, **When** the drawer opens, **Then** the area chart section is hidden or shows a "Not enough data" message

### Edge Cases

- What happens when a scan has null telemetry values (tokensUsed, costUsd, durationMs)? Display a dash "—" for missing values.
- What happens when cost is extremely small (e.g., $0.001)? Display formatted to appropriate precision (e.g., "$0.00" for sub-cent values).
- What happens when a module has exactly 3 scans? The sparkline renders with 3 data points — the minimum for a visual trend.
- What happens when all scans for a module are failed (no scores)? Only completed scans with scores feed the trend; if none qualify, treat as insufficient data (no sparkline, no chart).
- What happens when the trend endpoint is called for a project with no scans at all? Return empty arrays for all modules.
- What happens when tokens or duration values are very large? Format with appropriate units (e.g., "12.3k" tokens, "2m 15s" duration).

## Requirements

### Functional Requirements

- **FR-001**: System MUST expose `tokensUsed` and `costUsd` fields in the scan history API response for each scan record
- **FR-002**: System MUST display 4 compact metric icons (issues, cost, tokens, duration) on each scan history line in the drawer, replacing the existing "X issues" text format
- **FR-003**: Each metric icon MUST display a tooltip on hover explaining what the metric represents
- **FR-004**: System MUST provide a trend endpoint returning the last 20 scores per active module (Security, Compliance, Tests, Spec Sync) with timestamps in a single response
- **FR-005**: Trend data MUST be fetched once on dashboard mount, not included in the periodic polling cycle
- **FR-006**: Active module cards MUST display a mini sparkline (~40px height, no axes) showing score trend when 3 or more completed scans exist
- **FR-007**: Active module cards MUST NOT display a sparkline when fewer than 3 completed scans are available
- **FR-008**: Each active module drawer MUST include an area chart showing score evolution over time, following the same visual pattern as the existing Quality Gate drawer chart
- **FR-009**: Area charts MUST include date axis, score axis (0-100 range), and hover details showing date and score
- **FR-010**: All text and visual elements MUST meet WCAG AA contrast requirements (4.5:1 ratio)
- **FR-011**: Null telemetry values MUST display as a dash "—" in scan history metrics
- **FR-012**: Cost values MUST be formatted as USD currency with appropriate precision

### Key Entities

- **Scan History Record**: Extended to expose telemetry fields (tokensUsed, costUsd) alongside existing fields (score, issuesFound, durationMs, commit range)
- **Trend Data Point**: A score value with timestamp, grouped by module type; represents one completed scan's score contribution to the trend line
- **Module Trend**: Collection of trend data points for a single active module (Security, Compliance, Tests, Spec Sync), ordered chronologically

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can see scan cost, token usage, and duration for every historical scan without leaving the drawer
- **SC-002**: Users can identify score trends across all active modules from the dashboard in under 3 seconds (sparkline glance)
- **SC-003**: Dashboard page load adds no more than one additional network request for trend data (single endpoint, single fetch)
- **SC-004**: All scan history metrics are visible and readable on screens 375px wide and above
- **SC-005**: Module drawers provide detailed score history charts consistent with the existing Quality Gate chart experience
- **SC-006**: 100% of displayed text meets WCAG AA contrast ratio of 4.5:1
