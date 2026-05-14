# Tasks: Admin Insights Page Cosmetic Refresh & Failed Report Diagnostics

**Input**: Design documents from `/specs/AIB-807-admin-insights-page/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies, no schema changes. Verify environment prerequisites and understand existing code.

- [ ] T001 Verify `GITHUB_OWNER` and `GITHUB_REPO` env vars are documented and available in dev environment

**Checkpoint**: Environment ready — no blocking setup required for this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the API serialization layer to expose `workflowRunId` and `githubActionsUrl` — both US1 (layout) and US2 (diagnostics) depend on these fields being available in the response.

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete.

- [ ] T002 Extend `ReportListEntry` interface and `toListEntry()` with `workflowRunId: string | null` and `githubActionsUrl: string | null` in `app/lib/insights/repository.ts`. Add helper `buildGithubActionsUrl(workflowRunId, owner, repo)`. Update `listReports()` and `getReportById()` Prisma queries to include `{ job: { select: { workflowRunId: true } } }`. Serialize BigInt as `String()`.
- [ ] T003 [P] Update GET reports list route to pass `GITHUB_OWNER`/`GITHUB_REPO` env vars to `toListEntry()` in `app/api/admin/insights/reports/route.ts`
- [ ] T004 [P] Update GET single report route to pass `GITHUB_OWNER`/`GITHUB_REPO` env vars to `toListEntry()` in `app/api/admin/insights/reports/[id]/route.ts`
- [ ] T005 [P] Update SSR page to pass host project config to `toListEntry()` calls in `app/admin/insights/page.tsx`

**Checkpoint**: API responses now include `workflowRunId` and `githubActionsUrl` fields. Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Browse and Select Past Reports in Side-by-Side Layout (Priority: P1) 🎯 MVP

**Goal**: Restructure the Insights page from vertical layout to a side-by-side layout with a compact left pane listing past reports and a right pane showing the selected report's content.

**Independent Test**: Navigate to `/admin/insights`, verify two-pane layout renders, click different reports in the left pane, confirm right pane updates without page reload.

### Tests for User Story 1
**RULE (constitution): Extend existing test files, don't create new ones.**

- [ ] T006 [P] [US1] Extend `tests/unit/components/admin/insights/insights-report-view.test.tsx` with tests: side-by-side layout renders (left pane + right pane visible), H1 title is absent, duration displayed for COMPLETED reports with `completedAt`, duration hidden when `completedAt` is null
- [ ] T007 [P] [US1] Extend `tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx` with tests: dense row format (generation date, period, status badge, duration visible), active selection highlight class applied to selected row, responsive stacking class check for mobile layout

### Implementation for User Story 1

- [ ] T008 [US1] Rewrite layout in `components/admin/insights/insights-report-view.tsx`: remove H1 title (FR-003), restructure outer container to side-by-side flex layout with `md:flex-row` breakpoint (FR-004, FR-005), left pane `<aside>` at `md:w-[280px] md:shrink-0` for past reports list, right pane `<main className="flex-1 min-w-0">` for report content. Keep header row with shipped-tickets counter and "Run new analysis" button above the two-pane area (FR-018, FR-022).
- [ ] T009 [US1] Implement dense report list rows in `components/admin/insights/insights-report-view.tsx`: compact ~30-36px height rows (FR-006) with generation date, compact period window, status badge (`Badge` component with `text-[10px]`), and duration display for COMPLETED reports (FR-007, computed from `createdAt` → `completedAt` as "Xm Ys"). Add active selection highlight with `bg-accent/50 border-l-2 border-primary` (FR-008, distinct from sidebar's `bg-accent/30`).

**Checkpoint**: Side-by-side layout is functional, reports can be browsed and selected, duration is displayed. US1 is independently testable.

---

## Phase 4: User Story 2 — Diagnose and Retry Failed Reports (Priority: P2)

**Goal**: Add GitHub Actions link and retry button for FAILED reports so admins can investigate failures and retry without leaving the app.

**Independent Test**: Select a FAILED report, verify error detail, GitHub Actions link (when available), and retry button all appear and function correctly.

### Tests for User Story 2
**RULE (constitution): Extend existing test files, don't create new ones.**

- [ ] T010 [P] [US2] Extend `tests/unit/components/admin/insights/insights-report-view.test.tsx` with tests: FAILED report shows GitHub Actions link when `githubActionsUrl` is present, FAILED report hides link when `githubActionsUrl` is null, FAILED report shows retry button
- [ ] T011 [P] [US2] Extend `tests/unit/components/admin/insights/run-analysis-button.test.tsx` with tests: retry mode button label says "Retry analysis", retry sends `periodStart`/`periodEnd` in POST body
- [ ] T012 [P] [US2] Extend `tests/integration/api/admin/insights/trigger.test.ts` with tests: retry with valid period params creates new report (201), retry with mismatched params (one missing) returns 400, retry with `periodStart >= periodEnd` returns 400, retry still blocked by ALREADY_RUNNING gate (409)
- [ ] T013 [P] [US2] Extend `tests/integration/api/admin/insights/reports-list.test.ts` with tests: response includes `workflowRunId` as string (when present), response includes `githubActionsUrl` (when env vars configured), `workflowRunId` is null when Job has no run ID, `githubActionsUrl` is null when env vars missing

### Implementation for User Story 2

- [ ] T014 [US2] Add Zod validation schema for optional `periodStart`/`periodEnd` body params in `app/api/admin/insights/trigger/route.ts`. Both must be present together or both absent, `periodStart < periodEnd`. When present: skip NO_CLAUDE_JOBS/NO_NEW_SHIPPED gates (original run proved eligibility), still enforce ALREADY_RUNNING gate, use provided dates as period window. Follow dispatch-then-rollback error pattern from existing code.
- [ ] T015 [US2] Extend `RunAnalysisButton` in `components/admin/insights/run-analysis-button.tsx` to accept optional `retryPeriod?: { periodStart: string; periodEnd: string }` prop. When provided: send period in POST body, change label to "Retry analysis", follow same optimistic update pattern.
- [ ] T016 [US2] Add FAILED report diagnostics in `components/admin/insights/insights-report-view.tsx`: in `renderReportBody()` for FAILED state, show error reason text (existing `ReportErrorPlaceholder`), GitHub Actions link (conditional on `githubActionsUrl` non-null, opens in new tab with `ExternalLink` icon from lucide-react), and retry button (using extended `RunAnalysisButton` with `retryPeriod` prop populated from the failed report's `periodStart`/`periodEnd`).

**Checkpoint**: Failed reports show full diagnostics with investigation link and one-click retry. US2 is independently testable.

---

## Phase 5: User Story 3 — Run New Analysis from Refreshed Layout (Priority: P3)

**Goal**: Ensure the "Run new analysis" trigger button works correctly in the new side-by-side layout, preserving all existing preflight logic.

**Independent Test**: Click "Run new analysis" button, verify preflight dialog, eligibility checks, and workflow dispatch function identically to pre-refresh behavior.

### Tests for User Story 3

No new tests needed — existing tests in `run-analysis-button.test.tsx` already cover the trigger flow, and US1 tests verify button placement in the new layout. The US2 integration tests for `trigger.test.ts` also exercise the existing (no-period) path.

### Implementation for User Story 3

- [ ] T017 [US3] Verify "Run new analysis" button placement and behavior in `components/admin/insights/insights-report-view.tsx`: button remains in header row above the two-pane layout (FR-018), preflight refusal display uses existing pattern (FR-017), new RUNNING entry appears in the left pane's past-reports list after dispatch. No code changes expected — this is a verification task after US1 layout rewrite.

**Checkpoint**: All existing trigger functionality preserved in new layout.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure responsive behavior, live polling, and edge cases work across all user stories.

- [ ] T018 Verify responsive layout stacking on narrow screens in `components/admin/insights/insights-report-view.tsx` (FR-005): past-reports list stacks above report content below medium breakpoint
- [ ] T019 Verify live polling updates both panes in `components/admin/insights/insights-report-view.tsx` (FR-019): when a RUNNING report completes, status badge updates in left pane and right pane transitions from "in progress" placeholder to rendered report
- [ ] T020 Verify edge cases: zero past reports (left pane empty state, right pane prompt), all FAILED reports (most recent selected by default), pruned artifact (graceful "content no longer available" message)
- [ ] T021 Run `bun run type-check` and `bun run lint` to ensure all changes pass static analysis
- [ ] T022 Run `bun run test:unit tests/unit/components/admin/insights/` and `bun run test:integration tests/integration/api/admin/insights/` to verify all extended tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
  - T002 must complete before T003/T004/T005 (they depend on updated `toListEntry()`)
  - T003, T004, T005 can run in parallel
- **User Story 1 (Phase 3)**: Depends on Foundational (needs `workflowRunId`/`githubActionsUrl` in API responses)
- **User Story 2 (Phase 4)**: Depends on Foundational (needs API fields) and partially on US1 (retry button renders in the new layout's right pane)
- **User Story 3 (Phase 5)**: Depends on US1 (verifies trigger in new layout)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational. No dependencies on other stories.
- **US2 (P2)**: Can start after Foundational for API/test work (T010-T014 parallel with US1). UI work (T015-T016) depends on US1 layout being in place.
- **US3 (P3)**: Depends on US1 layout completion. Verification only — no new code expected.

### Within Each User Story

- Tests written FIRST, ensure they FAIL before implementation
- API/data layer changes before UI
- Core implementation before integration

### Parallel Opportunities

**Within Foundational (Phase 2)**:
```
T002 (repository.ts)
  ├── T003 [P] (reports list route)
  ├── T004 [P] (single report route)
  └── T005 [P] (SSR page)
```

**Within US1 Tests**:
```
T006 [P] (report-view tests)  ||  T007 [P] (list-selection tests)
```

**Within US2 Tests**:
```
T010 [P] (view tests)  ||  T011 [P] (button tests)  ||  T012 [P] (trigger integration)  ||  T013 [P] (reports-list integration)
```

**Cross-Story Parallelism** (API + test work only):
```
US1: T006, T007 (unit tests)     ||  US2: T010-T013 (all tests) + T014 (trigger API)
     T008, T009 (UI)             ||       T015, T016 (UI — after US1 layout done)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002 → T003/T004/T005)
3. Complete Phase 3: User Story 1 (T006-T009)
4. **STOP and VALIDATE**: Test side-by-side layout independently
5. The page is already usable with improved browsing UX

### Incremental Delivery

1. Setup + Foundational → API responses enriched with new fields
2. Add US1 → Side-by-side layout with dense report list → **MVP ready**
3. Add US2 → Failed report diagnostics + retry → Full feature
4. Add US3 → Verify trigger button in new layout → Confidence check
5. Polish → Edge cases, responsive, live polling verified

---

## Notes

- No Prisma schema changes or migrations required
- No new dependencies to install
- All test tasks extend existing test files (5 files total) — no new test files
- BigInt serialization: `workflowRunId` must use `String()` for JSON safety
- GitHub Actions URL resolved server-side (CONSERVATIVE decision) — never expose `GITHUB_OWNER`/`GITHUB_REPO` to client
- Retry creates a NEW report+job pair — never mutates the failed report
