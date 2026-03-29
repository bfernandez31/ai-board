# Feature Specification: Health Dashboard - Scan Detail Drawer

**Feature Branch**: `AIB-376-copy-of-health`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Health Dashboard scan detail drawer — slide-over panel showing full scan report, issues, generated tickets, and scan history when clicking a module card"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Drawer Trigger Behavior

- **Decision**: Clicking anywhere on a module card (not just a dedicated button) opens the drawer. The existing "Run Scan" / "Retry" buttons retain their current behavior (trigger scan) and do not open the drawer.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — AUTO confidence insufficient, promoted to CONSERVATIVE
- **Fallback Triggered?**: Yes — absScore = 1, below threshold of 3
- **Trade-offs**:
  1. Intuitive interaction: cards feel clickable and discoverable
  2. Action buttons must clearly stop event propagation to avoid dual actions (scan + drawer open)
- **Reviewer Notes**: Validate that separating "card click = view details" from "button click = trigger scan" is intuitive for users

### Decision 2: Issue Data Structure

- **Decision**: Scan issues are extracted from the existing scan report data. Each issue includes severity level, description, affected files/lines, and whether a ticket was generated. The report field stores structured data that the drawer parses and renders per module type.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — promoted to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Leverages existing data model without schema changes for the drawer itself
  2. Report data quality depends on the scan workflow producing well-structured output
- **Reviewer Notes**: Verify that the scan report field contains sufficient structured data (severity, file paths, line numbers) for the detailed issue display. If the report format is unstructured text, a data enrichment step may be needed upstream.

### Decision 3: Ticket Linking Strategy

- **Decision**: The "Generated Tickets" section shows tickets that were created as a result of scan findings. Tickets are linked to scans through the existing data relationships (project-level ticket queries filtered by creation time and scan context). The drawer displays ticket key, title, and current stage status.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — promoted to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. No new data model required for the drawer UI itself
  2. Linking accuracy depends on how scan-to-ticket associations are tracked
- **Reviewer Notes**: Confirm that a reliable mechanism exists to associate scan findings with generated tickets. If no explicit link exists today, the plan phase should address how to establish this association.

### Decision 4: Drawer Width and Layout

- **Decision**: The drawer uses the right-side slide-over pattern (consistent with existing Sheet component) with a wider max-width than the default to accommodate detailed report content. The drawer is scrollable for long reports.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — promoted to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Wider drawer provides comfortable reading experience for detailed reports
  2. On mobile, the drawer takes full width for usability
- **Reviewer Notes**: None — standard responsive pattern

### Decision 5: History Scope

- **Decision**: The scan history section in the drawer shows history only for the selected module type (not all modules). This provides focused context and avoids information overload. Users see date, score, issues found, and commit range for each past scan.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — promoted to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Focused history per module type aids comparison and trend analysis
  2. Users who want cross-module history must check each module individually
- **Reviewer Notes**: The existing scan history API already supports type-based filtering, so this aligns with current capabilities

### Decision 6: Score Evolution Display

- **Decision**: The history section shows score evolution as a simple chronological list with score values, rather than a chart. This provides clear trend visibility without requiring additional charting complexity in a drawer context.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — promoted to CONSERVATIVE
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Simple list is easier to scan and understand at a glance
  2. A chart would provide better visual trend analysis but adds complexity to a secondary view
- **Reviewer Notes**: Consider upgrading to a mini sparkline chart in a future iteration if users request visual trend data

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Scan Report for a Completed Module (Priority: P1)

A project member clicks on a module card that has a completed scan. A drawer slides in from the right showing the full scan report: module name with score badge, last scan date, commit range, a list of issues found grouped by the module's organizing principle, and any tickets generated from those findings.

**Why this priority**: This is the core value — accessing detailed scan results is the primary reason for the drawer's existence.

**Independent Test**: Can be fully tested by clicking a completed module card and verifying the drawer displays the header, issues section, and generated tickets section with correct data.

**Acceptance Scenarios**:

1. **Given** a Security module with a completed scan showing 5 issues, **When** the user clicks the Security card, **Then** a drawer opens from the right displaying the module icon, name "Security", score badge with color, last scan date, commit range, and 5 issues grouped by severity (high → medium → low)
2. **Given** a Compliance module with a completed scan, **When** the user clicks the Compliance card, **Then** the drawer shows issues grouped by violated constitution principle
3. **Given** a Tests module with a completed scan, **When** the user clicks the Tests card, **Then** the drawer shows issues split into "auto-fixed" and "non-fixable" categories with error details per test
4. **Given** a Spec Sync module with a completed scan, **When** the user clicks the Spec Sync card, **Then** the drawer shows a list of specs with synced/drifted status and drift summaries
5. **Given** a Quality Gate module with data, **When** the user clicks the Quality Gate card, **Then** the drawer shows a breakdown by dimension (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) and lists recent SHIP tickets with their scores
6. **Given** a Last Clean module with data, **When** the user clicks the Last Clean card, **Then** the drawer shows the last cleanup job summary, files cleaned, and remaining issues

---

### User Story 2 - View Generated Tickets from Scan (Priority: P1)

A project member reviews the scan report and wants to see which issues have already resulted in tickets on the board. Each ticket shows its key, title, and current stage, and clicking a ticket navigates to that ticket on the board.

**Why this priority**: Connecting scan findings to actionable tickets is essential for the scan-to-fix workflow. Without it, users must manually cross-reference.

**Independent Test**: Can be tested by opening a drawer for a module that generated tickets and verifying each ticket link navigates to the correct board ticket.

**Acceptance Scenarios**:

1. **Given** a scan that generated 3 tickets, **When** the user views the "Generated Tickets" section, **Then** they see 3 entries with ticket key, title, and current stage (e.g., "INBOX", "BUILD", "SHIP")
2. **Given** a generated ticket entry, **When** the user clicks the ticket link, **Then** they are navigated to that ticket's detail view on the board
3. **Given** a scan that generated no tickets, **When** the user views the "Generated Tickets" section, **Then** they see a message indicating no tickets were generated from this scan

---

### User Story 3 - View Scan History and Score Evolution (Priority: P2)

A project member wants to understand how a module's health has changed over time. The drawer's history section shows a chronological list of past scans with date, score, issues found, and commit range.

**Why this priority**: Historical context helps users understand trends and measure improvement, but is secondary to viewing the current report.

**Independent Test**: Can be tested by opening a drawer for a module with multiple past scans and verifying the history section shows entries in reverse chronological order with correct data.

**Acceptance Scenarios**:

1. **Given** a module with 5 past scans, **When** the user scrolls to the "History" section, **Then** they see 5 entries ordered newest-first, each showing date, score, issues found, and commit range
2. **Given** a module with score improving from 45 to 82 over 4 scans, **When** the user views the history, **Then** the score progression is clearly visible across entries
3. **Given** a module with only 1 completed scan, **When** the user views the history, **Then** they see a single entry with no trend comparison

---

### User Story 4 - Handle Drawer States for Unscanned and In-Progress Modules (Priority: P2)

A user clicks on a module card that has never been scanned, or one with a scan currently in progress. The drawer adapts its content to match the module's current state.

**Why this priority**: Graceful handling of all states prevents confusion and guides users toward productive actions.

**Independent Test**: Can be tested by clicking module cards in each state (never scanned, scanning, failed) and verifying appropriate content is displayed.

**Acceptance Scenarios**:

1. **Given** a module that has never been scanned, **When** the user clicks the card, **Then** the drawer opens showing the module header and a message inviting the user to launch a first scan
2. **Given** a module with a scan currently in progress, **When** the user clicks the card, **Then** the drawer shows the module header and a progress indicator with "Scan in progress" messaging
3. **Given** a module with a failed scan, **When** the user clicks the card, **Then** the drawer shows the module header, an error message with failure details, and available error logs
4. **Given** the drawer is open and a scan completes, **When** the results arrive, **Then** the drawer content updates in real-time to show the completed report without requiring the user to close and reopen

---

### User Story 5 - Close Drawer (Priority: P3)

A user wants to dismiss the drawer and return to the full Health Dashboard grid view.

**Why this priority**: Basic interaction to exit the detail view. Essential but low complexity.

**Independent Test**: Can be tested by opening a drawer and verifying it closes via the close button, clicking outside, or pressing Escape.

**Acceptance Scenarios**:

1. **Given** the drawer is open, **When** the user clicks the close button (X icon), **Then** the drawer slides closed and the full grid is visible
2. **Given** the drawer is open, **When** the user clicks the overlay/backdrop area outside the drawer, **Then** the drawer closes
3. **Given** the drawer is open, **When** the user presses the Escape key, **Then** the drawer closes

---

### Edge Cases

- What happens when the scan report data is malformed or empty? The drawer displays the module header with a fallback message indicating the report could not be loaded.
- What happens when the user opens a drawer and then a scan is triggered for that module? The drawer transitions from the completed report to the "scanning" state, and updates to the new report once complete.
- What happens when the scan history has many entries (50+)? The history section supports scrolling within the drawer and loads entries progressively to avoid performance issues.
- What happens on mobile screens? The drawer takes full viewport width and provides a clear close button for touch interaction.
- What happens when the user navigates away from the Health page while the drawer is open? The drawer closes and the user navigates normally.
- What happens when an issue references a file that no longer exists? The file reference is displayed as-is (informational) without attempting to verify file existence.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST open a right-side slide-over drawer when the user clicks on any module card in the Health Dashboard grid
- **FR-002**: The drawer header MUST display the module icon, module name, score badge with color coding, last scan date, and scanned commit range
- **FR-003**: The drawer MUST display an "Issues" section listing all issues found in the most recent scan, with each issue showing severity level, description, and affected files/lines
- **FR-004**: Issues in the drawer MUST be grouped according to the module type: by severity for Security, by violated principle for Compliance, by auto-fixed/non-fixable for Tests, by synced/drifted status for Spec Sync, by dimension for Quality Gate, and by cleanup category for Last Clean
- **FR-005**: Each issue MUST indicate whether a ticket was generated from it, with a clickable link to the corresponding ticket on the board
- **FR-006**: The drawer MUST display a "Generated Tickets" section listing all tickets created from the current scan, showing ticket key, title, and current stage status
- **FR-007**: Clicking a ticket link in the drawer MUST navigate the user to that ticket's detail view on the board
- **FR-008**: The drawer MUST display a "History" section showing previous scans for the same module type, ordered newest-first, with date, score, issues found count, and commit range per entry
- **FR-009**: The drawer MUST handle four distinct states: never scanned (invitation message), scan in progress (progress indicator), scan completed (full report), and scan failed (error message with logs)
- **FR-010**: The drawer MUST close when the user clicks the close button, clicks outside the drawer overlay, or presses the Escape key
- **FR-011**: The drawer content MUST update in real-time when a scan completes while the drawer is open, without requiring manual refresh
- **FR-012**: The drawer MUST be scrollable to accommodate long reports and issue lists
- **FR-013**: The drawer MUST adapt to mobile screens by taking full viewport width
- **FR-014**: The "Run Scan" / "Retry" action buttons on module cards MUST continue to trigger scans without opening the drawer (click event separation)
- **FR-015**: The drawer MUST use existing Aurora theme utilities and semantic color tokens; no hardcoded color values

### Key Entities

- **Scan Report**: The detailed output of a health scan, containing structured issue data organized by the module's classification scheme. Parsed from the scan's report field and rendered according to module type.
- **Scan Issue**: An individual finding within a scan report. Contains severity, description, affected file paths and line numbers, and an optional reference to a generated ticket.
- **Generated Ticket**: A board ticket created as a result of a scan finding. Referenced by ticket key and linked back to the originating issue for traceability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open a scan detail drawer within 1 second of clicking any module card
- **SC-002**: 100% of module types display correctly formatted, module-specific issue groupings in the drawer
- **SC-003**: All ticket links in the drawer navigate to the correct ticket detail view on the board
- **SC-004**: Users can review the scan history for any module showing at least the 10 most recent scans
- **SC-005**: The drawer correctly renders all 4 states (never scanned, in progress, completed, failed) matching the actual module status
- **SC-006**: The drawer closes reliably via all 3 dismissal methods (close button, overlay click, Escape key)
- **SC-007**: Drawer content updates in real-time when scan status changes, without requiring page refresh
- **SC-008**: All drawer elements use semantic color tokens with WCAG AA contrast compliance
