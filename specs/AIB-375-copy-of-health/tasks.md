# Tasks: Health Dashboard - Page, Sidebar, Score Global, Data Model and API

**Input**: Design documents from `/specs/AIB-375-copy-of-health/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per constitution (III. Test-Driven Development) and plan testing strategy.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and Prisma migration for HealthScan and HealthScore models

- [x] T001 Add HealthScanType and HealthScanStatus enums, HealthScan model, HealthScore model, and Project relations to prisma/schema.prisma per data-model.md
- [x] T002 Run Prisma migration (`bunx prisma migrate dev --name add-health-models`) and verify generated client

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core library modules that ALL user stories depend on — types, constants, score calculator, database queries, workflow dispatch

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create TypeScript interfaces and API response types in lib/health/types.ts (ModuleConfig, HealthScoreResponse, HealthScanResponse, module status enum)
- [x] T004 [P] Create module configuration constants in lib/health/constants.ts (HEALTH_MODULES array with 6 module configs: type, name, icon, isPassive flag; CONTRIBUTING_MODULES subset)
- [x] T005 [P] Implement global score calculator in lib/health/score-calculator.ts (calculateGlobalScore with equal weighting and redistribution for missing modules, reuse getScoreThreshold/getScoreColor from lib/quality-score.ts)
- [x] T006 Create Prisma query functions in lib/health/queries.ts (getHealthScore, getLatestScans, getActiveScan, getScanHistory, upsertHealthScore, computePassiveModuleScores)
- [x] T007 [P] Create workflow dispatch function in lib/workflows/dispatch-health-scan.ts following dispatch-ai-board.ts pattern (inputs: project_id, scan_type, scan_id, base_commit, head_commit, githubRepository)
- [x] T008 [P] Unit test for score-calculator.ts in tests/unit/health/score-calculator.test.ts (null when no modules, single module = 100% weight, all 5 modules = 20% each, partial modules with redistribution, edge cases)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 4 — Navigate to Health from Sidebar (Priority: P1)

**Goal**: Add a "Health" entry with HeartPulse icon to the sidebar Views group after Comparisons

**Independent Test**: Verify HeartPulse icon appears in sidebar after Comparisons and clicking it navigates to `/projects/[projectId]/health`

### Tests for User Story 4

- [x] T009 [US4] E2E test for sidebar navigation to Health page in tests/e2e/health-navigation.spec.ts (HeartPulse icon visible, positioned after Comparisons, navigates to /projects/[projectId]/health)

### Implementation for User Story 4

- [x] T010 [US4] Add Health nav entry to components/navigation/nav-items.ts (id: 'health', label: 'Health', icon: HeartPulse, href: '/health', group: 'views', after Comparisons)

**Checkpoint**: Sidebar navigation to Health page works (page itself may be empty)

---

## Phase 4: User Story 1 — View Project Health Overview (Priority: P1) MVP

**Goal**: Display global health score (0-100), sub-score badges for 5 contributing modules, 6 module cards in 2x3 grid with correct visual states

**Independent Test**: Navigate to Health page, verify global score display, sub-score badges, and 6 module cards render correctly in their current states

### Tests for User Story 1

- [x] T011 [P] [US1] Integration test for GET /api/projects/[projectId]/health in tests/integration/health/health-score-api.test.ts (returns global score, module array with 6 entries, handles no-scans case, auth checks)
- [x] T012 [P] [US1] Component test for global-score-card.tsx in tests/unit/components/health/global-score-card.test.tsx (score display with label/color, "---" when null, sub-score badges, "Last full scan" text)
- [x] T013 [P] [US1] Component test for module-card.tsx in tests/unit/components/health/module-card.test.tsx (4 visual states: never_scanned, scanning, completed, failed; passive vs active distinction)

### Implementation for User Story 1

- [x] T014 [US1] Implement GET health score API route in app/api/projects/[projectId]/health/route.ts (verifyProjectAccess, Zod validation, return global score + 6 module statuses per health-score-api.yaml contract)
- [x] T015 [US1] Create TanStack Query polling hook in lib/hooks/useHealthPolling.ts (useQuery wrapping GET /health, refetchInterval: 15_000 when scans active, stops when idle)
- [x] T016 [P] [US1] Create global score card component in components/health/global-score-card.tsx (large score with label/color, 5 sub-score badges, "Last full scan: X days ago", Aurora theme styling)
- [x] T017 [P] [US1] Create module card component in components/health/module-card.tsx (4 visual states per FR-010, icon + name + score badge + summary + last scan date, passive label for Quality Gate/Last Clean)
- [x] T018 [US1] Create health dashboard layout component in components/health/health-dashboard.tsx (Client Component, 2x3 grid for module cards, global score card at top, uses useHealthPolling hook)
- [x] T019 [US1] Create Health page route in app/projects/[projectId]/health/page.tsx (Server Component, verifyProjectAccess, fetch initial data, render HealthDashboard client component)

**Checkpoint**: Health page displays global score and 6 module cards with correct states (never_scanned for new projects)

---

## Phase 5: User Story 2 — Trigger a Health Scan (Priority: P1)

**Goal**: Users can click "Run Scan" on active module cards to trigger health scans with real-time status feedback

**Independent Test**: Click "Run Scan" on any active module, verify card transitions through pending -> running -> completed states

### Tests for User Story 2

- [ ] T020 [P] [US2] Integration test for POST /api/projects/[projectId]/health/scans in tests/integration/health/health-scan-api.test.ts (create scan + dispatch, 409 on concurrent scan, auth checks, Zod validation)
- [ ] T021 [P] [US2] Integration test for PATCH /api/projects/[projectId]/health/scans/[scanId]/status in tests/integration/health/scan-status-api.test.ts (PENDING->RUNNING->COMPLETED transitions, score upsert on completion, FAILED with errorMessage, invalid transitions rejected, workflow token auth)

### Implementation for User Story 2

- [ ] T022 [US2] Implement POST trigger scan in app/api/projects/[projectId]/health/scans/route.ts (verifyProjectAccess, Zod validate scanType, check concurrent scan prevention, create HealthScan record, derive base/head commits, dispatch health-scan workflow, return 201 per contract)
- [ ] T023 [US2] Implement PATCH scan status callback in app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts (workflow token auth, validate state transitions, update scan fields, on COMPLETED: upsert HealthScore cache with recomputed global score)
- [ ] T024 [US2] Create scan action button component in components/health/scan-action-button.tsx (trigger scan on click via POST, disabled + Loader2 spinner while PENDING/RUNNING, "Retry" on FAILED, hidden for passive modules)
- [ ] T025 [US2] Integrate scan-action-button into module-card.tsx in components/health/module-card.tsx (active modules show scan button, wire up mutation to POST /health/scans, invalidate health query on success)

**Checkpoint**: Full scan lifecycle works — trigger scan, see spinner, receive completion callback, score updates

---

## Phase 6: User Story 3 — Incremental Scanning (Priority: P2)

**Goal**: Subsequent scans for the same module only analyze changes since the last completed scan's head commit

**Independent Test**: Run two consecutive scans for the same module, verify second scan has baseCommit matching first scan's headCommit

### Tests for User Story 3

- [ ] T026 [US3] Integration test for incremental scan logic in tests/integration/health/health-scan-api.test.ts (first scan has null baseCommit, second scan derives baseCommit from last COMPLETED scan's headCommit, failed scans are skipped for base commit derivation)

### Implementation for User Story 3

- [ ] T027 [US3] Enhance POST scan creation in app/api/projects/[projectId]/health/scans/route.ts to query last COMPLETED scan of same type for project and set baseCommit from its headCommit (null if no completed scan exists)

**Checkpoint**: Incremental scanning works — base/head commit chain is maintained across scans

---

## Phase 7: User Story 5 — View Scan History via API (Priority: P3)

**Goal**: API endpoint returns paginated scan history filtered by scan type

**Independent Test**: Call scan history API and verify paginated results with type filtering

### Tests for User Story 5

- [ ] T028 [US5] Integration test for GET /api/projects/[projectId]/health/scans in tests/integration/health/health-scan-api.test.ts (paginated results, type filter, reverse chronological order, pagination metadata)

### Implementation for User Story 5

- [ ] T029 [US5] Implement GET scan history in app/api/projects/[projectId]/health/scans/route.ts (verifyProjectAccess, Zod validate query params: type, page, pageSize, return paginated scans per health-scan-api.yaml contract)

**Checkpoint**: Scan history API returns filtered, paginated results

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cross-cutting improvements

- [ ] T030 [P] Verify all API endpoints match contracts in specs/AIB-375-copy-of-health/contracts/ (response shapes, status codes, error formats)
- [ ] T031 [P] Verify Aurora theme compliance — no hardcoded colors, WCAG AA contrast, aurora-* utility classes on cards/dialogs in components/health/
- [ ] T032 Run full test suite (`bun run test`) and fix any failures
- [ ] T033 Run type-check (`bun run type-check`) and lint (`bun run lint`) and fix any errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma models must exist)
- **US4 Sidebar (Phase 3)**: Depends on Phase 2 (minimal, but consistent ordering)
- **US1 View Overview (Phase 4)**: Depends on Phase 2 (types, queries, constants)
- **US2 Trigger Scan (Phase 5)**: Depends on Phase 2 + Phase 4 (needs module-card from US1)
- **US3 Incremental (Phase 6)**: Depends on Phase 5 (enhances POST scan from US2)
- **US5 Scan History (Phase 7)**: Depends on Phase 2 (queries, types only)
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **US4 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Depends on US1 (integrates scan button into module-card component)
- **US3 (P2)**: Depends on US2 (enhances scan creation endpoint)
- **US5 (P3)**: Can start after Phase 2 — no dependencies on other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/models before queries
- Queries before API routes
- API routes before UI components
- Core implementation before integration

### Parallel Opportunities

- T003, T004, T005, T007, T008 can all run in parallel (Phase 2 — different files)
- US4 (Phase 3) and US1 (Phase 4) can run in parallel after Phase 2
- US5 (Phase 7) can run in parallel with US2 (Phase 5) and US3 (Phase 6)
- Within US1: T011, T012, T013 tests can run in parallel; T016, T017 components can run in parallel
- Within US2: T020, T021 tests can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all foundational tasks in parallel:
Task: "Create TypeScript interfaces in lib/health/types.ts"
Task: "Create module constants in lib/health/constants.ts"
Task: "Implement score calculator in lib/health/score-calculator.ts"
Task: "Create workflow dispatch in lib/workflows/dispatch-health-scan.ts"
Task: "Unit test for score-calculator in tests/unit/health/score-calculator.test.ts"
```

## Parallel Example: User Story 1

```bash
# Launch US1 tests in parallel:
Task: "Integration test for GET /health in tests/integration/health/health-score-api.test.ts"
Task: "Component test for global-score-card in tests/unit/components/health/global-score-card.test.tsx"
Task: "Component test for module-card in tests/unit/components/health/module-card.test.tsx"

# Launch US1 UI components in parallel (after API route):
Task: "Create global-score-card in components/health/global-score-card.tsx"
Task: "Create module-card in components/health/module-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 4 Only)

1. Complete Phase 1: Setup (Prisma schema + migration)
2. Complete Phase 2: Foundational (types, constants, calculator, queries)
3. Complete Phase 3: US4 (sidebar navigation)
4. Complete Phase 4: US1 (view health overview)
5. **STOP and VALIDATE**: Health page accessible from sidebar, displays scores and module cards
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add US4 + US1 -> Sidebar + Dashboard viewable -> Deploy/Demo (MVP!)
3. Add US2 -> Scan triggering works -> Deploy/Demo
4. Add US3 -> Incremental scans -> Deploy/Demo
5. Add US5 -> Scan history API -> Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, stories can run in parallel:
   - Parallel task 1: US4 (Sidebar Nav)
   - Parallel task 2: US1 (View Overview)
   - Parallel task 3: US5 (Scan History API)
3. After US1 completes: US2 (Trigger Scan)
4. After US2 completes: US3 (Incremental Scanning)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
