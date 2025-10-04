# Tasks: GitHub Branch Tracking and Automation Flags

**Input**: Design documents from `/specs/014-add-github-branch/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
This is a Next.js web application with the following structure:
- **Database**: `prisma/schema.prisma` (Prisma ORM)
- **API Routes**: `app/api/projects/[projectId]/tickets/` (Next.js App Router)
- **Validation**: `lib/validations/ticket.ts` (Zod schemas)
- **Tests**: `tests/` (Playwright E2E)

---

## Phase 3.1: Setup

- [ ] **T001** Verify Prisma is installed and database connection works
  - Run: `npx prisma --version` to verify Prisma CLI available
  - Check: `prisma/schema.prisma` exists
  - Verify: DATABASE_URL in .env is configured

- [ ] **T002** Ensure development environment is ready
  - Verify: Node.js 22.20.0 LTS installed
  - Verify: PostgreSQL 14+ running
  - Run: `npm install` to ensure all dependencies installed
  - Run: `npm run type-check` to verify TypeScript compilation

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (from contracts/tickets-api.yml)

- [ ] **T003** [P] Contract test: POST /api/tickets returns branch=null and autoMode=false
  - File: `tests/contracts/tickets-create.spec.ts`
  - Verify: New ticket has `branch: null` in response
  - Verify: New ticket has `autoMode: false` in response
  - This test will FAIL until schema is updated (expected)

- [ ] **T004** [P] Contract test: PATCH /api/tickets/:id accepts branch and autoMode
  - File: `tests/contracts/tickets-update.spec.ts`
  - Verify: Can update branch field (string | null)
  - Verify: Can update autoMode field (boolean)
  - Verify: Branch max length validation (200 chars)
  - This test will FAIL until API route is updated (expected)

- [ ] **T005** [P] Contract test: PATCH /api/tickets/:id/branch validates and updates branch
  - File: `tests/contracts/tickets-branch.spec.ts`
  - Verify: Endpoint exists at `/api/projects/:projectId/tickets/:id/branch`
  - Verify: Accepts `{ branch: string | null }`
  - Verify: Rejects branch longer than 200 characters
  - Verify: Returns minimal response (id, branch, updatedAt)
  - This test will FAIL until new endpoint is created (expected)

### Integration Tests (from quickstart.md scenarios)

- [ ] **T006** [P] Integration test: Ticket creation with default values (Scenario 1)
  - File: `tests/integration/ticket-defaults.spec.ts`
  - Create ticket via API
  - Assert: `branch === null` (not undefined, not empty string)
  - Assert: `autoMode === false`
  - Assert: Other fields unchanged (title, description, stage, etc.)
  - This test will FAIL until schema migration applied (expected)

- [ ] **T007** [P] Integration test: Branch assignment workflow (Scenario 2)
  - File: `tests/integration/ticket-branch-assignment.spec.ts`
  - Create ticket (branch should be null)
  - Update branch via PATCH /api/projects/:projectId/tickets/:id/branch
  - Query ticket to verify persistence
  - Assert: Branch name stored correctly
  - This test will FAIL until new endpoint exists (expected)

- [ ] **T008** [P] Integration test: AutoMode toggle (Scenario 3)
  - File: `tests/integration/ticket-automode.spec.ts`
  - Create ticket (autoMode should be false)
  - Update autoMode to true via PATCH /api/projects/:projectId/tickets/:id
  - Query ticket to verify persistence
  - Assert: autoMode changed correctly
  - This test will FAIL until API route updated (expected)

- [ ] **T009** [P] Integration test: Multiple fields atomic update (Scenario 4)
  - File: `tests/integration/ticket-multi-field-update.spec.ts`
  - Update title, stage, and branch in single PATCH request
  - Assert: All fields updated atomically
  - Assert: Unchanged fields preserved
  - This test will FAIL until API route supports new fields (expected)

- [ ] **T010** [P] Integration test: Branch validation edge cases (Scenarios 5-7)
  - File: `tests/integration/ticket-branch-validation.spec.ts`
  - Test: Clear branch (set to null)
  - Test: Reject branch longer than 200 chars (400 error)
  - Test: Reject invalid autoMode type (400 error)
  - Assert: Proper error messages returned
  - This test will FAIL until validation implemented (expected)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Schema Changes

- [ ] **T011** Update Prisma schema with branch and autoMode fields
  - File: `prisma/schema.prisma`
  - Add: `branch String? @db.VarChar(200)` to Ticket model
  - Add: `autoMode Boolean @default(false)` to Ticket model
  - Ensure: Existing fields and relations unchanged
  - Reference: `specs/014-add-github-branch/data-model.md` for exact schema

- [ ] **T012** Generate and run Prisma migration
  - Run: `npx prisma migrate dev --name add_branch_tracking`
  - Verify: Migration SQL creates both columns correctly
  - Verify: Existing data preserved (branch=NULL, autoMode=false for existing tickets)
  - Run: `npx prisma generate` to update Prisma Client types
  - Verify: No migration errors in console

- [ ] **T013** Verify Prisma Client types include new fields
  - Check: TypeScript types include `branch: string | null`
  - Check: TypeScript types include `autoMode: boolean`
  - Run: `npm run type-check` to ensure no TypeScript errors
  - Test: Query a ticket and access `.branch` and `.autoMode` properties

### Validation Schema Updates

- [ ] **T014** Update Zod validation schemas for new fields
  - File: `lib/validations/ticket.ts`
  - Add: Branch validation schema `z.string().max(200).nullable().optional()`
  - Add: AutoMode validation schema `z.boolean().optional()`
  - Update: `patchTicketSchema` to accept branch and autoMode
  - Create: `updateBranchSchema` for specialized endpoint validation
  - Reference: `specs/014-add-github-branch/research.md` (Section 3) for exact schemas
  - Export: TypeScript types for new schemas

### API Route Updates

- [ ] **T015** Update existing PATCH endpoint to accept new fields
  - File: `app/api/projects/[projectId]/tickets/[id]/route.ts`
  - Update: PATCH handler to accept `branch` and `autoMode` in request body
  - Add: Validation using updated `patchTicketSchema`
  - Update: Prisma update call to include new fields
  - Ensure: Response includes `branch` and `autoMode` in returned ticket
  - Add: Error handling for validation failures (400 response)
  - Test: TypeScript compilation passes

- [ ] **T016** Create new PATCH /branch specialized endpoint
  - Create file: `app/api/projects/[projectId]/tickets/[id]/branch/route.ts`
  - Implement: PATCH handler accepting `{ branch: string | null }`
  - Add: Validation using `updateBranchSchema`
  - Implement: Prisma update with select (return only id, branch, updatedAt)
  - Add: 404 handling if ticket not found
  - Add: 400 handling for validation errors (branch too long)
  - Reference: `specs/014-add-github-branch/contracts/tickets-api.yml` for exact contract

- [ ] **T017** Update GET endpoints to return new fields
  - File: `app/api/projects/[projectId]/tickets/[id]/route.ts`
  - Update: GET handler response to include `branch` and `autoMode`
  - File: `app/api/projects/[projectId]/tickets/route.ts`
  - Update: GET all tickets response to include new fields in each ticket
  - Verify: Existing response fields unchanged

- [ ] **T018** Update POST endpoint to return new fields with defaults
  - File: `app/api/projects/[projectId]/tickets/route.ts`
  - Update: POST handler response to include `branch: null` and `autoMode: false`
  - Verify: Prisma create uses default values (no need to explicitly set)
  - Ensure: Response schema matches contract

---

## Phase 3.4: Integration & Validation

- [ ] **T019** Run all contract tests and verify they pass
  - Run: `npx playwright test tests/contracts/`
  - Verify: T003 (POST default values) passes
  - Verify: T004 (PATCH accepts new fields) passes
  - Verify: T005 (PATCH /branch) passes
  - Fix: Any remaining failures

- [ ] **T020** Run all integration tests and verify they pass
  - Run: `npx playwright test tests/integration/ticket-*.spec.ts`
  - Verify: T006 (default values) passes
  - Verify: T007 (branch assignment) passes
  - Verify: T008 (autoMode toggle) passes
  - Verify: T009 (multi-field update) passes
  - Verify: T010 (validation edge cases) passes
  - Fix: Any remaining failures

- [ ] **T021** Execute quickstart manual validation
  - Follow: `specs/014-add-github-branch/quickstart.md` scenarios 1-8
  - Verify: All 8 scenarios produce expected responses
  - Verify: API response times <200ms (performance goal)
  - Document: Any deviations or issues found

---

## Phase 3.5: Polish

- [ ] **T022** [P] Add unit tests for validation schemas
  - File: `tests/unit/validations/ticket-branch.spec.ts`
  - Test: Branch validation accepts valid strings up to 200 chars
  - Test: Branch validation rejects strings over 200 chars
  - Test: Branch validation accepts null
  - Test: AutoMode validation accepts true/false
  - Test: AutoMode validation rejects non-boolean values

- [ ] **T023** [P] Update API documentation (if exists)
  - Check: Does project have API docs (e.g., `docs/api.md` or OpenAPI spec)?
  - If yes: Update with new fields and /branch endpoint
  - If no: Skip this task

- [ ] **T024** [P] Update CLAUDE.md with implementation notes
  - File: `CLAUDE.md`
  - Add: Note that Ticket model now includes branch and autoMode
  - Add: API endpoint `/api/projects/:projectId/tickets/:id/branch` for branch updates
  - Keep: Recent changes section up to date (automated by update script)

- [ ] **T025** Performance validation
  - Run: Load test with 100 concurrent ticket queries
  - Measure: Response times for GET and PATCH operations
  - Verify: <200ms p95 response time (from plan.md performance goals)
  - Document: Any performance issues or optimizations needed

- [ ] **T026** Code cleanup and refactoring
  - Review: All modified files for code duplication
  - Ensure: Consistent error handling patterns
  - Verify: No commented-out code or debug logs
  - Run: `npm run lint` and fix any issues
  - Run: `npm run format` to ensure consistent formatting

- [ ] **T027** Final verification
  - Run: Full test suite `npm run test:e2e`
  - Run: Type check `npm run type-check`
  - Run: Build check `npm run build`
  - Verify: All tests pass
  - Verify: No TypeScript errors
  - Verify: Production build succeeds

---

## Dependencies

**Setup Dependencies**:
- T001-T002 must complete before all other tasks

**Test Dependencies (TDD)**:
- T003-T010 (all tests) must complete before T011-T018 (implementation)
- Tests must FAIL initially (expected behavior)

**Implementation Dependencies**:
- T011-T012 (schema + migration) must complete before T013
- T013 (Prisma types) must complete before T014-T018
- T014 (validation schemas) must complete before T015-T016
- T011-T018 must complete before T019-T020 (test validation)

**Polish Dependencies**:
- T019-T021 (validation) must pass before T022-T027 (polish)
- All implementation complete before final verification (T027)

---

## Parallel Execution Examples

### Parallel Test Creation (T003-T010)
All contract and integration tests can be written in parallel since they target different files:

```bash
# Execute these tests in parallel (8 independent tasks):
Task: "Contract test POST /api/tickets in tests/contracts/tickets-create.spec.ts"
Task: "Contract test PATCH /api/tickets/:id in tests/contracts/tickets-update.spec.ts"
Task: "Contract test PATCH /branch in tests/contracts/tickets-branch.spec.ts"
Task: "Integration test defaults in tests/integration/ticket-defaults.spec.ts"
Task: "Integration test branch assignment in tests/integration/ticket-branch-assignment.spec.ts"
Task: "Integration test autoMode in tests/integration/ticket-automode.spec.ts"
Task: "Integration test multi-field in tests/integration/ticket-multi-field-update.spec.ts"
Task: "Integration test validation in tests/integration/ticket-branch-validation.spec.ts"
```

### Parallel Polish Tasks (T022-T024)
These tasks touch different files and can run concurrently:

```bash
# Execute these polish tasks in parallel (3 independent tasks):
Task: "Unit tests for validation in tests/unit/validations/ticket-branch.spec.ts"
Task: "Update API docs (if exists)"
Task: "Update CLAUDE.md implementation notes"
```

---

## Notes

- **[P] tasks**: Different files, no dependencies - safe to run in parallel
- **TDD Critical**: All tests (T003-T010) MUST fail before implementation starts
- **Commit Strategy**: Commit after each phase completes (Setup, Tests, Implementation, Validation, Polish)
- **Type Safety**: Run `npm run type-check` after T013 and T014 to catch type errors early
- **Migration Safety**: T012 migration is reversible (can rollback if needed)

---

## Task Generation Rules Applied

1. **From Contracts** (`contracts/tickets-api.yml`):
   - POST /api/tickets → T003 (contract test)
   - PATCH /api/tickets/:id → T004 (contract test)
   - PATCH /api/tickets/:id/branch → T005 (contract test)
   - API implementation → T015, T016, T017, T018

2. **From Data Model** (`data-model.md`):
   - Ticket entity changes → T011 (schema update)
   - Migration → T012 (Prisma migration)
   - Types → T013 (Prisma Client verification)

3. **From User Stories** (`quickstart.md` scenarios):
   - Scenario 1 (defaults) → T006 (integration test)
   - Scenario 2 (branch assignment) → T007 (integration test)
   - Scenario 3 (autoMode) → T008 (integration test)
   - Scenario 4 (multi-field) → T009 (integration test)
   - Scenarios 5-7 (validation) → T010 (integration test)
   - Scenario 8 (query) → Covered by T017 (GET endpoint update)

4. **Ordering**:
   - Setup (T001-T002) → Tests (T003-T010) → Schema (T011-T013) → Validation (T014) → API (T015-T018) → Validation (T019-T021) → Polish (T022-T027)

---

## Validation Checklist

- [x] All contracts have corresponding tests (T003-T005 cover all endpoints)
- [x] All entities have model tasks (T011 updates Ticket model)
- [x] All tests come before implementation (T003-T010 before T011-T018)
- [x] Parallel tasks truly independent (verified file paths don't overlap)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task (validated)
- [x] TDD workflow enforced (tests must fail before implementation)
- [x] All quickstart scenarios covered by tests
- [x] Performance goals included (T025 validates <200ms requirement)

---

**Total Tasks**: 27 tasks across 5 phases
**Estimated Parallel Groups**: 2 major groups (8 test tasks, 3 polish tasks)
**Critical Path**: Setup → Tests → Schema/Migration → Validation → API → Test Verification → Polish

**Ready for execution**: Yes - All tasks have specific file paths and clear acceptance criteria
