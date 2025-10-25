---
description: "Implementation tasks for Enhanced Implementation Workflow with Database Setup and Selective Testing"
---

# Tasks: Enhanced Implementation Workflow with Database Setup and Selective Testing

**Input**: Design documents from `/specs/052-896-workflow-implement/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT required for this feature (workflow infrastructure only, no application logic)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and workflow structure validation

- [ ] T001 Verify existing workflow structure in .github/workflows/speckit.yml
- [ ] T002 Backup current workflow configuration (create .github/workflows/speckit.yml.backup)
- [ ] T003 Verify PostgreSQL service container syntax compatibility with GitHub Actions YAML 2.0

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add Bun dependency caching configuration in .github/workflows/speckit.yml
- [ ] T005 Add DATABASE_URL environment variable configuration for implement command
- [ ] T006 Add conditional logic for implement-specific steps (if: inputs.command == 'implement')

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Automated Implementation with Test Validation (Priority: P1) 🎯 MVP

**Goal**: Set up PostgreSQL database service and apply migrations before Claude begins implementation

**Independent Test**: Trigger implement workflow with simple spec, verify database is accessible during implementation and Playwright tests execute successfully

### Implementation for User Story 1

- [ ] T007 [P] [US1] Add PostgreSQL service container configuration in .github/workflows/speckit.yml (services section)
- [ ] T008 [P] [US1] Configure PostgreSQL health checks (pg_isready with 5 retries) in .github/workflows/speckit.yml
- [ ] T009 [US1] Add "Generate Prisma Client" step after dependency installation in .github/workflows/speckit.yml
- [ ] T010 [US1] Add "Apply database migrations" step (npx prisma migrate deploy) in .github/workflows/speckit.yml
- [ ] T011 [US1] Add "Seed test database" step (npx tsx tests/global-setup.ts) in .github/workflows/speckit.yml
- [ ] T012 [US1] Add step ordering validation (dependencies → database → migrations → seeding → Claude)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (database setup completes successfully)

---

## Phase 4: User Story 2 - Intelligent Test Selection (Priority: P1)

**Goal**: Provide Claude with enhanced command instruction to run only impacted tests

**Independent Test**: Verify Claude receives correct instruction and only runs related test files (e.g., modify /api/tickets/route.ts → only runs tests/api/tickets.spec.ts)

### Implementation for User Story 2

- [ ] T013 [US2] Modify "Execute Spec-Kit Command" step implement case in .github/workflows/speckit.yml
- [ ] T014 [US2] Add enhanced Claude instruction with all four directives (never prompt, full implementation, no full test suite, only impacted tests)
- [ ] T015 [US2] Verify instruction format matches contract in specs/052-896-workflow-implement/contracts/claude-instruction.md
- [ ] T016 [US2] Add environment variable pass-through for DATABASE_URL to Claude execution context

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently (database ready + Claude receives correct instruction)

---

## Phase 5: User Story 3 - Database-Dependent Implementation (Priority: P2)

**Goal**: Ensure test database is properly configured and seeded for Claude to write and validate database-dependent code

**Independent Test**: Provide spec requiring database operations (e.g., "Add ticket priority field"), verify Claude can execute Prisma migrations and run database-dependent tests

### Implementation for User Story 3

- [ ] T017 [P] [US3] Verify DATABASE_URL is accessible in all implement command steps
- [ ] T018 [P] [US3] Add PostgreSQL connection verification step (pg_isready check) after service startup
- [ ] T019 [US3] Add error handling for database setup failures (fail fast with clear message)
- [ ] T020 [US3] Add migration failure detection and reporting
- [ ] T021 [US3] Verify test fixtures (test user, projects 1-2) are created by seeding step

**Checkpoint**: All database-dependent workflows should now be fully functional (migrations apply, fixtures created, tests can run)

---

## Phase 6: User Story 4 - Dependency Management (Priority: P3)

**Goal**: Automatically install and cache Playwright and dependencies for consistent test environment

**Independent Test**: Clear dependency cache, verify workflow successfully installs Playwright and completes implementation

### Implementation for User Story 4

- [ ] T022 [P] [US4] Add "Get Playwright version" step in .github/workflows/speckit.yml (extract from package.json)
- [ ] T023 [P] [US4] Add "Cache Playwright browsers" step with version-based cache key
- [ ] T024 [US4] Add "Install Playwright browsers" step with conditional execution (cache miss only)
- [ ] T025 [US4] Add "Install Playwright OS dependencies" step with conditional execution (cache hit only)
- [ ] T026 [US4] Verify cache key format: ${{ runner.os }}-playwright-${{ steps.playwright-version.outputs.version }}
- [ ] T027 [US4] Verify Bun cache key format: ${{ runner.os }}-bun-${{ hashFiles('bun.lockb') }}
- [ ] T028 [US4] Add --frozen-lockfile flag to bun install command

**Checkpoint**: All user stories should now be independently functional (full workflow with caching operational)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T029 [P] Verify all conditional steps have correct if: conditions (inputs.command == 'implement')
- [ ] T030 [P] Verify backward compatibility (specify/plan commands unaffected)
- [ ] T031 [P] Add comments in workflow file explaining each new step's purpose
- [ ] T032 Verify step ordering matches contract in specs/052-896-workflow-implement/contracts/workflow-changes.yml
- [ ] T033 Verify all environment variables are passed correctly to subsequent steps
- [ ] T034 Remove backup workflow file (.github/workflows/speckit.yml.backup)
- [ ] T035 Update CLAUDE.md with PostgreSQL service pattern and Playwright caching pattern (if not already documented)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (Database Setup) must complete before User Story 3 (Database-Dependent Implementation)
  - User Story 2 (Intelligent Test Selection) is independent, can run in parallel with US1
  - User Story 4 (Dependency Management) can run in parallel with US1-US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent of US1 (different workflow section)
- **User Story 3 (P2)**: Depends on User Story 1 completion (requires database setup steps to exist)
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent of US1-US3 (different workflow section)

### Within Each User Story

**User Story 1**:
- Service container and health checks can be added in parallel (T007, T008)
- Prisma/seeding steps must follow database setup sequentially (T009 → T010 → T011 → T012)

**User Story 2**:
- All tasks are sequential modifications to the same step (T013 → T014 → T015 → T016)

**User Story 3**:
- Verification and error handling tasks can be added in parallel (T017, T018, T019, T020, T021 all marked [P])

**User Story 4**:
- Playwright version and cache steps can be added in parallel (T022, T023)
- Installation steps must follow cache configuration (T024 → T025)
- Bun caching can be done in parallel with Playwright tasks (T026, T027, T028)

### Parallel Opportunities

- Setup tasks (T001, T002, T003) cannot run in parallel (sequential workflow verification)
- Foundational tasks (T004, T005, T006) can run in parallel (different sections of workflow file)
- User Story 1 and User Story 2 can be implemented in parallel (different workflow sections)
- User Story 4 can be implemented in parallel with User Stories 1-3 (different workflow sections)
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all database setup configuration together:
Task: "Add PostgreSQL service container configuration in .github/workflows/speckit.yml"
Task: "Configure PostgreSQL health checks in .github/workflows/speckit.yml"

# Then sequentially add migration/seeding steps:
Task: "Add Generate Prisma Client step" → "Add Apply database migrations step" → "Add Seed test database step"
```

---

## Parallel Example: User Story 4

```bash
# Launch all Playwright caching configuration together:
Task: "Add Get Playwright version step"
Task: "Add Cache Playwright browsers step"

# Launch all Bun caching configuration together (in parallel with Playwright):
Task: "Verify Bun cache key format"
Task: "Add --frozen-lockfile flag to bun install"

# Then add installation steps sequentially:
Task: "Add Install Playwright browsers step" → "Add Install Playwright OS dependencies step"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Database Setup)
4. Complete Phase 4: User Story 2 (Intelligent Test Selection)
5. **STOP and VALIDATE**: Trigger implement workflow, verify database setup and Claude receives correct instruction
6. Verify Claude runs selective tests (not full suite)

**This delivers the core value**: Automated implementation with database and selective testing

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + User Story 2 → Test independently → Deploy (MVP! Core value delivered)
3. Add User Story 3 → Test independently → Deploy (Enhanced error handling and validation)
4. Add User Story 4 → Test independently → Deploy (Performance optimization with caching)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Database Setup)
   - Developer B: User Story 2 (Intelligent Test Selection) + User Story 4 (Dependency Management)
   - Developer C: User Story 3 (Database-Dependent Implementation) - waits for US1 completion
3. Stories complete and integrate independently

**OR** (Sequential, Single Developer):

1. Complete Setup + Foundational
2. Complete User Story 1 + User Story 2 (MVP)
3. Test and validate MVP
4. Add User Story 4 (caching for performance)
5. Add User Story 3 (enhanced validation and error handling)

---

## Notes

- [P] tasks = different files or sections, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- All changes are in single file (.github/workflows/speckit.yml) but in different sections
- Commit after each user story or logical group
- Stop at any checkpoint to validate story independently
- Workflow is YAML configuration - test by triggering workflow, not unit tests
- Verify backward compatibility: specify/plan commands should not execute new steps
- Avoid: same workflow step conflicts, incorrect conditional logic, missing environment variables

---

## Performance Budget Validation

After completing all tasks, verify the following performance targets are met:

| Phase | Target (Cold) | Target (Cached) |
|-------|---------------|-----------------|
| Dependency installation | <2 min | <30 sec |
| PostgreSQL startup | <2 min | <2 min |
| Playwright installation | <3 min | <1 min |
| Prisma migrations | <2 min | <2 min |
| Database seeding | <1 min | <1 min |
| **TOTAL INFRASTRUCTURE** | **<10 min** | **<5 min** |

**Validation Method**: Trigger implement workflow with minimal feature spec, measure time for each step in GitHub Actions logs

---

## Success Criteria Checklist

After completing all tasks, verify:

- ✅ FR-001: PostgreSQL database service configured before Claude begins implementation
- ✅ FR-002: All Prisma migrations applied before test execution
- ✅ FR-003: Test database seeded with fixtures (test user, projects 1-2)
- ✅ FR-004: Playwright and browser dependencies installed before E2E tests
- ✅ FR-005: Enhanced command instruction passed to Claude
- ✅ FR-006: Instruction explicitly prohibits prompting user
- ✅ FR-007: Instruction explicitly requires selective test execution
- ✅ FR-008: Dependencies cached (node_modules, Playwright browsers)
- ✅ FR-009: DATABASE_URL provided to Claude's environment
- ✅ FR-010: Workflow fails fast on setup errors with clear messages
- ✅ FR-011: Workflow executes only when command is "implement"
- ✅ FR-012: Workflow supports E2E tests requiring database and browser

---

## Task Count Summary

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 3 tasks
- **Phase 3 (User Story 1)**: 6 tasks
- **Phase 4 (User Story 2)**: 4 tasks
- **Phase 5 (User Story 3)**: 5 tasks
- **Phase 6 (User Story 4)**: 7 tasks
- **Phase 7 (Polish)**: 7 tasks

**TOTAL**: 35 tasks

**Parallel Opportunities**:
- Phase 1: Sequential (workflow structure verification)
- Phase 2: 3 tasks can run in parallel (different workflow sections)
- User Story 1: 2 tasks parallel (T007, T008), then 4 sequential
- User Story 2: 4 tasks sequential (same workflow step)
- User Story 3: 5 tasks parallel (different validation points)
- User Story 4: 5 tasks can run in parallel, 2 sequential
- Phase 7: 5 tasks parallel (T029, T030, T031, T032, T033), then 2 sequential

**Suggested MVP Scope**: Phase 1 + Phase 2 + User Story 1 + User Story 2 (16 tasks) - Delivers core value of automated implementation with database and selective testing
