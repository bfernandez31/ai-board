# Tasks: Activity Heatmap on Projects Page

**Feature**: `AIB-702-activity-heatmap-on` | **Status**: Actionable

## Phase 1: Setup
- [X] T001 Define heatmap types and Zod schemas (HeatmapDay, HeatmapStats, HeatmapFilters) in `lib/types/activity.ts` ✅ DONE
- [X] T002 Create feature directory structure in `components/projects/activity-heatmap/` ✅ DONE

## Phase 2: Foundational
- [ ] T003 Implement `lib/db/activity.ts` for heatmap data aggregation (counts per day, shipped tickets, cost calculation)
- [ ] T004 [P] Create integration test `tests/integration/activity/heatmap-aggregation.test.ts` for database aggregation logic
- [X] T005 Implement date utility functions (rolling 12-month boundaries, calendar year ranges, chipped edge logic) in `lib/utils/activity-date-utils.ts` ✅ DONE
- [X] T006 [P] Create unit test `tests/unit/activity/heatmap-logic.test.ts` for date boundaries and chipped edge calculations ✅ DONE

## Phase 3: User Story 1 - View Rolling Annual Heatmap (P1)
- [ ] T007 [US1] Create API route `app/api/activity/heatmap/route.ts` for fetching heatmap data with user authentication
- [ ] T008 [P] [US1] Extend `tests/integration/activity/api.test.ts` to include contract tests for `GET /api/activity/heatmap`
- [ ] T009 [US1] Implement `ActivityHeatmapGrid` and `ActivityHeatmapCell` components in `components/projects/activity-heatmap/`
- [ ] T010 [US1] Implement `ActivityHeatmap` main component with server-side data fetching for initial load
- [ ] T011 [US1] Inject `ActivityHeatmap` into `app/projects/page.tsx` below the project cards grid
- [ ] T012 [US1] Add Aurora theme intensity classes (`.aurora-cell-1`, `.aurora-cell-2`, etc.) to `app/globals.css`

## Phase 4: User Story 4 - View Detailed Daily Activity (P2)
- [ ] T013 [P] [US4] Implement `ActivityHeatmapTooltip` using shadcn/ui Tooltip component
- [ ] T014 [US4] Integrate `ActivityHeatmapTooltip` into `ActivityHeatmapCell` with mobile tap/touch support and conditional cost display

## Phase 5: User Story 2 - Filter Heatmap by Agent (P2)
- [ ] T015 [US2] Implement `ActivityHeatmapHeader` with Agent Filter dropdown (dynamically populated from user's jobs)
- [ ] T016 [US2] Update `lib/db/activity.ts` and API route to support filtering by effective agent (Ticket.agent ?? Project.defaultAgent)
- [ ] T017 [US2] Sync agent filter state to URL search parameters in `ActivityHeatmap` for shareable URLs

## Phase 6: User Story 3 - Select Historical Year (P3)
- [ ] T018 [US3] Implement Year Selector dropdown in `ActivityHeatmapHeader` (from account creation year to current)
- [ ] T019 [US3] Update `lib/db/activity.ts` and `ActivityHeatmapGrid` to handle calendar year boundaries and chipped edges

## Phase 7: Polish & Cross-cutting
- [ ] T020 [P] Implement horizontal scrolling for the heatmap grid on mobile viewports with sticky day labels
- [ ] T021 [P] Implement centered empty state message: "No activity to show yet — your AI work will appear here"
- [ ] T022 [P] Final performance validation of aggregation logic (ensuring < 200ms for annual range)
- [ ] T023 Final E2E validation of the heatmap interaction and filtering in `tests/e2e/activity-heatmap.spec.ts`

## Dependencies
- US1 is foundational for US2, US3, and US4.
- US4 (Tooltip) depends on US1 (Cell component).
- US2 and US3 depend on US1 and US2 (Header component).

## Parallel Execution Opportunities
- T004 (Integration Test) can run in parallel with T003 (DB Implementation).
- T006 (Unit Test) can run in parallel with T005 (Date Utils).
- T013 (Tooltip) can be developed independently of the main grid once types are defined.
- T020-T022 (Polish) can be done in parallel after US1 is complete.

## Implementation Strategy
1. **MVP First**: Complete Phase 1-3 to get a functional rolling 12-month heatmap on the projects page.
2. **Incremental Polish**: Add tooltips (US4) and filtering (US2) to enhance utility.
3. **Historical View**: Add year selection (US3) as the final functional increment.
