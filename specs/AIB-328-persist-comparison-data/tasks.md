# Tasks: Persist Comparison Data to Database via Workflow

**Input**: Design documents from `/specs/AIB-328-persist-comparison-data/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Integration tests are explicitly requested in plan.md for the POST endpoint.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project scaffolding needed — this feature is additive to an existing codebase. Setup verifies existing dependencies are available.

- [x] T001 Verify existing comparison persistence function signature in lib/comparison/comparison-record.ts matches PersistComparisonInput from data-model.md
- [x] T002 Verify existing workflow auth helper validateWorkflowAuth() in app/lib/workflow-auth.ts is importable and returns expected shape

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared Zod validation schema used by the POST endpoint and integration tests

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create Zod validation schema for PersistComparisonRequest in app/api/projects/[projectId]/comparisons/route.ts (or co-located validator file), matching the contract in contracts/comparison-persistence.openapi.yaml and the PersistComparisonInput type from lib/comparison/comparison-record.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Comparison Data Automatically Appears in Dashboard (Priority: P1) 🎯 MVP

**Goal**: After a `/compare` command runs, structured JSON is written, POSTed to the API by the workflow, and persisted to the database so it appears in the comparison dashboard.

**Independent Test**: Run the POST endpoint with a valid payload referencing real test tickets and verify the comparison record, participants, metrics, decision points, and compliance data are created in the database and retrievable via the existing GET endpoint.

### Integration Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US1] Create integration test file tests/integration/comparisons/comparison-persistence-endpoint.test.ts with test scaffolding (describe block, test database setup, test ticket creation via Prisma)
- [x] T005 [P] [US1] Write integration test: POST with valid payload creates comparison record and returns 201 with { id, generatedAt } in tests/integration/comparisons/comparison-persistence-endpoint.test.ts
- [x] T006 [P] [US1] Write integration test: POST creates all related entities (participants, metric snapshots, compliance assessments, decision point evaluations) in tests/integration/comparisons/comparison-persistence-endpoint.test.ts
- [x] T007 [P] [US1] Write integration test: POST with missing auth header returns 401 in tests/integration/comparisons/comparison-persistence-endpoint.test.ts
- [x] T008 [P] [US1] Write integration test: POST with invalid token returns 401 in tests/integration/comparisons/comparison-persistence-endpoint.test.ts
- [x] T009 [P] [US1] Write integration test: POST with invalid payload (missing required fields, wrong types) returns 400 with Zod error details in tests/integration/comparisons/comparison-persistence-endpoint.test.ts
- [x] T010 [P] [US1] Write integration test: POST with projectId mismatch between body and URL returns 400 in tests/integration/comparisons/comparison-persistence-endpoint.test.ts
- [x] T011 [P] [US1] Write integration test: POST with non-existent ticket IDs returns 400 in tests/integration/comparisons/comparison-persistence-endpoint.test.ts
- [x] T012 [P] [US1] Write integration test: Multiple POSTs for same tickets create separate comparison records (point-in-time snapshots) in tests/integration/comparisons/comparison-persistence-endpoint.test.ts

### Implementation for User Story 1

- [x] T013 [US1] Implement POST handler in app/api/projects/[projectId]/comparisons/route.ts: workflow token auth via validateWorkflowAuth(), Zod validation using schema from T003, call persistComparisonRecord(), return 201 with { id, generatedAt }, handle 400/401/500 errors per contract
- [x] T014 [US1] Add JSON data file write step to .claude/commands/ai-board.compare.md after markdown report generation (Step 10.5): construct PersistComparisonInput payload, write to specs/{branch}/comparisons/{timestamp}-vs-{keys}.json, wrap in try-catch for failure isolation
- [x] T015 [US1] Add "Persist Comparison Data" step to .github/workflows/ai-board-assist.yml after Claude command execution and before commit step: find newest .json in specs/{branch}/comparisons/, POST to ${APP_URL}/api/projects/${PROJECT_ID}/comparisons with Bearer auth, log success/failure, exit 0 on all paths

**Checkpoint**: At this point, User Story 1 should be fully functional — a `/compare` run produces JSON, the workflow POSTs it, and the data appears in the database

---

## Phase 4: User Story 2 — Markdown Report Generation Remains Unaffected (Priority: P1)

**Goal**: The existing markdown report is produced identically regardless of JSON generation success or failure.

**Independent Test**: Verify the compare command's markdown output is unaffected by JSON write failures.

### Implementation for User Story 2

- [x] T016 [US2] Verify try-catch isolation in .claude/commands/ai-board.compare.md: confirm JSON write failure (Step 10.5) logs a warning and does NOT prevent markdown report generation or command completion — adjust if needed
- [x] T017 [US2] Verify the JSON write step in .claude/commands/ai-board.compare.md is placed AFTER the markdown report write (Step 10) so markdown is always produced first, regardless of JSON outcome

**Checkpoint**: Markdown report generation is confirmed to be fully independent of JSON file generation

---

## Phase 5: User Story 3 — Graceful Degradation on Persistence Failure (Priority: P2)

**Goal**: Workflow succeeds even when persistence fails — JSON write errors, network errors, or API errors never block the workflow.

**Independent Test**: Simulate API errors (bad endpoint, timeout) and verify the workflow completes successfully with markdown report intact.

### Implementation for User Story 3

- [x] T018 [US3] Verify workflow step in .github/workflows/ai-board-assist.yml uses exit 0 on all code paths: no comparisons directory, no JSON file found, POST returns non-201, curl network error
- [x] T019 [US3] Verify workflow step logs the failure reason (HTTP status code, response body) for observability when persistence fails in .github/workflows/ai-board-assist.yml
- [x] T020 [US3] Verify workflow step only runs for /compare commands via the if condition: contains(inputs.comment, '/compare') in .github/workflows/ai-board-assist.yml

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all changes

- [x] T021 Run bun run type-check to verify no TypeScript errors in new/modified files
- [x] T022 Run bun run lint to verify no linting issues in new/modified files
- [x] T023 Run integration tests: bun run test:integration -- tests/integration/comparisons/comparison-persistence-endpoint.test.ts to verify all tests pass
- [x] T024 Run quickstart.md validation: verify the three changes match quickstart.md summary

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion — core implementation
- **User Story 2 (Phase 4)**: Can run after US1 implementation (T014) — verifies failure isolation in command
- **User Story 3 (Phase 5)**: Can run after US1 implementation (T015) — verifies failure isolation in workflow
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Core pipeline — must be implemented first since US2 and US3 verify properties of its implementation
- **User Story 2 (P1)**: Verifies failure isolation in the compare command (depends on T014)
- **User Story 3 (P2)**: Verifies failure isolation in the workflow step (depends on T015)

### Within User Story 1

- Tests (T004-T012) MUST be written and FAIL before implementation
- Zod schema (T003) before POST handler (T013)
- POST handler (T013) before workflow step (T015) — endpoint must exist for workflow to call it
- Compare command JSON (T014) and POST handler (T013) can run in parallel (different files)

### Parallel Opportunities

- All integration tests T004-T012 can be written in parallel (same file, but independent test cases)
- T013 (POST handler) and T014 (compare command JSON) can run in parallel (different files)
- T016-T017 (US2 verification) can run in parallel with T018-T020 (US3 verification)
- T021-T024 (polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: T004 "Create integration test scaffolding"
Task: T005 "Integration test: valid POST creates record"
Task: T006 "Integration test: POST creates all related entities"
Task: T007 "Integration test: missing auth returns 401"
Task: T008 "Integration test: invalid token returns 401"
Task: T009 "Integration test: invalid payload returns 400"
Task: T010 "Integration test: projectId mismatch returns 400"
Task: T011 "Integration test: non-existent tickets returns 400"
Task: T012 "Integration test: multiple POSTs create separate records"

# After tests are written, launch implementation in parallel:
Task: T013 "POST handler in comparisons/route.ts"
Task: T014 "JSON write step in compare command"

# Then sequentially:
Task: T015 "Workflow persistence step" (depends on T013)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify existing dependencies)
2. Complete Phase 2: Foundational (Zod schema)
3. Complete Phase 3: User Story 1 (tests → POST endpoint → command JSON → workflow step)
4. **STOP and VALIDATE**: Run integration tests, verify data appears in database
5. Deploy if ready — dashboard will start showing comparison data

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Run integration tests → Core pipeline works (MVP!)
3. Add User Story 2 → Verify command failure isolation → Backward compatibility confirmed
4. Add User Story 3 → Verify workflow failure isolation → Graceful degradation confirmed
5. Polish → All checks pass → Ready for review

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No Prisma schema changes required — all persistence uses existing models
- The POST endpoint reuses `persistComparisonRecord()` from `lib/comparison/comparison-record.ts`
- Auth uses existing `validateWorkflowAuth()` from `app/lib/workflow-auth.ts`
- US2 and US3 are primarily verification phases — they confirm failure isolation properties of US1's implementation
