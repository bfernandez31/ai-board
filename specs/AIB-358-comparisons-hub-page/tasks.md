# Tasks: Comparisons Hub Page

**Input**: Design documents from `/specs/AIB-358-comparisons-hub-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/comparisons-hub-api.md

**Tests**: Included per plan.md testing strategy (integration, component, E2E).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create page route and project component structure

- [x] T001 Create server component page route at app/projects/[projectId]/comparisons/page.tsx that reads projectId from params and renders ComparisonsPage client component
- [x] T002 [P] Add sidebar navigation item for Comparisons (GitCompare icon, group: views, after Analytics) in components/navigation/nav-items.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API endpoints and hooks that MUST be complete before user story UI components can be implemented

**Warning**: No user story UI work can begin until this phase is complete

- [x] T003 Rewrite GET handler in app/api/projects/[projectId]/comparisons/route.ts to query ComparisonRecord from database with Prisma (include participants, sourceTicket, winnerTicket relations), support limit/offset pagination, return ProjectComparisonSummary[] shape per contract
- [x] T004 [P] Create GET handler at app/api/projects/[projectId]/comparisons/[comparisonId]/route.ts for project-level comparison detail fetch using verifyProjectAccess, reusing enrichment logic from existing getComparisonDetailForTicket adapted for project context
- [x] T005 [P] Create GET handler at app/api/projects/[projectId]/tickets/verify/route.ts to list VERIFY-stage tickets (id, ticketKey, title, branch) for the project
- [x] T006 [P] Create POST handler at app/api/projects/[projectId]/comparisons/launch/route.ts with Zod validation (ticketIds min 2, max 5, no duplicates), verify all tickets in VERIFY stage with branches, create Job record, dispatch ai-board-assist.yml workflow
- [x] T007 Create TanStack Query hooks in hooks/use-project-comparisons.ts: useProjectComparisons (list with pagination), useProjectComparisonDetail (detail by ID), useVerifyStageTickets, useLaunchComparison (mutation with list invalidation) per contract specs

**Checkpoint**: All API endpoints and data hooks ready - UI component implementation can begin

---

## Phase 3: User Story 1 - Browse All Project Comparisons (Priority: P1) MVP

**Goal**: Users can navigate to the Comparisons page and see all project comparisons listed in reverse chronological order with summary data and pagination

**Independent Test**: Navigate to comparisons page, verify list renders with winner ticket key/title, participants, score, summary, date, and differentiator badges; verify empty state; verify "Load More" pagination

### Tests for User Story 1

- [ ] T008 [P] [US1] Integration test for GET /api/projects/:projectId/comparisons (pagination, empty project, authorization) in tests/integration/comparisons/comparisons-hub-api.test.ts
- [ ] T009 [P] [US1] Component test for ComparisonsPage empty state and list rendering in tests/unit/components/comparisons-page.test.tsx

### Implementation for User Story 1

- [ ] T010 [US1] Create comparisons page client component at components/comparisons/comparisons-page.tsx with list rendering, empty state (no comparisons message with guidance), loading skeleton, error state, and "Load More" pagination (track offset in state, append results, show button when more available)
- [ ] T011 [US1] Create comparison list item component at components/comparisons/comparison-list-item.tsx showing winner ticket key/title, participant count and ticket keys, winner score, summary (1-2 lines), generatedAt date, key differentiator badges, click handler for selection, active state styling

**Checkpoint**: User Story 1 fully functional - comparisons list with pagination and empty state

---

## Phase 4: User Story 2 - View Comparison Detail Inline (Priority: P1)

**Goal**: Users can click a comparison in the list to expand the full comparison dashboard inline, reusing all existing sub-components

**Independent Test**: Click a comparison entry, verify full dashboard (hero card, participant grid, stat cards, unified metrics, decision points, compliance heatmap) renders inline; click again to collapse; click different entry to swap

### Tests for User Story 2

- [ ] T012 [P] [US2] Component test for ComparisonInlineDetail expand/collapse behavior in tests/unit/components/comparison-inline-detail.test.tsx

### Implementation for User Story 2

- [ ] T013 [US2] Create inline detail wrapper at components/comparisons/comparison-inline-detail.tsx that renders existing sub-components (ComparisonHeroCard, ComparisonParticipantGrid, ComparisonStatCards, ComparisonUnifiedMetrics, ComparisonDecisionPoints, ComparisonComplianceHeatmap), includes loading skeleton while detail fetches, and collapse control
- [ ] T014 [US2] Integrate inline detail into comparisons-page.tsx: manage selectedComparisonId state, expand detail below selected list item, collapse on re-click or different selection, use useProjectComparisonDetail hook

**Checkpoint**: User Stories 1 AND 2 fully functional - list with inline detail expansion

---

## Phase 5: User Story 3 - Launch New Comparison from Hub (Priority: P2)

**Goal**: Users can click "New Comparison," select 2+ VERIFY-stage tickets, and trigger the comparison workflow from the hub page

**Independent Test**: Click "New Comparison," verify VERIFY-stage tickets shown with checkboxes; select 2+ tickets, click "Compare," verify workflow triggered and pending state shown; verify disabled button with <2 selections; verify empty state when no VERIFY tickets

### Tests for User Story 3

- [ ] T015 [P] [US3] Integration test for POST /api/projects/:projectId/comparisons/launch (validation, dispatch, error cases) in tests/integration/comparisons/new-comparison-launch.test.ts
- [ ] T016 [P] [US3] Component test for NewComparisonLauncher selection, validation, and empty state in tests/unit/components/new-comparison-launcher.test.tsx

### Implementation for User Story 3

- [ ] T017 [US3] Create new comparison launcher component at components/comparisons/new-comparison-launcher.tsx with "New Comparison" button opening shadcn Dialog, fetching VERIFY-stage tickets via useVerifyStageTickets, checkbox selection UI showing ticketKey/title/branch, "Compare" button disabled until 2+ selected, trigger useLaunchComparison mutation, empty state when no VERIFY tickets
- [ ] T018 [US3] Integrate launcher into comparisons-page.tsx: render NewComparisonLauncher in page header, show pending/loading state in list after launch, handle job completion polling to replace pending entry with real comparison

**Checkpoint**: User Stories 1, 2, AND 3 functional - full hub page with list, detail, and launch

---

## Phase 6: User Story 4 - Navigate to Comparisons via Sidebar (Priority: P2)

**Goal**: Users can access the Comparisons page from the sidebar navigation with active state highlighting

**Independent Test**: Click Comparisons icon in sidebar from any project view, verify navigation to /projects/{projectId}/comparisons; verify active state when on Comparisons page

### Tests for User Story 4

- [ ] T019 [US4] Unit test for nav-items configuration verifying Comparisons entry exists with correct properties in tests/unit/components/nav-items.test.ts

### Implementation for User Story 4

- [ ] T020 [US4] Verify sidebar navigation integration: confirm Comparisons nav item (added in T002) renders correctly, navigates to proper URL, and shows active state highlighting on the comparisons page

**Checkpoint**: Navigation fully functional - Comparisons accessible from sidebar

---

## Phase 7: User Story 5 - Responsive Layout (Priority: P3)

**Goal**: Comparisons page is usable on viewports from 375px to 1920px

**Independent Test**: Resize browser to mobile width (<768px), verify list displays as stacked cards; expand detail, verify sub-components stack vertically and remain readable

### Tests for User Story 5

- [ ] T021 [US5] E2E test for responsive layout verification at multiple viewports in tests/e2e/comparisons-hub.spec.ts

### Implementation for User Story 5

- [ ] T022 [US5] Add responsive Tailwind classes to components/comparisons/comparisons-page.tsx, comparison-list-item.tsx, and comparison-inline-detail.tsx: stacked card layout on <768px, grid/table on desktop, vertical stacking of detail sub-components on narrow viewports

**Checkpoint**: All user stories functional across all viewport sizes

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cross-cutting improvements

- [ ] T023 Verify existing ticket detail modal "Compare (N)" button still works (FR-013 no-regression check) — confirm independent API endpoints/hooks/component tree
- [ ] T024 Run quickstart.md validation — verify all implementation phases match quickstart steps
- [ ] T025 Run type-check (`bun run type-check`) and lint (`bun run lint`) across all new and modified files, fix any errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) are core — US2 depends on US1 (list must exist before detail expansion)
  - US3 (P2) is independent of US1/US2 (own APIs and UI)
  - US4 (P2) is independent (nav item added in Setup, verification only)
  - US5 (P3) depends on US1+US2+US3 (responsive applied to existing components)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (integrates into comparisons-page.tsx)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P2)**: Can start after Setup (Phase 1) - Independent
- **User Story 5 (P3)**: Depends on US1+US2+US3 (applies responsive styles to their components)

### Within Each User Story

- Tests written first, verify they reference correct types/interfaces
- Models/hooks before components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (Setup phase)
- T003, T004, T005, T006 can run in parallel (different API route files)
- T008 and T009 can run in parallel (different test files)
- T012, T015, T016 can run in parallel (different test files, different stories)
- US3 and US4 can run in parallel with US1+US2 (independent concerns)

---

## Parallel Example: User Story 1

```bash
# Launch tests for US1 in parallel:
Task T008: "Integration test for comparisons hub API in tests/integration/comparisons/comparisons-hub-api.test.ts"
Task T009: "Component test for ComparisonsPage in tests/unit/components/comparisons-page.test.tsx"

# Then implement sequentially:
Task T010: "Create comparisons-page.tsx client component"
Task T011: "Create comparison-list-item.tsx component"
```

## Parallel Example: User Story 3

```bash
# Launch tests for US3 in parallel:
Task T015: "Integration test for launch comparison API"
Task T016: "Component test for NewComparisonLauncher"

# Then implement sequentially:
Task T017: "Create new-comparison-launcher.tsx component"
Task T018: "Integrate launcher into comparisons-page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test comparisons list with pagination and empty state
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test list independently -> MVP!
3. Add User Story 2 -> Test inline detail -> Core experience complete
4. Add User Story 3 -> Test comparison launch -> Full feature
5. Add User Story 4 -> Verify navigation -> Discoverable
6. Add User Story 5 -> Verify responsive -> Polish complete
7. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - Parallel track A: User Story 1 -> User Story 2 (sequential, US2 depends on US1)
   - Parallel track B: User Story 3 (independent)
   - Parallel track C: User Story 4 (independent)
3. After tracks complete: User Story 5 (responsive across all components)
4. Polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- No schema changes needed — all queries use existing ComparisonRecord model
- 100% reuse of existing comparison sub-components (SC-005)
- Existing ticket detail modal Compare button is unaffected (FR-013)
