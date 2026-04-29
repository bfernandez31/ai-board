# Tasks: Health Drawer — Clickable Scan History + Visible Issue Counts

**Input**: Design documents from `/specs/AIB-760-health-drawer-clickable/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-scan-history.md

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies, no schema changes. This phase handles the shared backend and data-layer enhancements that multiple user stories depend on.

- [x] T001 [P] Add optional `scanId` query parameter to scan history API endpoint in `app/api/projects/[projectId]/health/scans/route.ts` — add `scanId: z.coerce.number().int().positive().optional()` to `scanHistorySchema`, implement conditional single-scan fetch with report when `scanId` is present (return `{ scans: [result], nextCursor: null, hasMore: false }`), preserve existing pagination behavior when absent
- [x] T002 [P] Extend `useScanReport` hook in `app/lib/hooks/useScanReport.ts` — add optional third parameter `scanId: number | null = null`, include `scanId` in query key `['health', projectId, 'scan-report', moduleType, scanId]`, append `&scanId=${scanId}` to fetch URL when provided, keep existing latest-scan behavior when null

**Checkpoint**: API and data layer ready — user story implementation can begin

---

## Phase 2: User Story 1 — View a Historical Scan's Report (Priority: P1) 🎯 MVP

**Goal**: Users can click any scan history row to view that historical scan's full report in the issues panel, and return to the latest scan via "Back to latest."

**Independent Test**: Open any health drawer with ≥2 completed scans, click a non-latest row, verify the issues panel updates to that historical scan's report. Click "Back to latest" and verify it reverts.

### Tests for User Story 1
**RULE: Extend existing test files where they cover the domain; create new files only when no existing file covers it.**

- [x] T003 [P] [US1] Create `tests/unit/components/drawer-history.test.tsx` — no existing test file for DrawerHistory component. Tests for row interactivity: clicking a row calls `onSelectScan` with scan ID; selected row has `aria-pressed="true"` and ring/bg-primary classes; "Back to latest" button visible when non-latest scan selected; "Back to latest" hidden when latest is active; clicking "Back to latest" calls `onSelectScan(null)`. Mock `useInfiniteQuery`, use `renderWithProviders` + `userEvent`.
- [x] T004 [P] [US1] Extend `tests/unit/components/scan-detail-drawer.test.tsx` — add tests: passes `selectedScanId` to `useScanReport` hook (verify third argument); shows "Report not available for this scan" when historical scan has null report and `selectedScanId` is set. Extend existing `mockUseScanReport` mock to verify `scanId` argument.

### Implementation for User Story 1

- [x] T005 [US1] Add `selectedScanId` state and orchestration wiring in `components/health/scan-detail-drawer.tsx` — add `const [selectedScanId, setSelectedScanId] = useState<number | null>(null)`; pass `selectedScanId` to `useScanReport(projectId, moduleType, selectedScanId)`; derive `latestScanId` from initial hook result; pass `selectedScanId`, `latestScanId`, and `onSelectScan={setSelectedScanId}` to `DrawerHistory`; show "Report not available for this scan" when `selectedScanId` is set and report is null (FR-012)
- [x] T006 [US1] Make DrawerHistory rows interactive in `components/health/drawer/drawer-history.tsx` — extend `DrawerHistoryProps` with `selectedScanId: number | null`, `latestScanId: number | null`, `onSelectScan: (scanId: number | null) => void`; transform `HistoryEntry` from passive `<div>` to interactive element with `role="button"`, `tabIndex={0}`, `aria-pressed={isSelected}`, `onClick`, `cursor-pointer`; add selected state visual (`ring-2 ring-primary/50 bg-primary/5`) when `scan.id === selectedScanId` (FR-003); add "Back to latest" `<Button variant="ghost" size="sm">` above history list when `selectedScanId !== null && selectedScanId !== latestScanId` (FR-004, FR-005)

**Checkpoint**: Users can click scan rows to view historical reports and return to latest — core feature complete

---

## Phase 3: User Story 2 — Visually Identify Issue Count Severity at a Glance (Priority: P2)

**Goal**: Issue count on each scan history row is color-coded using the friction badge system (0=green, 1-2=yellow, 3+=red).

**Independent Test**: Open any health drawer; verify issue count badge color is green for 0, yellow for 1-2, red for 3+ across all module types.

### Tests for User Story 2

- [x] T007 [P] [US2] Extend `tests/unit/components/drawer-history.test.tsx` — add tests: issue count badge shows green (`level="low"`) for 0 issues; yellow (`level="med"`) for 1-2 issues; red (`level="high"`) for 3+ issues; null `issuesFound` treated as 0 (green); badge uses `kind="friction"` (not hardcoded colors) (FR-008)

### Implementation for User Story 2

- [x] T008 [US2] Add `getIssueCountLevel` helper and friction badge rendering in `components/health/drawer/drawer-history.tsx` — add inline `getIssueCountLevel(issuesFound: number | null): 'low' | 'med' | 'high'` function (0→low, 1-2→med, 3+→high, null→0); replace plain `<span>` issue count display with `<Badge variant="attribute" kind="friction" level={getIssueCountLevel(scan.issuesFound)}>{scan.issuesFound ?? 0}</Badge>`; import `Badge` from `components/ui/badge`

**Checkpoint**: Issue counts are color-coded across all module types

---

## Phase 4: User Story 3 — Clean Scan History Without Cost/Token Noise (Priority: P3)

**Goal**: Remove cost and token usage display from scan history rows; remaining columns: date, commit range, issue count (colored), duration, score.

**Independent Test**: Open any health drawer; confirm no cost or token values appear in scan history rows.

### Tests for User Story 3

- [x] T009 [P] [US3] Extend `tests/unit/components/drawer-history.test.tsx` — add tests: scan history rows do NOT render cost values (no coin icon, no "$X.XX"); scan history rows do NOT render token values (no zap icon, no token count); remaining columns (date, commit range, issue count, duration, score) are all present

### Implementation for User Story 3

- [x] T010 [US3] Remove cost/token display from `components/health/drawer/drawer-history.tsx` — delete `costUsd` and `tokensUsed` tooltip blocks (around lines 115-136); remove `Coins` and `Zap` icon imports from lucide-react; remove `formatCost` and `formatTokens` imports from `lib/health/format`

**Checkpoint**: Scan history rows show only relevant metrics — no misleading zero-value telemetry

---

## Phase 5: User Story 4 — Keyboard-Accessible Scan History Navigation (Priority: P2)

**Goal**: Keyboard-only users can Tab through scan history rows with visible focus indicators and activate them via Enter/Space.

**Independent Test**: Using keyboard only, Tab to a scan history row, press Enter, verify the issues panel updates with a visible focus ring.

### Tests for User Story 4

- [x] T011 [P] [US4] Extend `tests/unit/components/drawer-history.test.tsx` — add tests: pressing Enter on focused row calls `onSelectScan` with scan ID; pressing Space on focused row calls `onSelectScan` with scan ID; rows are focusable via Tab (`tabIndex={0}`); focused row shows visible focus ring classes

### Implementation for User Story 4

- [x] T012 [US4] Add keyboard event handling and focus styles in `components/health/drawer/drawer-history.tsx` — add `onKeyDown` handler for Enter and Space keys (call `onSelectScan(scan.id)` and `e.preventDefault()` for Space to prevent scroll); add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` classes to each row element (FR-010, WCAG 2.1 SC 2.4.7)

**Checkpoint**: Full keyboard accessibility for scan history navigation

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification and final consistency checks

- [x] T013 Verify score trend chart independence in `components/health/drawer/score-trend-chart.tsx` — confirm no accidental coupling to `selectedScanId`; the chart receives `trendData` from parent which is independent of scan selection (FR-006). No code changes expected — verification only.
- [x] T014 Run `bun run type-check` and `bun run lint` to verify all changes pass static analysis
- [x] T015 Run `bun run test:unit tests/unit/components/drawer-history.test.tsx tests/unit/components/scan-detail-drawer.test.tsx` to verify all new and extended tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 and T002 are parallel (different files).
- **US1 (Phase 2)**: Depends on Phase 1 completion (API + hook must be ready). T003 and T004 tests are parallel. T005 before T006 (orchestrator props needed by child).
- **US2 (Phase 3)**: Depends on T006 (DrawerHistory must have interactive rows before adding badge rendering). T007 test can start after T003 creates the test file.
- **US3 (Phase 4)**: Can start after T006 (modifying same file — drawer-history.tsx). T009 test can start after T003 creates the test file.
- **US4 (Phase 5)**: Can start after T006 (modifying same file — drawer-history.tsx). T011 test can start after T003 creates the test file.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 only — no cross-story dependencies
- **US2 (P2)**: Depends on US1's DrawerHistory modifications (T006) — same file
- **US3 (P3)**: Depends on US1's DrawerHistory modifications (T006) — same file, removing content
- **US4 (P2)**: Depends on US1's DrawerHistory modifications (T006) — adds keyboard handling to interactive rows

### Within Each User Story

- Tests written first (fail before implementation)
- Orchestrator before child component changes (US1: T005 before T006)
- Core implementation before integration

### Parallel Opportunities

- **Phase 1**: T001 (API) and T002 (hook) run in parallel — different files
- **Phase 2 tests**: T003 (new drawer-history tests) and T004 (extend scan-detail-drawer tests) run in parallel — different files
- **Cross-phase tests**: T007, T009, T011 can all be written once T003 creates the test file (extend it in sequence)
- **Phase 6**: T013, T014, T015 are independent verification steps

---

## Parallel Example: Phase 1

```bash
# Launch both setup tasks together (different files):
Task T001: "Add scanId param to API in app/api/projects/[projectId]/health/scans/route.ts"
Task T002: "Extend useScanReport hook in app/lib/hooks/useScanReport.ts"
```

## Parallel Example: Phase 2 Tests

```bash
# Launch both test tasks together (different files):
Task T003: "Create tests/unit/components/drawer-history.test.tsx"
Task T004: "Extend tests/unit/components/scan-detail-drawer.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002 in parallel)
2. Complete Phase 2: US1 tests (T003, T004 in parallel), then implementation (T005 → T006)
3. **STOP and VALIDATE**: Click a scan row in any health drawer — issues panel updates to historical report
4. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 (Setup) → API + hook ready
2. Phase 2 (US1) → Historical scan viewing works → **MVP!**
3. Phase 3 (US2) → Issue counts are color-coded
4. Phase 4 (US3) → Cost/token noise removed
5. Phase 5 (US4) → Full keyboard accessibility
6. Phase 6 (Polish) → Verification and static analysis
7. Each story adds value without breaking previous stories

### Parallel Execution Strategy

Since US2, US3, and US4 all modify `drawer-history.tsx`, they should run sequentially after US1. However, their test tasks can be batched together as extensions to the same test file.
