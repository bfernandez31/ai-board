# Tasks: Project Analytics Dashboard

**Input**: Design documents from `/specs/AIB-83-project-analytics-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analytics-api.yaml

**Tests**: Tests are NOT explicitly requested in the spec, but the quickstart.md follows TDD. We'll include unit and integration tests as described in quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router: `app/`, `components/`, `lib/`, `tests/`
- TypeScript strict mode throughout

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic analytics structure

- [x] T001 Create TypeScript types for all analytics entities in lib/analytics/types.ts
- [x] T002 Install shadcn/ui chart components if not present (npx shadcn@latest add chart)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core analytics infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create unit test file for aggregation functions in tests/unit/analytics/aggregations.test.ts
- [ ] T004 Create unit test file for calculation functions in tests/unit/analytics/calculations.test.ts
- [ ] T005 Implement calculateCacheEfficiency function in lib/analytics/calculations.ts
- [ ] T006 [P] Implement calculateSuccessRate function in lib/analytics/calculations.ts
- [ ] T007 [P] Implement formatDuration function in lib/analytics/calculations.ts
- [ ] T008 Implement aggregateCostByStage function in lib/analytics/aggregations.ts
- [ ] T009 [P] Implement aggregateToolUsage function in lib/analytics/aggregations.ts
- [ ] T010 [P] Implement COMMAND_TO_STAGE lookup table in lib/analytics/types.ts
- [ ] T011 Create Prisma query function fetchJobsForAnalytics in lib/db/analytics-queries.ts
- [ ] T012 [P] Create Prisma query function fetchTicketsForVelocity in lib/db/analytics-queries.ts
- [ ] T013 [P] Create Prisma query function aggregateCostSummary in lib/db/analytics-queries.ts
- [ ] T014 Create analytics API route in app/api/projects/[projectId]/analytics/route.ts (basic structure with auth)
- [ ] T015 Implement API route validation and authorization using verifyProjectAccess in app/api/projects/[projectId]/analytics/route.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Project Cost Overview (Priority: P1) 🎯 MVP

**Goal**: Display total project cost, cost trend percentage, and handle zero-data scenarios

**Independent Test**: Create test jobs with telemetry data, navigate to analytics page, verify cost metrics display correctly

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [P] [US1] Write Playwright API test for GET /api/projects/[projectId]/analytics returns 200 in tests/integration/analytics/api.spec.ts
- [x] T017 [P] [US1] Write Playwright API test for no jobs returns valid empty structure in tests/integration/analytics/api.spec.ts
- [x] T018 [P] [US1] Write unit tests for cost aggregation logic in tests/unit/analytics/aggregations.test.ts

### Implementation for User Story 1

- [x] T019 [US1] Implement total cost aggregation in API route (sum Job.costUsd) in app/api/projects/[projectId]/analytics/route.ts
- [x] T020 [US1] Implement cost trend calculation (current vs previous 30 days) in app/api/projects/[projectId]/analytics/route.ts
- [x] T021 [P] [US1] Create OverviewCards component skeleton in components/analytics/overview-cards.tsx
- [x] T022 [US1] Implement Total Cost card with trend percentage in components/analytics/overview-cards.tsx
- [x] T023 [US1] Add "No data available" handling for zero cost scenarios in components/analytics/overview-cards.tsx
- [x] T024 [US1] Create analytics page route in app/(authenticated)/project/[projectKey]/analytics/page.tsx
- [x] T025 [US1] Fetch analytics data via API and render Total Cost card in app/(authenticated)/project/[projectKey]/analytics/page.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - total cost displays with trend

---

## Phase 4: User Story 2 - Monitor Job Success Rates (Priority: P1)

**Goal**: Display success rate percentage calculated from job statuses

**Independent Test**: Create jobs with different statuses (COMPLETED/FAILED/CANCELLED), verify success rate percentage is calculated correctly

### Tests for User Story 2

- [x] T026 [P] [US2] Write unit tests for calculateSuccessRate with edge cases (0 jobs, all completed, etc.) in tests/unit/analytics/calculations.test.ts
- [x] T027 [P] [US2] Write Playwright test for success rate display in tests/integration/analytics/dashboard.spec.ts

### Implementation for User Story 2

- [x] T028 [US2] Implement success rate aggregation in API route using Prisma groupBy in app/api/projects/[projectId]/analytics/route.ts
- [x] T029 [US2] Add Success Rate card to OverviewCards component in components/analytics/overview-cards.tsx
- [x] T030 [US2] Handle "N/A - No completed jobs" edge case in components/analytics/overview-cards.tsx
- [x] T031 [US2] Add average duration calculation to API route in app/api/projects/[projectId]/analytics/route.ts
- [x] T032 [US2] Add Avg Duration card to OverviewCards component in components/analytics/overview-cards.tsx
- [x] T033 [US2] Add Tickets Shipped This Month calculation to API route in app/api/projects/[projectId]/analytics/route.ts
- [x] T034 [US2] Add Tickets Shipped card to OverviewCards component in components/analytics/overview-cards.tsx

**Checkpoint**: At this point, all 4 overview cards display correctly with real metrics

---

## Phase 5: User Story 3 - Analyze Cost by Workflow Stage (Priority: P2)

**Goal**: Display horizontal bar chart showing cost breakdown by stage (SPECIFY, PLAN, BUILD, VERIFY)

**Independent Test**: Create jobs across different commands, verify costs are correctly grouped by stage using COMMAND_TO_STAGE mapping

### Tests for User Story 3

- [x] T035 [P] [US3] Write unit tests for aggregateCostByStage function in tests/unit/analytics/aggregations.test.ts
- [x] T036 [P] [US3] Write Playwright test for cost-by-stage chart rendering in tests/integration/analytics/dashboard.spec.ts

### Implementation for User Story 3

- [x] T037 [US3] Implement cost-by-stage aggregation in API route using COMMAND_TO_STAGE lookup in app/api/projects/[projectId]/analytics/route.ts
- [x] T038 [US3] Create CostByStageChart component using Recharts BarChart (horizontal) in components/analytics/cost-by-stage-chart.tsx
- [x] T039 [US3] Add tooltip formatter for currency display in components/analytics/cost-by-stage-chart.tsx
- [x] T040 [US3] Handle empty data state ("No data available") in components/analytics/cost-by-stage-chart.tsx
- [x] T041 [US3] Add CostByStageChart to analytics page in Bento Grid layout in app/(authenticated)/project/[projectKey]/analytics/page.tsx

**Checkpoint**: Cost-by-stage chart displays with sorted bars (highest to lowest)

---

## Phase 6: User Story 4 - Track Token Usage Patterns (Priority: P2)

**Goal**: Display token usage breakdown (input, output, cache tokens) and cache efficiency donut chart

**Independent Test**: Create jobs with different token distributions, verify stacked bars and cache efficiency display correctly

### Tests for User Story 4

- [x] T042 [P] [US4] Write unit tests for cache efficiency formula in tests/unit/analytics/calculations.test.ts
- [x] T043 [P] [US4] Write Playwright test for token usage chart in tests/integration/analytics/dashboard.spec.ts

### Implementation for User Story 4

- [x] T044 [US4] Implement token usage aggregation in API route (sum all token fields) in app/api/projects/[projectId]/analytics/route.ts
- [x] T045 [US4] Implement cache efficiency calculation in API route in app/api/projects/[projectId]/analytics/route.ts
- [x] T046 [P] [US4] Create TokenUsageChart component using Recharts stacked BarChart in components/analytics/token-usage-chart.tsx
- [x] T047 [P] [US4] Create CacheEfficiencyChart component using Recharts PieChart (donut) in components/analytics/cache-efficiency-chart.tsx
- [x] T048 [US4] Add tooltips showing exact counts and percentages in components/analytics/token-usage-chart.tsx
- [x] T049 [US4] Handle 0% cache efficiency edge case with educational tooltip in components/analytics/cache-efficiency-chart.tsx
- [x] T050 [US4] Add TokenUsageChart and CacheEfficiencyChart to analytics page in app/(authenticated)/project/[projectKey]/analytics/page.tsx

**Checkpoint**: Token usage and cache efficiency charts display with correct calculations

---

## Phase 7: User Story 5 - Identify Most-Used Tools (Priority: P3)

**Goal**: Display top 10 most frequently used Claude tools as horizontal bar chart

**Independent Test**: Create jobs with toolsUsed arrays, verify bars are sorted by frequency (highest first)

### Tests for User Story 5

- [x] T051 [P] [US5] Write unit tests for aggregateToolUsage function in tests/unit/analytics/aggregations.test.ts
- [x] T052 [P] [US5] Write Playwright test for top tools chart in tests/integration/analytics/dashboard.spec.ts

### Implementation for User Story 5

- [x] T053 [US5] Implement tool usage aggregation in API route (flatten arrays, count frequencies) in app/api/projects/[projectId]/analytics/route.ts
- [x] T054 [US5] Create TopToolsChart component using Recharts BarChart (horizontal) in components/analytics/top-tools-chart.tsx
- [x] T055 [US5] Implement top 10 limiting and percentage calculation in components/analytics/top-tools-chart.tsx
- [x] T056 [US5] Handle empty toolsUsed data ("No tool data available") in components/analytics/top-tools-chart.tsx
- [x] T057 [US5] Add TopToolsChart to analytics page in app/(authenticated)/project/[projectKey]/analytics/page.tsx

**Checkpoint**: Top tools chart displays sorted by frequency with percentages

---

## Phase 8: User Story 6 - View Cost Trends Over Time (Priority: P3)

**Goal**: Display area chart showing daily cost trends with toggle for daily/weekly granularity

**Independent Test**: Create jobs with different completion dates, verify daily/weekly aggregation renders correctly

### Tests for User Story 6

- [x] T058 [P] [US6] Write unit tests for time-series grouping logic in tests/unit/analytics/aggregations.test.ts
- [x] T059 [P] [US6] Write Playwright test for cost-over-time chart in tests/integration/analytics/dashboard.spec.ts

### Implementation for User Story 6

- [x] T060 [US6] Implement daily cost aggregation using Prisma groupBy in app/api/projects/[projectId]/analytics/route.ts
- [x] T061 [US6] Create CostOverTimeChart component using Recharts AreaChart in components/analytics/cost-over-time-chart.tsx
- [x] T062 [US6] Implement daily/weekly toggle switch in components/analytics/cost-over-time-chart.tsx
- [x] T063 [US6] Add client-side weekly aggregation from daily data in components/analytics/cost-over-time-chart.tsx
- [x] T064 [US6] Add hover tooltips showing date, cost, and job count in components/analytics/cost-over-time-chart.tsx
- [x] T065 [US6] Add CostOverTimeChart to analytics page (lg:col-span-2 for prominence) in app/(authenticated)/project/[projectKey]/analytics/page.tsx

**Checkpoint**: Cost-over-time chart displays with smooth area curve and functional toggle

---

## Phase 9: User Story 7 - Understand Workflow Distribution (Priority: P3)

**Goal**: Display donut chart showing distribution of FULL/QUICK/CLEAN workflows

**Independent Test**: Create tickets with different workflowType values, verify segment sizes match distribution

### Tests for User Story 7

- [x] T066 [P] [US7] Write unit tests for workflow distribution aggregation in tests/unit/analytics/aggregations.test.ts
- [x] T067 [P] [US7] Write Playwright test for workflow distribution chart in tests/integration/analytics/dashboard.spec.ts

### Implementation for User Story 7

- [x] T068 [US7] Implement workflow distribution aggregation using Ticket.workflowType in app/api/projects/[projectId]/analytics/route.ts
- [x] T069 [US7] Create WorkflowDistributionChart component using Recharts PieChart (donut) in components/analytics/workflow-distribution-chart.tsx
- [x] T070 [US7] Add percentage labels to donut segments in components/analytics/workflow-distribution-chart.tsx
- [x] T071 [US7] Handle single workflow type edge case (100% full circle) in components/analytics/workflow-distribution-chart.tsx
- [x] T072 [US7] Add WorkflowDistributionChart to analytics page in app/(authenticated)/project/[projectKey]/analytics/page.tsx

**Checkpoint**: Workflow distribution donut chart displays with proportional segments and percentages

---

## Phase 10: User Story 8 - Monitor Ticket Velocity (Priority: P3)

**Goal**: Display bar chart showing tickets shipped per week for last 8-12 weeks

**Independent Test**: Create tickets in SHIP stage with different updatedAt timestamps, verify weekly aggregation is correct

### Tests for User Story 8

- [x] T073 [P] [US8] Write unit tests for velocity weekly grouping in tests/unit/analytics/aggregations.test.ts
- [x] T074 [P] [US8] Write Playwright test for velocity chart in tests/integration/analytics/dashboard.spec.ts

### Implementation for User Story 8

- [x] T075 [US8] Implement velocity aggregation in API route (Ticket.stage=SHIP, group by ISO week) in app/api/projects/[projectId]/analytics/route.ts
- [x] T076 [US8] Create VelocityChart component using Recharts BarChart in components/analytics/velocity-chart.tsx
- [x] T077 [US8] Implement ISO week calculation and week label formatting in components/analytics/velocity-chart.tsx
- [x] T078 [US8] Handle empty velocity data ("No tickets shipped yet") in components/analytics/velocity-chart.tsx
- [x] T079 [US8] Add VelocityChart to analytics page in app/(authenticated)/project/[projectKey]/analytics/page.tsx

**Checkpoint**: All user stories complete - all 7 charts and 4 overview cards functional

---

## Phase 11: Navigation & Integration

**Purpose**: Connect analytics page to project navigation

- [x] T080 Locate existing project dropdown menu component (search for "project menu" or "dropdown")
- [x] T081 Add "Analytics" menu item with BarChart3 icon to project dropdown
- [x] T082 Link Analytics menu item to /project/[projectKey]/analytics route
- [x] T083 Write Playwright test for navigation menu item visibility in tests/integration/analytics/dashboard.spec.ts
- [x] T084 Test analytics page authorization (403 for non-members) in tests/integration/analytics/api.spec.ts

**Checkpoint**: Analytics accessible from project menu with proper authorization

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Responsive layout, error handling, performance validation

- [ ] T085 [P] Add responsive Bento Grid layout for charts (mobile, tablet, desktop) in app/(authenticated)/project/[projectKey]/analytics/page.tsx
- [ ] T086 [P] Add loading skeleton for analytics page in components/analytics/analytics-skeleton.tsx
- [ ] T087 [P] Add error state component with retry button in components/analytics/error-state.tsx
- [ ] T088 Test responsive layout on mobile viewport (320px) using Playwright in tests/integration/analytics/dashboard.spec.ts
- [ ] T089 Add JSDoc comments to all exported functions in lib/analytics/
- [ ] T090 [P] Verify page load time <2 seconds for 500 jobs (manual test or performance audit)
- [ ] T091 Run full test suite: bun run type-check && bun run test:unit && bun run test:e2e
- [ ] T092 Run production build: bun run build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order: US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8
- **Navigation (Phase 11)**: Depends on at least US1 completion (can happen after US1 is done)
- **Polish (Phase 12)**: Depends on all user stories being complete

### User Story Dependencies

All user stories are **independent** after Foundational phase:

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Adds to same OverviewCards component
- **User Story 3 (P2)**: Can start after Foundational - Independent chart component
- **User Story 4 (P2)**: Can start after Foundational - Independent chart components
- **User Story 5 (P3)**: Can start after Foundational - Independent chart component
- **User Story 6 (P3)**: Can start after Foundational - Independent chart component
- **User Story 7 (P3)**: Can start after Foundational - Independent chart component
- **User Story 8 (P3)**: Can start after Foundational - Independent chart component

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- API aggregation before component creation
- Component implementation before page integration
- Story complete and tested before moving to next priority

### Parallel Opportunities

- **Setup (Phase 1)**: Both tasks can run in parallel
- **Foundational (Phase 2)**: Tasks T006-T007, T009-T010, T012-T013 marked [P] can run in parallel
- **User Story Tests**: All test tasks marked [P] within a story can run in parallel
- **User Story Implementation**: Tasks marked [P] within a story can run in parallel (different files)
- **Different User Stories**: All user stories can be worked on in parallel by different team members after Foundational phase

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write Playwright API test for GET /api/projects/[projectId]/analytics returns 200 in tests/integration/analytics/api.spec.ts"
Task: "Write Playwright API test for no jobs returns valid empty structure in tests/integration/analytics/api.spec.ts"
Task: "Write unit tests for cost aggregation logic in tests/unit/analytics/aggregations.test.ts"

# After tests fail, launch implementation tasks:
Task: "Create OverviewCards component skeleton in components/analytics/overview-cards.tsx"
# Then sequentially implement cost aggregation and display
```

---

## Parallel Example: User Story 4

```bash
# Launch both chart components in parallel (different files):
Task: "Create TokenUsageChart component using Recharts stacked BarChart in components/analytics/token-usage-chart.tsx"
Task: "Create CacheEfficiencyChart component using Recharts PieChart (donut) in components/analytics/cache-efficiency-chart.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Total Cost Overview)
4. Complete Phase 4: User Story 2 (Success Rates + Complete Overview Cards)
5. Complete Phase 11: Navigation (make it accessible)
6. **STOP and VALIDATE**: Test overview cards work correctly
7. Deploy/demo if ready (basic analytics with 4 metrics visible)

### Incremental Delivery

1. **Foundation**: Setup + Foundational → API structure ready
2. **MVP (P1 stories)**: US1 + US2 → 4 overview cards working → Deploy/Demo
3. **Stage Analysis (P2)**: US3 → Cost-by-stage chart → Deploy/Demo
4. **Token Insights (P2)**: US4 → Token usage + cache efficiency → Deploy/Demo
5. **Advanced Analytics (P3)**: US5 → Top tools → Deploy/Demo
6. **Trend Analysis (P3)**: US6 → Cost over time → Deploy/Demo
7. **Process Metrics (P3)**: US7 + US8 → Workflow distribution + velocity → Deploy/Demo
8. **Polish**: Phase 12 → Responsive, error handling, performance → Final release

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together**
2. **Once Foundational is done, parallel user story implementation**:
   - Developer A: US1 (Cost Overview) + US2 (Success Rates)
   - Developer B: US3 (Cost by Stage) + US4 (Token Usage)
   - Developer C: US5 (Top Tools) + US6 (Cost Over Time)
   - Developer D: US7 (Workflow Distribution) + US8 (Velocity)
3. **Integration**: All stories merge, Navigation added, Polish applied
4. Each story completes and integrates independently

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Each user story**: Independently completable and testable after Foundational phase
- **TDD approach**: Write tests first, verify they fail, then implement to make them pass
- **Commit strategy**: Commit after each task or logical group
- **Checkpoints**: Stop at any checkpoint to validate story independently
- **No schema changes**: All data comes from existing Job and Ticket models
- **Authorization**: All API routes use verifyProjectAccess (owner or member)
- **Performance target**: Page load <2 seconds for 500 jobs
- **Responsive**: Bento Grid layout adapts to mobile/tablet/desktop
- **Empty data handling**: All charts display "No data available" gracefully

---

## Success Metrics

Feature is complete when:
- ✅ All 92 tasks completed
- ✅ All unit tests pass (bun run test:unit)
- ✅ All integration tests pass (bun run test:e2e)
- ✅ TypeScript compilation succeeds (bun run type-check)
- ✅ Production build succeeds (bun run build)
- ✅ All 4 overview cards display correctly
- ✅ All 7 charts render with real data
- ✅ Authorization enforced (403 for non-members)
- ✅ Page loads in <2 seconds for 500 jobs
- ✅ Responsive layout works on mobile (320px+)
- ✅ No console errors or warnings

---

**Total Tasks**: 92 tasks
**Estimated Time**: 4-6 hours (per quickstart.md)
**MVP Scope**: User Stories 1-2 (T001-T034 + Navigation: T080-T084) = ~39 tasks
**Full Feature**: All 8 user stories + Navigation + Polish = 92 tasks
