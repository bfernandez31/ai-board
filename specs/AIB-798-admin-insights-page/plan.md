# Implementation Plan: Admin Insights page cosmetic refresh and failed report diagnostics

**Branch**: `AIB-798-admin-insights-page` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-798-admin-insights-page/spec.md`

## Summary

Tighten the `/admin/insights` page so it lives inside the admin shell without
visual duplication (no internal `<h1>`, tab title becomes `"Insights LLM"`),
introduce a compact ~280px dense past-reports table on the left, and replace
the existing FAILED placeholder with a diagnostics panel that surfaces the
GitHub Actions workflow run link and a "Reessayer" retry button. The right
panel's "Run new analysis" button keeps every behavioral bit it has today.

Technical approach (from `research.md`):
- No new endpoints. The list endpoint is extended **additively** to expose
  `workflowRunId: string | null` (joined from `InsightsReport.job`).
- Two new components (`PastReportsTable`, `FailureDiagnosticsPanel`) + one
  pure helper (`buildInsightsRunUrl`). One additive prop on `RunAnalysisButton`.
- Two-column layout via `grid-cols-[280px_minmax(0,1fr)]`, stacking on `md:`.
- Document title via Next.js segment `export const metadata`.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node 22.20.0
**Primary Dependencies**: Next.js 16 (App Router) Server + Client Components, React 18, TanStack Query v5, shadcn/ui, lucide-react, Tailwind CSS 3.4, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma — read-only for this feature (no schema changes). Joins `InsightsReport.job.workflowRunId`.
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Browser (admin operators, desktop-first; degrades gracefully below tablet breakpoint)
**Project Type**: web (Next.js full-stack)
**Performance Goals**:
- Row click → right-panel swap ≤ 200 ms (SC-006)
- Existing 15s polling cadence preserved (FR-016)
- No additional network round trips beyond the existing list/preflight polls
**Constraints**:
- No new HTTP routes; the list response shape extension is additive
- No schema migrations (`Job.workflowRunId` already exists)
- All styling via Tailwind semantic tokens + `aurora-*` utilities (no hex/rgb literals — CLAUDE.md "Colors" rule)
- BigInt → string conversion at the API boundary (JSON-safe)
**Scale/Scope**:
- Up to 200 reports per render (existing cap in `app/lib/insights/repository.ts:17`)
- Single feature page + ≤3 new files + ≤4 modified files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Required behavior | This plan |
|-----------|-------------------|-----------|
| I — TypeScript-First | strict mode, no `any`, explicit typing on new props/return types | All new components have explicit prop interfaces; helper has explicit signature; no `any` introduced. ✓ |
| II — Component-Driven Architecture | shadcn/ui primitives only; Server Components by default; sub-component only when reused / has own state / parent > ~300 lines | `<RunAnalysisButton>` reuse > duplicate; new components extracted because (a) `PastReportsTable` has localized rendering of 200 rows and would push `InsightsReportView` past ~300 lines; (b) `FailureDiagnosticsPanel` composes a child button and renders a distinct sub-tree (cohesion). ✓ |
| III — TDD (NON-NEGOTIABLE) | Tests verify behavior; extend existing tests first; query priority `getByRole > getByLabelText > getByText > getByTestId`; assertions outside conditional blocks | Plan extends 3 existing test files first, adds 3 new test files only for genuinely new components/helpers (see "Existing Files" in `research.md`). All new tests use role/label queries. ✓ |
| IV — Security-First | Validate inputs; Prisma parameterized; no secrets in responses; cross-origin link safety | The new field is read-only from DB; the GH link uses `target="_blank" rel="noopener noreferrer"` (P-5); `workflowRunId` is opaque (not a secret); env vars are read server-side. ✓ |
| V — Database Integrity | Migrations via Prisma; transactions for multi-step; soft deletes for user content | No DB writes, no migrations, no transactions added. ✓ |
| V (clarification guardrails) | Auto-resolved decisions documented; PRAGMATIC retains safeguards | All auto-resolved decisions are in `spec.md` and re-referenced in `research.md` (D-1..D-9). No safeguard is trimmed. ✓ |

**Result**: PASS. No violations; no entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```
specs/AIB-798-admin-insights-page/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── component-contracts.md  # Phase 1 output
└── checklists/          # (existing, empty)
```

### Source Code (repository root)

```
app/
├── admin/
│   └── insights/
│       └── page.tsx                            # MODIFY: add `export const metadata = { title: 'Insights LLM' }`; flow new field through
└── lib/
    └── insights/
        └── repository.ts                       # MODIFY: include job.workflowRunId, extend ReportListEntry, extend toListEntry

components/
└── admin/
    └── insights/
        ├── insights-report-view.tsx            # MODIFY: remove H1, two-column grid, swap FAILED placeholder for diagnostics panel
        ├── past-reports-table.tsx              # NEW: dense table component
        ├── failure-diagnostics-panel.tsx       # NEW: FAILED right-panel composition
        ├── run-analysis-button.tsx             # MODIFY: add optional `label?: string` prop
        └── report-error-placeholder.tsx        # UNCHANGED: still used for RUNNING / empty / missing-blob cases

lib/
└── admin/
    └── insights-github-url.ts                  # NEW: pure helper buildInsightsRunUrl

tests/
├── unit/
│   ├── admin/
│   │   └── insights-github-url.test.ts         # NEW: pure helper tests
│   └── components/
│       └── admin/
│           └── insights/
│               ├── insights-report-view.test.tsx                  # EXTEND
│               ├── insights-report-view-list-selection.test.tsx   # EXTEND
│               ├── past-reports-table.test.tsx                    # NEW
│               └── failure-diagnostics-panel.test.tsx             # NEW
└── e2e/
    └── admin/
        └── insights-flow.spec.ts                                  # EXTEND: tab title + no internal H1 assertions
```

**Structure Decision**: Single Next.js web application (Option 2 collapsed —
`app/` is both backend routes and frontend pages in App Router). The existing
admin feature folder `components/admin/insights/` is the canonical home for
this feature's UI; the pure helper goes under `lib/admin/` alongside the
sibling `lib/admin/active-path.ts`.

## Phase 0 — Outline & Research

Complete. See `research.md` for:
- Decisions D-1..D-9 (additive field, GH URL helper, client-only selection, segment metadata, grid layout, button reuse, compact formatters, title scope)
- Existing Files inventory (every path the plan touches)
- Patterns to Follow P-1..P-6 (mutation pattern, active-state classes, active-path carve-out, repository read shape, cross-origin link safety, atomic transitions)
- No outstanding `NEEDS CLARIFICATION`.

## Phase 1 — Design & Contracts

Complete. Outputs:
- `data-model.md` — additive `ReportListEntry.workflowRunId: string | null`; no schema migration; BigInt → string at API boundary.
- `contracts/component-contracts.md` — props and DOM contracts for `InsightsReportView`, the new `PastReportsTable`, the new `FailureDiagnosticsPanel`, the extended `RunAnalysisButton`, the `buildInsightsRunUrl` helper, and the extended `GET /api/admin/insights/reports` response.
- Agent context updated via `update-agent-context.sh claude`.

No workflow/agent artifacts are required — the spec contains no Internal
Processes (the feature is UI-only with one reused dispatch endpoint).

## Implementation Phases (sketch — full task list lives in `tasks.md`)

Each phase below references real paths from the Phase 0 inventory. The
explicit pattern references (P-1, P-2, …) point at the line numbers in
`research.md` so a contributor never has to guess "follow existing patterns".

### Phase A — Data plumbing (one repository extension)

1. `app/lib/insights/repository.ts`:
   - Extend `listReports` to `include: { job: { select: { workflowRunId: true } } }`.
   - Update `ReportListEntry` interface to add `workflowRunId: string | null`.
   - Update `toListEntry` signature to accept the joined shape and emit
     `workflowRunId: row.job?.workflowRunId?.toString() ?? null` (P-4).
2. `components/admin/insights/run-analysis-button.tsx`: in
   `buildOptimisticEntry`, set `workflowRunId: null` so the optimistic
   `ReportListEntry` typechecks (P-1).
3. No new endpoint; `GET /api/admin/insights/reports` flows the new field
   through `toListEntry` automatically.

### Phase B — Pure helper (`buildInsightsRunUrl`)

1. Create `lib/admin/insights-github-url.ts` with the signature from
   `contracts/component-contracts.md §6`.
2. Create `tests/unit/admin/insights-github-url.test.ts` covering all six
   contract cases. Pure-function tests — no DOM, no providers.

### Phase C — New presentational components

1. `components/admin/insights/past-reports-table.tsx`:
   - Props per `contracts §3`.
   - Row template: four columns (Date, Period, Status, Duration); selected
     row classes from P-2; row height `[30, 36]` px; internal scroll
     wrapper.
   - Colocate `formatCompactPeriod`, `formatCompactDuration`, `formatDateFull`
     helpers (D-7, D-8).
2. `components/admin/insights/failure-diagnostics-panel.tsx`:
   - Props per `contracts §4`.
   - Reuses `<RunAnalysisButton label="Reessayer" …>` (D-6, P-1).
   - GH link: `<a target="_blank" rel="noopener noreferrer">` (P-5).
   - `whitespace-pre-wrap` for `errorReason`.

### Phase D — `InsightsReportView` refresh

1. `components/admin/insights/insights-report-view.tsx`:
   - Remove the page-internal `<h1>Claude Code Insights</h1>` and the
     `<p className="text-sm text-muted-foreground">Shipped Claude tickets…</p>`
     wrapper (the preflight shipped-tickets line moves into the metadata card
     or is dropped — preserve only the metadata phrasing of the **selected**
     report per FR-004).
   - Wrap content in `<div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-6">`.
   - Left column: `<PastReportsTable rows={reports} selectedId={selectedId} onSelect={setSelectedId} />` or the existing empty state when `reports.length === 0`.
   - Right column: existing metadata card + body switcher, but FAILED branch
     now renders `<FailureDiagnosticsPanel report={display} preflight={…} latestIsRunning={latestIsRunning} />`.
   - Top-right of the right column: `<RunAnalysisButton …>` unchanged.
   - All existing hooks (`useInsightsReports`, `useInsightsPreflight`,
     `useState<number | null>`, `useMemo` for selection/default) preserved
     verbatim.

### Phase E — Page metadata + integration

1. `app/admin/insights/page.tsx`: add `import type { Metadata } from 'next';`
   and `export const metadata: Metadata = { title: 'Insights LLM' };` (D-4).
2. No other change — the page already calls reconciliation (FR-020) and
   already renders inside the admin shell via `app/admin/layout.tsx` (FR-001).

### Phase F — Tests

See "Existing Files → Tests" in `research.md`. Order of operations:
1. Update `insights-report-view.test.tsx`:
   - Replace the "FAILED placeholder" assertion with one that asserts the new
     diagnostics panel (`getByRole('link', { name: /workflow run/i })`,
     `getByRole('button', { name: /Reessayer/i })`, `errorReason` text).
   - Add: no element with role `heading` matching `/claude code insights/i`.
2. Update `insights-report-view-list-selection.test.tsx`:
   - Clicking a FAILED row with `workflowRunId='12345'` reveals the link
     pointing at the composed URL.
   - Clicking a FAILED row with `workflowRunId=null` shows the fallback text
     and no link.
   - Selected row has `aria-pressed="true"` after clicking.
3. New `past-reports-table.test.tsx`:
   - Renders four columns in order.
   - Duration cell is blank for RUNNING/FAILED, populated for COMPLETED.
   - Compact period formatting matches the three D-7 cases.
   - Clicking a row calls `onSelect`.
   - Selected row has both `bg-accent/30` and `border-l-2 border-primary` (P-2).
4. New `failure-diagnostics-panel.test.tsx`:
   - Link presence/absence based on `workflowRunId`.
   - Link `target="_blank" rel="noopener noreferrer"` (P-5).
   - `errorReason` whitespace preserved (multi-line text).
   - "Reessayer" button is the existing `RunAnalysisButton` (assert via
     `aria-disabled` reflecting the passed preflight state).
5. New `insights-github-url.test.ts`: six pure-function cases per `contracts §6`.
6. Update `insights-flow.spec.ts` (Playwright):
   - Assert `await expect(page).toHaveTitle(/Insights LLM/)` (FR-003).
   - Assert no `<h1>` matching `/claude code insights/i` (FR-002).
   - Keep the iframe assertion.

### Phase G — Manual verification (UI sanity)

Per CLAUDE.md "For UI or frontend changes, start the dev server and use the
feature in a browser before reporting the task as complete":
1. `bun run dev`
2. Log in as admin (`x-test-user-id` header or `E2E_ADMIN_HEADER`).
3. Visit `/admin/insights`. Confirm:
   - Tab title is `Insights LLM`.
   - No internal H1 reads "Claude Code Insights".
   - Sidebar item `Insights LLM` is marked active (background tint + left
     border).
   - Past-reports table is on the left (~280px), dense rows.
   - Clicking a COMPLETED row swaps the iframe.
   - Clicking a FAILED row reveals the GH Actions link (or fallback) and
     the "Reessayer" button.
   - Clicking "Reessayer" with a RUNNING row present surfaces the same
     `ALREADY_RUNNING` refusal as the top-right button.
   - Toggle theme; all new elements adapt (no hex literals).
   - Resize narrow; panels stack vertically.

## Testing Strategy

Per constitution §III, default to the fastest sufficient layer and reuse
existing files.

| Concern | Layer | File |
|---------|-------|------|
| Pure helpers (`formatCompactPeriod`, `formatCompactDuration`, `buildInsightsRunUrl`) | Vitest unit | `tests/unit/components/admin/insights/past-reports-table.test.tsx` (colocated helpers) + `tests/unit/admin/insights-github-url.test.ts` (helper file) |
| `<PastReportsTable>` rendering & selection | Vitest + RTL component | NEW `tests/unit/components/admin/insights/past-reports-table.test.tsx` |
| `<FailureDiagnosticsPanel>` rendering & link contract | Vitest + RTL component | NEW `tests/unit/components/admin/insights/failure-diagnostics-panel.test.tsx` |
| `<InsightsReportView>` two-column layout + body switch + no H1 | Vitest + RTL component (extend) | `tests/unit/components/admin/insights/insights-report-view.test.tsx` |
| Row click → right panel update | Vitest + RTL component (extend) | `tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx` |
| Trigger mutation behavior (`canTrigger`, `ALREADY_RUNNING`, `NO_NEW_SHIPPED`, dispatch failure) | Existing — Vitest | `tests/unit/components/admin/insights/run-analysis-button*.test.tsx` (or wherever current regression suite lives) — re-run unchanged (SC-010) |
| Tab title, no internal H1, sidebar active state | Playwright E2E (extend) | `tests/e2e/admin/insights-flow.spec.ts` |

**Tests we deliberately do NOT add**:
- A separate "Reessayer triggers same mutation" Vitest integration test:
  covered by reusing `RunAnalysisButton` — the existing button test matrix
  already proves the mutation; the new panel test only needs to assert the
  button is present and receives the expected props.
- API integration test for the new field: the additive shape is verified by
  the component tests (which mock the response) and TypeScript at the
  endpoint boundary — adding a separate `tests/integration/admin/insights-reports.test.ts`
  would duplicate the existing endpoint test for a one-field extension.
- A new responsive snapshot test file: SC-012 is acceptance-checked manually
  in Phase G plus a single component-test assertion against the wrapper
  classes.

## Complexity Tracking

*Filled ONLY if Constitution Check has violations.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _(none)_ | _(none)_ | _(none)_ |

## Post-design Constitution Re-check

After completing Phase 1 (`data-model.md` + `contracts/component-contracts.md`)
the design still satisfies every constitutional rule recorded in §"Constitution
Check" above:
- No `any` introduced; the new `workflowRunId` field is strictly typed.
- New components are extracted under the published thresholds (parent file
  would exceed ~300 lines if the table were left inline; the diagnostics
  panel has its own composition).
- Test files map 1:1 to new components; existing tests are extended before
  new ones are created.
- No new DB writes, secrets, or non-Tailwind colors.
- Auto-resolved decisions remain documented in `spec.md` and `research.md`.

**Result**: PASS post-design. The plan is ready for `/ai-board.tasks`.
