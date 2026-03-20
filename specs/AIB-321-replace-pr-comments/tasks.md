# Tasks: Replace PR Comments Dimension with Spec Sync in Code Review

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-321-replace-pr-comments/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/quality-score-dimensions.yaml`, `quickstart.md`

**Tests**: Automated tests are required by the feature spec and implementation plan. Write story tests first and confirm they fail before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel because the task edits different files and has no dependency on unfinished work in the same phase
- **[Story]**: Present only on user story tasks (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact repository file path

## Phase 1: Setup

**Purpose**: Load the existing producer, scoring, consumer, and test touchpoints before refactoring shared review-dimension behavior.

- [ ] T001 Inventory existing `PR Comments` and `qualityScore` touchpoints in `.claude-plugin/commands/ai-board.code-review.md`, `lib/quality-score.ts`, `components/ticket/quality-score-section.tsx`, `components/analytics/dimension-comparison-chart.tsx`, `lib/analytics/queries.ts`, `tests/unit/quality-score.test.ts`, `tests/unit/components/quality-score-section.test.tsx`, `tests/integration/analytics/quality-score.test.ts`, and `tests/integration/jobs/status.test.ts`
- [ ] T002 [P] Verify the persistence contract remains passthrough-compatible by reviewing `.github/workflows/verify.yml`, `app/api/jobs/[id]/status/route.ts`, and `app/lib/job-update-validator.ts` against `specs/AIB-321-replace-pr-comments/contracts/quality-score-dimensions.yaml`

---

## Phase 2: Foundational

**Purpose**: Establish the shared dimension configuration and compatibility helpers that block all user story work.

**⚠️ CRITICAL**: Complete this phase before starting any user story tasks.

- [ ] T003 Refactor shared review-dimension metadata and parsing helpers in `lib/quality-score.ts` so name, agent ID, weight, ordering, and overall-score participation are driven by one typed configuration
- [ ] T004 [P] Align stored-review compatibility types with the shared dimension model in `lib/types/job-types.ts` and `lib/analytics/types.ts`

**Checkpoint**: Shared dimension configuration exists and can drive producers, scoring, ticket views, and analytics consistently.

---

## Phase 3: User Story 1 - Review PRs Against Updated Specs (Priority: P1) 🎯 MVP

**Goal**: New verify reviews emit a `Spec Sync` dimension that evaluates only changed files under `specs/specifications/` and stores its findings in the completed-job payload.

**Independent Test**: Run a verify flow for a PR with changed specification files and confirm the stored review output includes `Spec Sync`, reports contradictions or coverage gaps when present, and returns `100` with no findings when no eligible spec files changed.

### Tests for User Story 1

- [ ] T005 [P] [US1] Extend shared payload/config coverage for `Spec Sync`, no-spec success behavior, and legacy `PR Comments` parsing in `tests/unit/quality-score.test.ts`
- [ ] T006 [P] [US1] Extend completed verify-job persistence coverage for zero-weight `Spec Sync` payloads in `tests/integration/jobs/status.test.ts`

### Implementation for User Story 1

- [ ] T007 [US1] Replace the `PR Comments` review agent, prompt instructions, and example `QUALITY_SCORE_JSON` payload with `Spec Sync` behavior in `.claude-plugin/commands/ai-board.code-review.md`
- [ ] T008 [US1] Confirm the verify workflow and completed-job update path continue forwarding the new payload shape without transformation in `.github/workflows/verify.yml` and `app/api/jobs/[id]/status/route.ts`

**Checkpoint**: New reviews produce and persist `Spec Sync` results without breaking completed verify-job updates.

---

## Phase 4: User Story 2 - Preserve Existing Quality Gate Behavior (Priority: P2)

**Goal**: The overall quality score and threshold classification remain unchanged for active dimensions even after replacing `PR Comments` with zero-weight `Spec Sync` and raising `Compliance` to `0.40`.

**Independent Test**: Compare equivalent review inputs before and after the change and confirm `qualityScore` plus threshold classification use only the active weighted dimensions whose weights still sum to `1.00`.

### Tests for User Story 2

- [ ] T009 [P] [US2] Add weighted-score and threshold regression coverage that excludes zero-weight `Spec Sync` from `qualityScore` in `tests/unit/quality-score.test.ts`
- [ ] T010 [P] [US2] Extend analytics regression coverage for unchanged active-dimension scoring and mixed legacy/new review payloads in `tests/integration/analytics/quality-score.test.ts`

### Implementation for User Story 2

- [ ] T011 [US2] Update weighted-score computation, threshold helpers, and active-weight validation to ignore zero-weight dimensions in `lib/quality-score.ts`
- [ ] T012 [US2] Keep completed-job payload validation backward compatible for both new `Spec Sync` rows and historical `PR Comments` rows in `app/lib/job-update-validator.ts` and `app/api/jobs/[id]/status/route.ts`

**Checkpoint**: Overall quality gates still behave the same while `Spec Sync` remains visible but weightless.

---

## Phase 5: User Story 3 - See the New Dimension Everywhere the Old One Appeared (Priority: P3)

**Goal**: Ticket review breakdowns and analytics show `Spec Sync` for new reviews using the same shared dimension configuration, while legacy `PR Comments` records remain readable.

**Independent Test**: Generate new review data and confirm ticket summaries plus analytics surfaces show `Spec Sync`; also load historical data and confirm legacy `PR Comments` entries still render and aggregate without crashes.

### Tests for User Story 3

- [ ] T013 [P] [US3] Add component coverage for `Spec Sync` rendering, dimension ordering, and legacy `PR Comments` fallback in `tests/unit/components/quality-score-section.test.tsx`
- [ ] T014 [P] [US3] Extend dimension-comparison analytics coverage for new `Spec Sync` rows and mixed historical datasets in `tests/integration/analytics/quality-score.test.ts`

### Implementation for User Story 3

- [ ] T015 [US3] Update ticket review breakdown rendering to use the shared dimension metadata for labels, weights, ordering, and legacy fallbacks in `components/ticket/quality-score-section.tsx`
- [ ] T016 [US3] Update analytics dimension aggregation and ordering to surface `Spec Sync` for new reviews while preserving historical `PR Comments` interpretability in `lib/analytics/queries.ts`
- [ ] T017 [P] [US3] Align chart label and ordering behavior with the shared dimension configuration in `components/analytics/dimension-comparison-chart.tsx`

**Checkpoint**: All user-visible review breakdown surfaces show the replacement dimension consistently for new reviews.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the integrated feature across unit, component, integration, typing, and linting workflows.

- [ ] T018 [P] Run the targeted validation commands from `specs/AIB-321-replace-pr-comments/quickstart.md` for `tests/unit/quality-score.test.ts`, `tests/unit/components/quality-score-section.test.tsx`, `tests/integration/analytics/quality-score.test.ts`, and `tests/integration/jobs/status.test.ts`
- [ ] T019 Run repository-wide validation with `bun run type-check` and `bun run lint` against `package.json`, `tsconfig.json`, and `eslint.config.mjs` from the repository root

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and establishes the concrete edit/test surface
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories because it introduces the shared dimension configuration
- **User Story 1 (Phase 3)**: Depends on Foundational and delivers the MVP producer/storage behavior
- **User Story 2 (Phase 4)**: Depends on Foundational and should run after or alongside late US1 work once shared config is stable
- **User Story 3 (Phase 5)**: Depends on Foundational and consumes the shared config plus persisted payload behavior from earlier phases
- **Polish (Phase 6)**: Depends on completion of all desired user stories

### User Story Dependencies

- **US1**: Can start immediately after Phase 2 and does not require US2 or US3
- **US2**: Can start after Phase 2, but validating it is easier once US1 producer payload changes are in place
- **US3**: Can start after Phase 2, but final verification depends on the payload/config behavior delivered by US1 and US2

### Within Each User Story

- Tests must be written first and fail before implementation
- Shared config changes must land before producer, scoring, and UI consumers rely on them
- Producer/storage changes should land before ticket and analytics consumer updates are validated
- Story checkpoints should be used to stop and validate each increment independently

### Completion Order

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: User Story 1 (MVP)
4. Phase 4: User Story 2
5. Phase 5: User Story 3
6. Phase 6: Polish

---

## Parallel Opportunities

- `T002` can run in parallel with `T001` after the feature files are identified
- `T004` can run in parallel with `T003` once the shared config shape is chosen
- `T005` and `T006` can run in parallel for US1 because they edit different test files
- `T009` and `T010` can run in parallel for US2 because they cover unit and integration layers separately
- `T013` and `T014` can run in parallel for US3 because they edit different test files
- `T017` can run in parallel with `T015` or `T016` once the shared dimension metadata API is settled
- `T018` can run as grouped targeted test commands before the repo-wide validation in `T019`

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together once the shared config contract is defined
Task: "T005 [US1] Extend shared payload/config coverage in tests/unit/quality-score.test.ts"
Task: "T006 [US1] Extend completed verify-job persistence coverage in tests/integration/jobs/status.test.ts"
```

## Parallel Example: User Story 2

```bash
# Run the score-regression tests in parallel because they edit different files
Task: "T009 [US2] Add weighted-score and threshold regression coverage in tests/unit/quality-score.test.ts"
Task: "T010 [US2] Extend analytics regression coverage in tests/integration/analytics/quality-score.test.ts"
```

## Parallel Example: User Story 3

```bash
# Split display verification by layer
Task: "T013 [US3] Add component coverage in tests/unit/components/quality-score-section.test.tsx"
Task: "T014 [US3] Extend analytics dimension-comparison coverage in tests/integration/analytics/quality-score.test.ts"
Task: "T017 [US3] Align chart label and ordering behavior in components/analytics/dimension-comparison-chart.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2 to establish the shared dimension contract
2. Complete Phase 3 to ship new `Spec Sync` producer and persistence behavior
3. Stop and validate US1 independently using the targeted unit and integration tests

### Incremental Delivery

1. Land shared config refactor first
2. Add US1 so new reviews emit and store `Spec Sync`
3. Add US2 so scoring and thresholds remain stable
4. Add US3 so ticket and analytics consumers display the replacement dimension consistently
5. Finish with cross-cutting validation in Phase 6

### Suggested MVP Scope

- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: User Story 1

---

## Notes

- All tasks use the required checklist format with sequential IDs `T001` through `T019`
- User story tasks are labeled `[US1]`, `[US2]`, or `[US3]`; setup, foundational, and polish tasks intentionally omit story labels
- `[P]` markers are only applied where work can proceed independently on different files
- Historical `PR Comments` compatibility is intentionally preserved in parsing, persistence validation, and analytics display tasks
