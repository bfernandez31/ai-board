# Tasks: Comparisons Hub Page With Project List, Inline Detail, and VERIFY Launch

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/contracts/comparisons-hub.openapi.yaml`

**Tests**: Include Vitest integration and component coverage because the implementation plan explicitly requires route, orchestration, and UI interaction tests for each story.

**Organization**: Tasks are grouped by setup, shared foundations, and then one phase per user story so each increment stays independently testable.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel when the referenced files do not overlap and prerequisite tasks are complete
- **[Story]**: User story label for story-specific work only (`[US1]`, `[US2]`, `[US3]`)
- Every task includes the exact file path it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared contracts and reusable fixtures before route and UI work starts.

- [ ] T001 Extend shared project comparison contracts in `/home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts`
- [ ] T002 [P] Add reusable comparison hub fixtures for project list, detail, candidate, and launch cases in `/home/runner/work/ai-board/ai-board/target/tests/helpers/comparison-fixtures.ts`
- [ ] T003 [P] Scaffold project comparison query keys and request helpers in `/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared data access and orchestration primitives that block all user stories.

**⚠️ CRITICAL**: Complete this phase before story implementation.

- [ ] T004 Create project-scoped comparison summary pagination helpers in `/home/runner/work/ai-board/ai-board/target/lib/comparison/project-comparison-summary.ts`
- [ ] T005 [P] Add project-authorized comparison detail loader reuse in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts`
- [ ] T006 [P] Create VERIFY candidate query and quality-state normalization helpers in `/home/runner/work/ai-board/ai-board/target/lib/comparison/project-comparison-candidates.ts`
- [ ] T007 Extract reusable compare launch orchestration helpers in `/home/runner/work/ai-board/ai-board/target/lib/comparison/project-comparison-launch.ts`

**Checkpoint**: Shared comparison hub infrastructure is ready for user-story delivery.

---

## Phase 3: User Story 1 - Browse project comparisons (Priority: P1) 🎯 MVP

**Goal**: Deliver a project-level comparisons page with paginated, newest-first saved comparison history.

**Independent Test**: Open `/projects/[projectId]/comparisons` for a project with seeded comparison records and confirm the page shows reverse-chronological summaries, page navigation, and the required empty state.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add project comparisons list integration coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparisons-route.test.ts`
- [ ] T009 [P] [US1] Add project navigation coverage for the comparisons destination in `/home/runner/work/ai-board/ai-board/target/tests/unit/navigation-utils.test.ts`

### Implementation for User Story 1

- [ ] T010 [US1] Rewrite the project comparisons list API to use durable `ComparisonRecord` pagination in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/route.ts`
- [ ] T011 [P] [US1] Add the `Comparisons` project navigation item in `/home/runner/work/ai-board/ai-board/target/components/navigation/nav-items.ts`
- [ ] T012 [P] [US1] Build the project comparisons page shell and paginated list layout in `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/comparisons/page.tsx`
- [ ] T013 [US1] Implement summary list, pagination controls, and empty/loading/error states in `/home/runner/work/ai-board/ai-board/target/components/comparison/project-comparisons-page.tsx`

**Checkpoint**: User Story 1 is complete when project members can browse saved comparisons from project navigation without opening a ticket.

---

## Phase 4: User Story 2 - Inspect a comparison inline (Priority: P2)

**Goal**: Let project members select a saved comparison and review the full dashboard inline on the same page.

**Independent Test**: Select one summary on the project comparisons page, verify the inline dashboard loads without a modal, then switch selections and confirm the detail view updates while the list stays visible.

### Tests for User Story 2

- [ ] T014 [P] [US2] Add project comparison detail route coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparison-detail-route.test.ts`
- [ ] T015 [P] [US2] Add inline selection and error-state component coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/project-comparisons-page.test.tsx`

### Implementation for User Story 2

- [ ] T016 [US2] Add the project-scoped comparison detail API endpoint in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/[comparisonId]/route.ts`
- [ ] T017 [P] [US2] Extend project detail queries and cache keys in `/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts`
- [ ] T018 [US2] Add inline comparison selection, detail loading, and recoverable error handling in `/home/runner/work/ai-board/ai-board/target/components/comparison/project-comparisons-page.tsx`
- [ ] T019 [US2] Reuse the saved dashboard renderer for the inline detail panel in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx`

**Checkpoint**: User Story 2 is complete when the same page can switch between saved comparisons and show full detail inline.

---

## Phase 5: User Story 3 - Launch a new comparison from VERIFY tickets (Priority: P3)

**Goal**: Allow project members to launch the existing compare workflow from the hub by selecting eligible VERIFY-stage tickets.

**Independent Test**: Open the launch flow on the project comparisons page, select at least two VERIFY tickets, submit the request, observe the pending state, and confirm the completed result becomes visible in refreshed history.

### Tests for User Story 3

- [ ] T020 [P] [US3] Add comparison launch orchestration integration coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparison-launch.test.ts`
- [ ] T021 [P] [US3] Add candidate selection and launch validation component coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/project-comparison-launch-sheet.test.tsx`
- [ ] T022 [P] [US3] Extend regression coverage for the existing ticket comparison entry point in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-api.test.ts`

### Implementation for User Story 3

- [ ] T023 [US3] Add the VERIFY comparison candidate API endpoint in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/candidates/route.ts`
- [ ] T024 [US3] Add the project comparison launch API endpoint that creates the comment and job workflow records in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/launch/route.ts`
- [ ] T025 [P] [US3] Extend project comparison candidate, launch mutation, and pending-job polling hooks in `/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts`
- [ ] T026 [P] [US3] Build the VERIFY ticket picker, launch CTA, and candidate empty state UI in `/home/runner/work/ai-board/ai-board/target/components/comparison/project-comparison-launch-sheet.tsx`
- [ ] T027 [US3] Integrate launch flow, pending banners, and post-completion invalidation into `/home/runner/work/ai-board/ai-board/target/components/comparison/project-comparisons-page.tsx`

**Checkpoint**: User Story 3 is complete when hub users can launch a comparison from VERIFY tickets and watch it resolve back into project history.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish shared UX and run the feature validation pass.

- [ ] T028 [P] Add responsive layout polish for mobile and desktop comparison hub states in `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/comparisons/page.tsx`
- [ ] T029 [P] Harden shared fallback copy and partial-data rendering for list, detail, and launch states in `/home/runner/work/ai-board/ai-board/target/components/comparison/project-comparisons-page.tsx`
- [ ] T030 Run feature validation commands from `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies; start immediately.
- **Phase 2: Foundational**: Depends on Phase 1; blocks all user stories.
- **Phase 3: US1**: Depends on Phase 2; establishes the MVP page, list route, and navigation entry.
- **Phase 4: US2**: Depends on Phase 3 because inline detail extends the same hub page and summary selection flow.
- **Phase 5: US3**: Depends on Phase 3 for the hub shell and should land after Phase 4 to reuse the finished page state management cleanly.
- **Phase 6: Polish**: Depends on the stories you intend to ship.

### User Story Dependency Graph

- **US1 (P1)** → **US2 (P2)** → **US3 (P3)**
- US1 is the suggested MVP scope.
- US2 depends on the project hub list and page shell from US1.
- US3 depends on the hub shell from US1 and benefits from the settled inline detail/error-state structure from US2.

### Within Each User Story

- Write the listed tests first and confirm they fail before implementation.
- Land data/API work before page integration.
- Finish loading, empty, and error states before considering the story complete.

## Parallel Opportunities

- Setup: `T002` and `T003` can run in parallel after `T001`.
- Foundational: `T005` and `T006` can run in parallel after `T004`; `T007` can start once the needed shared types exist.
- US1: `T008` and `T009` can run in parallel; `T011` and `T012` can run in parallel after `T010`.
- US2: `T014` and `T015` can run in parallel; `T017` and `T019` can run in parallel after `T016`.
- US3: `T020`, `T021`, and `T022` can run in parallel; `T025` and `T026` can run in parallel after `T023` and `T024`.
- Polish: `T028` and `T029` can run in parallel before the final validation task.

## Parallel Example: User Story 1

```text
T008 [US1] Add project comparisons list integration coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparisons-route.test.ts
T009 [US1] Add project navigation coverage for the comparisons destination in /home/runner/work/ai-board/ai-board/target/tests/unit/navigation-utils.test.ts

T011 [US1] Add the Comparisons project navigation item in /home/runner/work/ai-board/ai-board/target/components/navigation/nav-items.ts
T012 [US1] Build the project comparisons page shell and paginated list layout in /home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/comparisons/page.tsx
```

## Parallel Example: User Story 2

```text
T014 [US2] Add project comparison detail route coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparison-detail-route.test.ts
T015 [US2] Add inline selection and error-state component coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/project-comparisons-page.test.tsx

T017 [US2] Extend project detail queries and cache keys in /home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts
T019 [US2] Reuse the saved dashboard renderer for the inline detail panel in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx
```

## Parallel Example: User Story 3

```text
T020 [US3] Add comparison launch orchestration integration coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparison-launch.test.ts
T021 [US3] Add candidate selection and launch validation component coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/project-comparison-launch-sheet.test.tsx
T022 [US3] Extend regression coverage for the existing ticket comparison entry point in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-api.test.ts

T025 [US3] Extend project comparison candidate, launch mutation, and pending-job polling hooks in /home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts
T026 [US3] Build the VERIFY ticket picker, launch CTA, and candidate empty state UI in /home/runner/work/ai-board/ai-board/target/components/comparison/project-comparison-launch-sheet.tsx
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) only.
3. Validate the project comparisons page, pagination behavior, navigation entry, and empty state.

### Incremental Delivery

1. Deliver US1 to unlock project-wide browsing.
2. Add US2 to keep comparison inspection on the same page.
3. Add US3 to remove the command-only launch workflow.
4. Finish responsive and fallback-state polish, then run the quickstart validation commands.

### Suggested Shipping Slices

1. **MVP**: `T001`-`T013`
2. **Inline detail**: `T014`-`T019`
3. **Launch from VERIFY**: `T020`-`T027`
4. **Polish/validation**: `T028`-`T030`

## Notes

- No Prisma schema migration is planned for this feature.
- Keep ticket-detail comparison routes working independently while adding the project-scoped hub.
- Use only static Tailwind class strings and semantic tokens in the new hub UI files.
