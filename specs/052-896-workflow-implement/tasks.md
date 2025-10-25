---
description: "Implementation tasks for Enhanced Implementation Workflow with Database Setup and Selective Testing"
---

# Tasks: Enhanced Implementation Workflow with Database Setup and Selective Testing

**Input**: Design documents from `/specs/052-896-workflow-implement/`
**Prerequisites**: plan.md, spec.md

**Approach**: Direct implementation - modify workflow file and test with real workflow execution

**Target**: Single file modification (`.github/workflows/speckit.yml`)

## Implementation Tasks

### 1. Add PostgreSQL Service for Implement Command

Add PostgreSQL service container configuration to the workflow job, only active when `command == 'implement'`:

- [ ] Add `services:` section to `run-speckit` job with PostgreSQL 14 container
- [ ] Configure health checks: `pg_isready` with retries
- [ ] Set environment variables: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

**File**: `.github/workflows/speckit.yml`

### 2. Add Database Setup Steps (Conditional on Implement Command)

Add steps to prepare the database before Claude executes, only when `command == 'implement'`:

- [ ] Add step: "Install Dependencies" with Bun (already exists, verify it runs before database steps)
- [ ] Add step: "Generate Prisma Client" (`npx prisma generate`)
- [ ] Add step: "Apply Database Migrations" (`npx prisma migrate deploy`)
- [ ] Add step: "Seed Test Database" (`npx tsx tests/global-setup.ts`)
- [ ] Add `DATABASE_URL` environment variable pointing to PostgreSQL service

**File**: `.github/workflows/speckit.yml`
**Location**: Between "Setup" steps and "Execute Spec-Kit Command" step
**Condition**: `if: ${{ env.SKIP_SPECKIT_EXECUTION != 'true' && inputs.command == 'implement' }}`

### 3. Add Playwright Setup Steps (Conditional on Implement Command)

Add Playwright browser installation, only when `command == 'implement'`:

- [ ] Add step: "Get Playwright Version" (extract from package.json using jq)
- [ ] Add step: "Cache Playwright Browsers" (cache path: ~/.cache/ms-playwright)
- [ ] Add step: "Install Playwright Browsers" (conditional on cache miss)
- [ ] Add step: "Install Playwright OS Dependencies" (conditional on cache hit)

**File**: `.github/workflows/speckit.yml`
**Location**: After database setup steps, before "Execute Spec-Kit Command"
**Condition**: `if: ${{ env.SKIP_SPECKIT_EXECUTION != 'true' && inputs.command == 'implement' }}`

### 4. Add Dependency Caching

Optimize dependency installation with caching:

- [ ] Add step: "Cache Bun Dependencies" (cache path: ~/.bun/install/cache)
- [ ] Use cache key: `${{ runner.os }}-bun-${{ hashFiles('bun.lockb') }}`
- [ ] Add `--frozen-lockfile` flag to `bun install` command

**File**: `.github/workflows/speckit.yml`
**Location**: Before "Setup Bun" step

### 5. Update Implement Command Instruction

Modify the `implement` case in "Execute Spec-Kit Command" step:

- [ ] Change from `claude --dangerously-skip-permissions /speckit.implement` to:
  ```bash
  claude --dangerously-skip-permissions "/speckit.implement IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests"
  ```
- [ ] Ensure DATABASE_URL is available in Claude's environment

**File**: `.github/workflows/speckit.yml`
**Location**: Line 313 (implement case in Execute Spec-Kit Command step)

### 6. Verify and Test

Final validation:

- [ ] Verify all new steps have correct conditional logic (`inputs.command == 'implement'`)
- [ ] Verify specify/plan commands are unaffected (no new steps execute)
- [ ] Add comments explaining each new section
- [ ] Commit changes to feature branch
- [ ] Test with real workflow dispatch (trigger implement command on test ticket)

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
