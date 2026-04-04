# Tasks: Add SKIPPED Status for Health Scans

**Input**: Design documents from `/specs/AIB-534-add-skipped-status/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema change that all subsequent phases depend on

- [ ] T001 Add `SKIPPED` value to `HealthScanStatus` enum in `prisma/schema.prisma`
- [ ] T002 Run Prisma migration and regenerate client (`bunx prisma migrate dev --name add_skipped_health_scan_status && bunx prisma generate`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoint changes that MUST be complete before UI stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Add `'SKIPPED'` to Zod `statusUpdateSchema.status` enum in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T004 Add SKIPPED to `VALID_TRANSITIONS` map (PENDING → SKIPPED, RUNNING → SKIPPED, SKIPPED → []) in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T005 Add validation: reject score when `status === 'SKIPPED'` (return 400) in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T006 Set `completedAt` for SKIPPED status and skip HealthScore upsert block when `status === 'SKIPPED'` in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T007 Update `latestScans` query filter from `status: 'COMPLETED'` to `status: { in: ['COMPLETED', 'SKIPPED'] }` in `app/api/projects/[projectId]/health/route.ts`
- [ ] T008 Update `buildModuleStatus()` to detect `scanStatus === 'SKIPPED'` and set `summary: 'Nothing to evaluate'` and pass `scanStatus` through to response in `app/api/projects/[projectId]/health/route.ts`

**Checkpoint**: API layer complete — SKIPPED transitions work end-to-end, HealthScore preserved

---

## Phase 3: User Story 1 — Health scan correctly reports nothing to evaluate (Priority: P1) 🎯 MVP

**Goal**: SKIPPED status flows end-to-end: workflow detects nothing to evaluate, sends SKIPPED to API, scan stored correctly with null score

**Independent Test**: Trigger PATCH with `status: SKIPPED` and verify scan is stored with null score, no HealthScore update, completedAt set

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [P] [US1] Create SKIPPED status transition tests in `tests/integration/health/health-scan-skipped.test.ts` (new file — justified: PATCH SKIPPED flows don't belong in GET endpoint test file). Tests: PENDING → SKIPPED succeeds, RUNNING → SKIPPED succeeds, SKIPPED → any returns 409, SKIPPED with score returns 400, SKIPPED does not update HealthScore aggregate, SKIPPED scan appears in scan history
- [ ] T010 [P] [US1] Extend `tests/integration/health/health-score.test.ts` with test: GET /health returns correct module status when latest scan is SKIPPED (score from previous HealthScore, summary "Nothing to evaluate", scanStatus "SKIPPED")
- [ ] T011 [P] [US1] Extend `tests/integration/health/health-score.test.ts` with test: global score is unaffected by SKIPPED scans (module with SKIPPED latest scan excluded from recalculation)

### Implementation for User Story 1

- [ ] T012 [US1] Update workflow to detect SKIPPED result and send `{ status: "SKIPPED" }` without score to PATCH endpoint in `.github/workflows/health-scan.yml` — check result JSON for `status: "SKIPPED"` or `skipped: true` in "Merge Scan Outputs" step, skip remediation ticket creation for SKIPPED scans

**Checkpoint**: User Story 1 complete — SKIPPED flows work end-to-end with full test coverage

---

## Phase 4: User Story 2 — Dashboard displays SKIPPED scans distinctly (Priority: P2)

**Goal**: Module cards, drawer states, and scan history visually distinguish SKIPPED from scored/never-scanned states

**Independent Test**: View health dashboard for a project where latest scan is SKIPPED — card shows "Skipped" badge, drawer shows "Nothing to evaluate", history shows SKIPPED badge

### Tests for User Story 2

- [ ] T013 [P] [US2] Extend `tests/unit/components/health-module-card.test.tsx` with tests: `skipped` card state renders "Skipped" badge, previous score is still displayed when available, "No scan yet" shown when no previous score exists

### Implementation for User Story 2

- [ ] T014 [P] [US2] Add `'skipped'` to `CardState` union type, update `getCardState()` to return `'skipped'` when `module.scanStatus === 'SKIPPED'`, add `skipped` case in `ScoreBadge` with muted styling, add `skipped: 'Re-run'` to `BUTTON_LABELS` in `components/health/health-module-card.tsx`
- [ ] T015 [P] [US2] Add `'skipped'` to `DrawerState` type, add detection in `getDrawerState()` for `scanStatus === 'SKIPPED'`, add `skipped` switch case with "Nothing to evaluate" message and info icon in `components/health/drawer/drawer-states.tsx`
- [ ] T016 [P] [US2] Add SKIPPED badge rendering in `HistoryEntry` — detect `scan.status === 'SKIPPED'` and show "Skipped" badge instead of score in `components/health/drawer/drawer-history.tsx`

**Checkpoint**: User Story 2 complete — all UI components correctly distinguish SKIPPED state

---

## Phase 5: User Story 3 — Trend statistics exclude SKIPPED scans (Priority: P2)

**Goal**: Trend charts, sparklines, and global score calculations exclude SKIPPED data points — no code changes needed (verified in research)

**Independent Test**: Confirm trends API already filters `status: 'COMPLETED'` which excludes SKIPPED. Confirm `calculateGlobalScore()` handles null modules.

### Verification for User Story 3

- [ ] T017 [US3] Verify that `app/api/projects/[projectId]/health/trends/route.ts` already filters `status: 'COMPLETED'` (SKIPPED automatically excluded — no code change needed)
- [ ] T018 [US3] Verify that `lib/health/score-calculator.ts` `calculateGlobalScore()` already excludes null-scored modules (no code change needed)

**Checkpoint**: User Story 3 verified — trend exclusion works via existing filters

---

## Phase 6: User Story 4 — COMPLIANCE and TESTS_FIX scans are never SKIPPED (Priority: P3)

**Goal**: Workflow logic ensures COMPLIANCE and TESTS_FIX scan types always proceed to COMPLETED, never SKIPPED

**Independent Test**: Confirm workflow logic only sends SKIPPED for REVIEW_QUALITY, SECURITY, and SPEC_SYNC scan types

### Implementation for User Story 4

- [ ] T019 [US4] Ensure the SKIPPED detection in `.github/workflows/health-scan.yml` only applies to REVIEW_QUALITY, SECURITY, and SPEC_SYNC scan types — COMPLIANCE and TESTS_FIX always proceed to COMPLETED even if result indicates nothing found

**Checkpoint**: User Story 4 complete — scan type guardrails in place

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T020 Run `bun run type-check` and fix any TypeScript errors
- [ ] T021 Run `bun run lint` and fix any linting errors
- [ ] T022 Run `bun run test:unit tests/unit/components/health-module-card.test.tsx` and verify all tests pass
- [ ] T023 Run `bun run test:integration tests/integration/health/health-scan-skipped.test.ts` and verify all tests pass
- [ ] T024 Run `bun run test:integration tests/integration/health/health-score.test.ts` and verify all tests pass
- [ ] T025 Run quickstart.md verification checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma migration) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (API endpoints ready)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (API returns SKIPPED status for UI to consume)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (verification only — no code changes)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (workflow changes from US1)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **User Story 2 (P2)**: Can start after Phase 2 — independent of US1 (UI reads API response)
- **User Story 3 (P2)**: Can start after Phase 2 — verification only, independent of other stories
- **User Story 4 (P3)**: Depends on US1 (workflow changes) — must follow Phase 3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- API changes before UI changes
- Core logic before integration points

### Parallel Opportunities

- **Phase 2**: T007 and T008 (GET endpoint) can run in parallel with T003–T006 (PATCH endpoint) — different files
- **Phase 3**: T009, T010, T011 (test files) can all run in parallel — different files
- **Phase 4**: T013 (tests), T014, T015, T016 can all run in parallel — all different files
- **Phase 5**: T017 and T018 can run in parallel — verification only
- **Cross-story**: US2 and US3 can start in parallel after Phase 2

---

## Parallel Example: User Story 2

```bash
# Launch all tests and implementation in parallel (all different files):
Task T013: "Extend health-module-card.test.tsx with skipped state tests"
Task T014: "Add skipped card state in health-module-card.tsx"
Task T015: "Add skipped drawer state in drawer-states.tsx"
Task T016: "Add SKIPPED badge in drawer-history.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Prisma migration)
2. Complete Phase 2: Foundational (API endpoints)
3. Complete Phase 3: User Story 1 (workflow + tests)
4. **STOP and VALIDATE**: Run integration tests, verify SKIPPED flows work end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → API layer ready
2. Add User Story 1 → Test independently → SKIPPED works end-to-end (MVP!)
3. Add User Story 2 → Test independently → Dashboard shows SKIPPED distinctly
4. Add User Story 3 → Verify → Trends exclude SKIPPED (no code change)
5. Add User Story 4 → Test → Scan type guardrails in place
6. Polish → All tests green, type-check clean, lint clean
