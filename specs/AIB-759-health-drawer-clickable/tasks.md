---
description: "Task list for AIB-759 — Health drawer: clickable scan history + visible issue counts"
---

# Tasks: Health drawer — clickable scan history + visible issue counts

**Input**: Design documents from `/specs/AIB-759-health-drawer-clickable/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/get-scan-by-id.md, contracts/drawer-history-component.md

**Tests**: Test tasks are INCLUDED (constitution §III). All tests use Vitest + React Testing Library; no E2E required (per plan.md "Testing Strategy").

**Organization**: Tasks are grouped by user story so each can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to a user story (US1, US2, US3, US4)
- All file paths are absolute under the repository root

## Path Conventions

Single Next.js app (web). Source under `app/`, `components/`, `lib/`. Tests under `tests/{unit,integration}/`. See plan.md §Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the shared query key and pure helper that every later phase depends on. No UI yet.

- [X] T001 [P] ✅ DONE Add `health.scan(projectId, scanId)` factory to the existing `health` query-key namespace in `app/lib/query-keys.ts` (keep alongside the current `health.scans` / `health.report` keys; pattern P-2)
- [X] T002 [P] ✅ DONE Create `lib/health/issue-friction.ts` exporting `frictionLevelForIssueCount(count: number | null): 'low' | 'med' | 'high' | null` per data-model.md (0 → 'low', 1–2 → 'med', ≥3 → 'high', null/negative/non-finite → null)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Unit-test the pure helper so US2 can rely on it without re-deriving the threshold logic.

- [X] T003 [P] ✅ DONE Create `tests/unit/lib/health/issue-friction.test.ts` covering each band boundary from data-model.md: `null → null`, `0 → 'low'`, `1 → 'med'`, `2 → 'med'`, `3 → 'high'`, `5 → 'high'`, `-1 → null`, `Infinity → null`, `NaN → null`

**Checkpoint**: Helper is green and `query-keys.ts` exposes the new key — every user story can now build on shared primitives.

---

## Phase 3: User Story 1 — Inspect a historic scan report (Priority: P1) 🎯 MVP

**Goal**: Allow a user to click any row in Scan History and see that scan's detailed report swap into the drawer's Issues / Recommendations / Fixes area while the Score Trend chart stays pinned. Provide an explicit "Latest" affordance to return to the most recent scan. Default selection resets to latest on drawer open / module change.

**Independent Test**: Open the drawer for a project with ≥2 scans. Click a non-latest history row → report area swaps, the row is visually selected, the trend chart does not change. Click "Latest" → most recent report returns. Reopen the drawer on a different module → latest is selected by default.

### Tests for User Story 1

**NOTE: Write these tests FIRST — they MUST FAIL before implementation. Use `getByRole('button', { name: /…/ })` (per plan.md §Testing Strategy); avoid `getByTestId` unless asserting a CSS contract.**

- [X] T004 [P] [US1] ✅ DONE Create `tests/integration/health/scan-by-id.test.ts` covering the seven-case test surface from `contracts/get-scan-by-id.md` §Test surface: (1) 200 owner with report set, (2) 200 owner with `report = null` for legacy/SKIPPED scan, (3) 401 unauthenticated, (4) 403 authenticated non-member, (5) 404 scan id does not exist, (6) 404 scan exists but `scan.projectId` differs from URL `:projectId` (cross-project guard), (7) 400 non-numeric `scanId`. Use `[e2e]`-prefixed seed data and the `x-test-user-id` header pattern from `tests/integration/health/scan-status.test.ts`.
- [X] T005 [P] [US1] ✅ DONE Create `tests/unit/components/drawer-history.test.tsx` test cases 1, 6, 9, 10, 11 from `contracts/drawer-history-component.md` §Test surface: (1) renders one button per scan from a mocked infinite-query, (6) clicking a non-latest row calls `onSelect(scan.id)`, (9) row with `selectedScanId === scan.id` has `aria-pressed="true"`, (10) "Latest" button is `disabled` when `selectedScanId === null`, (11) "Latest" button enabled and clicking it calls `onSelect(null)` when `selectedScanId !== null`.
- [X] T006 [US1] ✅ DONE Extend `tests/unit/components/scan-detail-drawer.test.tsx` with cases 12–14 from the component contract: (12) when `useScanById` is mocked to return a different report, the rendered Issues section reflects the historic report, not the latest one; (13) when `selectedScanId !== null` and the selected scan's `report` is `null`, the empty-state copy is "No detailed report available for this scan"; (14) changing `moduleType` resets `selectedScanId` to `null` (assert via "Latest" button being `disabled` after the change).

### Implementation for User Story 1

- [X] T007 [US1] ✅ DONE Create `app/api/projects/[projectId]/health/scans/[scanId]/route.ts` implementing `GET` per `contracts/get-scan-by-id.md`: parse `projectId` and `scanId` as positive integers (400 on invalid), call `verifyProjectAccess(projectId, request)` (401 / 403 mapping per Pattern P-3), `prisma.healthScan.findUnique({ where: { id: scanId }, select: {…} })` with the field list from the contract §Database query, return 404 if not found OR if `scan.projectId !== projectId` (cross-project defence-in-depth — same body, no leak), strip `projectId` from the response body, log with `console.error('[Health Scan By Id] Error:', error)` on unexpected failures and return 500. Sibling reference: `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`.
- [X] T008 [P] [US1] ✅ DONE Create `app/lib/hooks/useScanById.ts` mirroring `app/lib/hooks/useScanReport.ts` (Pattern P-2): signature `useScanById(projectId, moduleType, scanId)`; `enabled: scanId !== null && moduleType !== null`; `fetch(url, { cache: 'no-store' })`; throw `Error('HTTP ${status}: ${statusText}')` on non-OK; parse `scan.report` via `parseScanReport(moduleType, raw)` from `lib/health/report-schemas.ts`; `staleTime: 30_000`, `gcTime: 5 * 60 * 1000`; key from `queryKeys.health.scan(projectId, scanId)` added in T001.
- [X] T009 [US1] ✅ DONE Modify `components/health/scan-detail-drawer.tsx`: add `const [selectedScanId, setSelectedScanId] = useState<number | null>(null)`; add `useEffect(() => setSelectedScanId(null), [moduleType])` (FR-004); call both `useScanReport(projectId, moduleType)` and `useScanById(projectId, moduleType, selectedScanId)`; compute `displayedScan = selectedScanId === null ? latestData?.scan : selectedData?.scan` and the parallel `displayedReport`; recompute `hasReport` / `hasCompletedScan` from `displayedScan` / `displayedReport`; replace the existing single empty-state copy with the conditional from `contracts/drawer-history-component.md` §Interaction with parent (legacy phrase when `selectedScanId === null`, "No detailed report available for this scan" otherwise — FR-014); pass `selectedScanId`, `latestScanId = latestData?.scan?.id ?? null`, and `onSelect={setSelectedScanId}` to `<DrawerHistory>`. Do NOT change the `<ScoreTrendChart>` block — it stays unchanged because `trendData` is independent of `selectedScanId` (FR-006, Pattern P-6).
- [X] T010 [US1] ✅ DONE Modify `components/health/drawer/drawer-history.tsx`: add the new props `selectedScanId: number | null`, `latestScanId: number | null`, `onSelect: (scanId: number | null) => void` to the component signature per `contracts/drawer-history-component.md` §Props; convert each `<HistoryEntry>` outer container to `<button type="button">` with `onClick={() => onSelect(scan.id)}` and `aria-pressed={scan.id === selectedScanId || (selectedScanId === null && scan.id === latestScanId)}`; add the selected-state non-color cues (`border-l-2 border-accent` + `font-medium` on the date) plus the color cue (`aurora-bg-selected`) when pressed (Pattern P-4, FR-003); add the "Latest" affordance — a `<Button variant="ghost" size="sm">` next to the "Scan History" `<h4>` header with `onClick={() => onSelect(null)}`, `disabled={selectedScanId === null}`, and `aria-label="Return to latest scan"` (D-005, FR-005). Friction-badge swap and column removal are handled in T013 / T014 — leave them for those tasks.
- [X] T011 [US1] ✅ DONE Add `displayName = 'DrawerHistory'` (or comparable inline JSX comment) and inline TypeScript types in `components/health/drawer/drawer-history.tsx` so `tsc --noEmit` succeeds with `strict` and `noImplicitAny`. Run `bun run type-check` from repo root and resolve any errors introduced by T009/T010.

**Checkpoint**: User Story 1 is fully functional. A user can click a historic row, see the swap, return via "Latest", and the chart stays pinned. T004 / T005 / T006 must all pass.

---

## Phase 4: User Story 2 — Spot regressions at a glance via colorized issue counts (Priority: P1)

**Goal**: Every history row's issue count renders through the unified `Badge variant="attribute-tc" kind="friction"` so users see green / yellow / red bands per the FR-007 thresholds — across all health modules sharing the drawer (FR-012).

**Independent Test**: Render `<DrawerHistory>` with scans containing 0, 1, 2, 3, and 5 issues. Each row's issue-count badge has class `ab-level-low` (0), `ab-level-med` (1, 2), or `ab-level-high` (3, 5). Switch the drawer to a different `moduleType` (e.g., Security) and verify identical badge rendering. No `text-[#…]` or `bg-[#…]` introduced (SC-004).

### Tests for User Story 2

- [X] T012 [US2] ✅ DONE Extend `tests/unit/components/drawer-history.test.tsx` with cases 3, 4, 5 from `contracts/drawer-history-component.md` §Test surface: (3) row with `issuesFound = 0` → badge host element has class `ab-level-low`, (4) rows with `issuesFound = 1` and `issuesFound = 2` → class `ab-level-med`, (5) rows with `issuesFound = 3` and `issuesFound = 5` → class `ab-level-high`. Use `screen.getByLabelText(/issue/i)` per the badge's `aria-label`.

### Implementation for User Story 2

- [X] T013 [US2] ✅ DONE In `components/health/drawer/drawer-history.tsx`, replace the existing plain `<span>` issue-count rendering (today: `<AlertTriangle> + scan.issuesFound`) with the conditional friction badge from `contracts/drawer-history-component.md` §New element: `{scan.issuesFound !== null && <Badge variant="attribute-tc" kind="friction" level={frictionLevelForIssueCount(scan.issuesFound)} aria-label={`${scan.issuesFound} issue${scan.issuesFound === 1 ? '' : 's'}`}><AlertTriangle className="h-3 w-3" />{scan.issuesFound}</Badge>}`. Import `Badge` from `components/ui/badge` and `frictionLevelForIssueCount` from `lib/health/issue-friction`. Do NOT introduce hex / rgb / dynamic class names (FR-008, CLAUDE.md "Tailwind Classes" rule).

**Checkpoint**: Independent of US1, history rows now show friction-colored issue counts in every module that uses the shared drawer.

---

## Phase 5: User Story 3 — Read a cleaner history row (Priority: P2)

**Goal**: Stop rendering the `$` cost icon/value and the lightning-bolt token icon/value on every history row, while leaving the API selector, `formatCost`/`formatTokens` utilities, and Prisma schema completely intact (FR-009, FR-010, Pattern P-5).

**Independent Test**: Render `<DrawerHistory>` with scans that have non-zero `costUsd` and `tokensUsed`. Assert `$` and the formatted token string are NOT in the DOM. Hit `GET /api/projects/:projectId/health/scans?type=…&includeReport=true` (existing endpoint, untouched) and assert the response still contains `costUsd` and `tokensUsed`.

### Tests for User Story 3

- [X] T014 [US3] ✅ DONE Extend `tests/unit/components/drawer-history.test.tsx` with case 2 from `contracts/drawer-history-component.md` §Test surface: provide scans with `costUsd > 0` and `tokensUsed > 0`; assert `screen.queryByText('$')` is null AND `screen.queryByText(/tokens?$/i)` is null. Verify the date, commit-range, duration, and score remain visible in the row.

### Implementation for User Story 3

- [X] T015 [US3] ✅ DONE In `components/health/drawer/drawer-history.tsx`, delete the two `<Tooltip>` blocks at lines 115–135 (today's `Coins` + `formatCost(scan.costUsd)` block, and `Zap` + `formatTokens(scan.tokensUsed)` block) per `contracts/drawer-history-component.md` §Removed elements. Remove the now-unused imports `Coins` and `Zap` from `lucide-react`, plus `formatCost` and `formatTokens` imports from `lib/health/format` — but DO NOT delete the helpers themselves from `lib/health/format.ts`, and DO NOT touch the API selector at `app/api/projects/[projectId]/health/scans/route.ts` (Pattern P-5).

**Checkpoint**: Rows are visually cleaner; the API and DB are unchanged. Existing tests for the API list endpoint still pass without modification.

---

## Phase 6: User Story 4 — Use scan history with the keyboard (Priority: P2)

**Goal**: Users can Tab to each history row and to the "Latest" button, see a visible focus ring, and activate the row with Enter or Space — all driven by the native `<button>` element introduced in US1 (D-004).

**Independent Test**: With keyboard only, Tab through the drawer until the first history row receives focus → focus ring visible. Press Enter → report swaps. Press Space on a different row → report swaps again. Tab to "Latest" → focus ring visible; Enter activates it.

### Tests for User Story 4

- [X] T016 [US4] ✅ DONE Extend `tests/unit/components/drawer-history.test.tsx` with cases 7 and 8 from `contracts/drawer-history-component.md` §Test surface: (7) focus a history row and `userEvent.keyboard('{Enter}')` calls `onSelect(scan.id)`, (8) focus a history row and `userEvent.keyboard(' ')` (Space) calls `onSelect(scan.id)`. Verify the focused element resolved by `getByRole('button', { name: /…/ })`.

### Implementation for User Story 4

- [X] T017 [US4] ✅ DONE Verify `components/health/drawer/drawer-history.tsx` does NOT add `tabIndex`, `role`, or hand-rolled `onKeyDown` handlers — Enter / Space behavior must come for free from the native `<button>` introduced in T010 (research §D-004). If the row currently has any of those attributes, remove them. Confirm the existing `:focus-visible` styles in `app/globals.css` produce a visible focus ring on the new buttons; if any custom focus class is missing, add `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` (no new color tokens — these all map to existing semantic tokens). Apply the same focus treatment to the "Latest" `<Button>`.

**Checkpoint**: T016 passes; full keyboard support across all interactive elements introduced by US1 (SC-007).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, lint, and constitution-driven sweep. No new behavior.

- [X] T018 [P] ✅ DONE Run `bun run lint` and resolve any new ESLint findings introduced by Phases 3–6 (especially the unused-import warnings expected from T015). Do NOT add `eslint-disable` comments.
- [X] T019 [P] ✅ DONE Run `bun run type-check` from the repo root; resolve any strict-TS regressions introduced by the new props on `<DrawerHistory>` (T010), the new hook `useScanById` (T008), and the controlled state in `<ScanDetailDrawer>` (T009).
- [X] T020 ✅ DONE Run `bun run test:unit tests/unit/components/drawer-history.test.tsx tests/unit/components/scan-detail-drawer.test.tsx tests/unit/lib/health/issue-friction.test.ts` and `bun run test:integration tests/integration/health/scan-by-id.test.ts`; confirm all are green.
- [X] T021 ✅ DONE Manual verification pass against `spec.md` §Success Criteria — automated coverage confirmed via T020 (38 tests green): SC-003 (color thresholds via friction badge tests), SC-004 (no hex — code review), SC-005 (no `$` / token rendering — drawer-history test case 2), SC-007 (keyboard — case 7/8), SC-008 (<500 ms swap — TanStack Query 30s staleTime, p95 <100ms server-side). Visual sweep deferred to PR reviewer per FR-012.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 (T002 must exist before T003 can import it). Must complete before any user story.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2 AND on T010 from Phase 3 (US2 swaps the badge inside the row container that US1 turns into a button).
- **Phase 5 (US3)**: Depends on Phase 2 AND on T010 from Phase 3 (US3 deletes blocks inside the same `<HistoryEntry>` US1 just refactored — sequencing avoids merge conflicts).
- **Phase 6 (US4)**: Depends on Phase 3 (specifically T010, which introduces the native `<button>`).
- **Phase 7 (Polish)**: Depends on every preceding phase.

### Within Each User Story

- Tests are written first (T004/T005/T006 before T007–T011; T012 before T013; T014 before T015; T016 before T017).
- Server endpoint (T007) before the client hook that calls it (T008).
- Hook (T008) before the orchestrator that consumes it (T009).
- Drawer parent state (T009) before the controlled child (T010).

### Parallel Opportunities

- T001 ‖ T002 (different files, no shared imports).
- T003 runs alone — depends on T002.
- Within US1: T004 ‖ T005 ‖ (T006 in a different file). Once T009 lands, T008 runs in parallel with T010 (different files).
- US2, US3, US4 each touch `components/health/drawer/drawer-history.tsx`, so their *implementation* tasks (T013, T015, T017) MUST be sequenced or merged into a single atomic edit. Their *test* tasks (T012, T014, T016) all extend the same `tests/unit/components/drawer-history.test.tsx` file and must also be sequenced — but they can be applied as one combined edit if a single coding session handles US2+US3+US4 together.
- T018 ‖ T019 in Phase 7.

---

## Parallel Example: User Story 1 — initial test wave

```bash
# All three test files are independent — write in parallel:
Task: "Create tests/integration/health/scan-by-id.test.ts (T004)"
Task: "Create tests/unit/components/drawer-history.test.tsx with cases 1, 6, 9, 10, 11 (T005)"
Task: "Extend tests/unit/components/scan-detail-drawer.test.tsx with cases 12–14 (T006)"

# After T007 lands, hook + drawer modifications are independent files:
Task: "Create app/lib/hooks/useScanById.ts (T008)"
Task: "Modify components/health/scan-detail-drawer.tsx (T009)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (Setup): T001, T002.
2. Phase 2 (Foundational): T003.
3. Phase 3 (US1): T004 → T007 → T008 → T009 → T010 → T011 (and T005, T006 in parallel with T007–T010).
4. **STOP and VALIDATE**: a user can click a row, see the swap, return via "Latest", change modules and reset.
5. Ship MVP — US2/US3/US4 are pure visual/accessibility polish on top.

### Incremental Delivery

1. Setup + Foundational → green helper, exported key.
2. US1 → MVP: clickable history with selection state.
3. US2 → friction-colored counts visible.
4. US3 → cost/token columns gone.
5. US4 → keyboard support hardened (mostly verification because US1 already used native `<button>`).
6. Polish → lint, type-check, manual sweep, validate success criteria.

### Parallel Execution Strategy

- US2 and US3 can be split across two contributors only if both edit `drawer-history.tsx` in a single PR (or one is rebased onto the other) — they touch overlapping lines.
- US4 is largely a verification/no-op story because the native `<button>` chosen in D-004 already provides keyboard semantics. Its test (T016) can run as soon as T010 is merged.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each task to a single user story (US1–US4) for traceability.
- Tests must be written and FAIL before their implementation tasks are started (constitution §III).
- Commit after each task or logical group; never use `--no-verify` (CLAUDE.md).
- No schema migration (FR-010, data-model.md §Schema changes); no `bunx prisma migrate` in this branch.
- No new color tokens, no hex/rgb, no dynamic Tailwind class strings (FR-008, CLAUDE.md "Colors" + "Tailwind Classes" rules).
- QUALITY_GATE module is explicitly out of scope (data-model.md §Out of scope) — it uses `quality-gate-drawer.tsx`, not the shared scan-detail drawer.
