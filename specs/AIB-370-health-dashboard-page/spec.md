# Feature Specification: Health Dashboard - Page, Sidebar, Score Global, Data Model and API

**Feature Branch**: `AIB-370-health-dashboard-page`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Health Dashboard with global score, 6 module cards, data model, and API for project health monitoring"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Scan Authorization Model

- **Decision**: Only project owners and members can view health data and trigger scans, using existing project access verification
- **Policy Applied**: AUTO (recommended CONSERVATIVE, confidence High)
- **Confidence**: High (0.9) — no conflicting signals, standard user-facing feature
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with existing authorization patterns across the application
  2. No additional role granularity (e.g., "scan-only" permissions) — simplifies implementation
- **Reviewer Notes**: If future requirements need finer-grained scan permissions (e.g., read-only health viewers), this decision should be revisited

### Decision 2: Scan Status Polling Interval

- **Decision**: Scan status polling uses the same 2-second interval as existing job polling
- **Policy Applied**: AUTO (recommended CONSERVATIVE)
- **Confidence**: High (0.9) — aligns with established polling patterns in the codebase (2s for jobs)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Responsive real-time feel for users waiting on scan results
  2. Slightly higher server load than longer intervals, but consistent with existing patterns
- **Reviewer Notes**: Validate that the 2s interval is acceptable given expected scan durations (likely minutes, not seconds)

### Decision 3: Concurrent Scan Prevention

- **Decision**: Only one scan per type per project can run at a time; triggering a scan while one of the same type is already running returns an error
- **Policy Applied**: AUTO (recommended CONSERVATIVE)
- **Confidence**: High (0.9) — prevents wasted resources and confusing overlapping results
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents resource waste and result confusion
  2. Users must wait for a running scan to complete before re-triggering the same type
- **Reviewer Notes**: Consider whether a "cancel and re-run" option is needed in future iterations

### Decision 4: Responsive Layout Behavior

- **Decision**: The 2-column grid collapses to a single column on small screens; hero score section stacks vertically
- **Policy Applied**: AUTO (recommended CONSERVATIVE)
- **Confidence**: High (0.9) — standard responsive web design practice
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Accessible on all device sizes
  2. No additional design work beyond standard responsive breakpoints
- **Reviewer Notes**: None — standard responsive behavior

### Decision 5: Passive Module Data Sources

- **Decision**: "Quality Gate" derives its score from the latest completed job's quality score for the project; "Last Clean" shows the most recent cleanup job's completion date and result
- **Policy Applied**: AUTO (recommended CONSERVATIVE)
- **Confidence**: High (0.9) — leverages existing data (Job model already stores qualityScore, cleanup jobs exist)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. No new data collection needed for passive modules
  2. Quality Gate score accuracy depends on jobs being run regularly
- **Reviewer Notes**: Confirm that existing quality score data is sufficient for the Quality Gate module or if additional aggregation logic is needed

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Project Health Overview (Priority: P1)

A project owner navigates to the Health page to see an at-a-glance summary of their project's overall health status. They see a prominent global score with a descriptive label and color, along with compact badges for each contributing module. Below, they see 6 module cards organized in a grid showing individual scores and summaries.

**Why this priority**: This is the core value proposition — providing a unified health view. Without this, no other functionality matters.

**Independent Test**: Can be fully tested by navigating to the Health page and verifying the global score display, sub-score badges, and 6 module cards render correctly with appropriate states.

**Acceptance Scenarios**:

1. **Given** a project with no prior scans, **When** the user navigates to `/projects/[projectId]/health`, **Then** they see the Health page with score "---", label "No data yet", and all 6 cards showing "No scan yet" state
2. **Given** a project with completed scans for Security and Tests modules, **When** the user views the Health page, **Then** the global score is calculated from available modules only (Security and Tests, weighted equally), and the 3 unscanned active modules show "---"
3. **Given** a project with all 5 contributing modules scanned, **When** the user views the Health page, **Then** the global score reflects the weighted average (20% each), with the correct label (Excellent/Good/Fair/Poor) and corresponding color
4. **Given** a project with a global score of 85, **When** the user views the hero zone, **Then** the score displays as "85" with label "Good" and the appropriate color, with 5 sub-score badges below

---

### User Story 2 - Trigger and Monitor a Health Scan (Priority: P1)

A project member wants to run a security scan on their project. They click "Run Scan" on the Security card, which triggers a scan. The card transitions to a "Scanning..." state with a disabled button and spinner. Once complete, the card updates with the new score, summary, and scan details.

**Why this priority**: The ability to trigger scans is the primary interactive action of the Health Dashboard. Without it, the page is purely static.

**Independent Test**: Can be tested by clicking "Run Scan" on any active module card and verifying the state transitions (idle → scanning → completed).

**Acceptance Scenarios**:

1. **Given** a Security card in idle state, **When** the user clicks "Run Scan", **Then** a scan is created in PENDING status, the card shows "Scanning..." with a spinner, and the button becomes disabled
2. **Given** a scan is running for the Tests module, **When** the user tries to trigger another Tests scan, **Then** the system prevents it and the button remains disabled
3. **Given** a running scan completes successfully, **When** the scan finishes, **Then** the card updates to show the new score, issue summary (e.g., "3 issues found"), commit range scanned, and the global score recalculates
4. **Given** a scan fails, **When** the failure is reported, **Then** the card shows a "Failed" badge with an error message and a "Retry" button

---

### User Story 3 - Navigate to Health via Sidebar (Priority: P2)

A user clicks the "Health" entry in the sidebar navigation under the "Views" group to access the Health Dashboard for their current project.

**Why this priority**: Navigation is essential for discoverability, but the page itself (P1) must exist first.

**Independent Test**: Can be tested by clicking the Health sidebar entry and verifying navigation to the correct URL.

**Acceptance Scenarios**:

1. **Given** the user is on any project page, **When** they look at the sidebar under "Views", **Then** they see a "Health" entry with the HeartPulse icon positioned after "Comparisons"
2. **Given** the user clicks "Health" in the sidebar, **When** the page loads, **Then** they are navigated to `/projects/[projectId]/health`

---

### User Story 4 - Incremental Scan Execution (Priority: P2)

After running an initial full scan for a module, subsequent scans only analyze changes since the last scanned commit, reducing scan time and cost.

**Why this priority**: Incremental scanning is a key efficiency feature but only relevant after initial scans are working (P1).

**Independent Test**: Can be tested by running two consecutive scans for the same module and verifying the second scan uses the previous scan's head commit as its base.

**Acceptance Scenarios**:

1. **Given** no prior scans exist for a module type, **When** a scan is triggered, **Then** a full scan is performed with no base commit
2. **Given** a completed scan exists for Security with head commit "abc123", **When** a new Security scan is triggered, **Then** the new scan uses "abc123" as the base commit
3. **Given** each module type has independent scan history, **When** a Security scan runs after a Tests scan, **Then** the Security scan uses the Security module's last head commit, not the Tests module's

---

### User Story 5 - View Scan History (Priority: P3)

A project owner wants to review the history of past scans to understand health trends over time. They can retrieve a list of completed scans filtered by module type.

**Why this priority**: Historical data is valuable but secondary to real-time health monitoring.

**Independent Test**: Can be tested by retrieving scan history for a project and verifying results include correct scan details and support type filtering.

**Acceptance Scenarios**:

1. **Given** a project with 10 completed scans across multiple types, **When** the user requests scan history, **Then** they receive a paginated list ordered by most recent first
2. **Given** a project with scans of various types, **When** the user filters by "SECURITY", **Then** only Security scans are returned

---

### Edge Cases

- What happens when a scan is triggered but the workflow dispatch fails? The scan record transitions to FAILED status with an appropriate error message.
- What happens when the project has no commits yet? Active scan cards show "No commits available" and the "Run Scan" button is disabled.
- What happens when all 5 contributing modules score 0? The global score displays "0" with label "Poor" and the corresponding color.
- What happens when a user navigates to Health for a project they don't have access to? Standard project access verification returns an authorization error.
- What happens when a scan completes but the score update fails? The scan record shows as completed but the global score retains its previous value; the next successful scan recalculates the aggregate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Health" navigation entry in the sidebar under the "Views" group, positioned after "Comparisons", using the HeartPulse icon
- **FR-002**: System MUST render a Health Dashboard page at `/projects/[projectId]/health` accessible to project owners and members
- **FR-003**: System MUST display a global health score (0-100) in a prominent hero zone with a textual label (Excellent 90-100 / Good 70-89 / Fair 50-69 / Poor 0-49) and corresponding color using existing score threshold utilities
- **FR-004**: System MUST display compact badges for 5 sub-scores (Security, Compliance, Tests, Spec Sync, Quality Gate) below the global score, each with its own color
- **FR-005**: System MUST display "Last full scan: X days ago" text showing the time since the most recent completed scan of any type
- **FR-006**: System MUST render 6 module cards in a 2-column, 3-row grid layout: Security | Compliance, Tests | Quality Gate, Spec Sync | Last Clean
- **FR-007**: Each module card MUST display: icon, module name, score badge (0-100 or "OK" or "---"), compact summary, commit range (active scans), severity tags, action button (active scans), "passive" label (Quality Gate and Last Clean), and last scan date
- **FR-008**: Module cards MUST support 4 states: never scanned ("---", "No scan yet", "Run first scan" button), scanning (disabled button with spinner, "Scanning..." label), completed (score, summary, active re-run button), and failed ("Failed" badge, error message, "Retry" button)
- **FR-009**: System MUST allow users to trigger a scan for active modules (Security, Compliance, Tests, Spec Sync) via the card's action button
- **FR-010**: When a scan is triggered, the system MUST create a scan record in PENDING status and dispatch the appropriate workflow
- **FR-011**: System MUST prevent concurrent scans of the same type for the same project
- **FR-012**: System MUST store individual scan records with: project reference, scan type (SECURITY / COMPLIANCE / SPEC_SYNC / TESTS), status (PENDING / RUNNING / COMPLETED / FAILED), score (0-100), report data, issues found/fixed counts, base commit and head commit, tickets created count, telemetry (duration, tokens, cost), and timestamps
- **FR-013**: System MUST maintain a cached aggregate health score per project containing: global score (0-100), per-module sub-scores, last scan date per type, last clean date, and last cleanup job reference
- **FR-014**: The global score MUST be calculated as a weighted average of 5 contributing modules (Security, Compliance, Tests, Spec Sync, Quality Gate) at 20% each; Last Clean is informational and does not contribute
- **FR-015**: When a module has never been scanned, it MUST be excluded from the global score calculation; the global score is computed from available modules only, redistributing weights proportionally
- **FR-016**: System MUST support incremental scanning: the first scan of a type performs a full scan (no base commit), subsequent scans analyze only changes since the last scanned commit for that specific type
- **FR-017**: System MUST provide an endpoint to retrieve the health score for a project (global score, sub-scores, module statuses)
- **FR-018**: System MUST provide an endpoint to list scan history for a project with filtering by scan type
- **FR-019**: The aggregate health score MUST be recalculated and updated after each scan completes
- **FR-020**: System MUST use existing semantic color tokens and Aurora theme utilities; no hardcoded color values
- **FR-021**: The 2-column grid MUST collapse to a single column on small screens

### Key Entities

- **Health Scan**: An individual scan execution record. Linked to a project and identified by scan type. Tracks the full lifecycle from pending through completion or failure. Stores the commit range analyzed, results (score, issues, report), and operational telemetry. Each module type maintains its own independent scan cursor for incremental scanning.
- **Health Score**: A cached aggregate per project (one per project). Stores the computed global score and individual sub-scores for each module. Updated after every successful scan completion. References the latest scan dates and cleanup job for display purposes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view their project's overall health score within 2 seconds of navigating to the Health page
- **SC-002**: Users can trigger a scan and see the card transition to "Scanning..." state within 1 second of clicking the action button
- **SC-003**: After a scan completes, the global score updates automatically without requiring a page refresh
- **SC-004**: The global health score accurately reflects the weighted average of all scanned modules, with unscanned modules excluded from calculation
- **SC-005**: Users can access the Health Dashboard from the sidebar in a single click from any project page
- **SC-006**: All 6 module cards display correct state information (never scanned, scanning, completed, or failed) matching the actual scan data
- **SC-007**: Incremental scans correctly scope their analysis to only the commits changed since the previous scan of that type
- **SC-008**: 100% of health page elements use semantic color tokens with no hardcoded color values, maintaining WCAG AA contrast compliance
