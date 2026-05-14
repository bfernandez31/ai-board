---
description: "Dependency-ordered task list for AIB-798 — Admin Insights page cosmetic refresh and failed report diagnostics"
---

# Tasks: Admin Insights page cosmetic refresh and failed report diagnostics

**Input**: Design documents from `/specs/AIB-798-admin-insights-page/`
**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md (loaded — provides "Existing Files" inventory), data-model.md (loaded), contracts/component-contracts.md (loaded)

**Tests**: Test tasks included by default (constitution §III). Order within each story is **Tests → Implementation**.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Every file path below was validated against the filesystem (existing) or justified as new in `research.md` "Existing Files → Source (new)".

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1, US2, US3, US4)
- Each task includes an exact file path

## Path Conventions (this repo)

- App routes / server pages: `app/...`
- React components: `components/...`
- Pure helpers: `lib/...` and `app/lib/...`
- Tests: `tests/unit/...`, `tests/e2e/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm prerequisite tooling. No new dependencies are required for AIB-798 (no schema change, no new package).

- [X] T001 ✅ DONE Confirm baseline checks pass before any code change by running `bun run type-check` and `bun run lint` from the repo root (no edits in this task — establishes the green baseline so later phases attribute failures correctly)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the read-only data shape (`ReportListEntry.workflowRunId`) that **US2** (the dense table consumes `ReportListEntry[]`) and **US3** (the diagnostics panel needs `workflowRunId`) both depend on. Decisions: D-1, P-4.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T002 ✅ DONE In `app/lib/insights/repository.ts`: (a) extend `listReports` to use `include: { job: { select: { workflowRunId: true } } }`; (b) extend the exported `ReportListEntry` interface with `workflowRunId: string | null`; (c) extend `toListEntry`'s row parameter type to `InsightsReport & { job: { workflowRunId: bigint | null } | null }` and emit `workflowRunId: row.job?.workflowRunId?.toString() ?? null` (per data-model.md "Serialization note" and research.md P-4)
- [X] T003 ✅ DONE [P] In `components/admin/insights/run-analysis-button.tsx`: update `buildOptimisticEntry` to set `workflowRunId: null` on the returned `ReportListEntry` so the optimistic RUNNING insertion typechecks against the extended interface (data-model.md "Backwards compatibility")

**Checkpoint**: `ReportListEntry` now carries `workflowRunId`; the optimistic insertion path is type-safe. User stories can begin in parallel.

---

## Phase 3: User Story 1 — Admin shell integration, no internal H1, tab title "Insights LLM" (Priority: P1) 🎯 MVP

**Goal**: `/admin/insights` renders inside the admin shell with the sidebar `Insights LLM` entry active, no page-internal `<h1>Claude Code Insights</h1>`, and the browser tab title reads `Insights LLM` (FR-001, FR-002, FR-003, SC-001, SC-002, SC-003).

**Independent Test**: Click `Insights LLM` in the admin sidebar; confirm URL is `/admin/insights`, the global header and admin sidebar are present, the sidebar item is in the active state (background tint + left-edge indicator from AIB-796), no element with role `heading` matches `/claude code insights/i`, and the document `<title>` is `Insights LLM`.

### Tests for User Story 1

**RULE (constitution): "Search existing tests FIRST — extend, don't duplicate."** Use the real test files in research.md "Existing Test Files".

- [ ] T004 [P] [US1] Extend `tests/e2e/admin/insights-flow.spec.ts`: add `await expect(page).toHaveTitle(/Insights LLM/)` (FR-003) and assert no element with role `heading` matching `/claude code insights/i` (FR-002); keep all existing iframe/admin-shell assertions intact
- [ ] T005 [P] [US1] Extend `tests/unit/components/admin/insights/insights-report-view.test.tsx`: add an assertion that the rendered tree contains **no** element with role `heading` matching `/claude code insights/i` (FR-002)

### Implementation for User Story 1

- [ ] T006 [US1] In `app/admin/insights/page.tsx`: add `import type { Metadata } from 'next';` and `export const metadata: Metadata = { title: 'Insights LLM' };` near the top of the file (D-4, FR-003)
- [ ] T007 [US1] In `components/admin/insights/insights-report-view.tsx`: remove the page-internal `<h1>Claude Code Insights</h1>` and the adjacent subtitle `<p className="text-sm text-muted-foreground">…</p>` wrapper; preserve the metadata card phrasing of the **selected** report (FR-004)

**Checkpoint**: US1 is complete and independently testable. The page renders inside the admin shell, has no duplicate title, and the tab title is correct.

---

## Phase 4: User Story 2 — Dense past-reports table on the left, in-place row selection (Priority: P1)

**Goal**: A ~280px left panel renders past reports as a dense table (rows 30–36px tall, four columns: Date / Period / Status / Duration) with the currently displayed row visually marked. Clicking a row swaps the right-side content in place without a full page reload (FR-005..FR-010, SC-004..SC-006, edge cases for 200-row cap and narrow viewport).

**Independent Test**: With ≥5 reports in mixed statuses, render `/admin/insights`. Confirm: the left panel column resolves to `[260, 300]` CSS pixels, each row's height falls in `[30, 36]` px for ≥95% of rows, the four columns appear in order, the selected row carries `bg-accent/30` + `border-l-2 border-primary` (P-2) AND `aria-pressed="true"`, clicking another row updates the right panel and the selection indicator in <200 ms without a `navigationStart` increment.

### Tests for User Story 2

- [ ] T008 [P] [US2] Create `tests/unit/components/admin/insights/past-reports-table.test.tsx` covering: (a) four columns rendered in order Date / Period / Status / Duration; (b) Duration cell is blank for RUNNING and FAILED rows, populated for COMPLETED rows; (c) compact period formatting matches the three D-7 cases (same-day `M/D`, in-year `M/D → M/D`, cross-year `M/D/YY → M/D/YY`); (d) clicking a row calls `onSelect(row.id)`; (e) the row matching `selectedId` carries `bg-accent/30`, `border-l-2 border-primary`, AND `aria-pressed="true"` (P-2 / FR-009)
- [ ] T009 [P] [US2] Extend `tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx` to assert: after clicking a non-default row, the newly clicked row carries `aria-pressed="true"` and the previously selected row carries `aria-pressed="false"`; clicking a COMPLETED row updates the iframe `src` to the new report id (single render, no navigation event)
- [ ] T010 [P] [US2] Extend `tests/unit/components/admin/insights/insights-report-view.test.tsx` to assert: the top-level layout container has classes resolving to a two-column grid on desktop (e.g., matches `/grid-cols-\[280px_minmax\(0,1fr\)\]/` or equivalent) and stacks below `md:` (FR-005, FR-006, FR-018)

### Implementation for User Story 2

- [ ] T011 [US2] Create `components/admin/insights/past-reports-table.tsx` exporting `PastReportsTable` with props `{ rows: ReportListEntry[]; selectedId: number | null; onSelect: (id: number) => void }` per `contracts/component-contracts.md §3`: four-column dense layout (Date / Period / Status / Duration), each row as `<button type="button">` with `aria-pressed`, `data-selected`, `min-h-[30px] max-h-[36px] py-1` sizing, selected-row classes `bg-accent/30 border-l-2 border-primary` (P-2), `hover:bg-accent` for non-selected, internal scroll wrapper `max-h-[…] overflow-y-auto`; colocate pure helpers `formatCompactPeriod(start, end)` (D-7), `formatCompactDuration(createdAt, completedAt, status)` (D-8), and `formatDateFull(iso)` in the same file; only Tailwind semantic tokens + `aurora-*` utilities (FR-017, no hex/rgb)
- [ ] T012 [US2] In `components/admin/insights/insights-report-view.tsx`: wrap the post-H1 content in `<div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-6">` (FR-005, FR-006, FR-018); render `<PastReportsTable rows={reports} selectedId={selectedId} onSelect={setSelectedId} />` in the left column when `reports.length > 0`, otherwise render the existing compact empty state; keep `useState<number | null>(null)` for `selectedId`, the `useMemo` default-selection (latest COMPLETED → first row → `latest` prop), and all existing hooks (`useInsightsReports`, `useInsightsPreflight`) verbatim (FR-016, D-3)

**Checkpoint**: US2 is complete and independently testable. The dense table renders on the left; clicking rows swaps the right-side body for COMPLETED and RUNNING states. The FAILED body is still the legacy placeholder until US3 ships.

---

## Phase 5: User Story 3 — FAILED report diagnostics panel with GitHub Actions link and "Reessayer" retry (Priority: P1)

**Goal**: Selecting a FAILED row renders a right-panel diagnostics view that displays the inline `errorReason` (whitespace preserved), a labeled link to the underlying GitHub Actions run (when `workflowRunId` is non-null) opening in a new tab with `rel="noopener noreferrer"`, and a "Reessayer" button reusing the existing `RunAnalysisButton` mutation (FR-011..FR-014, FR-017, SC-007..SC-009). FAILED rows without `workflowRunId` show fallback text and no link (FR-013, SC-008).

**Independent Test**: Seed a FAILED `InsightsReport` row whose `Job.workflowRunId` is `"12345"`. As an admin, open `/admin/insights` and click that row. Confirm: the panel shows the `errorReason` inline with line breaks; contains exactly one anchor whose `href` is `https://github.com/{owner}/{repo}/actions/runs/12345` with `target="_blank"` and `rel="noopener noreferrer"`; contains a "Reessayer" button driven by the live preflight; clicking "Reessayer" dispatches the same trigger flow as the top-right button. Then seed a FAILED row with `workflowRunId === null` and confirm zero GH-run anchors plus the fallback text "No workflow run is associated with this report".

### Tests for User Story 3

- [ ] T013 [P] [US3] Create `tests/unit/admin/insights-github-url.test.ts` covering the six pure-function cases from `contracts/component-contracts.md §6`: `buildInsightsRunUrl(null)` → `null`; `buildInsightsRunUrl('')` → `null`; `buildInsightsRunUrl('abc')` → `null`; `buildInsightsRunUrl('12345', 'me', 'r')` → `'https://github.com/me/r/actions/runs/12345'`; with `process.env.GITHUB_OWNER` and `process.env.GITHUB_REPO` unset → `null`; with both env vars set → composed URL (use `vi.stubEnv` to isolate)
- [ ] T014 [P] [US3] Create `tests/unit/components/admin/insights/failure-diagnostics-panel.test.tsx` covering: (a) when `report.workflowRunId` is non-null, the panel contains exactly one `<a>` with `target="_blank"` and `rel="noopener noreferrer"` whose `href` matches the composed GH Actions URL (FR-012, P-5, SC-007); (b) when `report.workflowRunId` is null, the panel renders the fallback string and contains zero GH-run anchors (FR-013, SC-008); (c) a multi-line `errorReason` is rendered with whitespace preserved (assert the container has `whitespace-pre-wrap`) (FR-011); (d) the "Reessayer" button reflects the passed `preflight` (e.g., `aria-disabled="true"` when `latestIsRunning=true` or `canTrigger=false`); (e) empty/null `errorReason` shows the stable fallback message (edge case)
- [ ] T015 [P] [US3] Extend `tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx` to add two scenarios: (a) clicking a FAILED row with `workflowRunId='12345'` reveals the GH Actions link with the composed URL; (b) clicking a FAILED row with `workflowRunId=null` shows the fallback text and renders no GH-run anchor
- [ ] T016 [P] [US3] In `tests/unit/components/admin/insights/insights-report-view.test.tsx`: replace the existing "FAILED placeholder" assertion (the legacy `<ReportErrorPlaceholder>` text) with assertions for the new diagnostics panel — `getByRole('link', { name: /workflow run/i })`, `getByRole('button', { name: /Reessayer/i })`, and that the `errorReason` text appears inline

### Implementation for User Story 3

- [ ] T017 [P] [US3] Create `lib/admin/insights-github-url.ts` exporting `buildInsightsRunUrl(workflowRunId: string | null, owner?: string, repo?: string): string | null` per `contracts/component-contracts.md §6`: read `owner ?? process.env.GITHUB_OWNER`, `repo ?? process.env.GITHUB_REPO`; return `null` if `workflowRunId` is null, empty, or fails `/^[0-9]+$/`, or if `owner`/`repo` resolves to a falsy value; otherwise return `https://github.com/{owner}/{repo}/actions/runs/{workflowRunId}` — pure function, no side effects beyond reading `process.env` (D-2)
- [ ] T018 [P] [US3] In `components/admin/insights/run-analysis-button.tsx`: add an optional `label?: string` prop to the component's props interface; render `props.label ?? 'Run new analysis'` as the idle button text; keep `'Starting…'` as the pending-state text regardless of `label`; do **not** touch the mutation, optimistic insertion, refusal codes, or disable conditions (additive only — P-1, SC-009, SC-010)
- [ ] T019 [US3] Create `components/admin/insights/failure-diagnostics-panel.tsx` exporting `FailureDiagnosticsPanel` with props `{ report: ReportListEntry; preflight: { canTrigger: boolean; refusal: { refusalCode: string; message: string } | null }; latestIsRunning: boolean }` per `contracts/component-contracts.md §4`: wrap in a `Card` with `aurora-bg-card-blue`; title `"This run failed"` as `<p className="font-medium text-foreground">` (not a heading); render `errorReason` (or fallback `"Run failed without a recorded reason — open the workflow run for details"` when null/empty) inside a `<div className="whitespace-pre-wrap …">` (FR-011); compute `url = buildInsightsRunUrl(report.workflowRunId)` — when non-null render `<a href={url} target="_blank" rel="noopener noreferrer">Open workflow run on GitHub</a>` (FR-012, P-5), when null render `"No workflow run is associated with this report"` (FR-013); render `<RunAnalysisButton preflight={preflight} latestIsRunning={latestIsRunning} label="Reessayer" />` for the retry action (D-6, FR-014); all styling via Tailwind semantic tokens + `aurora-*` utilities (FR-017) — depends on T017 and T018
- [ ] T020 [US3] In `components/admin/insights/insights-report-view.tsx`: in the right-panel body switcher, replace the FAILED branch (currently `<ReportErrorPlaceholder>`) with `<FailureDiagnosticsPanel report={display} preflight={preflight} latestIsRunning={latestIsRunning} />`; keep COMPLETED → `<iframe sandbox="allow-scripts">` and RUNNING → `<ReportErrorPlaceholder title="Run in progress" …>` unchanged (per `contracts §2` DOM contract) — depends on T019

**Checkpoint**: US3 is complete and independently testable. FAILED rows surface the inline reason, the GH Actions link (or fallback), and a working retry button. US1 + US2 + US3 deliver the full MVP.

---

## Phase 6: User Story 4 — Regression guard: "Run new analysis" preserves all existing behavior (Priority: P2)

**Goal**: The top-right "Run new analysis" button keeps every behavioral bit it had before the refresh — preflight evaluation, refusal codes (`ALREADY_RUNNING`, `NO_NEW_SHIPPED`), disabled state when latest is RUNNING, optimistic RUNNING-row insertion, polling resumption, error/refusal display (FR-015, SC-010).

**Independent Test**: Run the existing `tests/unit/components/admin/insights/run-analysis-button.test.tsx` regression suite unchanged against the refreshed page and confirm every outcome matches the pre-refresh behavior bit-for-bit.

### Tests for User Story 4

- [ ] T021 [US4] Run the existing `tests/unit/components/admin/insights/run-analysis-button.test.tsx` suite unchanged via `bun run test:unit tests/unit/components/admin/insights/run-analysis-button.test.tsx` and confirm 0 failures (regression guard — no edit; if the additive `label` prop or any sibling change has broken a case, fix the implementation, never the test, until parity holds) (SC-010)

### Implementation for User Story 4

- [ ] T022 [US4] In `components/admin/insights/insights-report-view.tsx`: confirm the existing `<RunAnalysisButton preflight={preflight} latestIsRunning={latestIsRunning} />` (no `label` prop, so it defaults to `'Run new analysis'`) is rendered in the top-right of the right-panel column inside the new grid layout, visually equivalent to its prior placement (FR-015 acceptance #1); make no functional changes to its props

**Checkpoint**: US4's regression guard is green. Both call sites of `RunAnalysisButton` exercise the same mutation; the top-right button is observably identical to before.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Repo-wide checks, full test pass, and the manual UI walkthrough required by CLAUDE.md before reporting the task complete.

- [ ] T023 [P] Run `bun run type-check` from the repo root and fix any errors introduced by the new components, helper, or extended interface (no `any`, explicit prop typing per constitution §I)
- [ ] T024 [P] Run `bun run lint` from the repo root and fix any new lint errors; verify there are zero hardcoded hex/rgb literals in `components/admin/insights/past-reports-table.tsx`, `components/admin/insights/failure-diagnostics-panel.tsx`, and `components/admin/insights/insights-report-view.tsx` (FR-017, SC-011)
- [ ] T025 [P] Run the full insights unit-test suite via `bun run test:unit tests/unit/components/admin/insights tests/unit/admin/insights-github-url.test.ts` and confirm all green
- [ ] T026 Run the E2E suite via `bun run test:e2e tests/e2e/admin/insights-flow.spec.ts` and confirm tab title + no-H1 + iframe assertions pass
- [ ] T027 Manual UI verification per plan §"Phase G": start `bun run dev`, authenticate as admin (`x-test-user-id` or `E2E_ADMIN_HEADER`), visit `/admin/insights`, and confirm — tab title `Insights LLM`; no internal H1 reading "Claude Code Insights"; sidebar `Insights LLM` item shows active state (background tint + left border); left panel resolves to ~280px with dense rows; clicking COMPLETED row swaps iframe; clicking FAILED row reveals GH Actions link (or fallback) and "Reessayer"; clicking "Reessayer" while a RUNNING row exists surfaces the same `ALREADY_RUNNING` refusal as the top-right button; theme toggle adapts all new elements; narrow viewport stacks panels vertically

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 has no dependencies and can start immediately
- **Phase 2 (Foundational)**: T002, T003 depend only on T001 baseline — BLOCK all user stories
- **Phase 3+ (User Stories)**: Each depends on Phase 2 completion
  - **US1 (P1)** has no dependencies on other user stories
  - **US2 (P1)** has no dependencies on other user stories
  - **US3 (P1)** has no dependencies on other user stories (US3 reads the `workflowRunId` field added in Phase 2; the FAILED branch wiring in T020 touches `insights-report-view.tsx` so it must serialize with T012 if both stories are in flight in the same file — see "Within Each User Story" below)
  - **US4 (P2)** depends on US3's T018 (the additive `label` prop change) since it asserts no regression after that edit
- **Phase 7 (Polish)**: Depends on all user stories being complete (T023..T027)

### User Story Dependencies

- **US1**: Independent. T006 touches `app/admin/insights/page.tsx`; T007 touches `components/admin/insights/insights-report-view.tsx` (header removal). No collision with US2/US3 in those exact text regions if done before US2's T012.
- **US2**: Independent. T011 creates a new file; T012 modifies `insights-report-view.tsx` (wraps content in grid). If US1's T007 has already removed the H1, T012 simply wraps the remaining content. If US1 is deferred, T012 should also remove the H1 to avoid a stale reference — schedule US1 before or alongside US2 to keep T012 minimal.
- **US3**: Independent in tests/helpers/panel; T020 modifies `insights-report-view.tsx` (FAILED branch). Serialize with T012 by completing US2 first; otherwise the two edits target the same file's body switcher and merging the diffs becomes manual.
- **US4**: Depends on US3's T018 having shipped; otherwise the regression suite has nothing new to guard against.

### Within Each User Story

- Tests come **before** implementation (constitution §III). Within US2/US3, T008..T010 and T013..T016 are written first; expect them to fail before T011/T012 and T017..T020 ship.
- Edits to the same file (`insights-report-view.tsx` in T007, T012, T020) MUST be sequenced: T007 (US1) → T012 (US2) → T020 (US3). Do not parallelize across these tasks.
- Edits to the same file (`run-analysis-button.tsx` in T003 and T018) MUST be sequenced: T003 (Foundational) → T018 (US3).

### Parallel Opportunities

- **Phase 2**: T002 and T003 are in different files → run in parallel.
- **US1 tests**: T004 and T005 are in different files → run in parallel.
- **US2 tests**: T008, T009, T010 are in different files → run in parallel.
- **US3 tests**: T013, T014, T015, T016 are in different files → run in parallel.
- **US3 implementation**: T017 (new helper file) and T018 (additive prop in button) are in different files → run in parallel. T019 depends on both; T020 depends on T019.
- **Polish**: T023, T024, T025 read-only — run in parallel; T026 must follow at least T024 (lint fixes can affect E2E test compilation); T027 is manual and runs last.

---

## Parallel Example: User Story 3

```bash
# After Phase 2 completes, launch US3 tests in parallel:
Task: "Create tests/unit/admin/insights-github-url.test.ts (T013)"
Task: "Create tests/unit/components/admin/insights/failure-diagnostics-panel.test.tsx (T014)"
Task: "Extend tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx (T015)"
Task: "Update tests/unit/components/admin/insights/insights-report-view.test.tsx (T016)"

# Once tests are failing, launch the two independent implementation pieces in parallel:
Task: "Create lib/admin/insights-github-url.ts (T017)"
Task: "Add label prop to components/admin/insights/run-analysis-button.tsx (T018)"

# Then serialize:
Task: "Create components/admin/insights/failure-diagnostics-panel.tsx (T019)"
Task: "Wire FAILED branch in components/admin/insights/insights-report-view.tsx (T020)"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3 — all P1)

The three P1 stories together constitute the MVP. None is independently shippable as a meaningful improvement on its own (the ticket requires the layout refresh **and** the FAILED diagnostics for the page to feel cohesive), so the MVP ships when US1 + US2 + US3 are all green.

1. Complete Phase 1: Setup baseline (T001)
2. Complete Phase 2: Foundational data plumbing (T002, T003) — **CRITICAL**, blocks everything
3. Complete Phase 3: US1 (T004..T007) — admin shell integration + tab title + no H1
4. Complete Phase 4: US2 (T008..T012) — dense table + selection
5. Complete Phase 5: US3 (T013..T020) — FAILED diagnostics panel + GH link + Reessayer
6. **STOP and VALIDATE**: Run the MVP independent tests for each P1 story
7. Demo / merge MVP

### Incremental Delivery

1. Setup + Foundational → safe to ship the additive `workflowRunId` field alone (no UI consumers yet)
2. Add US1 → tab title + H1 removal lands → ship intermediate commit
3. Add US2 → dense table lands; FAILED body remains legacy placeholder → ship intermediate commit
4. Add US3 → FAILED diagnostics panel lands → MVP complete
5. Add US4 regression run → confirm no behavior drift on the top-right button
6. Polish phase locks in type-check, lint, full test pass, and manual UI sweep

### Parallel Execution Strategy

After Phase 2 completes, an orchestrator can launch US1 / US2 / US3 in parallel **provided** the three edits to `components/admin/insights/insights-report-view.tsx` (T007, T012, T020) are serialized through a single editor — or one branch handles all three. The cleanest split is: agent A owns US1, agent B owns US2, agent C owns US3, and they merge their `insights-report-view.tsx` diffs sequentially in the order T007 → T012 → T020.

---

## Notes

- All file paths above are validated: source paths are real (`components/admin/insights/insights-report-view.tsx`, `components/admin/insights/run-analysis-button.tsx`, `components/admin/insights/report-error-placeholder.tsx`, `app/admin/insights/page.tsx`, `app/lib/insights/repository.ts`, `lib/admin/active-path.ts`) and test paths are real (`tests/unit/components/admin/insights/insights-report-view.test.tsx`, `tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx`, `tests/unit/components/admin/insights/run-analysis-button.test.tsx`, `tests/e2e/admin/insights-flow.spec.ts`). New files (`past-reports-table.tsx`, `failure-diagnostics-panel.tsx`, `lib/admin/insights-github-url.ts`, `past-reports-table.test.tsx`, `failure-diagnostics-panel.test.tsx`, `tests/unit/admin/insights-github-url.test.ts`) are justified in research.md "Existing Files → Source (new)".
- `[P]` tasks operate on different files with no incomplete-task dependencies.
- `[Story]` labels (US1..US4) provide traceability back to spec.md user stories.
- Verify each test fails before its corresponding implementation task lands (constitution §III).
- Commit after each task or logical group; do not bundle Phase 2 and Phase 5 in a single commit.
- Do not use `--no-verify` to bypass pre-commit hooks (CLAUDE.md): fix type-check / lint errors at their source.
- Avoid: hardcoded hex/rgb colors in any new component (FR-017, CLAUDE.md "Colors" rule); duplicating the trigger mutation in the diagnostics panel (P-1, D-6); inventing a new endpoint where the additive list field suffices (D-1).
