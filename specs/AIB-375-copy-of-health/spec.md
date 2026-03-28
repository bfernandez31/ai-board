# Feature Specification: Health Dashboard - Page, Sidebar, Score Global, Data Model and API

**Feature Branch**: `AIB-375-copy-of-health`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Project Health Dashboard with global score, 6 module cards, data model, and API"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Score color thresholds reuse existing quality score thresholds (Excellent 90-100 / Good 70-89 / Fair 50-69 / Poor 0-49) rather than defining new ones
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1, absScore: 1 — neutral feature with internal-tool signal)
- **Fallback Triggered?**: Yes — AUTO confidence was below 0.5 threshold, promoted to CONSERVATIVE
- **Trade-offs**:
  1. Consistency with existing quality score UX reduces learning curve
  2. No flexibility to tune thresholds per health module independently
- **Reviewer Notes**: If specific modules need different thresholds (e.g., Security should be stricter), this can be revisited during planning

---

- **Decision**: Equal weighting (20% each) for the 5 contributing modules in the global score calculation, with "Last Clean" excluded as informational only
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1) — ticket explicitly specifies equal weighting, so this is a direct transcription rather than an assumption
- **Fallback Triggered?**: Yes — low confidence, but ticket description is unambiguous on this point
- **Trade-offs**:
  1. Simple and transparent scoring model; easy for users to understand
  2. May not reflect that some modules (e.g., Security) are more critical than others
- **Reviewer Notes**: Consider whether weighted scoring should be configurable per project in a future iteration

---

- **Decision**: Polling-based UI updates (consistent with existing app patterns — 15s interval) rather than real-time WebSocket notifications for scan status
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1) — existing app uses polling exclusively (2s-15s intervals per architecture)
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback, but aligned with established architecture
- **Trade-offs**:
  1. Consistency with existing polling architecture; no new infrastructure needed
  2. Scan status updates may have up to 15s delay in the UI
- **Reviewer Notes**: 15s polling is consistent with analytics and notifications intervals; adjust if scans need faster feedback

---

- **Decision**: Scan actions dispatch GitHub workflows (same pattern as existing job dispatch) rather than running scans in-process
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1) — ticket explicitly mentions dispatching `health-scan.yml` workflow
- **Fallback Triggered?**: Yes — direct transcription from ticket
- **Trade-offs**:
  1. Leverages existing workflow infrastructure; scans run in isolated CI environment
  2. Adds dependency on GitHub Actions availability and cost
- **Reviewer Notes**: Workflow file (`health-scan.yml`) implementation is out of scope for this ticket — only the dispatch mechanism is covered

---

- **Decision**: Quality Gate and Last Clean modules are passive (computed from existing data) and do not have scan trigger buttons
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1) — ticket explicitly defines these as passive with no action buttons
- **Fallback Triggered?**: Yes — direct transcription
- **Trade-offs**:
  1. Reduces UI complexity for modules that derive data from other sources
  2. Users cannot force a refresh of passive modules independently
- **Reviewer Notes**: Quality Gate derives from existing job quality scores; Last Clean derives from the most recent cleanup job

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Project Health Overview (Priority: P1)

A project owner navigates to the Health page from the sidebar to get an at-a-glance view of their project's overall health score and the status of each health module.

**Why this priority**: The primary value of this feature is giving users instant visibility into project health. Without this view, no other functionality is useful.

**Independent Test**: Can be fully tested by navigating to the Health page and verifying the global score display, sub-score badges, and 6 module cards render correctly with their current states.

**Acceptance Scenarios**:

1. **Given** a project with no health scans ever run, **When** the user navigates to `/projects/[projectId]/health`, **Then** the global score shows "---", all module cards show "No scan yet" with "Run first scan" buttons for active modules, and passive modules show "---"
2. **Given** a project with completed scans for Security and Tests, **When** the user views the Health page, **Then** the global score is calculated from the 2 available modules (equal weight redistribution), sub-score badges show scores for Security and Tests with colors matching thresholds, and unscanned modules show "---"
3. **Given** a project with all 5 contributing modules scanned, **When** the user views the Health page, **Then** the global score is the weighted average (20% each), all sub-score badges display with appropriate colors, and "Last full scan: X days ago" reflects the most recent scan date

---

### User Story 2 - Trigger a Health Scan (Priority: P1)

A project owner clicks "Run Scan" on a module card to initiate a health scan for that specific module, and sees real-time feedback while the scan is in progress.

**Why this priority**: Triggering scans is the core interactive action. Without it, the dashboard is static and provides no ongoing value.

**Independent Test**: Can be tested by clicking "Run Scan" on any active module card and verifying the card transitions through pending → running → completed states.

**Acceptance Scenarios**:

1. **Given** a module card in idle state, **When** the user clicks "Run Scan", **Then** a scan record is created with PENDING status, the button becomes disabled with a spinner and "Scanning..." label, and a workflow is dispatched
2. **Given** a scan is in progress (RUNNING status), **When** the user views the card, **Then** the button remains disabled with spinner, and the card shows "Scanning..."
3. **Given** a scan completes successfully, **When** the UI polls for updates, **Then** the card displays the new score with appropriate color, a summary of findings, the commit range scanned, and the "Run Scan" button becomes active again
4. **Given** a scan fails, **When** the UI polls for updates, **Then** the card shows a red "Failed" badge, an error message, and a "Retry" button

---

### User Story 3 - Incremental Scanning (Priority: P2)

After running an initial full scan, subsequent scans for the same module only analyze changes since the last scanned commit, reducing scan time and cost.

**Why this priority**: Incremental scanning is essential for efficiency but only matters after the first scan has been run. It builds on the foundation of User Story 2.

**Independent Test**: Can be tested by running two consecutive scans for the same module and verifying the second scan has a non-null base commit matching the first scan's head commit.

**Acceptance Scenarios**:

1. **Given** a module with no prior scans, **When** a scan is triggered, **Then** the scan record has a null base commit (full scan) and records the current head commit
2. **Given** a module with a previous completed scan at commit `abc123`, **When** a new scan is triggered, **Then** the scan record has base commit `abc123` and the current head commit as head commit
3. **Given** a module with a previous failed scan, **When** a new scan is triggered, **Then** the base commit is taken from the last *completed* scan (not the failed one)

---

### User Story 4 - Navigate to Health from Sidebar (Priority: P1)

A user sees a "Health" entry with a HeartPulse icon in the sidebar's Views group and can navigate to the Health page for the current project.

**Why this priority**: Navigation is the entry point to the entire feature. Without sidebar access, users cannot discover or reach the Health page.

**Independent Test**: Can be tested by verifying the HeartPulse icon appears in the sidebar after "Comparisons" and clicking it navigates to the correct route.

**Acceptance Scenarios**:

1. **Given** the user is viewing any project page, **When** they look at the sidebar, **Then** they see a "Health" entry with a HeartPulse icon in the Views group, positioned after "Comparisons"
2. **Given** the user clicks the "Health" sidebar entry, **When** the page loads, **Then** they are navigated to `/projects/[projectId]/health`

---

### User Story 5 - View Scan History via API (Priority: P3)

A user or automated system retrieves the history of health scans for a project, filtered by scan type, to understand trends over time.

**Why this priority**: Scan history is a secondary feature that supports auditability and trend analysis but is not essential for the core dashboard experience.

**Independent Test**: Can be tested by calling the scan history API endpoint and verifying it returns paginated results filtered by scan type.

**Acceptance Scenarios**:

1. **Given** a project with multiple completed scans, **When** the API is called without filters, **Then** all scans are returned in reverse chronological order
2. **Given** a project with scans of different types, **When** the API is called with a type filter (e.g., SECURITY), **Then** only scans of that type are returned

---

### Edge Cases

- What happens when a scan is triggered while another scan of the same type is already running? The system prevents duplicate concurrent scans for the same module and project, returning an appropriate error.
- What happens when the project has no commits (empty repository)? The Health page displays gracefully with "No commits available" messaging and disabled scan buttons.
- What happens when the GitHub workflow dispatch fails? The scan record is marked as FAILED with an appropriate error message.
- What happens when the global score calculation has zero available modules? The global score displays "---" rather than 0.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Health" navigation entry with a HeartPulse icon in the sidebar Views group, positioned after "Comparisons"
- **FR-002**: System MUST route `/projects/[projectId]/health` to the Health Dashboard page
- **FR-003**: System MUST display a global health score (0-100) with a textual label (Excellent / Good / Fair / Poor) and corresponding color using existing quality score thresholds
- **FR-004**: System MUST display sub-score badges for the 5 contributing modules (Security, Compliance, Tests, Spec Sync, Quality Gate) below the global score, each with its own color
- **FR-005**: System MUST display "Last full scan: X days ago" reflecting the most recent scan date across all modules
- **FR-006**: System MUST render 6 module cards in a 2-column, 3-row grid layout: Security | Compliance, Tests | Quality Gate, Spec Sync | Last Clean
- **FR-007**: Each module card MUST display: icon, module name, score badge (0-100 or "---"), compact summary, and last scan/calculation date
- **FR-008**: Active module cards (Security, Compliance, Spec Sync, Tests) MUST display a scan action button and the commit range scanned
- **FR-009**: Passive module cards (Quality Gate, Last Clean) MUST display a "passive" label and MUST NOT have scan trigger buttons
- **FR-010**: Module cards MUST support 4 visual states: never scanned ("---", "No scan yet", "Run first scan"), scanning (disabled button with spinner, "Scanning..."), completed (score, summary, active button), and failed (red "Failed" badge, error message, "Retry" button)
- **FR-011**: System MUST allow users to trigger a scan for any active module, creating a scan record and dispatching the appropriate workflow
- **FR-012**: System MUST prevent triggering a scan when one of the same type is already running for the same project
- **FR-013**: System MUST calculate the global score as a weighted average of available module scores (20% each), excluding modules that have never been scanned
- **FR-014**: System MUST store scan records with: project, scan type, status, score, JSON report, issues found/fixed counts, base commit, head commit, tickets created count, telemetry (duration, tokens, cost), and timestamps
- **FR-015**: System MUST maintain a cached aggregate health score per project, updated after each completed scan
- **FR-016**: System MUST support incremental scanning: first scan has null base commit (full scan), subsequent scans use the last completed scan's head commit as base commit
- **FR-017**: System MUST provide an API endpoint to retrieve the health score for a project (global score, sub-scores, module statuses)
- **FR-018**: System MUST provide an API endpoint to list scan history for a project with optional type filtering
- **FR-019**: System MUST enforce project access authorization for all health-related endpoints
- **FR-020**: System MUST use Aurora theme styling with no hardcoded colors

### Key Entities *(include if feature involves data)*

- **HealthScan**: Represents a single execution of a health scan for one module. Key attributes: project reference, scan type (Security/Compliance/Spec Sync/Tests), status lifecycle (Pending → Running → Completed/Failed), score (0-100), JSON report with findings, issue counts (found/fixed), commit range (base/head for incremental support), tickets created, telemetry data (duration, tokens, cost). One project can have many scans of each type over time.
- **HealthScore**: Cached aggregate health score for a project (one per project). Key attributes: global score (0-100), individual sub-scores per module, last scan date per module type, last clean date, reference to most recent cleanup job. Updated automatically whenever a scan completes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access the Health Dashboard within 2 clicks from any project page (sidebar navigation)
- **SC-002**: Global health score updates within 30 seconds of a scan completing
- **SC-003**: All 6 module cards render correctly in their appropriate states on page load
- **SC-004**: Users can trigger a scan and see visual feedback (spinner/disabled state) within 2 seconds of clicking
- **SC-005**: Incremental scans process only changes since the last scanned commit, reducing scan scope proportionally to the change volume
- **SC-006**: The Health Dashboard meets WCAG AA contrast requirements (4.5:1 minimum) using only semantic theme tokens
- **SC-007**: The dashboard page loads and displays cached scores within standard page load time expectations
- **SC-008**: Scan history API returns paginated results filtered by type within standard API response time expectations
