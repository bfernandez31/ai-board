# Feature Specification: Admin Insights Page Cosmetic Refresh and Failed Report Diagnostics

**Feature Branch**: `AIB-807-admin-insights-page`
**Created**: 2026-05-14
**Status**: Draft
**Input**: User description: "Admin Insights page cosmetic refresh and failed report diagnostics"

## Auto-Resolved Decisions

- **Decision**: GitHub Actions link data — how to provide workflow run URLs to the frontend for failed report diagnostics
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (score 0, fallback from AUTO)
- **Fallback Triggered?**: Yes — AUTO scored netScore=0, absScore=0, confidence=0.3; fell back to CONSERVATIVE per low-confidence rule
- **Trade-offs**: Requires the API response to include additional data (workflow run URL) derived server-side; avoids exposing raw environment variables to the client
- **Reviewer Notes**: Verify that the linked Job's `workflowRunId` is reliably populated by the workflow before the status transition to FAILED

---

- **Decision**: Retry scope — whether retry reuses the exact period window from the failed report or computes a fresh window
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (score 0, fallback from AUTO)
- **Fallback Triggered?**: Yes — same AUTO fallback as above
- **Trade-offs**: Reusing the exact same `periodStart`/`periodEnd` makes retry behavior deterministic and matches operator intent; new tickets shipped since the failure will not be included until the next fresh analysis
- **Reviewer Notes**: Confirm this matches operator expectations — if the intent was always "retry the same scope" then this is correct; if operators want the freshest window, the spec should change

---

- **Decision**: Responsive behavior — how the side-by-side layout adapts to narrow screens
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (score 0, fallback from AUTO)
- **Fallback Triggered?**: Yes — same AUTO fallback as above
- **Trade-offs**: Vertical stacking on mobile preserves full functionality; the past-reports sidebar may push the main content below the fold on small screens
- **Reviewer Notes**: Acceptable for an admin-only page with low mobile traffic; revisit if mobile admin usage grows

---

- **Decision**: Duration display computation — the dense report list includes run duration for completed reports, but no explicit duration field exists in the data model
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (score 0, fallback from AUTO)
- **Fallback Triggered?**: Yes — same AUTO fallback as above
- **Trade-offs**: Computing duration from `createdAt` to `completedAt` is a reasonable proxy for wall-clock run time; only shown when both timestamps exist
- **Reviewer Notes**: Confirm `completedAt` is reliably set for all COMPLETED reports before relying on it for duration display

---

- **Decision**: Selected report visual marker style — how the currently-selected report is highlighted in the sidebar list
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (score 0, fallback from AUTO)
- **Fallback Triggered?**: Yes — same AUTO fallback as above
- **Trade-offs**: Using the existing admin shell active-item pattern (accent background with border) maintains visual consistency; a more prominent marker could improve discoverability but risks clashing with the shell's own active indicators
- **Reviewer Notes**: Ensure the active report highlight is distinct from the sidebar's page-level active state to avoid confusion

## User Scenarios & Testing

### User Story 1 - Browse and Select Past Reports in Side-by-Side Layout (Priority: P1)

An admin navigates to the Insights page to review a past analysis report. The page renders within the admin shell with the "Insights LLM" sidebar item highlighted. The left pane shows a compact list of all past reports. The admin clicks any report in the list, and the right pane immediately displays the selected report's content without a full page reload.

**Why this priority**: This is the core navigation improvement — the side-by-side layout with dense report list is the primary UX change that makes daily report browsing efficient.

**Independent Test**: Can be fully tested by navigating to `/admin/insights`, verifying the two-pane layout renders, clicking different reports in the left pane, and confirming the right pane updates. Delivers the compact browsing experience independently of failed-report diagnostics.

**Acceptance Scenarios**:

1. **Given** the admin is on the Insights page with multiple past reports, **When** the page loads, **Then** the page renders within the admin shell with "Insights LLM" active in the sidebar, no duplicate H1 title appears, and a left pane (~280px) lists past reports in a dense tabular format alongside a right pane showing the latest completed report.
2. **Given** the admin sees the past reports list, **When** they examine a single row, **Then** it is compact (~30-36px height) and displays: generation date, period window (compact form), status badge, and duration (for completed reports only).
3. **Given** the admin clicks a different report in the left pane, **When** the click is processed, **Then** the right pane updates to show the selected report's content without a full page reload, and the clicked row is visually highlighted as the active selection.
4. **Given** the admin views the page on a small screen (below the medium breakpoint), **When** the layout renders, **Then** the past-reports list and the main content area stack vertically instead of side-by-side.

---

### User Story 2 - Diagnose and Retry Failed Reports (Priority: P2)

An admin selects a failed report from the list to understand why it failed and take corrective action. The right pane displays the failure reason in a readable format with a direct link to the corresponding GitHub Actions workflow run. A retry button allows the admin to retry the analysis on the same time window.

**Why this priority**: Failed report diagnostics are the second most impactful improvement — operators currently see a generic error message with no way to investigate or retry without leaving the app.

**Independent Test**: Can be tested by selecting a FAILED report in the list and verifying the error detail, GitHub Actions link, and retry button all appear and function correctly.

**Acceptance Scenarios**:

1. **Given** a FAILED report is selected, **When** the right pane renders, **Then** it displays the failure reason text in a readable format with clear visual styling.
2. **Given** a FAILED report with an associated workflow run, **When** the admin views the failure detail, **Then** a clickable link opens the corresponding GitHub Actions run page in a new tab. The link is constructed from the report's linked job data and the repository information.
3. **Given** a FAILED report whose linked job has no workflow run ID recorded, **When** the admin views the failure detail, **Then** no broken link is shown; the GitHub Actions link is simply absent.
4. **Given** a FAILED report is displayed with a retry button, **When** the admin clicks the button, **Then** a new analysis is triggered using the exact same period window (`periodStart` and `periodEnd`) as the failed report, following the same preflight and eligibility checks as the "Run new analysis" button.
5. **Given** the retry preflight check fails (e.g., another run is already in progress), **When** the admin clicks retry, **Then** the refusal reason is displayed to the admin just as with the normal trigger button.

---

### User Story 3 - Run New Analysis from Refreshed Layout (Priority: P3)

An admin triggers a fresh analysis from the updated Insights page. The "Run new analysis" button remains accessible at the top-right of the main content area and retains its existing preflight logic (eligibility checks, refusal messages).

**Why this priority**: This preserves existing functionality within the new layout — no new behavior, just ensuring the trigger flow works correctly in the redesigned page.

**Independent Test**: Can be tested by clicking the "Run new analysis" button and verifying the preflight dialog, eligibility checks, and workflow dispatch all function as before.

**Acceptance Scenarios**:

1. **Given** the admin is on the Insights page, **When** the page loads, **Then** the "Run new analysis" button is visible at the top-right of the main content area.
2. **Given** the conditions for triggering a new analysis are met, **When** the admin clicks "Run new analysis", **Then** the analysis is dispatched and a new RUNNING entry appears in the past-reports list.
3. **Given** the conditions for triggering are not met (no new shipped tickets, already running), **When** the admin clicks the button, **Then** the existing refusal message is displayed.

---

### Edge Cases

- What happens when there are zero past reports? The left pane shows an empty state message and the right pane shows a placeholder prompting the admin to trigger a first run.
- What happens when all past reports are FAILED? The most recent report is selected by default and its failure detail is shown in the right pane.
- What happens when a RUNNING report completes while the admin is viewing the page? The polling mechanism updates the report's status in the list and, if the completed report is currently selected, the right pane transitions from the "in progress" placeholder to the rendered HTML report.
- What happens when the admin selects a COMPLETED report whose HTML artifact has been pruned (retention expired)? The right pane shows a graceful "content no longer available" message (existing behavior preserved).
- What happens when the retry button is clicked but the original report's period window is now stale (much older than recent runs)? The retry still uses the original window as specified; the admin can use "Run new analysis" for a fresh window instead.

## Requirements

### Functional Requirements

- **FR-001**: The Insights page MUST render within the admin shell, inheriting the global header and admin sidebar.
- **FR-002**: The sidebar MUST show "Insights LLM" as the active item when viewing the Insights page.
- **FR-003**: The page MUST NOT display a redundant H1 title (the previous "Claude Code Insights" heading is removed).
- **FR-004**: The page MUST use a side-by-side layout with a left pane (~280px wide) for past reports and a right pane for the selected report content.
- **FR-005**: On screens below the medium breakpoint, the layout MUST stack vertically (past reports above, report content below).
- **FR-006**: The past-reports list MUST display each report in a compact row (~30-36px height) showing: generation date, period window (compact form), status badge, and duration (for COMPLETED reports only).
- **FR-007**: Duration MUST be computed from the report's creation timestamp to its completion timestamp, and displayed only when both timestamps are available.
- **FR-008**: The currently selected report MUST be visually highlighted in the past-reports list using an accent background consistent with the admin shell's styling patterns.
- **FR-009**: Clicking a report in the past-reports list MUST update the right pane to display the selected report's content without a full page reload.
- **FR-010**: For a COMPLETED report, the right pane MUST display the report HTML via the existing sandboxed iframe mechanism.
- **FR-011**: For a FAILED report, the right pane MUST display the failure reason in a readable, well-formatted presentation.
- **FR-012**: For a FAILED report with an associated workflow run, the right pane MUST include a direct link to the corresponding GitHub Actions run page (opens in a new tab).
- **FR-013**: The GitHub Actions link MUST be constructed from the report's linked job data (workflow run ID) and the repository coordinates, resolved server-side.
- **FR-014**: When the linked job has no workflow run ID, the GitHub Actions link MUST NOT appear (graceful degradation, no broken link).
- **FR-015**: For a FAILED report, a retry button MUST be displayed in the right pane.
- **FR-016**: The retry button MUST trigger a new analysis using the exact same `periodStart` and `periodEnd` from the failed report.
- **FR-017**: The retry MUST go through the same preflight checks and eligibility rules as the normal "Run new analysis" trigger, displaying refusal reasons when applicable.
- **FR-018**: The "Run new analysis" button MUST remain accessible at the top-right of the main content area with its existing preflight logic preserved identically.
- **FR-019**: Live polling (15-second interval while RUNNING rows exist) MUST continue to function, updating both the past-reports list and the right pane when a report's status transitions.
- **FR-020**: For a RUNNING report, the right pane MUST show an "in progress" placeholder with the run start date.
- **FR-021**: The past-reports list MUST show the most recent reports first (descending by generation date).
- **FR-022**: The shipped-tickets-since-previous-run counter and contextual info MUST remain visible in the main content header area.

### Key Entities

- **InsightsReport**: Represents a single analysis run. Key attributes: status (RUNNING/COMPLETED/FAILED), period window (start/end dates), generation date, error reason (for FAILED), linked job (provides workflow run ID for GitHub Actions link), session and ticket counts (for COMPLETED), completion timestamp (for duration computation).
- **Job**: The underlying workflow job linked to an insights report. Provides the `workflowRunId` needed to construct the GitHub Actions URL for failed report diagnostics.

### Internal Processes

- **Retry Analysis**: Triggered when an admin clicks the retry button on a FAILED report.
  - **Input**: The failed report's `periodStart` and `periodEnd` timestamps.
  - **Phases**: (1) Preflight eligibility checks (same as normal trigger: no concurrent run, valid config). (2) Create a new InsightsReport + Job with the same period window. (3) Dispatch the insights-analyze workflow.
  - **Output**: A new RUNNING report appears in the list; the workflow executes and eventually transitions to COMPLETED or FAILED.
  - **Error behavior**: Same as normal trigger — dispatch failures atomically mark the new report as FAILED and clean up the associated job. Preflight refusals (already running, missing config) are surfaced to the admin.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Admins can locate and select any past report within 2 clicks from the Insights page (one click to open the page, one click to select a report).
- **SC-002**: The past-reports list displays at least 10 reports without scrolling in the left pane (given the ~30-36px row height and standard viewport).
- **SC-003**: Switching between reports in the list updates the right pane content within 1 second (no full page reload).
- **SC-004**: For every FAILED report with a recorded workflow run, the admin can reach the GitHub Actions logs page in one click from the failure detail view.
- **SC-005**: The retry button successfully dispatches a new analysis on the same time window, reducing the steps needed to retry a failed run from manual workflow navigation to a single button click.
- **SC-006**: No duplicate title or sidebar elements are visible on the page — a single "Insights LLM" label in the admin sidebar is the sole page identifier.
- **SC-007**: The page functions correctly on both desktop (side-by-side layout) and mobile-width screens (stacked layout) without content overflow or broken interactions.

## Assumptions

- The linked Job's `workflowRunId` is populated before the insights workflow transitions the report status to FAILED, so the GitHub Actions link can be reliably shown for failed reports.
- The repository owner and repository name needed to construct the GitHub Actions URL are available server-side via the host project configuration or environment variables, and are resolved server-side rather than exposed to the client.
- The existing 15-second polling interval is sufficient for live-updating the report list and right pane content after status transitions.
- The retry trigger endpoint can accept explicit `periodStart` and `periodEnd` parameters to reuse the failed report's window, in addition to the existing fresh-window computation.
