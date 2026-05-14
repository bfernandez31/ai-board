# UI Contracts: Admin Insights cosmetic refresh

**Feature**: AIB-798
**Date**: 2026-05-14

This file specifies the component-level contracts touched or introduced by
this feature. The contracts are observable from outside the components (props,
DOM structure, accessibility attributes, query keys) and constitute the
testable surface area for the unit/integration suites.

---

## 1. Page metadata — `/admin/insights`

**File**: `app/admin/insights/page.tsx`

```ts
export const metadata: Metadata = { title: 'Insights LLM' };
```

**Contract**:
- The browser tab title for `/admin/insights` is the literal string
  `Insights LLM` (FR-003, SC-003).
- The metadata is exported from the page segment (not the layout) so sibling
  admin routes are unaffected.

---

## 2. `InsightsReportView` — top-level admin insights view

**File**: `components/admin/insights/insights-report-view.tsx`

### Props (unchanged shape)

```ts
interface InsightsReportViewProps {
  reports: ReportListEntry[];
  latest: ReportListEntry | null;
  preflight: InsightsPreflight;
}
```

### DOM contract (post-refresh)

- MUST NOT render a `<h1>` whose text matches `/claude code insights/i` (FR-002, SC-002).
- MUST render a top-level layout container with a CSS grid that resolves to
  two columns on desktop (left ~280px, right fills remaining) and one
  column below the tablet breakpoint (FR-005, FR-006, FR-018).
- The right panel MUST contain:
  - A metadata card (existing `Card` with `aurora-bg-card-blue`) summarizing
    the **selected** report's sessions/tickets/period (FR-004).
  - A body region whose contents depend on `display.status`:
    - `COMPLETED` → `<iframe sandbox="allow-scripts">` pointed at
      `/api/admin/insights/reports/{id}/html` (unchanged).
    - `FAILED` → `<FailureDiagnosticsPanel report={display} preflight={...} latestIsRunning={...} />` (new).
    - `RUNNING` → existing `<ReportErrorPlaceholder title="Run in progress" detail={...} />` (unchanged).
  - The existing `<RunAnalysisButton>` in the top-right of the right panel,
    receiving the same `preflight`/`latestIsRunning` props it gets today (FR-015).
- The left panel MUST contain `<PastReportsTable rows={reports} selectedId={selectedId} onSelect={setSelectedId} />`.
- When `reports.length === 0`, the left panel renders a compact `"no prior
  runs"` empty state and the right panel renders the existing
  `<ReportErrorPlaceholder title="No Insights reports yet" />`.

### Behavioral contract (unchanged)

- 15s polling of reports (`useInsightsReports`) and preflight
  (`useInsightsPreflight`) MUST continue (FR-016).
- The reconciliation pass MUST stay on the page's server entry point
  (`app/admin/insights/page.tsx:14`), unmodified (FR-020).
- Default selection logic: latest COMPLETED, then first row, then `latest`
  prop — exactly as today (`insights-report-view.tsx:110-114`).
- Selection is client-only (D-3); reload resets to default.

---

## 3. `PastReportsTable` — new

**File**: `components/admin/insights/past-reports-table.tsx`

### Props

```ts
interface PastReportsTableProps {
  rows: ReportListEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}
```

### DOM contract

- Renders a semantic `<table>` (or `<div role="table">` if borderless layout
  better fits the design) with four columns in this order: **Date**, **Period**,
  **Status**, **Duration**.
- Each row is a `<button type="button">` (or `role="row"` with a click handler
  on the row element) — selected by `aria-pressed="true"` AND
  `data-selected="true"`. Inactive rows use `aria-pressed="false"`.
- Selected row classes MUST include both `bg-accent/30` and `border-l-2
  border-primary` (P-2 / FR-009).
- Row CSS height MUST resolve in the `[30px, 36px]` range at desktop
  breakpoints for at least 95% of rows in a mixed-status fixture (SC-004).
  Use `min-h-[30px] max-h-[36px] py-1` (or equivalent line-height + padding
  combination) on the row container.
- The table is wrapped in a `max-h-[…] overflow-y-auto` container so 200
  rows do not push the right panel off-screen (FR-018, edge case "200 row
  cap").
- The panel container's width on desktop falls in `[260px, 300px]`, targeting
  280px (SC-005); achieved via the parent grid template `[280px_minmax(0,1fr)]`.

### Display helpers (colocated)

- `formatCompactPeriod(start: string, end: string): string` per D-7.
- `formatCompactDuration(createdAt: string, completedAt: string | null, status: InsightsRunStatus): string` per D-8.
- `formatDateFull(iso: string): string` — `YYYY-MM-DD` (reuse existing
  `formatDate` from `insights-report-view.tsx`, possibly extracted).

### Behavioral contract

- Clicking a row calls `onSelect(row.id)` and updates `selectedId` in the
  parent within a single React render (no network round trip, no
  `navigationStart` increment) (FR-010, SC-006).
- The component is presentational — no internal state beyond rendering.

---

## 4. `FailureDiagnosticsPanel` — new

**File**: `components/admin/insights/failure-diagnostics-panel.tsx`

### Props

```ts
interface FailureDiagnosticsPanelProps {
  report: ReportListEntry;       // INVARIANT: report.status === 'FAILED'
  preflight: { canTrigger: boolean; refusal: { refusalCode: string; message: string } | null };
  latestIsRunning: boolean;
}
```

### DOM contract

- Renders a `Card` with `aurora-bg-card-blue` (matching the metadata card
  styling).
- Title: `"This run failed"` (h-level matches the existing placeholder — a
  `<p className="font-medium text-foreground">`, NOT an `<h1>`).
- Body region:
  - `errorReason` (or fallback `"Run failed without a recorded reason — open the workflow run for details"`) rendered with `whitespace-pre-wrap` to preserve line breaks (FR-011).
- Link region (rendered iff `buildInsightsRunUrl(report.workflowRunId)` returns a non-null string):
  - `<a href={url} target="_blank" rel="noopener noreferrer">Open workflow run on GitHub</a>` (FR-012, P-5).
  - Visually distinguishable as a link (underline + accent color via Tailwind tokens).
- Link absence:
  - If the helper returns `null`, the panel MUST display
    `"No workflow run is associated with this report"` (FR-013, SC-008).
- Retry region:
  - Renders the existing `<RunAnalysisButton preflight={...} latestIsRunning={...} label="Reessayer" />` — same mutation, same refusal handling (FR-014, SC-009).
- All styling uses Tailwind semantic tokens + `aurora-*` classes (FR-017).

### Behavioral contract

- Clicking `Reessayer` invokes the same `POST /api/admin/insights/trigger`
  mutation as the top-right button. Optimistic insertion, refusal codes,
  polling resumption are byte-equivalent (SC-009).
- The button uses the live `preflight` from the parent (`InsightsReportView`),
  so refusal/refresh behavior matches the top-right button exactly.

---

## 5. `RunAnalysisButton` — modified (additive)

**File**: `components/admin/insights/run-analysis-button.tsx`

### Props (extended)

```ts
interface RunAnalysisButtonProps {
  preflight: PreflightShape;
  latestIsRunning: boolean;
  label?: string; // NEW — default 'Run new analysis'; FailureDiagnosticsPanel passes 'Reessayer'.
}
```

### DOM contract (additive)

- The button text is `props.label ?? 'Run new analysis'` when not pending.
- When `mutation.isPending`, the button text remains `'Starting…'` regardless
  of label (so the pending state is recognizable across both call sites).
- All other DOM, mutation, refusal display, and styling are unchanged.

### Behavioral contract (unchanged)

- Mutation key (`insightsReportsQueryKey`), optimistic entry, error handling,
  refusal phrasing, and disable conditions remain identical (P-1, SC-010).

---

## 6. `lib/admin/insights-github-url.ts` — new pure helper

**File**: `lib/admin/insights-github-url.ts`

### Signature

```ts
export function buildInsightsRunUrl(
  workflowRunId: string | null,
  owner?: string,
  repo?: string
): string | null;
```

### Contract

- Reads `owner ?? process.env.GITHUB_OWNER` and `repo ?? process.env.GITHUB_REPO`.
- Returns `null` when:
  - `workflowRunId` is `null`, empty string, or does not match `/^[0-9]+$/`.
  - `owner` or `repo` resolves to a falsy value.
- Otherwise returns `https://github.com/{owner}/{repo}/actions/runs/{workflowRunId}`.
- The helper is **pure** — no side effects beyond reading `process.env`.

### Test surface

- `buildInsightsRunUrl(null)` → `null`.
- `buildInsightsRunUrl('')` → `null`.
- `buildInsightsRunUrl('abc')` → `null` (non-numeric).
- `buildInsightsRunUrl('12345', 'me', 'r')` → `'https://github.com/me/r/actions/runs/12345'`.
- `buildInsightsRunUrl('12345')` with env vars unset → `null`.
- `buildInsightsRunUrl('12345')` with env vars set → composed URL.

---

## 7. `GET /api/admin/insights/reports` — response shape extension

**File**: `app/api/admin/insights/reports/route.ts`

### Response (extended additively)

```json
{
  "reports": [
    {
      "id": 42,
      "status": "FAILED",
      "generatedAt": "2026-05-14T10:00:00.000Z",
      "periodStart": "2026-05-07T00:00:00.000Z",
      "periodEnd": "2026-05-14T10:00:00.000Z",
      "sessionsCount": null,
      "ticketsCount": null,
      "artifactSize": null,
      "errorReason": "Workflow step failed; see workflow logs",
      "completedAt": "2026-05-14T10:02:11.000Z",
      "createdAt": "2026-05-14T10:00:00.000Z",
      "workflowRunId": "987654321"
    }
  ]
}
```

### Contract

- The endpoint contract (auth, reconciliation, 200-row cap, content shape) is
  unchanged except for the additive `workflowRunId: string | null` field on
  every entry.
- `workflowRunId` is non-null only when the underlying `Job.workflowRunId` is
  set (i.e., the workflow dispatch landed successfully or the row was created
  by a path that has since persisted the run ID).
- The endpoint does NOT add new query parameters, status codes, or error
  bodies.

### Polling cadence (unchanged)

- 15s while any RUNNING row is visible (existing `useInsightsReports`
  behavior) — FR-016.
