# Tasks: Project Analytics Dashboard

**Input**: Design documents from `/specs/AIB-87-opus-project-analytics/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analytics-api.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create type system foundation

- [ ] T001 Install Recharts dependency with `bun add recharts`
- [ ] T002 [P] Create analytics types in lib/analytics/types.ts
- [ ] T003 [P] Add chart CSS variables (--chart-1 through --chart-5) to app/globals.css
- [ ] T004 [P] Add analytics query keys to app/lib/query-keys.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core analytics utilities and API that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create command-to-stage mapping function in lib/analytics/aggregations.ts
- [ ] T006 Implement time range date calculation in lib/analytics/aggregations.ts
- [ ] T007 Implement granularity auto-adjustment (daily vs weekly) in lib/analytics/aggregations.ts
- [ ] T008 [P] Create aggregateTools utility function in lib/analytics/aggregations.ts
- [ ] T009 [P] Create hasAnalyticsData utility function in lib/analytics/aggregations.ts
- [ ] T010 Create Prisma query helpers in lib/analytics/queries.ts (overview, cost, tokens, tools, workflow, velocity)
- [ ] T011 Create getAnalyticsData main orchestration function in lib/analytics/queries.ts
- [ ] T012 Create analytics API route at app/api/projects/[projectId]/analytics/route.ts

**Checkpoint**: Foundation ready - API returns analytics data, user story implementation can now begin

---

## Phase 3: User Story 7 - Navigate to Analytics (Priority: P1) 🎯 MVP

**Goal**: Add Analytics menu item to project dropdown for easy navigation

**Independent Test**: Click project menu dropdown → "Analytics" item visible → clicking navigates to /projects/{projectId}/analytics

### Implementation for User Story 7

- [ ] T013 [US7] Add BarChart3 icon import and Analytics menu item to components/project/project-menu.tsx
- [ ] T014 [US7] Create analytics page at app/projects/[projectId]/analytics/page.tsx (Server Component shell)

**Checkpoint**: Users can navigate to analytics page from project menu

---

## Phase 4: User Story 1 - View Project Cost Overview (Priority: P1)

**Goal**: Display four overview metric cards showing total cost, success rate, duration, and tickets shipped

**Independent Test**: Navigate to analytics page → four overview cards display accurate data from job history

### Implementation for User Story 1

- [ ] T015 [P] [US1] Create time-range-selector.tsx component in components/analytics/
- [ ] T016 [P] [US1] Create overview-cards.tsx component in components/analytics/ with four metric cards (cost, success rate, avg duration, tickets shipped)
- [ ] T017 [US1] Create analytics-dashboard.tsx client component in components/analytics/ with TanStack Query polling
- [ ] T018 [US1] Create empty-state.tsx component in components/analytics/ for projects without job data
- [ ] T019 [US1] Wire overview-cards into analytics-dashboard.tsx with data binding
- [ ] T020 [US1] Update analytics page.tsx to use AnalyticsDashboard component with initialData

**Checkpoint**: Analytics page displays overview cards with cost, success rate, duration, tickets shipped

---

## Phase 5: User Story 2 - Analyze Cost by Stage (Priority: P1)

**Goal**: Display horizontal bar chart showing cost breakdown by BUILD, SPECIFY, PLAN, VERIFY stages

**Independent Test**: Navigate to analytics page → Cost by Stage chart shows horizontal bars with cost values

### Implementation for User Story 2

- [ ] T021 [P] [US2] Create cost-by-stage-chart.tsx component in components/analytics/ using Recharts BarChart horizontal

**Checkpoint**: Cost by Stage chart displays stage breakdown

---

## Phase 6: User Story 3 - Track Cost Over Time (Priority: P2)

**Goal**: Display area chart with cost trends over selectable time periods

**Independent Test**: Navigate to analytics page → Cost Over Time area chart shows data → time range selector changes view

### Implementation for User Story 3

- [ ] T022 [P] [US3] Create cost-over-time-chart.tsx component in components/analytics/ using Recharts AreaChart

**Checkpoint**: Cost Over Time chart displays trends with time range selector functionality

---

## Phase 7: User Story 4 - Monitor Token Usage and Cache Efficiency (Priority: P2)

**Goal**: Display token breakdown and cache savings visualization

**Independent Test**: Navigate to analytics page → Token Usage chart shows input/output/cache → Cache Efficiency shows savings percentage

### Implementation for User Story 4

- [ ] T023 [P] [US4] Create token-usage-chart.tsx component in components/analytics/ using Recharts stacked/grouped BarChart
- [ ] T024 [P] [US4] Create cache-efficiency-chart.tsx component in components/analytics/ using Recharts PieChart (donut)

**Checkpoint**: Token Usage and Cache Efficiency charts display token metrics

---

## Phase 8: User Story 5 - Analyze Tool Usage Patterns (Priority: P3)

**Goal**: Display top 10 most frequently used AI tools as horizontal bar chart

**Independent Test**: Navigate to analytics page → Top Tools chart shows ranked tool usage

### Implementation for User Story 5

- [ ] T025 [P] [US5] Create top-tools-chart.tsx component in components/analytics/ using Recharts BarChart horizontal

**Checkpoint**: Top Tools chart displays tool usage rankings

---

## Phase 9: User Story 6 - View Workflow Distribution and Velocity (Priority: P3)

**Goal**: Display workflow type distribution (FULL/QUICK/CLEAN) and tickets shipped per week

**Independent Test**: Navigate to analytics page → Workflow Distribution donut shows proportions → Velocity chart shows weekly shipping

### Implementation for User Story 6

- [ ] T026 [P] [US6] Create workflow-distribution-chart.tsx component in components/analytics/ using Recharts PieChart (donut)
- [ ] T027 [P] [US6] Create velocity-chart.tsx component in components/analytics/ using Recharts BarChart

**Checkpoint**: Workflow Distribution and Velocity charts display productivity metrics

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, responsive layout, and validation

- [ ] T028 Implement responsive bento grid layout in analytics-dashboard.tsx for 768px-1920px+ screens
- [ ] T029 Add custom tooltip component with shadcn/ui styling for all charts
- [ ] T030 Add number formatting utilities (abbreviated format: $1.2K, percentage display) in lib/analytics/aggregations.ts
- [ ] T031 Ensure all chart components handle null/missing data gracefully with fallbacks
- [ ] T032 Verify dark mode support using CSS variables (hsl(var(--chart-N))) in all chart colors
- [ ] T033 Run quickstart.md validation - verify all steps work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - US7 (Navigation) → US1 (Overview) must be sequential (page must exist before cards)
  - US2-US6 (Charts) can proceed in parallel after US1 establishes dashboard structure
- **Polish (Phase 10)**: Depends on all chart components being complete

### User Story Dependencies

- **User Story 7 (P1)**: Can start after Foundational (Phase 2) - Creates page shell
- **User Story 1 (P1)**: Depends on US7 - Adds dashboard container and overview cards
- **User Story 2 (P1)**: Can start after US1 - Independent chart component
- **User Story 3 (P2)**: Can start after US1 - Independent chart component
- **User Story 4 (P2)**: Can start after US1 - Independent chart components
- **User Story 5 (P3)**: Can start after US1 - Independent chart component
- **User Story 6 (P3)**: Can start after US1 - Independent chart components

### Within Each User Story

- Components before integration
- Chart components can be developed in parallel (different files)
- Dashboard integration ties components together

### Parallel Opportunities

- T002, T003, T004 can run in parallel (Setup phase)
- T008, T009 can run in parallel (Foundational phase)
- T015, T016 can run in parallel (US1 - different components)
- All chart components (T021-T027) can run in parallel once US1 dashboard exists
- T023, T024 can run in parallel (US4 - Token and Cache charts)
- T026, T027 can run in parallel (US6 - Workflow and Velocity charts)

---

## Parallel Example: Chart Components

```bash
# After US1 dashboard exists, launch all chart components together:
Task: "Create cost-by-stage-chart.tsx component in components/analytics/"
Task: "Create cost-over-time-chart.tsx component in components/analytics/"
Task: "Create token-usage-chart.tsx component in components/analytics/"
Task: "Create cache-efficiency-chart.tsx component in components/analytics/"
Task: "Create top-tools-chart.tsx component in components/analytics/"
Task: "Create workflow-distribution-chart.tsx component in components/analytics/"
Task: "Create velocity-chart.tsx component in components/analytics/"
```

---

## Implementation Strategy

### MVP First (User Stories 7, 1, 2 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T012)
3. Complete Phase 3: US7 Navigation (T013-T014)
4. Complete Phase 4: US1 Overview Cards (T015-T020)
5. Complete Phase 5: US2 Cost by Stage (T021)
6. **STOP and VALIDATE**: Test navigation + overview + cost breakdown independently
7. Deploy/demo if ready - users can see cost overview and stage breakdown

### Incremental Delivery

1. Setup + Foundational → API ready
2. Add US7 (Navigation) + US1 (Overview) → Test independently → **MVP Demo**
3. Add US2 (Cost by Stage) → Test independently → Demo cost analysis
4. Add US3 (Cost Over Time) → Test independently → Demo trends
5. Add US4 (Token/Cache) → Test independently → Demo optimization insights
6. Add US5 (Tools) → Test independently → Demo tool patterns
7. Add US6 (Workflow/Velocity) → Test independently → Demo productivity
8. Polish phase → Full feature complete

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 33 |
| **Setup Tasks** | 4 |
| **Foundational Tasks** | 8 |
| **User Story Tasks** | 15 |
| **Polish Tasks** | 6 |
| **Parallelizable Tasks** | 16 |

### Tasks per User Story

| Story | Priority | Task Count |
|-------|----------|------------|
| US7 - Navigation | P1 | 2 |
| US1 - Cost Overview | P1 | 6 |
| US2 - Cost by Stage | P1 | 1 |
| US3 - Cost Over Time | P2 | 1 |
| US4 - Token/Cache | P2 | 2 |
| US5 - Tool Usage | P3 | 1 |
| US6 - Workflow/Velocity | P3 | 2 |

### Suggested MVP Scope

- **MVP (12 tasks)**: Setup (4) + Foundational (8) + US7 (2) + US1 (6) + US2 (1) = navigation + overview cards + cost breakdown
- **Full Feature**: All 33 tasks for complete analytics dashboard

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All chart components use Recharts with 'use client' directive
- Charts use CSS variables (--chart-1 through --chart-5) for dark mode support
- API aggregates data server-side; client receives pre-computed metrics
- 15-second polling interval consistent with existing notification pattern
- Empty states guide users toward creating workflows when no data exists
