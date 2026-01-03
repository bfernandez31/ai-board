# Tasks: Add Telemetry Metrics to Ticket Comparison

**Input**: Design documents from `/specs/AIB-130-add-telemetry-metrics/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Not explicitly requested in feature specification - tests are included for integration validation only.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify prerequisites and existing infrastructure

- [ ] T001 Verify existing `TicketTelemetry` interface in lib/types/comparison.ts matches schema from data-model.md
- [ ] T002 [P] Verify existing telemetry aggregation utilities in lib/comparison/telemetry-extractor.ts
- [ ] T003 [P] Verify existing jobs API endpoint at app/api/projects/[projectId]/tickets/[id]/jobs/route.ts returns telemetry fields

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add `.telemetry-context.json` pattern to specs/.gitignore to exclude runtime artifacts
- [ ] T005 Verify WORKFLOW_API_TOKEN authentication pattern in existing ai-board-assist.yml workflow

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 3 - Workflow Generates Telemetry Context (Priority: P1) 🎯 MVP

**Goal**: Workflow queries ai-board API and writes telemetry context file before Claude executes /compare

**Independent Test**: Run workflow step in isolation, verify .telemetry-context.json created with correct structure

**Note**: US3 is implemented first because it is the technical enabler for US1 - without the workflow generating the context file, the compare command cannot read telemetry.

### Implementation for User Story 3

- [ ] T006 [US3] Create fetch-telemetry.sh script at .github/scripts/fetch-telemetry.sh with ticket parsing and API calls
- [ ] T007 [US3] Add "Fetch Telemetry for Compare" step to .github/workflows/ai-board-assist.yml before Claude execution
- [ ] T008 [US3] Implement ticket key extraction logic using regex pattern `#[A-Z0-9]{3,6}-[0-9]+` in fetch-telemetry.sh
- [ ] T009 [US3] Implement search API call to resolve ticket key to ticket ID in fetch-telemetry.sh
- [ ] T010 [US3] Implement jobs API call and jq aggregation for telemetry data in fetch-telemetry.sh
- [ ] T011 [US3] Write aggregated telemetry to specs/$BRANCH/.telemetry-context.json in fetch-telemetry.sh

**Checkpoint**: Workflow generates telemetry context file for /compare commands

---

## Phase 4: User Story 1 - View Telemetry Metrics in Comparison Report (Priority: P1)

**Goal**: Comparison reports include actual cost, duration, and token data for evaluated tickets

**Independent Test**: Execute /compare on tickets with completed jobs, verify Metrics Comparison table contains Cost and Duration columns

### Implementation for User Story 1

- [ ] T012 [US1] Update .claude/commands/compare.md to read specs/$BRANCH/.telemetry-context.json in Step 6 (Aggregate Telemetry)
- [ ] T013 [US1] Add instructions for parsing JSON telemetry data into Metrics Comparison table in compare.md
- [ ] T014 [US1] Update Metrics Comparison table format to include Cost and Duration columns in compare.md
- [ ] T015 [US1] Add telemetry data usage instructions for Efficiency criterion (10% weight) calculation in compare.md

**Checkpoint**: Compare command displays telemetry metrics when context file exists

---

## Phase 5: User Story 2 - Graceful Handling of Missing Telemetry (Priority: P2)

**Goal**: Comparison completes successfully with "N/A" for unavailable metrics

**Independent Test**: Compare ticket with telemetry against one without, verify report renders with "N/A" values

### Implementation for User Story 2

- [ ] T016 [US2] Add error handling in fetch-telemetry.sh for ticket-not-found case (empty telemetry with hasData: false)
- [ ] T017 [US2] Add error handling in fetch-telemetry.sh for API timeout/failure (retry once, then empty telemetry)
- [ ] T018 [US2] Add instructions in compare.md for handling hasData: false tickets (display "N/A")
- [ ] T019 [US2] Add instructions in compare.md for missing context file scenario (proceed without telemetry)

**Checkpoint**: Comparisons gracefully degrade when telemetry unavailable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing and validation

- [ ] T020 Create integration test at tests/integration/telemetry/context-file-schema.test.ts validating TelemetryContextFile structure
- [ ] T021 [P] Create unit test at tests/unit/telemetry/aggregation.test.ts for jq aggregation logic documentation
- [ ] T022 Run quickstart.md validation checklist to verify all success criteria met
- [ ] T023 Verify end-to-end flow: workflow → context file → compare command → metrics table

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verifies existing infrastructure
- **Foundational (Phase 2)**: Depends on Setup completion - ensures prerequisites
- **User Story 3 (Phase 3)**: Depends on Foundational - creates telemetry context file
- **User Story 1 (Phase 4)**: Depends on User Story 3 - reads context file
- **User Story 2 (Phase 5)**: Can run in parallel with US1 after US3 - adds error handling
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 3 (P1)**: Foundational → Must complete first (creates the context file)
- **User Story 1 (P1)**: Depends on US3 → Consumes the context file
- **User Story 2 (P2)**: Can integrate with US3 and US1 in parallel

### Within Each User Story

- Workflow script before workflow YAML modification
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- T002 and T003 can run in parallel (different verification tasks)
- T020 and T021 can run in parallel (different test files)
- US1 and US2 can be partially parallelized after US3 core implementation

---

## Parallel Example: User Story 3

```bash
# Sequential within US3 (dependencies):
Task: T006 "Create fetch-telemetry.sh script"
# Then:
Task: T007 "Add workflow step to ai-board-assist.yml"
# Then in parallel:
Task: T008 "Implement ticket key extraction"
Task: T009 "Implement search API call"
Task: T010 "Implement jobs API aggregation"
# Then:
Task: T011 "Write context file"
```

---

## Implementation Strategy

### MVP First (User Story 3 + User Story 1)

1. Complete Phase 1: Setup (verify existing infrastructure)
2. Complete Phase 2: Foundational (.gitignore update)
3. Complete Phase 3: User Story 3 (workflow generates context file)
4. Complete Phase 4: User Story 1 (compare reads and displays metrics)
5. **STOP and VALIDATE**: Test with actual /compare command
6. Complete Phase 5: User Story 2 (error handling)
7. Complete Phase 6: Polish (tests and validation)

### Key Implementation Notes

- **No new TypeScript files needed for MVP** - workflow uses bash/jq, compare command uses markdown instructions
- **Existing utilities available**: `aggregateJobTelemetry()`, `createEmptyTelemetry()`, `formatTelemetryDisplay()` in lib/comparison/telemetry-extractor.ts
- **Existing types available**: `TicketTelemetry` in lib/types/comparison.ts
- **Context file location**: `specs/$BRANCH/.telemetry-context.json` (workflow writes, Claude reads)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US3 must complete before US1 (dependency: context file creation before consumption)
- Verify tests pass after each story completion
- Commit after each task or logical group
- All tasks follow existing codebase patterns (ai-board-assist.yml, compare.md)
