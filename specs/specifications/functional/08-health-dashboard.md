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

Below the hero zone, six module cards are arranged in a 2-column, 3-row grid:

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
- **Quality Gate**: Score from the latest COMPLETED verify job's `qualityScore` field
- **Last Clean**: Date and result of the latest COMPLETED cleanup job; does not contribute to the global score

### Card Content

Each card displays:
- Module icon and name
- Score badge: integer 0–100, "OK" (for Last Clean), or "---" (no data)
- Compact summary (e.g., "3 issues found", "All clear", "No scan yet")
- Commit range (active modules with completed scans): `baseCommit..headCommit`
- Severity tags (when applicable)
- Last scan date
- Action button or "passive" label

## Triggering a Scan

Clicking the action button on an active module card triggers a scan:

1. The system creates a scan record in PENDING status
2. The scan workflow is dispatched for the module type
3. The card immediately transitions to "Scanning…" state with a disabled button
4. The dashboard polls every 2 seconds for status updates
5. When the scan completes, the card shows the new score and the global score recalculates automatically — no page refresh required

**Concurrent scan prevention**: Only one scan per module type per project can run at a time. Attempting to trigger a second scan of the same type while one is running is rejected; the action button remains disabled until the running scan reaches a terminal state.

**No active scans button when passive**: Quality Gate and Last Clean cards never show an action button.

## Incremental Scanning

The first scan of any module type performs a full analysis with no base commit. Each subsequent scan of the same type uses the previous scan's `headCommit` as the `baseCommit`, limiting analysis to only the commits introduced since the last scan. Each module type maintains its own independent scan cursor.

## Scan History

Past scan records are retrievable via the API, ordered most-recent-first, with optional filtering by module type and cursor-based pagination. The UI does not currently surface scan history as a dedicated view; it is available via the API for programmatic access and future UI features.

## Real-Time Updates

The health dashboard polls the health score endpoint every 2 seconds while any active scan is in progress. Once all active scans reach terminal states, the polling interval may relax. This follows the same 2-second polling pattern as job status updates elsewhere in the application.

## Error and Edge Cases

- **Project with no commits**: Active scan cards show "No commits available"; action button disabled
- **Workflow dispatch failure**: Scan record transitions to FAILED with an error message; card shows the "Retry" button
- **All modules score 0**: Global score displays "0" with label "Poor"
- **Score update failure on scan completion**: Scan record is COMPLETED but the aggregate retains its previous value; the next successful scan recalculates the aggregate
- **Unauthorized access**: Standard project access verification returns 403; unauthenticated users are redirected to sign-in
