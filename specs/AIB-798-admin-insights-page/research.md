# Research: Admin Insights page cosmetic refresh and failed report diagnostics

**Feature**: AIB-798 — cosmetic refresh of `/admin/insights` + FAILED report diagnostics
**Branch**: `AIB-798-admin-insights-page`
**Date**: 2026-05-14

This document records the existing files that will be modified or read by the
implementation, the patterns we MUST follow from those files, and the design
decisions resolved before writing `plan.md`. It is the load-bearing prerequisite
for the Implementation Phases and Testing Strategy sections of the plan — those
sections reference real paths captured here rather than inventing new ones.

---

## Decisions

### D-1 — No new endpoints; refresh is a pure UI change with one data-shape extension

- **Decision**: The cosmetic refresh adds no new HTTP routes. The right-panel
  FAILED diagnostics view consumes `Job.workflowRunId` for the failed report's
  underlying job, which is already persisted but is NOT currently exposed by
  `GET /api/admin/insights/reports`. We extend `ReportListEntry` (the response
  shape returned by `listReports` + `toListEntry`) with `workflowRunId: string
  | null` so the existing list endpoint becomes the single source for the
  panel.
- **Rationale**:
  - The data already exists on `Job.workflowRunId` (BigInt, nullable) and is
    persisted by the existing dispatch path.
  - Adding a separate `GET /api/admin/insights/reports/:id/job` endpoint would
    double the polling traffic and force the client to coordinate two queries
    per row click.
  - Returning `workflowRunId` as a `string` keeps the JSON shape stable across
    JavaScript clients (BigInt is not JSON-serializable) and matches the way
    other workflow IDs are surfaced in admin API responses.
- **Alternatives considered**:
  - Dedicated `GET /api/admin/insights/reports/:id/diagnostics`: rejected as
    over-engineering — the list endpoint already enumerates rows and is
    polled at 15s for the dense table.
  - Server-render the GH URL into a hidden DOM attribute: rejected because the
    client needs the raw `workflowRunId` to compose links at click time, and
    SSR-only props don't survive the 15s polling refetch.

### D-2 — GitHub Actions URL is composed from the existing `GITHUB_OWNER`/`GITHUB_REPO` env vars

- **Decision**: A new pure helper `lib/admin/insights-github-url.ts` exports
  `buildInsightsRunUrl(workflowRunId: string | null): string | null` that reads
  `process.env.GITHUB_OWNER` and `process.env.GITHUB_REPO` and returns
  `https://github.com/{owner}/{repo}/actions/runs/{workflowRunId}` or `null`
  when any input is missing.
- **Rationale**:
  - `GITHUB_OWNER` / `GITHUB_REPO` are the canonical env vars already used by
    every centralized-workflow dispatch (`app/lib/workflows/dispatch-ai-board.ts:48-49`,
    `app/api/admin/insights/trigger/route.ts:107-108,156-157`). Reusing them
    keeps a single source of truth.
  - Returning `null` rather than a fabricated guess satisfies the spec's
    fallback rule when `workflowRunId` is null OR env vars are missing.
  - Pure helper makes unit testing trivial and avoids leaking env reads into
    the React tree.
- **Alternatives considered**:
  - Hard-coding the AI-BOARD owner/repo in a constant: rejected — the project
    already centralizes that pair in env vars and dev/preview environments
    may legitimately point at forks.
  - Computing the URL server-side in the page render only: rejected —
    polling-driven row clicks need to recompose URLs after refresh.

### D-3 — Selection state lives in client memory only; no URL params

- **Decision**: The dense table reuses the existing `useState<number | null>`
  selection pattern in `components/admin/insights/insights-report-view.tsx:98`.
  Refreshes reset to the default selection (latest COMPLETED, or latest row
  if none is COMPLETED), exactly as today.
- **Rationale**: Matches spec's Auto-Resolved Decision; minimal blast radius;
  no router/searchParams churn.
- **Alternatives considered**: URL-addressable selection (`?report=42`) —
  deferred to a follow-up; not required by FR-010.

### D-4 — Tab title is set via Next.js segment-level `export const metadata` on the page

- **Decision**: `app/admin/insights/page.tsx` exports
  `export const metadata: Metadata = { title: 'Insights LLM' }`.
- **Rationale**:
  - Next.js App Router's segment metadata flows through to `<title>` without
    requiring a client-side `document.title` write.
  - The page is already a Server Component returning a tree; adding the
    `metadata` export is a one-line change with no runtime cost.
  - The root layout sets `title: 'AI Board'`; segment-level metadata wins for
    routes under `/admin/insights`.
- **Alternatives considered**:
  - Client-side `useEffect(() => { document.title = 'Insights LLM' })`:
    rejected — produces a brief tab-title flash on SSR pages and bypasses the
    framework's title-merging behavior.
  - Setting the title from the `AdminShell`: rejected — would force every
    admin page to share one title; `/admin` (Accueil) and `/admin/insights`
    must differ.

### D-5 — Layout: CSS grid with a 280px fixed left column collapses to stack below tablet

- **Decision**: The two-panel content uses a `grid` whose desktop template is
  `grid-cols-[280px_minmax(0,1fr)]` and `grid-cols-1` below the tablet
  breakpoint (`md:`). The reports table is wrapped in `max-h-[…] overflow-y-auto`
  so its height never pushes the right panel off-screen.
- **Rationale**:
  - Grid avoids flex-grow rounding artifacts that would push the left panel's
    width off the 280px target.
  - The existing `AdminShell` `<main className="flex-1 p-6">` already provides
    the page-level padding; the new layout slots inside it.
  - Stacking below `md:` matches the admin sidebar's existing `md:flex-row`
    pattern (`components/admin/admin-shell.tsx:24`).
- **Alternatives considered**:
  - Resizable split using a drag handle: rejected — out of scope and adds a
    new component dependency.
  - Hide-behind-drawer on narrow viewports: rejected per spec auto-resolved
    decision (stacked, not drawer).

### D-6 — "Reessayer" reuses the existing `RunAnalysisButton` component (same mutation, same preflight)

- **Decision**: The FAILED diagnostics panel composes the existing
  `RunAnalysisButton` (from `components/admin/insights/run-analysis-button.tsx`)
  rather than introducing a parallel mutation hook. The button receives the
  same `preflight` and `latestIsRunning` props the top-right button gets, and
  is labeled "Reessayer" via an optional `label` prop added to the button.
- **Rationale**:
  - Eliminates any chance of the two buttons drifting on refusal codes,
    optimistic updates, or polling resumption (SC-009 / SC-010).
  - The mutation already prepends the optimistic RUNNING row to the reports
    list via `insightsReportsQueryKey`; reusing it keeps the table in sync
    automatically.
- **Alternatives considered**:
  - Duplicate the mutation inline in the FAILED panel: rejected — violates
    "Search existing tests FIRST — extend, don't duplicate" and would create
    a refusal-code drift risk on each spec change.
  - Extract the mutation into a shared hook (`useTriggerInsightsRun`):
    deferred — the existing button is the only caller and the extraction
    adds an abstraction without a second consumer.

### D-7 — Compact period formatting is a pure helper colocated with the table

- **Decision**: A new pure helper `formatCompactPeriod(start: string, end:
  string): string` lives next to the new table component (in the same file
  to start with; extracted if reused). It returns `M/D` for same-day, `M/D →
  M/D` for in-year, `M/D/YY → M/D/YY` across years.
- **Rationale**: Spec auto-resolved decision; no locale formatting beyond
  what the current `toISOString().slice(0,10)` already does; co-location
  keeps the table component cohesive without a premature `lib/` file.
- **Alternatives considered**: Use `Intl.DateTimeFormat` — rejected as overkill
  for a fixed `M/D` shape and would introduce locale-sensitivity bugs.

### D-8 — Duration formatting compacts to `Nm` / `Hh Mm`, blank for non-COMPLETED rows

- **Decision**: A new pure helper `formatCompactDuration(createdAt: string,
  completedAt: string | null, status: InsightsRunStatus): string` returns:
  - `""` (blank) when `status !== 'COMPLETED'` or `completedAt` is null
  - `"<1s"` when `completedAt - createdAt < 1000ms`
  - `"Ns"` for 1–59s, `"Nm"` for 1–59m, `"Hh Mm"` for ≥1h
- **Rationale**: Matches spec auto-resolved decision; pure function, trivially
  unit-tested.
- **Alternatives considered**: Use a library like `date-fns/formatDuration` —
  rejected to avoid adding a dependency for one display surface.

### D-9 — Document title via segment `metadata` overrides the root `'AI Board'` only inside `/admin/insights`

- **Decision**: Setting `metadata.title = 'Insights LLM'` on the page applies
  *only* to `/admin/insights`. `/admin` (Accueil) inherits the root layout
  title or sets its own. No tabs-titling regression elsewhere.
- **Rationale**: Verified via root layout reading (`app/layout.tsx:36-43`) — it
  exports `metadata.title = 'AI Board'` which Next.js merges with the page
  segment's title to produce `"Insights LLM"` (page title replaces the root
  string by default; the `title.template` slot is not configured).
- **Alternatives considered**: Configure `title.template` at the layout level —
  out of scope for AIB-798 and would touch the root layout.

---

## Existing Files

The files below are the entire surface area touched by this feature. Every
implementation task in the plan references a path from this inventory; no
new file is introduced unless an existing one cannot cover the responsibility.

### Source (read or modify)

| Path | What it covers | Action |
|------|----------------|--------|
| `app/admin/insights/page.tsx` | Server Component that reconciles orphans, lists reports, computes preflight, and renders `<InsightsReportView>`. | **Modify**: add `export const metadata = { title: 'Insights LLM' }` (FR-003). Pull `workflowRunId` through the new `toListEntry` shape (FR-012). |
| `app/admin/layout.tsx` | Admin shell wrapper (allowlist guard + `<AdminShell>`). | **Read-only**: confirms the page already renders inside the shell — no change needed for FR-001. |
| `components/admin/admin-shell.tsx` | Renders the admin sidebar + `<main>` content area; active-state classes `'bg-accent/30 border-l-2 border-primary'`. | **Read-only**: pattern reference for table row selection styling (FR-009). |
| `components/admin/admin-sidebar-items.ts` | Sidebar entries (`Accueil`, `Insights LLM`). | **Read-only**: confirms `'Insights LLM'` is the canonical label. |
| `components/admin/insights/insights-report-view.tsx` | The current single-column view with H1, metadata card, body, and `<ul>` past-reports list. | **Modify** (major): remove the H1 (FR-002), replace the `<ul>` list with the dense table component, switch to two-column grid (FR-005, FR-006), pass `workflowRunId` to the FAILED panel. Reuse `selectedId`/`setSelectedId` and the `latestCompleted ?? reports[0]` default-display logic verbatim. |
| `components/admin/insights/run-analysis-button.tsx` | Trigger mutation with optimistic RUNNING insertion. | **Modify** (minimal): add an optional `label?: string` prop so the FAILED panel can render the button as "Reessayer" (default remains "Run new analysis"). All mutation logic untouched (FR-014, SC-009). |
| `components/admin/insights/report-error-placeholder.tsx` | Generic placeholder card for RUNNING / missing-blob / FAILED. | **Read-only**: kept verbatim for RUNNING and missing-blob cases; FAILED state moves to the new diagnostics panel. |
| `app/lib/insights/repository.ts` | `listReports`, `toListEntry`, `ReportListEntry`. | **Modify**: change `listReports` to `include: { job: { select: { workflowRunId: true } } }` and extend `toListEntry` to emit `workflowRunId: string | null`. Update `ReportListEntry` interface (FR-012, D-1). |
| `app/api/admin/insights/reports/route.ts` | List endpoint returning `{ reports: ReportListEntry[] }`. | **Read-only**: no body change; the response shape extension flows through `toListEntry`. The endpoint stays at 200 row cap (no pagination change). |
| `app/api/admin/insights/trigger/route.ts` | The trigger endpoint that "Reessayer" reuses. | **Read-only**: confirms refusal codes and 201/409/502 contract (FR-014, D-6). |
| `lib/admin/active-path.ts` | `isAdminItemActive` — exact-match + child-path matcher. | **Read-only**: pattern reference confirming the sidebar marks `/admin/insights` active (FR-001 acceptance). |

### Source (new — only when no existing file covers the responsibility)

| Path | Responsibility | Why a new file |
|------|----------------|-----------------|
| `components/admin/insights/past-reports-table.tsx` | Renders the dense 4-column table with date / period / status / duration, selection indicator, internal scroll. | No existing file owns the dense-table rendering; extracting it from `InsightsReportView` keeps the parent under the 300-line constitutional threshold and lets the table be unit-tested in isolation. |
| `components/admin/insights/failure-diagnostics-panel.tsx` | Renders the FAILED right-panel: inline `errorReason`, GH Actions link (or fallback text), "Reessayer" button. | No existing file owns failure diagnostics; the panel composes `RunAnalysisButton`. The current `ReportErrorPlaceholder` is intentionally generic and would need branching that violates its single responsibility. |
| `lib/admin/insights-github-url.ts` | Pure helper `buildInsightsRunUrl(workflowRunId, owner?, repo?)`. | The GH Actions URL composition is reused by both the panel and tests; co-locating with `lib/admin/active-path.ts` keeps admin-specific pure helpers in one place. |

### Tests (extend before creating)

The constitution requires "Search existing tests FIRST — extend, don't
duplicate." Every test addition in the plan reuses one of the following:

| Path | Coverage today | Extend with |
|------|----------------|--------------|
| `tests/unit/components/admin/insights/insights-report-view.test.tsx` | Renders the iframe, metadata phrasing, empty state, FAILED placeholder for the **previous** list-style view. | Update FAILED expectation: now sees the new diagnostics panel; add cases for absence of the H1 (FR-002), presence of two columns (FR-005), and that the metadata card still renders. |
| `tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx` | List selection swapping iframe src; clicking FAILED / RUNNING / COMPLETED rows. | Add: clicking a FAILED row surfaces the GH Actions link, "Reessayer" button, and inline `errorReason` with preserved whitespace; clicking a row that has `workflowRunId === null` omits the link; selection indicator (`aria-pressed=true` + active classes) moves on click. |
| `tests/e2e/admin/insights-flow.spec.ts` | Non-admin → 404; admin → metadata phrasing + sandboxed iframe. | Update to assert: tab title is `'Insights LLM'` (FR-003), no internal H1 "Claude Code Insights" (FR-002), sidebar item active (FR-001). Keep the iframe assertion. |

| New test file | Why it cannot extend an existing one |
|---------------|--------------------------------------|
| `tests/unit/components/admin/insights/past-reports-table.test.tsx` | The new `<PastReportsTable>` is a standalone component with its own props contract (rows, selectedId, onSelect, formatting). Tests of formatting helpers, row-height range, column order, and selection styling belong here — mixing them into `insights-report-view-list-selection.test.tsx` would expand that file beyond its single concern. |
| `tests/unit/components/admin/insights/failure-diagnostics-panel.test.tsx` | The new panel composes `RunAnalysisButton` and emits the GH Actions link. Its tests assert: `target="_blank" rel="noopener noreferrer"` on the link, fallback text when `workflowRunId === null`, `errorReason` whitespace preservation, and that the "Reessayer" button dispatches the same mutation. Folding into the parent view test would mix the new panel's surface with the parent's layout assertions. |
| `tests/unit/admin/insights-github-url.test.ts` | Pure helper unit tests — wrong location for component-test-utils, belongs next to other admin pure-helper tests (none today, but the pattern matches `lib/admin/active-path.ts` whose tests live in `tests/unit/admin/active-path.test.ts` if present, otherwise a new sibling test file). |

> Note: the existing `tests/unit/admin-components/insights-page.test.tsx`
> targets `components/admin/insights-page` (an older sibling file), NOT the
> live `/admin/insights` page tree. We leave it untouched — the live view is
> covered by the files in `tests/unit/components/admin/insights/`.

---

## Patterns to Follow

### P-1 — Optimistic mutation + invalidation pattern (RunAnalysisButton)

**Reference**: `components/admin/insights/run-analysis-button.tsx:63-111`

The trigger mutation:
1. `onMutate` cancels in-flight reports query, snapshots previous data, prepends
   an optimistic RUNNING row keyed by sentinel id `-1`.
2. `onSuccess` clears the local error message and invalidates both
   `insightsReportsQueryKey` and `insightsPreflightQueryKey`.
3. `onError` restores the snapshot and surfaces the message in a local
   `useState`.

**How to apply**: The FAILED diagnostics panel MUST reuse `RunAnalysisButton`
unchanged for the "Reessayer" button (D-6). It MUST NOT duplicate the mutation
hook — every refusal code, every optimistic insertion, every error path must
remain identical so SC-009/SC-010 hold.

### P-2 — Active-state visual convention (AdminShell sidebar)

**Reference**: `components/admin/admin-shell.tsx:38-50`

The admin sidebar marks the active item with:
- `bg-accent/30` (subtle background tint)
- `border-l-2 border-primary` (left-edge lateral indicator)
- `aria-current="page"` + `data-active="true"` attributes

**How to apply**: The past-reports table row marks the currently selected row
with the same two classes (FR-009). Use `aria-pressed="true"` for the row
(it's a `<button>` semantically, like today), and add `data-selected="true"`
for unit-test selectors. The inactive state stays at `hover:bg-accent` to
parallel the sidebar's non-active hover.

### P-3 — Active-path matcher carve-out (active-path)

**Reference**: `lib/admin/active-path.ts:1-8`

The sidebar's `isAdminItemActive` exact-matches `/admin` (so it never claims
nested admin routes) but allows child-path matching for non-root entries.

**How to apply**: No change required for this feature — `/admin/insights`
already matches the sidebar's `Insights LLM` entry. Mentioned here so a
future contributor doesn't accidentally regress the carve-out when touching
adjacent code.

### P-4 — Repository read returning a stable `ReportListEntry` shape

**Reference**: `app/lib/insights/repository.ts:43-168`

`listReports` returns `InsightsReport[]` (Prisma rows). `toListEntry` maps
each row to a JSON-safe `ReportListEntry` excluding `artifactKey` (which is
fetched separately via `/html`) and serializing `DateTime` to ISO strings.

**How to apply**:
- `listReports` MUST be extended to `include: { job: { select: { workflowRunId:
  true } } }` so a single DB query gets the new field.
- `toListEntry` MUST accept the new shape `(row: InsightsReport & { job: { workflowRunId: bigint | null } | null })` and emit `workflowRunId: row.job?.workflowRunId?.toString() ?? null`.
- `ReportListEntry` MUST gain `workflowRunId: string | null`.
- Callers of `toListEntry` in `app/admin/insights/page.tsx` and the API route
  flow through unchanged because the new field is additive.

### P-5 — Cross-origin link safety (anchor patterns elsewhere)

**Reference**: project convention (search before implementing — no canonical
single example; the GH Actions link is the first external link of its kind on
this page).

**How to apply**: The GH Actions link MUST have `target="_blank"` and
`rel="noopener noreferrer"`. This is the standard Next.js / React safety
pattern for cross-origin anchors and is required by FR-012.

### P-6 — Atomic state-transition pattern (repository status flips)

**Reference**: `app/lib/insights/repository.ts:120-134` (`markFailed`)

State transitions go through `updateMany({ where: { id, status: 'RUNNING' } })`
so a late callback can never flip a row backwards.

**How to apply**: NOT a code path this feature touches (we make no state
transitions in AIB-798 — we only display existing state). Recorded here so
the reviewer can confirm we are not inadvertently adding a non-atomic state
write while wiring the FAILED panel.

---

## NEEDS CLARIFICATION

None. All design questions are resolved by the auto-resolved decisions in
`spec.md` or by the decisions above. The plan proceeds directly to Phase 1.
