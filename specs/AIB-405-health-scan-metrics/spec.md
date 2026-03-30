# Feature Specification: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Feature Branch**: `AIB-405-health-scan-metrics`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "Health dashboard enhancements for scan cost, token consumption, execution time visibility and score trends over time"

## Auto-Resolved Decisions

- **Decision**: Number of trend data points returned by the new trend endpoint
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score 5 — WCAG compliance keyword, neutral feature context)
- **Fallback Triggered?**: No — AUTO recommended CONSERVATIVE with high confidence
- **Trade-offs**:
  1. 20 data points provides enough history for meaningful sparklines and area charts without over-fetching
  2. A smaller number would reduce payload size but limit chart usefulness; a larger number adds marginal value
- **Reviewer Notes**: If projects run scans infrequently, 20 points may span a very long time range. Consider whether a time-based window (e.g., 90 days) would be more appropriate for some use cases.

---

- **Decision**: Tooltip text content for scan history metric icons
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score 5)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Descriptive tooltips ("Issues found during scan") are clearer than terse labels ("Issues") for first-time users
  2. Slightly more text to maintain but improves accessibility
- **Reviewer Notes**: Verify tooltip wording meets any existing UX copy guidelines.

---

- **Decision**: Area chart styling in module drawers follows existing Quality Gate drawer pattern
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score 5)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Visual consistency across all drawers improves learnability
  2. No additional design work needed; reuses proven chart configuration
- **Reviewer Notes**: The Quality Gate chart uses a 192px height, monotone interpolation, blue primary fill. Confirm this is appropriate for module-specific score charts as well.

---

- **Decision**: Cost display format in scan history
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score 5)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Displaying cost as "$X.XX" (2 decimal places) is standard for USD and sufficient precision for scan costs
  2. Very small costs (< $0.01) will display as "$0.00" — acceptable since exact sub-cent precision is not needed at a glance
- **Reviewer Notes**: If scans regularly cost sub-cent amounts, consider showing 3-4 decimal places or "< $0.01" notation.

---

- **Decision**: Token count display format
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score 5)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Abbreviating large numbers (e.g., "12.3k") keeps the compact icon-based layout readable
  2. Exact counts are available via tooltip or API for users who need precision
- **Reviewer Notes**: Ensure abbreviation thresholds are consistent with any existing number formatting patterns in the app.

## User Scenarios & Testing

### User Story 1 - View Scan Telemetry in History (Priority: P1)

A project manager reviewing recent health scans wants to quickly see how much each scan cost, how many tokens it consumed, and how long it took — alongside the existing score and issue count — so they can monitor operational costs and identify unusually expensive or slow scans.

**Why this priority**: This enriches already-visible data with telemetry that is stored but hidden, providing immediate value with minimal new infrastructure.

**Independent Test**: Can be fully tested by opening any module's scan history drawer and verifying that each completed scan line shows the 4 metric icons (issues, cost, tokens, duration) with accurate values and working tooltips.

**Acceptance Scenarios**:

1. **Given** a module with completed scans that have telemetry data, **When** the user opens the scan history drawer, **Then** each scan line displays a score badge and 4 compact metric icons (issues, cost, tokens, duration) with numeric values
2. **Given** a scan history line with metric icons, **When** the user hovers over any icon, **Then** a tooltip appears explaining what that metric represents (e.g., "Cost in USD", "Tokens consumed", "Execution time", "Issues found")
3. **Given** a completed scan where some telemetry fields are null (e.g., no cost data), **When** the scan line renders, **Then** the icon for the missing metric shows a dash or is gracefully hidden rather than displaying zero or breaking the layout
4. **Given** the scan history API, **When** a client fetches scan history, **Then** the response includes `tokensUsed` and `costUsd` fields for each scan entry

---

### User Story 2 - At-a-Glance Score Trends on Module Cards (Priority: P2)

A team lead glancing at the health dashboard wants to see whether each module's score is trending up or down without opening any drawers, so they can quickly identify modules that need attention.

**Why this priority**: Sparklines on module cards provide the most visible trend information at the dashboard level, giving immediate situational awareness.

**Independent Test**: Can be fully tested by viewing the health dashboard for a project with 3+ completed scans per module and verifying sparklines appear on active module cards.

**Acceptance Scenarios**:

1. **Given** an active module (Security, Compliance, Tests, or Spec Sync) with 3 or more completed scans, **When** the health dashboard loads, **Then** a mini sparkline (~40px height, no axes) appears on the module card showing the score trend
2. **Given** an active module with fewer than 3 completed scans, **When** the health dashboard loads, **Then** no sparkline is displayed on that module card
3. **Given** a passive module (Quality Gate, Last Clean), **When** the health dashboard loads, **Then** no sparkline is displayed (passive modules are not affected)
4. **Given** the dashboard has loaded, **When** the trend data is fetched, **Then** it is fetched once on mount and is not included in the 2-second polling cycle

---

### User Story 3 - Detailed Score Trend in Module Drawers (Priority: P3)

A developer investigating a declining module score wants to see a full score-over-time chart with dates and hover details inside the module's drawer, so they can correlate score changes with specific time periods or events.

**Why this priority**: The area chart in drawers provides deeper analysis capability, building on the at-a-glance sparklines with full interactivity.

**Independent Test**: Can be fully tested by opening any active module's drawer for a project with historical scan data and verifying the area chart renders with axes, dates, and hover details.

**Acceptance Scenarios**:

1. **Given** an active module with completed scans, **When** the user opens the module's drawer, **Then** an area chart is displayed showing score evolution over time with labeled axes and date markers
2. **Given** the area chart is visible, **When** the user hovers over a data point, **Then** a tooltip displays the score value and scan date for that point
3. **Given** a module with only 1-2 completed scans, **When** the drawer opens, **Then** the area chart is either not shown or shows the limited data points without visual artifacts
4. **Given** the chart follows the existing Quality Gate drawer chart pattern, **When** the chart renders, **Then** it uses consistent visual styling (grid lines, interpolation, colors) matching the established design

---

### User Story 4 - Trend Data Service (Priority: P1)

The system needs a dedicated data source for trend information that serves both sparklines and area charts without adding load to the main health polling cycle, so the dashboard remains performant during active scans.

**Why this priority**: This is the data foundation that User Stories 2 and 3 depend on. Without it, trend visualizations cannot be populated.

**Independent Test**: Can be fully tested by calling the trend endpoint and verifying it returns the correct structure with recent scores per active module.

**Acceptance Scenarios**:

1. **Given** a project with health scan history, **When** the trend endpoint is called, **Then** it returns the last N scores per active module (Security, Compliance, Tests, Spec Sync) in a single response
2. **Given** the trend data is fetched on dashboard mount, **When** the main health poll runs every 2 seconds during active scans, **Then** the trend data is NOT re-fetched as part of that polling cycle
3. **Given** the trend endpoint is called, **When** a module has no completed scans, **Then** that module returns an empty array in the response

### Edge Cases

- What happens when a scan has null telemetry values (tokensUsed, costUsd, or durationMs is null)? Display a dash or hide the specific icon gracefully.
- What happens when all scans for a module have null scores? The sparkline should not render (treated as fewer than 3 valid data points).
- What happens when scans are in PENDING or RUNNING status? They should not contribute to sparkline or area chart data (only COMPLETED scans count).
- What happens when the trend endpoint is called for a project with no scan history? Return an empty structure with empty arrays per module.
- What happens if a module has exactly 3 scans but one has a null score? Only 2 valid data points exist — sparkline should not render.

## Requirements

### Functional Requirements

- **FR-001**: The scan history display MUST show each completed scan with a score badge and 4 metric icons: issues (AlertTriangle), cost (Coins), tokens (Zap), and duration (Clock)
- **FR-002**: Each metric icon in the scan history MUST display a tooltip on hover explaining what the metric represents
- **FR-003**: The scan history API MUST include `tokensUsed` and `costUsd` fields in its response for each scan entry
- **FR-004**: Active module cards (Security, Compliance, Tests, Spec Sync) MUST display a mini sparkline showing score trend when 3 or more completed scans with valid scores exist
- **FR-005**: Module cards MUST NOT display a sparkline when fewer than 3 completed scans with valid scores are available
- **FR-006**: Each active module's drawer MUST include an area chart showing score evolution over time, following the established visual pattern used in the Quality Gate drawer
- **FR-007**: A dedicated trend endpoint MUST return the last N scores per active module in a single call
- **FR-008**: Trend data MUST be fetched once on dashboard mount and MUST NOT be included in the main health polling cycle
- **FR-009**: All text and visual elements MUST maintain WCAG AA contrast compliance (minimum 4.5:1 ratio)
- **FR-010**: Sparklines MUST render without axes at approximately 40px height to fit within the module card layout
- **FR-011**: Scan history metrics MUST gracefully handle null telemetry values by showing a dash or hiding the icon rather than displaying misleading zeros

### Key Entities

- **HealthScan**: Represents a single scan execution. Key attributes for this feature: `score`, `issuesFound`, `tokensUsed`, `costUsd`, `durationMs`, `scanType`, `status`, `completedAt`. Only COMPLETED scans contribute to trend data.
- **Trend Data Point**: A lightweight representation of a scan's score and date, used to populate sparklines and area charts. Derived from HealthScan but kept separate to avoid over-fetching full scan records.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can see scan cost, token usage, and duration for any completed scan within the history drawer without navigating to a separate page
- **SC-002**: Users can identify score trends at a glance from the dashboard without opening any drawer, for all modules with sufficient scan history
- **SC-003**: Trend data loading does not increase the frequency or payload size of the main health polling cycle (which runs every 2 seconds during active scans)
- **SC-004**: All metric icons display informative tooltips, ensuring first-time users understand each metric without external documentation
- **SC-005**: The dashboard remains responsive and readable on standard screen sizes with all new visual elements (sparklines, metric icons) properly laid out
- **SC-006**: All new text and visual elements meet WCAG AA contrast requirements (4.5:1 minimum ratio)

## Assumptions

- The existing `tokensUsed`, `costUsd`, and `durationMs` fields in the HealthScan database model are reliably populated by the scan workflow for completed scans
- 20 data points is a reasonable default for the trend endpoint (sufficient for meaningful sparklines and area charts)
- The existing chart library (Recharts) supports both mini sparklines and full area charts without additional dependencies
- Passive modules (Quality Gate, Last Clean) are explicitly excluded from sparkline and area chart enhancements since they have their own dedicated visualization patterns
- The "previous X issues" text format in scan history lines will be fully replaced by the icon-based format (not shown alongside)
