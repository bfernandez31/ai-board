# Tasks: Display health score heart indicator on project cards

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/contracts/api-projects-get.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/quickstart.md`

**Tests**: Test tasks are included by default. Extend existing coverage first; create a new test file only where the research inventory shows the domain is currently uncovered.

**Organization**: Tasks are grouped by shared setup, blocking foundations, then user stories in spec priority order so each story remains independently testable.

## Format: `[ID] [P?] [Story] Description`
- `[P]` marks tasks that can run in parallel because they touch different files and do not depend on incomplete work in the same phase.
- `[Story]` appears only on user-story tasks and maps directly to `/home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/spec.md`.
- Every task below names the exact file it must update or create.

## Phase 1: Setup

**Purpose**: Establish the shared typed contract that all list, API, and UI work will consume.

- [X] T001 Define `ProjectHealthSummary`, `ProjectHealthSubScores`, and the extended `ProjectWithCount` response shape in /home/runner/work/ai-board/ai-board/target/app/lib/types/project.ts

---

## Phase 2: Foundational

**Purpose**: Build the shared data plumbing that blocks every user story until complete.

**⚠️ CRITICAL**: No user story work should begin until these tasks are done.

- [X] T002 [P] Extend `getUserProjects()` to select the persisted `healthScore` fields needed by project cards in /home/runner/work/ai-board/ai-board/target/lib/db/projects.ts
- [X] T003 [P] Add a batched project-list Quality Gate aggregation helper that returns current averages by project ID in /home/runner/work/ai-board/ai-board/target/lib/health/quality-gate.ts

**Checkpoint**: The projects list can now obtain every raw health input in one server-side load.

---

## Phase 3: User Story 1 - Scan project health from the project list (Priority: P1) 🎯 MVP

**Goal**: Show each project card’s overall health score or no-data state directly on the Projects page.

**Independent Test**: Load the projects list with scored and unscored projects and confirm each card shows the correct heart state and numeric score, with no need to open a project first.

### Tests for User Story 1

- [X] T004 [US1] Extend scored and no-data `GET /api/projects` health summary coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/projects/crud.test.ts

### Implementation for User Story 1

- [X] T005 [P] [US1] Map selected health inputs into `healthSummary` for the server-rendered Projects page in /home/runner/work/ai-board/ai-board/target/app/projects/page.tsx
- [X] T006 [P] [US1] Map selected health inputs into the `GET /api/projects` response using the contract in /home/runner/work/ai-board/ai-board/target/app/api/projects/route.ts
- [X] T007 [P] [US1] Create the scored and no-data heart indicator UI with accessible overall-score labeling in /home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx
- [X] T008 [US1] Render the health indicator in the project-card header without displacing the existing menu or card content in /home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx

**Checkpoint**: User Story 1 is complete when project cards show correct overall health at first render and the integration test passes.

---

## Phase 4: User Story 2 - Understand the reason behind a health score (Priority: P2)

**Goal**: Let users inspect the six health sub-scores from the card without adding navigation or actions.

**Independent Test**: Reveal the indicator details on a project card and confirm the popover shows Security, Compliance, Tests, Spec Sync, Quality Gate, and Review Quality, with `—` for missing values.

### Tests for User Story 2

- [X] T009 [US2] Create project-card popover coverage for six sub-score rows and null-value rendering in /home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx

### Implementation for User Story 2

- [X] T010 [US2] Extend the indicator into a read-only popover that renders the six canonical sub-scores with score-band styling in /home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx

**Checkpoint**: User Story 2 is complete when the popover explains every score driver without introducing links, buttons, or workflow actions.

---

## Phase 5: User Story 3 - Preserve existing project-card interactions (Priority: P3)

**Goal**: Keep project-card navigation, existing controls, and responsive layout intact while the health indicator is present.

**Independent Test**: Interact with the card, ProjectMenu, GitHub link, deployment link, and health indicator on desktop/mobile-sized layouts and confirm only the intended targets navigate.

### Tests for User Story 3

- [X] T011 [US3] Extend project-card interaction regression coverage for card navigation isolation and indicator click behavior in /home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx

### Implementation for User Story 3

- [X] T012 [US3] Update project-card interaction guards so the health indicator and its popover do not trigger card navigation while normal card clicks still route to the board in /home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx
- [X] T013 [US3] Refine the indicator trigger and popover behavior for keyboard focus, non-visual labels, and compact card-header placement in /home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx

**Checkpoint**: User Story 3 is complete when the new indicator adds information without changing existing project-card behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories and shared quality gates.

- [X] T014 Run the targeted validation commands from /home/runner/work/ai-board/ai-board/target/specs/AIB-548-display-health-score/quickstart.md against /home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx and /home/runner/work/ai-board/ai-board/target/tests/integration/projects/crud.test.ts
- [X] T015 Run repository-wide verification for the changed surface with `bun run type-check` and `bun run lint` from /home/runner/work/ai-board/ai-board/target

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies.
- **Phase 2: Foundational** depends on Phase 1 and blocks all user stories.
- **Phase 3: User Story 1** depends on Phase 2 and delivers the MVP.
- **Phase 4: User Story 2** depends on User Story 1 because it extends the new indicator component and consumes the `healthSummary` payload already added for the MVP.
- **Phase 5: User Story 3** depends on User Story 1 and can proceed in parallel with User Story 2 once the base indicator is on the card.
- **Phase 6: Polish** depends on every story that is in scope for the release.

### User Story Dependencies

- **US1 (P1)**: Starts after T001-T003 and has no dependency on later stories.
- **US2 (P2)**: Starts after T008 because the popover extends the indicator introduced for US1.
- **US3 (P3)**: Starts after T008 because it validates and hardens the indicator/card interaction boundary introduced for US1.

### Within Each User Story

- Write or extend the story’s tests before its implementation tasks and confirm the new assertions fail first.
- Finish data mapping before wiring the UI to that data.
- Integrate into `/components/projects/project-card.tsx` only after the indicator component is ready.
- Complete each story’s independent test before moving the release scope forward.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- After T004 is in place, T005, T006, and T007 can run in parallel for US1 because they touch different files.
- After T008 completes, US2 and US3 can proceed in parallel because they both extend the shipped indicator surface from different concerns.

---

## Parallel Example: User Story 1

```bash
# After T004 defines the failing integration coverage, launch the independent US1 implementation tasks together:
Task: "T005 [US1] Map selected health inputs into healthSummary for /home/runner/work/ai-board/ai-board/target/app/projects/page.tsx"
Task: "T006 [US1] Map selected health inputs into GET /api/projects in /home/runner/work/ai-board/ai-board/target/app/api/projects/route.ts"
Task: "T007 [US1] Create the heart indicator UI in /home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx"
```

## Parallel Example: User Story 2

```bash
# No internal parallel split is recommended for US2 because the new test and popover implementation both center on the same indicator/card behavior.
Task: "T009 [US2] Create popover coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx"
Task: "T010 [US2] Extend the popover implementation in /home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx"
```

## Parallel Example: User Story 3

```bash
# Once US1 is on the card, US3 can run alongside US2, but its own tasks should stay sequential because they share the same interaction surface.
Task: "T011 [US3] Extend interaction regression coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx"
Task: "T012 [US3] Harden project-card interaction guards in /home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx"
Task: "T013 [US3] Refine indicator accessibility and placement in /home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 for User Story 1.
3. Validate the scored and no-data card states with `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/crud.test.ts`.
4. Stop here for an MVP release if only at-a-glance health visibility is needed.

### Incremental Delivery

1. Ship US1 to expose the overall project-card health score in the initial list payload.
2. Add US2 to explain the score with the six-sub-score read-only popover.
3. Add US3 to lock down interaction, accessibility, and layout regressions around the new UI.
4. Finish with Phase 6 validation before merge.

### Parallel Execution Strategy

1. Run T002 and T003 together after the shared type contract is in place.
2. After the US1 integration test is written, split page mapping, API mapping, and indicator creation across parallel workers.
3. After US1 lands on the card, run US2 and US3 in parallel as separate follow-up tracks.

---

## Notes

- The only justified new files for this feature are /home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx and /home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx, matching the research inventory.
- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/crud.test.ts` must be extended rather than replaced because it already owns `/api/projects` coverage.
- `/home/runner/work/ai-board/ai-board/target/components/projects/projects-container.tsx` stays untouched unless implementation proves the existing responsive grid cannot accommodate the indicator.
