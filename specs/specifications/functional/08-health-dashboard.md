# Health Dashboard - Functional Specification

## Purpose

The Health Dashboard provides project owners and members with an at-a-glance view of their project's technical health. It aggregates results from up to 6 health modules into a single global score, allows users to trigger on-demand scans, and tracks scan history over time.

## Accessing the Health Dashboard

The Health Dashboard is accessible at `/projects/{projectId}/health`. Users reach it by clicking the **Health** entry (HeartPulse icon) in the project sidebar under the Views group, positioned after Comparisons.

Access is restricted to project owners and members. Unauthenticated visitors are redirected to sign-in; non-members receive a 403 error.

## Global Health Score

The hero zone at the top of the page displays the project's overall health:

- **Score**: A single integer 0–100, or "---" when no modules have been scanned
- **Label**: A textual rating derived from the score threshold:
  - 90–100: "Excellent"
  - 70–89: "Good"
  - 50–69: "Fair"
  - 0–49: "Poor"
  - No data: "No data yet"
- **Color**: A semantic color corresponding to the label (no hardcoded hex values)
- **Sub-score badges**: Five compact badges below the score, one per contributing module (Security, Compliance, Tests, Spec Sync, Quality Gate), each showing its individual score and color

The global score is a weighted average of all contributing modules that have been scanned (20% each). Modules that have never been scanned are excluded from the calculation; their weight is redistributed proportionally among scanned modules.

**"Last full scan" text**: Below the badges, the page shows the time elapsed since the most recent completed scan of any type (e.g., "Last full scan: 2 days ago"). Displays nothing meaningful until at least one scan has completed.

## Module Cards

Below the hero zone, six module cards are arranged in a 2-column, 3-row grid. Clicking anywhere on a card (except the action button) opens the Scan Detail Drawer for that module.

| Row | Left | Right |
|-----|------|-------|
| 1 | Security | Compliance |
| 2 | Tests | Quality Gate |
| 3 | Spec Sync | Last Clean |

On small screens (< `sm` breakpoint), the grid collapses to a single column.

### Card States

Each card renders one of four states based on the module's scan data:

| State | Trigger | Display |
|-------|---------|---------|
| **Never scanned** | No completed scan exists | Score "---", "No scan yet", "Run first scan" button (active modules only) |
| **Scanning** | A PENDING or RUNNING scan exists | Spinner, "Scanning…" label, button disabled |
| **Completed** | Most recent scan is COMPLETED | Numeric score badge, summary text, commit range, severity tags, "Run scan" button |
| **Failed** | Most recent scan is FAILED | "Failed" badge, error message, "Retry" button |

### Active vs. Passive Modules

**Active modules** (Security, Compliance, Tests, Spec Sync) support user-triggered scans. Their cards display an action button and the commit range analyzed.

**Passive modules** (Quality Gate, Last Clean) derive data from existing Job records and display a "passive" label instead of an action button:
- **Quality Gate**: 30-day rolling average of quality scores from COMPLETED verify jobs of FULL-workflow tickets at SHIP stage. Contributes 20% to the global Health Score. The card also shows ticket count, a trend indicator (vs the previous 30-day window), and a threshold distribution (Excellent/Good/Fair/Poor).
- **Last Clean**: Date and result of the latest COMPLETED cleanup job. Does not contribute to the global score. The card shows a staleness visual state based on elapsed time: OK (< 30 days), warning (30–60 days), alert (> 60 days).

### Card Content

Each card displays:
- Module icon and name
- Score badge: integer 0–100, "OK" (for Last Clean), or "---" (no data)
- Compact summary (e.g., "3 issues found", "All clear", "No scan yet")
- Commit range (active modules with completed scans): `baseCommit..headCommit`
- Severity tags (when applicable)
- Last scan date
- Action button or "passive" label

**Quality Gate card extras** (when data is available): ticket count (e.g., "5 tickets"), trend indicator arrow (up/down/stable) with numeric delta, and a threshold distribution showing counts per bucket (Excellent ≥ 90, Good ≥ 70, Fair ≥ 50, Poor < 50).

**Last Clean card extras**: staleness visual state (green border/tint for OK, yellow for warning, red for alert); days since last cleanup; file count when available from job output.

## Triggering a Scan

Clicking the action button on an active module card triggers a scan:

1. The system creates a scan record in PENDING status
2. The scan workflow is dispatched for the module type
3. The card immediately transitions to "Scanning…" state with a disabled button
4. The dashboard polls every 2 seconds for status updates
5. When the scan completes, the card shows the new score and the global score recalculates automatically — no page refresh required

**Concurrent scan prevention**: Only one scan per module type per project can run at a time. Attempting to trigger a second scan of the same type while one is running is rejected; the action button remains disabled until the running scan reaches a terminal state.

**No active scans button when passive**: Quality Gate and Last Clean cards never show an action button.

## Automatic Ticket Creation

When an active module scan completes and issues are found, the system automatically creates remediation tickets in the project's INBOX stage with the QUICK workflow type. Tickets are grouped according to each module's issue structure:

| Module | Grouping Rule |
|--------|--------------|
| Security | One ticket per severity level (e.g., one for all HIGH issues, one for MEDIUM) |
| Compliance | One ticket per violated constitution principle |
| Tests | One ticket per unfixable failing test |
| Spec Sync | One ticket per desynchronized spec |

Each ticket includes the affected files, line numbers, and issue descriptions. When a scan finds zero issues, no tickets are created. Tickets created this way appear on the board immediately and are linked from the "Generated Tickets" section of the Scan Detail Drawer.

## Incremental Scanning

The first scan of any module type performs a full analysis with no base commit. Each subsequent scan of the same type uses the previous scan's `headCommit` as the `baseCommit`, limiting analysis to only the commits introduced since the last scan. Each module type maintains its own independent scan cursor.

## Scan Detail Drawer

Clicking any module card opens a right-side slide-over drawer displaying the full details for that module. The drawer replaces any previously open drawer if the user clicks a different card. It closes when the user clicks the overlay outside the drawer or the close button. Clicking the action button on a card (to trigger a scan) does not open the drawer.

### Drawer Header

The header shows the module icon, module name, a color-coded score badge (matching the card's score color), last scan date, and the commit range analyzed (`baseCommit..headCommit`) for active modules with completed scans. Passive modules (Quality Gate, Last Clean) omit the commit range.

### Drawer States

The drawer renders content appropriate to the module's current state:

| State | Content |
|-------|---------|
| **Never scanned** | Explanatory message; "Run first scan" button for active modules; explanation of passive data collection for passive modules |
| **Scanning** | Progress indicator with "Scanning…" label |
| **Completed** | Full report content (issues, tickets, history sections) |
| **Failed** | Error message and relevant logs if available; "Retry" option for active modules |

### Issues Section (Completed Scans)

Issues from the latest scan are displayed in groups according to the module's grouping strategy:

| Module | Grouping |
|--------|---------|
| Security | By severity (High → Medium → Low) |
| Compliance | By constitution principle violated |
| Tests | Two categories: "Auto-fixed" and "Non-fixable" |
| Spec Sync | By sync status (synced / drifted) with drift summary |
| Quality Gate | Dimension breakdown (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) with average scores; threshold distribution; trend chart (score per ticket over time); list of recent SHIP tickets with individual scores |
| Last Clean | Summary of the latest cleanup (files cleaned, remaining issues, summary text); chronological history of past cleanups (date, file count, summary) |

Each issue entry shows severity/category, description, and affected file with line number when available. Malformed or missing report data renders a fallback message ("Report data unavailable") instead of an error.

### Generated Tickets Section

For active modules, the drawer lists any tickets that were generated from the scan, showing each ticket's key and current stage. Each entry links directly to that ticket on the board. If no tickets were generated, this section is omitted.

### History Section

The History section lists previous scans for the selected module in reverse chronological order. Each entry shows the scan date, score, issue count, and commit range. History is loaded in pages of 20 with a "Load more" button at the bottom. Modules with no scan history display "No scan history."

### Content Refresh

If a scan completes while the drawer is open for that module, the drawer content refreshes automatically via the existing 2-second polling mechanism (shared with the health score endpoint). The drawer remains responsive across all supported viewport widths (375px–2560px).

## Real-Time Updates

The health dashboard polls the health score endpoint every 2 seconds while any active scan is in progress. Once all active scans reach terminal states, the polling interval may relax. This follows the same 2-second polling pattern as job status updates elsewhere in the application.

## Error and Edge Cases

- **Project with no commits**: Active scan cards show "No commits available"; action button disabled
- **Workflow dispatch failure**: Scan record transitions to FAILED with an error message; card shows the "Retry" button
- **All modules score 0**: Global score displays "0" with label "Poor"
- **Score update failure on scan completion**: Scan record is COMPLETED but the aggregate retains its previous value; the next successful scan recalculates the aggregate
- **Unauthorized access**: Standard project access verification returns 403; unauthenticated users are redirected to sign-in
