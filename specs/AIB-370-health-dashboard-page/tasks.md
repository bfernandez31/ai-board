# Tasks: Health Dashboard - Page, Sidebar, Score Global, Data Model and API

**Input**: Design documents from `/specs/AIB-370-health-dashboard-page/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per plan.md Testing Strategy (TDD — unit, component, integration, E2E).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema changes and migration for HealthScan/HealthScore models

- [x] T001 Add HealthScanType and HealthScanStatus enums, HealthScan and HealthScore models, and Project relations to prisma/schema.prisma
- [x] T002 Run prisma migration with `bunx prisma migrate dev --name add-health-models` and regenerate client
- [x] T003 Create TypeScript interfaces and type helpers in lib/health/types.ts matching Prisma models (HealthScanType enum, module metadata, API response types)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities and configuration that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create score calculator pure function in lib/health/score-calculator.ts (calculateGlobalScore with proportional weight redistribution, getScoreLabel, reuse getScoreThreshold/getScoreColor from lib/quality-score.ts)
- [x] T005 [P] Add health query keys to app/lib/query-keys.ts (healthScore, healthScans, scanHistory)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — View Project Health Overview (Priority: P1) MVP

**Goal**: Display global health score hero zone, 5 sub-score badges, and 6 module cards in a 2-column grid at `/projects/[projectId]/health`

**Independent Test**: Navigate to Health page and verify global score display, sub-score badges, and 6 module cards render correctly with appropriate states (no data, partial data, full data)

### Tests for User Story 1

- [x] T006 [P] [US1] Unit test for score calculator in tests/unit/health/score-calculator.test.ts (no modules, partial modules, all modules, edge cases)
- [x] T007 [P] [US1] Component test for health hero in tests/unit/components/health-hero.test.tsx (score thresholds: Excellent/Good/Fair/Poor, no data state)
- [x] T008 [P] [US1] Component test for health module card in tests/unit/components/health-module-card.test.tsx (4 states: never scanned, scanning, completed, failed)

### Implementation for User Story 1

- [x] T009 [US1] Implement GET handler in app/api/projects/[projectId]/health/route.ts (fetch HealthScore, active scans, derive qualityGate from latest verify job, derive lastClean from latest cleanup job, return contract response shape)
- [x] T010 [P] [US1] Create health sub-score badge component in components/health/health-sub-score-badge.tsx (compact badge with module name, score, and color using semantic tokens)
- [x] T011 [P] [US1] Create health hero component in components/health/health-hero.tsx (global score display with label, color, aurora-glow-score, 5 sub-score badges row, "Last full scan" text)
- [x] T012 [P] [US1] Create health module card component in components/health/health-module-card.tsx (4 states per FR-008, icon, name, score badge, summary, commit range, severity tags, action button, passive label, aurora-glass styling)
- [x] T013 [US1] Create health dashboard client component in components/health/health-dashboard.tsx (compose hero + 6 module cards in 2-col/3-row grid, responsive single-column on small screens, aurora-bg-section)
- [x] T014 [US1] Create useHealthPolling hook in app/lib/hooks/useHealthPolling.ts (TanStack Query with 2s conditional polling — active when any scan is PENDING/RUNNING, disabled when all terminal)
- [x] T015 [US1] Create Health page server component in app/projects/[projectId]/health/page.tsx (metadata, project access check, render HealthDashboard client component)
- [x] T016 [US1] Integration test for health score GET endpoint in tests/integration/health/health-score.test.ts (no data response, partial scores, full scores, auth checks)

**Checkpoint**: Health page renders with correct scores, labels, colors, and module card states

---

## Phase 4: User Story 2 — Trigger and Monitor a Health Scan (Priority: P1)

**Goal**: Users can trigger scans from module cards, see real-time state transitions (idle → scanning → completed/failed), and global score recalculates on completion

**Independent Test**: Click "Run Scan" on any active module card, verify card transitions to scanning state, and after completion the score updates without page refresh

### Tests for User Story 2

- [x] T017 [P] [US2] Integration test for trigger scan POST endpoint in tests/integration/health/trigger-scan.test.ts (successful trigger, concurrent scan prevention 409, invalid scan type, auth checks)
- [x] T018 [P] [US2] Integration test for scan status PATCH callback in tests/integration/health/scan-status.test.ts (PENDING→RUNNING, RUNNING→COMPLETED with score recalc, RUNNING→FAILED, invalid transitions)

### Implementation for User Story 2

- [x] T019 [US2] Create scan workflow dispatch function in lib/health/scan-dispatch.ts (Octokit.actions.createWorkflowDispatch following existing dispatch-ai-board.ts pattern)
- [x] T020 [US2] Implement POST handler in app/api/projects/[projectId]/health/scans/route.ts (Zod validation, concurrent scan check, lookup latest COMPLETED scan for base commit, create HealthScan record, dispatch workflow, return 201)
- [x] T021 [US2] Implement PATCH handler in app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts (workflow token auth, Zod validation, status transition validation, update scan record, on COMPLETED: update HealthScore sub-score + recalculate globalScore + update last scan timestamp)
- [x] T022 [US2] Create useTriggerScan mutation hook in app/lib/hooks/mutations/useTriggerScan.ts (POST to trigger endpoint, invalidate health queries on success)
- [x] T023 [US2] Wire scan trigger and real-time states into health-module-card.tsx and health-dashboard.tsx (connect useTriggerScan to action buttons, connect useHealthPolling for live card state updates)

**Checkpoint**: Scan trigger works end-to-end, cards show real-time state transitions, global score recalculates on completion

---

## Phase 5: User Story 3 — Navigate to Health via Sidebar (Priority: P2)

**Goal**: Health entry appears in sidebar under "Views" group after "Comparisons" with HeartPulse icon

**Independent Test**: Click Health sidebar entry from any project page and verify navigation to `/projects/[projectId]/health`

### Implementation for User Story 3

- [x] T024 [US3] Add Health navigation entry to components/navigation/nav-items.ts (id: 'health', label: 'Health', icon: HeartPulse from lucide-react, href: '/health', group: 'views', positioned after Comparisons)
- [x] T025 [US3] E2E test for sidebar health navigation in tests/e2e/health-navigation.spec.ts (verify Health entry visible under Views, click navigates to correct URL)

**Checkpoint**: Health is discoverable and accessible from the sidebar on all project pages

---

## Phase 6: User Story 4 — Incremental Scan Execution (Priority: P2)

**Goal**: Subsequent scans only analyze commits since the last scanned commit per module type, reducing scan time and cost

**Independent Test**: Run two consecutive scans for the same module and verify the second scan uses the first scan's headCommit as its baseCommit

### Implementation for User Story 4

- [ ] T026 [US4] Verify and harden incremental scan logic in POST handler (app/api/projects/[projectId]/health/scans/route.ts) — ensure baseCommit lookup queries latest COMPLETED scan of same type/project, first scan has null baseCommit, per-type independence
- [ ] T027 [US4] Integration test for incremental scanning in tests/integration/health/incremental-scan.test.ts (first scan has null baseCommit, second scan uses prior headCommit, type independence between modules)

**Checkpoint**: Incremental scans correctly scope to changed commits per module type

---

## Phase 7: User Story 5 — View Scan History (Priority: P3)

**Goal**: Retrieve paginated scan history with optional type filtering, ordered by most recent first

**Independent Test**: Retrieve scan history for a project with multiple scans, verify pagination and type filtering work correctly

### Implementation for User Story 5

- [ ] T028 [US5] Implement GET handler in app/api/projects/[projectId]/health/scans/route.ts (Zod validation for type/limit/cursor query params, cursor-based pagination, type filtering, ordered by createdAt DESC, return scans + nextCursor + hasMore)
- [ ] T029 [US5] Integration test for scan history in tests/integration/health/scan-history.test.ts (pagination, type filtering, empty results, auth checks)

**Checkpoint**: Scan history API returns paginated, filterable results

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Responsive layout, accessibility, and final validation

- [ ] T030 Verify responsive layout — 2-column grid collapses to single column on small screens, hero zone stacks vertically (FR-021)
- [ ] T031 Verify all health page elements use semantic color tokens with no hardcoded hex/rgb values (FR-020, SC-008)
- [ ] T032 Run quickstart.md validation — verify all files created match the specification and implementation order

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma models must exist) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core page rendering
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different files), but integrates with US1 components at T023
- **US3 (Phase 5)**: Depends on Phase 2 only — fully independent, can run in parallel with US1/US2
- **US4 (Phase 6)**: Depends on US2 (T020 must exist for incremental logic)
- **US5 (Phase 7)**: Depends on Phase 2 — extends the scans route from US2
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependencies on other stories
- **US2 (P1)**: After Phase 2 — integrates with US1 UI components at T023
- **US3 (P2)**: After Phase 2 — fully independent of US1/US2
- **US4 (P2)**: After US2 — extends trigger scan endpoint logic
- **US5 (P3)**: After Phase 2 — shares scans route file with US2

### Within Each User Story

- Tests written FIRST and verified to FAIL before implementation
- Models/types before services
- Services before API endpoints
- API endpoints before client hooks
- Client hooks before UI components
- Core implementation before integration

### Parallel Opportunities

- T006, T007, T008 (US1 tests) — all parallel, different files
- T010, T011, T012 (US1 components) — all parallel, different files
- T017, T018 (US2 tests) — parallel, different files
- US1 and US3 — fully parallel (no shared files)
- US1 and US2 — parallel until T023 integration point

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task T006: "Unit test for score calculator in tests/unit/health/score-calculator.test.ts"
Task T007: "Component test for health hero in tests/unit/components/health-hero.test.tsx"
Task T008: "Component test for health module card in tests/unit/components/health-module-card.test.tsx"

# Launch all US1 leaf components together:
Task T010: "Create health sub-score badge in components/health/health-sub-score-badge.tsx"
Task T011: "Create health hero in components/health/health-hero.tsx"
Task T012: "Create health module card in components/health/health-module-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Prisma schema + migration)
2. Complete Phase 2: Foundational (score calculator + query keys)
3. Complete Phase 3: User Story 1 (health page with scores and cards)
4. **STOP and VALIDATE**: Navigate to `/projects/[projectId]/health`, verify scores display correctly
5. Deploy/demo if ready — page shows health overview even without scan capability

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add US1 (View Health) -> Test independently -> Deploy (MVP — read-only dashboard)
3. Add US2 (Trigger Scans) -> Test independently -> Deploy (interactive scanning)
4. Add US3 (Sidebar Nav) -> Test independently -> Deploy (discoverable)
5. Add US4 (Incremental Scans) -> Test independently -> Deploy (efficient scanning)
6. Add US5 (Scan History) -> Test independently -> Deploy (historical view)
7. Polish -> Final validation

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, launch in parallel:
   - Parallel task 1: US1 (View Health Overview)
   - Parallel task 2: US3 (Sidebar Navigation)
3. After US1 and US2 foundations are laid:
   - Parallel task 3: US2 integration (wire scan triggers into UI)
4. Sequential: US4 (extends US2), US5 (extends scans route)
5. Final: Polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Reuse `getScoreThreshold()`/`getScoreColor()` from `lib/quality-score.ts` — do NOT duplicate
- Aurora utility classes from `globals.css` — no custom CSS needed
- Semantic color tokens only — never hardcode hex/rgb
- Commit after each task or logical group
