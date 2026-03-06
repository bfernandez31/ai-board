# Tasks: Make Telemetry Endpoint Agent-Agnostic

**Input**: Design documents from `/specs/AIB-242-make-telemetry-endpoint/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Integration and unit tests are included as specified in plan.md (Testing Trophy approach).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup needed - this feature extends an existing endpoint with no new dependencies or schema changes.

(No tasks - existing project structure is sufficient)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core code change that enables both Codex and Claude telemetry processing.

**CRITICAL**: This phase modifies the route handler that all user stories depend on.

- [ ] T001 Extend event matching to add `codex.api_request` to the api_request condition in `app/api/telemetry/v1/logs/route.ts`
- [ ] T002 Extend event matching to add `codex.tool.call` to the tool event condition in `app/api/telemetry/v1/logs/route.ts`
- [ ] T003 Update JSDoc comment in `app/api/telemetry/v1/logs/route.ts` to reflect agent-agnostic support

**Checkpoint**: Route handler now accepts both Claude and Codex event names. All user story tests can begin.

---

## Phase 3: User Story 1 - Codex Telemetry Ingestion (Priority: P1)

**Goal**: Codex agent jobs have telemetry data (tokens, cost, tools) populated on their Job records after sending OTLP data.

**Independent Test**: Send a Codex-formatted OTLP payload to the telemetry endpoint and verify the Job record is updated with correct token counts, cost, and tools used.

### Tests for User Story 1

- [ ] T004 [P] [US1] Create integration test file and test: Codex `api_request` event updates Job with correct token/cost metrics in `tests/integration/telemetry/agent-agnostic.test.ts`
- [ ] T005 [P] [US1] Add integration test: Codex `tool.call` event adds tool names to Job's toolsUsed in `tests/integration/telemetry/agent-agnostic.test.ts`
- [ ] T006 [P] [US1] Add integration test: multiple Codex batches accumulate metrics correctly (tokens sum, tools merge without duplicates) in `tests/integration/telemetry/agent-agnostic.test.ts`
- [ ] T007 [P] [US1] Add integration test: missing attributes in Codex events default to zero in `tests/integration/telemetry/agent-agnostic.test.ts`

**Checkpoint**: User Story 1 fully tested - Codex telemetry ingestion works correctly.

---

## Phase 4: User Story 2 - Claude Telemetry Backward Compatibility (Priority: P1)

**Goal**: Existing Claude Code workflows continue to have their telemetry tracked identically with no behavioral changes.

**Independent Test**: Send a Claude-formatted OTLP payload and verify the same behavior as before the change.

### Tests for User Story 2

- [ ] T008 [P] [US2] Add integration test: Claude `api_request` events still update Job with token counts, cost, duration, and model identically in `tests/integration/telemetry/agent-agnostic.test.ts`
- [ ] T009 [P] [US2] Add integration test: Claude `tool_result` and `tool_decision` events still track tool usage identically in `tests/integration/telemetry/agent-agnostic.test.ts`

**Checkpoint**: User Story 2 verified - zero regressions in existing Claude telemetry.

---

## Phase 5: User Story 3 - Agent-Distinguishable Analytics (Priority: P2)

**Goal**: Job metrics can be filtered/grouped by agent type via the Ticket's `agent` field, enabling cost comparison between Claude and Codex.

**Independent Test**: Create jobs linked to tickets with different agent types, send telemetry for each, and verify queries can filter/group by agent type.

### Tests for User Story 3

- [ ] T010 [P] [US3] Add integration test: mixed Claude + Codex events in same payload accumulate correctly in `tests/integration/telemetry/agent-agnostic.test.ts`
- [ ] T011 [P] [US3] Add integration test: Codex `api_request` event populates model field with Codex model name in `tests/integration/telemetry/agent-agnostic.test.ts`

**Checkpoint**: User Story 3 verified - agent type is distinguishable through Job's associated Ticket.

---

## Phase 6: Unit Tests & Edge Cases

**Purpose**: Extend OTLP schema unit tests and cover edge cases.

- [ ] T012 [P] Add unit test: OTLP payload with Codex event names validates successfully in `tests/unit/telemetry/otlp-schema.test.ts`
- [ ] T013 [P] Add unit test: OTLP payload with mixed Claude + Codex events validates in `tests/unit/telemetry/otlp-schema.test.ts`
- [ ] T014 [P] Add integration test: unrecognized event names are silently skipped without error in `tests/integration/telemetry/agent-agnostic.test.ts`

**Checkpoint**: All edge cases covered - schema validation and silent skip behavior verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all changes.

- [ ] T015 Run `bun run type-check` to verify no TypeScript regressions
- [ ] T016 Run `bun run lint` to verify no lint violations
- [ ] T017 Run full test suite to verify all tests pass (unit + integration)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies - can start immediately (modifies route handler)
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion
- **User Story 3 (Phase 5)**: Depends on Phase 2 completion
- **Unit Tests (Phase 6)**: Depends on Phase 2 completion
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- All test tasks within a story marked [P] can run in parallel (same file but independent test cases)
- Tests validate the route handler changes from Phase 2

### Parallel Opportunities

- All tasks in Phase 2 (T001-T003) are sequential (same file, same code region)
- All test tasks within Phases 3-6 marked [P] can run in parallel
- User Stories 1, 2, and 3 test phases can run in parallel after Phase 2
- Unit tests (Phase 6) can run in parallel with integration tests (Phases 3-5)

---

## Parallel Example: After Phase 2

```bash
# All these test phases can run in parallel after Phase 2 completes:
Phase 3: US1 integration tests (T004-T007)
Phase 4: US2 integration tests (T008-T009)
Phase 5: US3 integration tests (T010-T011)
Phase 6: Unit tests + edge cases (T012-T014)
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 2: Foundational (extend event matching - 2 line changes + JSDoc)
2. Complete Phase 3: User Story 1 tests (Codex ingestion works)
3. Complete Phase 4: User Story 2 tests (Claude backward compatibility verified)
4. **STOP and VALIDATE**: Both P1 stories are functional and tested
5. Continue to Phase 5 for P2 analytics differentiation

### Incremental Delivery

1. Phase 2: Route handler changes -> Agent-agnostic endpoint ready
2. Phase 3 + 4: P1 stories tested -> Core functionality verified (MVP!)
3. Phase 5: P2 story tested -> Analytics differentiation verified
4. Phase 6: Edge cases covered -> Full confidence
5. Phase 7: Final verification -> Ship-ready

---

## Notes

- [P] tasks = different files or independent test cases, no dependencies
- [Story] label maps task to specific user story for traceability
- No Prisma schema changes required - existing Job fields accommodate both agents
- No new dependencies required
- The core code change is minimal (~2 lines in route handler + JSDoc update)
- The bulk of work is in comprehensive test coverage
- Agent type resolved via `Ticket.agent` field, not from OTLP event names
