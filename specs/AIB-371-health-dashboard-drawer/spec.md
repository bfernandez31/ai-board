# Feature Specification: Health Dashboard — Scan Detail Drawer

**Feature Branch**: `AIB-371-health-dashboard-drawer`
**Created**: 2026-03-29
**Status**: Draft
**Input**: Ticket AIB-371 — "Health Dashboard - Drawer de detail des scans"

## Auto-Resolved Decisions

1. **Decision**: Drawer component choice — use existing Sheet (Radix Dialog) as the drawer primitive rather than building a custom slide-over panel
   - **Policy Applied**: AUTO → CONSERVATIVE (fallback)
   - **Confidence**: Low (score 1, absScore 1 < 3)
   - **Fallback Triggered?**: Yes — low confidence promoted AUTO to CONSERVATIVE
   - **Trade-offs**:
     1. Reuses proven component and aurora styling; consistent with existing modal patterns
     2. No custom animation work needed; standard right-side sheet behavior
   - **Reviewer Notes**: Verify that Sheet component supports the content density required for full scan reports

2. **Decision**: Report data structure — the `report` field on HealthScan (stored as String) will be expected to contain structured JSON with issues, generated tickets, and module-specific details. The drawer will parse this JSON for display.
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: Medium (score 3) — report field exists but format is undefined; structured JSON is the only reasonable approach for rich display
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Requires a well-defined report JSON schema per module type; adds contract between scan workflows and UI
     2. Enables rich, grouped display without additional API calls
   - **Reviewer Notes**: The report JSON schema must be defined during planning. Existing scans with unstructured reports should display gracefully (fallback to raw text)

3. **Decision**: Scan history scope — the drawer displays history for the selected module only (not all modules). History is fetched from the existing paginated scan history API endpoint with type filter.
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: High (score 5) — the existing API already supports type-filtered, paginated history
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Focused history per module keeps the drawer scannable and relevant
     2. Users wanting cross-module history still have the main dashboard view
   - **Reviewer Notes**: Confirm cursor-based pagination UX in drawer (infinite scroll vs. "Load more" button)

4. **Decision**: Generated ticket links — tickets referenced in the report will link to the board view for that project, navigating to the specific ticket. If no ticket exists for an issue, no link is shown.
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: High (score 5) — standard board navigation pattern already exists
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Depends on scan workflows embedding ticket keys in the report JSON
     2. Broken links are avoided by only showing links when a ticket key is present
   - **Reviewer Notes**: Ensure ticket links use the existing board URL pattern

5. **Decision**: Score history visualization — the history section shows a simple chronological list of past scans with score, date, and issue count. A score trend chart (sparkline) is deferred to a future enhancement.
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: Medium (score 3) — a chart adds complexity; conservative approach ships the list first
   - **Fallback Triggered?**: Yes — chart vs. list ambiguity resolved conservatively toward simpler approach
   - **Trade-offs**:
     1. List-only is faster to implement and test; delivers core value (seeing past scans)
     2. Users lose at-a-glance trend visualization; can be added as follow-up
   - **Reviewer Notes**: Consider adding a sparkline in a future iteration if users request visual trend

## User Scenarios & Testing

### User Story 1 — View Scan Report for a Completed Module (Priority: P1)

A project owner or member clicks on a module card in the Health Dashboard to view the full scan report. The drawer slides open from the right, showing the module header (icon, name, score badge, last scan date, commit range), the list of issues found grouped by the module's grouping logic, and any tickets that were generated from those issues.

**Why this priority**: This is the core value proposition — surfacing detailed scan results without leaving the dashboard. Every other feature depends on the drawer existing and displaying report data.

**Independent Test**: Can be fully tested by clicking a completed module card and verifying the drawer opens with correct header, issues, and ticket links.

**Acceptance Scenarios**:

1. **Given** a project with a completed Security scan, **When** the user clicks the Security module card, **Then** a drawer opens from the right showing the module icon, name "Security", the numeric score badge with appropriate color, last scan date, and commit range scanned.
2. **Given** a completed scan with 5 issues (2 high, 2 medium, 1 low), **When** the drawer opens, **Then** issues are grouped by severity with high-severity issues listed first, each showing description, affected files, and line numbers.
3. **Given** a scan that generated 2 tickets, **When** the drawer opens, **Then** the "Generated Tickets" section lists both tickets with their current stage (e.g., INBOX, BUILD), and clicking a ticket link navigates to that ticket on the board.
4. **Given** the drawer is open, **When** the user clicks the overlay outside the drawer OR clicks the close button, **Then** the drawer closes.

---

### User Story 2 — View Module-Specific Grouped Content (Priority: P1)

Each module type displays its issues and details using a grouping strategy tailored to that module. The drawer adapts its content layout based on which module is selected.

**Why this priority**: Without module-specific rendering, the drawer would show raw data with no meaningful organization. This is essential for usability.

**Independent Test**: Can be tested by opening the drawer for each module type and verifying the correct grouping and content structure.

**Acceptance Scenarios**:

1. **Given** a completed Security scan, **When** the drawer opens, **Then** issues are grouped by severity (High → Medium → Low) with a count per group.
2. **Given** a completed Compliance scan, **When** the drawer opens, **Then** issues are grouped by the constitution principle violated.
3. **Given** a completed Tests scan, **When** the drawer opens, **Then** issues are split into "Auto-fixed" and "Non-fixable" categories, with error details per test.
4. **Given** a completed Spec Sync scan, **When** the drawer opens, **Then** specs are listed with their sync status (synced/drifted) and a summary of detected drift.
5. **Given** a Quality Gate module with a score, **When** the drawer opens, **Then** a breakdown by dimension (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) is displayed along with recent SHIP tickets and their scores.
6. **Given** a Last Clean module with a completed cleanup job, **When** the drawer opens, **Then** a summary of the cleanup job is shown including files cleaned and remaining issues.

---

### User Story 3 — View Scan History for a Module (Priority: P2)

The drawer includes a "History" section showing previous scans for the selected module, ordered most-recent-first. Each entry shows the scan date, score, number of issues found, and the commit range analyzed.

**Why this priority**: History provides temporal context for scores but is secondary to viewing the current report. The dashboard already shows the latest scan; history adds depth.

**Independent Test**: Can be tested by opening the drawer for a module with multiple past scans and verifying the history list renders correctly with pagination.

**Acceptance Scenarios**:

1. **Given** a module with 5 past scans, **When** the drawer opens, **Then** the History section lists scans in reverse chronological order showing date, score, issues found, and commit range for each.
2. **Given** a module with more than 20 past scans, **When** the user scrolls to the bottom of the history list, **Then** additional scans are loaded (pagination).
3. **Given** a module that has never been scanned, **When** the drawer opens, **Then** the History section shows "No scan history" or is not displayed.

---

### User Story 4 — Handle Non-Standard Drawer States (Priority: P2)

The drawer displays appropriate content for modules that have not been scanned, are currently scanning, or have a failed scan.

**Why this priority**: Edge state handling ensures the drawer is usable in all scenarios, not just the happy path. Important for robustness but secondary to core report display.

**Independent Test**: Can be tested by opening the drawer for modules in each of the four states (never scanned, scanning, completed, failed).

**Acceptance Scenarios**:

1. **Given** a module that has never been scanned, **When** the user clicks the card, **Then** the drawer opens with a message inviting them to run their first scan (with a scan trigger button for active modules).
2. **Given** a module with a scan currently in progress, **When** the user clicks the card, **Then** the drawer opens showing a progress/scanning indicator.
3. **Given** a module whose last scan failed, **When** the user clicks the card, **Then** the drawer opens showing the error message and, if available, relevant logs.
4. **Given** a passive module (Quality Gate, Last Clean) with no data, **When** the user clicks the card, **Then** the drawer opens with an explanatory message about how the module collects data passively.

---

### Edge Cases

- What happens when the report JSON is malformed or missing? → The drawer displays a fallback message ("Report data unavailable") instead of crashing.
- What happens when a generated ticket has been deleted? → The ticket link is shown but marked as unavailable if the ticket no longer exists (graceful degradation).
- What happens when the user resizes the browser while the drawer is open? → The drawer remains responsive and adapts to viewport changes.
- What happens when multiple rapid clicks on different cards occur? → The drawer updates to show the most recently clicked module.
- What happens when a scan completes while the drawer is open for that module? → The drawer content refreshes to show the updated report (via polling).

## Requirements

### Functional Requirements

- **FR-001**: System MUST open a right-side slide-over drawer when a user clicks any module card on the Health Dashboard.
- **FR-002**: The drawer header MUST display the module icon, module name, color-coded score badge, last scan date, and commit range scanned (for active modules with completed scans).
- **FR-003**: The drawer MUST display a list of issues from the latest scan report, grouped according to the module type's grouping strategy (severity for Security, principle for Compliance, fix status for Tests, sync status for Spec Sync, dimension for Quality Gate, job summary for Last Clean).
- **FR-004**: Each issue in the list MUST show its severity/category, description, and affected file(s) with line numbers when available.
- **FR-005**: The drawer MUST display a "Generated Tickets" section listing tickets created by the scan, showing each ticket's key and current stage, with clickable links to the board.
- **FR-006**: The drawer MUST display a "History" section showing previous scans for the module with date, score, issue count, and commit range, ordered most-recent-first.
- **FR-007**: Scan history MUST support pagination for modules with many past scans.
- **FR-008**: The drawer MUST render appropriate content for all four module states: never scanned, scanning in progress, completed, and failed.
- **FR-009**: The drawer MUST close when the user clicks outside the drawer area or clicks the close button.
- **FR-010**: The drawer content MUST adapt its layout and grouping strategy based on the selected module type.
- **FR-011**: The drawer MUST refresh its content when the underlying scan data updates (e.g., a scan completes while the drawer is open).
- **FR-012**: The drawer MUST handle malformed or missing report data gracefully, displaying a fallback message instead of an error state.
- **FR-013**: The drawer MUST be responsive and usable across different viewport sizes.

### Key Entities

- **HealthScan**: Existing entity — the drawer reads the `report` field (structured JSON) to display issues, tickets, and module-specific details. Key attributes: scanType, status, score, report, issuesFound, baseCommit, headCommit, completedAt.
- **Report (embedded in HealthScan.report)**: Structured JSON containing issues (with severity, description, file, line), generated ticket references (ticketKey, stage), and module-specific metadata. Schema varies by module type.
- **HealthModuleStatus**: Existing API response shape providing score, label, summary, scan status, and dates — used for the drawer header.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can access the full scan report for any module within 1 click from the Health Dashboard, without navigating to a separate page.
- **SC-002**: 100% of module types display correctly grouped content in the drawer according to their grouping strategy.
- **SC-003**: Users can navigate from a generated ticket in the drawer to the corresponding ticket on the board in 1 click.
- **SC-004**: The drawer renders the correct state-specific content for all 4 module states (never scanned, scanning, completed, failed) with no blank or error screens.
- **SC-005**: Scan history loads within 2 seconds and supports viewing older scans through pagination.
- **SC-006**: The drawer remains functional and readable on viewport widths from 375px (mobile) to 2560px (ultrawide).

## Assumptions

- The scan workflow will be updated to write structured JSON into the `report` field of HealthScan records. The specific JSON schema per module type will be defined during planning.
- Existing scans that predate the structured report format will have their report displayed as raw text or a "legacy format" fallback.
- The existing Sheet (Radix Dialog) component provides sufficient customization for the drawer's content density and layout needs.
- The existing scan history API (`GET /api/projects/{projectId}/health/scans?type=...`) provides all data needed for the history section without additional endpoints.
- Ticket links in the report reference existing ticket keys that can be resolved to board URLs using the project's existing routing pattern.
