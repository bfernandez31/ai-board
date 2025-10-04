# Tasks: Add Job Model

**Input**: Design documents from `/specs/013-add-job-model/`
**Prerequisites**: plan.md, data-model.md, contracts/schema.prisma, quickstart.md

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
- **Repository root**: `/Users/b.fernandez/Workspace/ai-board/`
- **Prisma schema**: `prisma/schema.prisma`
- **Migrations**: `prisma/migrations/`
- This is a data-model-only feature (no API routes, UI components, or E2E tests)

## Phase 3.1: Setup ✅
**Note**: Setup already complete - this is a data model addition to existing project

- [x] T001 Project structure exists (Next.js App Router with Prisma)
- [x] T002 Dependencies installed (Prisma 6.x, PostgreSQL 14+, TypeScript 5.6)
- [x] T003 Database connection configured (DATABASE_URL environment variable)

## Phase 3.2: Schema Definition
**Data model implementation - sequential execution (single file)**

- [ ] T004 Add JobStatus enum to `prisma/schema.prisma`
  - **File**: `prisma/schema.prisma`
  - **Action**: Add enum with 4 values: PENDING, RUNNING, COMPLETED, FAILED
  - **Location**: After existing Stage enum, before models
  - **Validation**: Enum appears in schema with correct values

- [ ] T005 Add Job model to `prisma/schema.prisma`
  - **File**: `prisma/schema.prisma`
  - **Action**: Add Job model with 11 fields as specified in data-model.md
  - **Fields**:
    - id: Int @id @default(autoincrement())
    - ticketId: Int
    - command: String @db.VarChar(50)
    - status: JobStatus @default(PENDING)
    - branch: String? @db.VarChar(200)
    - commitSha: String? @db.VarChar(40)
    - logs: String? @db.Text
    - startedAt: DateTime @default(now())
    - completedAt: DateTime?
    - createdAt: DateTime @default(now())
    - updatedAt: DateTime @updatedAt
  - **Validation**: All 11 fields present with correct types and constraints

- [ ] T006 Add foreign key relation to Ticket model in `prisma/schema.prisma`
  - **File**: `prisma/schema.prisma`
  - **Action**: Add `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)`
  - **Location**: Inside Job model, after fields
  - **Validation**: Relation defined with cascade delete

- [ ] T007 Add indexes to Job model in `prisma/schema.prisma`
  - **File**: `prisma/schema.prisma`
  - **Action**: Add 4 indexes after relation definition
    - @@index([ticketId])
    - @@index([status])
    - @@index([startedAt])
    - @@index([ticketId, status, startedAt])
  - **Validation**: All 4 indexes defined

- [ ] T008 Add jobs relation field to Ticket model in `prisma/schema.prisma`
  - **File**: `prisma/schema.prisma`
  - **Action**: Add `jobs Job[]` field to existing Ticket model
  - **Location**: Inside Ticket model, after existing fields
  - **Validation**: One-to-many relation field added

## Phase 3.3: Migration
**Database migration - sequential execution**

- [ ] T009 Generate Prisma migration for Job model
  - **File**: New file in `prisma/migrations/`
  - **Command**: `npx prisma migrate dev --name add-job-model`
  - **Expected Output**:
    - Migration file created with SQL DDL
    - JobStatus enum created
    - Job table created with all fields
    - Foreign key constraint on ticketId with CASCADE
    - 4 indexes created
  - **Validation**: Migration file exists in `prisma/migrations/[timestamp]_add-job-model/`

- [ ] T010 Verify migration SQL contains all requirements
  - **File**: `prisma/migrations/[timestamp]_add-job-model/migration.sql`
  - **Action**: Review generated SQL for:
    - CREATE TYPE "JobStatus" with 4 enum values
    - CREATE TABLE "Job" with 11 columns
    - ALTER TABLE "Job" ADD CONSTRAINT for foreign key with ON DELETE CASCADE
    - CREATE INDEX statements for 4 indexes
  - **Validation**: SQL contains all required DDL statements

- [ ] T011 Regenerate Prisma Client with new types
  - **Command**: `npx prisma generate`
  - **Expected Output**: Prisma Client updated with Job and JobStatus types
  - **Validation**: TypeScript types available in node_modules/@prisma/client

## Phase 3.4: Validation
**Verify implementation - can run in parallel after migration**

- [ ] T012 [P] Verify schema structure via Prisma Studio
  - **Command**: `npx prisma studio`
  - **Action**: Open Prisma Studio and navigate to Job model
  - **Expected**: Job model visible with all 11 fields, correct types, and empty table
  - **Validation**: Visual confirmation in Prisma Studio UI

- [ ] T013 [P] Verify database schema via PostgreSQL
  - **Command**: `psql $DATABASE_URL`
  - **Action**: Run `\dT+ JobStatus` and `\d "Job"`
  - **Expected**:
    - JobStatus enum with 4 values
    - Job table with 11 columns
    - 4 indexes (Job_ticketId_idx, Job_status_idx, Job_startedAt_idx, Job_ticketId_status_startedAt_idx)
    - Foreign key constraint with ON DELETE CASCADE
  - **Validation**: Database objects match schema definition

- [ ] T014 [P] Verify TypeScript types generated correctly
  - **File**: Create temporary `test-types.ts`
  - **Action**: Import and use Job, JobStatus types from @prisma/client
  - **Expected**: No TypeScript errors, proper enum values, nullable fields correct
  - **Validation**: `npx tsc --noEmit test-types.ts` passes
  - **Cleanup**: Delete test-types.ts after verification

- [ ] T015 Run quickstart validation script
  - **File**: Create temporary `test-job-model.ts` from quickstart.md
  - **Action**: Run all 6 quickstart tests:
    1. Create job with minimal fields
    2. Create job with all fields
    3. Update job to completed
    4. Query jobs by ticket
    5. Query jobs by status
    6. Test cascade delete
  - **Expected**: All tests pass, output matches quickstart expectations
  - **Validation**: Script exits with code 0, all tests marked as passed
  - **Cleanup**: Delete test-job-model.ts after verification

- [ ] T016 Verify index performance
  - **Action**: Use `EXPLAIN ANALYZE` on common queries from data-model.md
    - Query jobs by ticketId
    - Query jobs by status
    - Query jobs by startedAt range
    - Composite query (ticketId + status + startedAt)
  - **Expected**: All queries use indexes (Index Scan, not Seq Scan)
  - **Validation**: EXPLAIN output shows index usage

## Phase 3.5: Documentation & Cleanup
**Final polish - can run in parallel**

- [ ] T017 [P] Verify CLAUDE.md updated with new feature
  - **File**: `CLAUDE.md`
  - **Action**: Confirm 013-add-job-model listed in Active Technologies and Recent Changes
  - **Expected**: PostgreSQL 14+ and Prisma 6.x mentioned for this feature
  - **Validation**: File contains feature reference

- [ ] T018 [P] Update plan.md progress tracking
  - **File**: `specs/013-add-job-model/plan.md`
  - **Action**: Mark Phase 3 (Tasks generated) as complete with date
  - **Expected**: Checkbox marked, date added
  - **Validation**: Progress Tracking section updated

- [ ] T019 Final schema review and cleanup
  - **File**: `prisma/schema.prisma`
  - **Action**: Review entire schema for consistency, formatting, and comments
  - **Expected**: Proper formatting, consistent style with existing models
  - **Validation**: `npx prisma format` makes no changes

## Dependencies

**Sequential Dependencies** (must complete in order):
1. T004-T008: Schema definition tasks (same file, sequential)
   - T004 (enum) → T005 (model) → T006 (relation) → T007 (indexes) → T008 (ticket update)
2. T009-T011: Migration tasks (sequential)
   - T008 → T009 (generate) → T010 (verify) → T011 (regenerate client)

**Parallel Opportunities** (can run simultaneously):
- T012-T014: Validation tasks (different tools, no dependencies)
- T017-T018: Documentation tasks (different files)

**Blocking Dependencies**:
- All validation tasks (T012-T016) blocked by T011 (Prisma Client must be regenerated)
- All documentation tasks (T017-T019) blocked by T015 (validation must pass)

## Parallel Execution Examples

**Validation Phase** (after T011 completes):
```bash
# Launch T012-T014 together in separate terminals:
Terminal 1: npx prisma studio
Terminal 2: psql $DATABASE_URL -c "\dT+ JobStatus" -c "\d \"Job\""
Terminal 3: Create test-types.ts and run: npx tsc --noEmit test-types.ts
```

**Documentation Phase** (after T015 completes):
```bash
# Launch T017-T018 together:
# Both are simple file checks that can run simultaneously
Terminal 1: cat CLAUDE.md | grep "013-add-job-model"
Terminal 2: Edit specs/013-add-job-model/plan.md
```

## Notes

- **No API Routes**: This feature is data-model only (no /app/api/ modifications)
- **No UI Components**: No React components or UI changes (no /app/ or /components/ modifications)
- **No E2E Tests**: No Playwright tests needed (database-level validation only)
- **Single File Edit**: Only `prisma/schema.prisma` is modified
- **Sequential Core Tasks**: T004-T008 modify same file, cannot parallelize
- **Parallel Validation**: T012-T014 use different tools, can run together
- **Verification First**: Run quickstart validation (T015) before marking feature complete
- **Type Safety**: TypeScript strict mode enforced via project tsconfig.json

## Task Completion Criteria

Each task is complete when:
- **Schema tasks (T004-T008)**: Changes visible in `prisma/schema.prisma`
- **Migration tasks (T009-T011)**: Migration file exists and Prisma Client regenerated
- **Validation tasks (T012-T016)**: All checks pass with expected output
- **Documentation tasks (T017-T019)**: Files updated and formatted correctly

## Acceptance Criteria Mapping

Tasks map to feature acceptance criteria:

- **AC-1** (Prisma schema includes Job model): T005, T006, T007
- **AC-2** (Prisma schema includes JobStatus enum): T004
- **AC-3** (Migration creates job table): T009, T010, T013
- **AC-4** (Foreign key cascade deletes): T006, T015 (test 6)
- **AC-5** (Indexes created): T007, T013, T016
- **AC-6** (Job queries work via Prisma client): T011, T015 (tests 1-5)

## Estimated Completion Time

- **Schema Definition** (T004-T008): 10-15 minutes
- **Migration** (T009-T011): 5 minutes
- **Validation** (T012-T016): 15-20 minutes
- **Documentation** (T017-T019): 5 minutes

**Total**: 35-45 minutes

## Rollback Plan

If issues arise:
1. **Before T009**: Revert changes to `prisma/schema.prisma`
2. **After T009**: Run `npx prisma migrate reset` to revert migration
3. **After T011**: Regenerate client: `npx prisma generate`

## Next Steps After Task Completion

1. ✅ All 19 tasks completed
2. ✅ Quickstart validation passed
3. ✅ Acceptance criteria verified
4. ⏭️ **Phase 4**: Job model ready for use
5. ⏭️ **Future**: Create API routes for job CRUD operations (separate ticket)
6. ⏭️ **Future**: Implement job lifecycle management (timeout handling, cancellation)
7. ⏭️ **Future**: Add job UI components for monitoring

## Validation Checklist
*GATE: Checked before marking feature complete*

- [x] All contracts have corresponding tests: N/A (no API contracts in this feature)
- [x] All entities have model tasks: Yes (Job model in T005)
- [x] All tests come before implementation: N/A (data model only, no TDD cycle)
- [x] Parallel tasks truly independent: Yes (T012-T014, T017-T018)
- [x] Each task specifies exact file path: Yes
- [x] No task modifies same file as another [P] task: Yes (sequential tasks not marked [P])
