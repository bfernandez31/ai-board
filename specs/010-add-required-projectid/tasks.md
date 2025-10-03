# Tasks: Add required projectId foreign key to Ticket model

**Feature**: 010-add-required-projectid
**Branch**: `010-add-required-projectid`
**Input**: Design documents from `/home/benoit/Workspace/ai-board/specs/010-add-required-projectid/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md ✅
   → Tech stack: TypeScript 5.6, Next.js 15, Prisma 6.x, PostgreSQL 14+
   → Structure: Next.js App Router monolith
2. Load design documents ✅
   → data-model.md: Ticket entity modification (add projectId)
   → contracts/: Database constraints specifications
   → quickstart.md: Validation and test scenarios
3. Generate tasks by category ✅
   → Setup: None needed (project already initialized)
   → Tests: Constraint validation tests (TDD)
   → Core: Schema update, migration, seed update
   → Integration: None needed (schema-only change)
   → Polish: Verification and validation
4. Apply task rules ✅
   → Tests before implementation (TDD principle)
   → Sequential execution (schema changes cannot be parallel)
5. Number tasks sequentially ✅
6. Validate completeness ✅
   → All constraints have tests
   → Schema migration included
   → Seed updated for required field
```

## Format: `[ID] Description`
- File paths are absolute from repository root
- [P] markers omitted (schema changes must be sequential)
- Each task is atomic and completable independently

## Phase 3.1: Setup
*No setup tasks required - project already initialized with Prisma*

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before schema migration**

- [X] **T001** Create database constraint test file `tests/database/ticket-project-constraints.spec.ts`
  - Test: Ticket creation without projectId fails (TypeScript compilation + Prisma validation)
  - Test: Ticket creation with invalid projectId fails (foreign key violation)
  - Test: Project deletion cascades to all tickets
  - Test: Project-scoped ticket queries return correct results
  - **Expected**: All tests fail (schema not yet updated)
  - **Files**: `tests/database/ticket-project-constraints.spec.ts` (new file)

- [X] **T002** Add test helper for database setup in `tests/helpers/db-setup.ts`
  - Helper: Create test project and return ID
  - Helper: Create test ticket with projectId
  - Helper: Clean up test data after each test
  - **Files**: `tests/helpers/db-setup.ts` (new file if doesn't exist)

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [X] **T003** Update Prisma schema to add projectId to Ticket model in `prisma/schema.prisma`
  - Add `projectId Int` field to Ticket model
  - Add `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` relation
  - Add `@@index([projectId])` to Ticket model
  - Add `tickets Ticket[]` inverse relation to Project model
  - **Expected**: TypeScript errors in seed.ts (tickets missing projectId)
  - **Files**: `prisma/schema.prisma`

- [X] **T004** Generate Prisma migration for projectId field
  - Run: `npx prisma migrate dev --name add-ticket-project-relation`
  - Verify migration SQL includes:
    - ADD COLUMN "projectId" INTEGER NOT NULL
    - ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY
    - ON DELETE CASCADE
    - CREATE INDEX "Ticket_projectId_idx"
  - **Expected**: Migration file created in `prisma/migrations/`
  - **Files**: `prisma/migrations/[timestamp]_add_ticket_project_relation/migration.sql` (generated)

- [X] **T005** Update seed script to create tickets with projectId in `prisma/seed.ts`
  - Modify existing project creation to save project reference
  - Add sample ticket creation with `projectId: project.id`
  - Create at least 6 sample tickets across different stages
  - Ensure project is created BEFORE tickets
  - **Expected**: Seed runs without errors
  - **Files**: `prisma/seed.ts`

- [X] **T006** Reset database and run migration
  - Run: `npx prisma migrate reset` (drops all data, recreates schema)
  - Confirm migration when prompted
  - Verify seed completes successfully
  - **Expected**: Database reset complete, default project + tickets created
  - **Command**: `npx prisma migrate reset`

- [X] **T007** Regenerate Prisma client with updated types
  - Run: `npx prisma generate`
  - Verify TypeScript types include `projectId` on Ticket
  - Verify relation methods available (ticket.project, project.tickets)
  - **Expected**: No TypeScript errors in codebase
  - **Command**: `npx prisma generate`

## Phase 3.4: Integration
*No integration tasks - schema-only change, no API/UI modifications in this feature*

## Phase 3.5: Polish & Validation

- [ ] **T008** Verify database constraints exist in PostgreSQL
  - Run: `psql $DATABASE_URL -c "\d \"Ticket\""`
  - Verify foreign key constraint: `Ticket_projectId_fkey`
  - Verify index exists: `Ticket_projectId_idx`
  - Verify NOT NULL constraint on projectId
  - **Expected**: All constraints present
  - **Command**: SQL verification via psql

- [X] **T009** Run constraint validation tests (previously written in T001)
  - Run: `npm run test:e2e -- tests/database/ticket-project-constraints.spec.ts`
  - **Expected**: All tests PASS (previously failed)
  - Test 1: Creation without projectId fails ✅
  - Test 2: Creation with invalid projectId fails ✅
  - Test 3: Cascade delete works ✅
  - Test 4: Project-scoped queries work ✅
  - **Files**: `tests/database/ticket-project-constraints.spec.ts`

- [X] **T010** Run existing E2E tests to verify no breaking changes
  - Run: `npm run test:e2e`
  - Verify board displays tickets correctly
  - Verify ticket creation/update/delete still works
  - **Expected**: All existing tests pass (no regressions)
  - **Command**: `npm run test:e2e`

- [X] **T011** Run TypeScript type check
  - Run: `npm run type-check`
  - Verify no type errors in codebase
  - Verify Prisma client types generated correctly
  - **Expected**: No TypeScript errors
  - **Command**: `npm run type-check`

- [ ] **T012** Test cascade delete manually via Prisma Studio
  - Run: `npx prisma studio`
  - Create test project with tickets
  - Delete project
  - Verify all tickets deleted automatically
  - **Expected**: No orphaned tickets remain
  - **Manual verification**: Prisma Studio

- [ ] **T013** Verify seed data integrity
  - Run: `npm run db:seed`
  - Check console output for success messages
  - Verify project created before tickets
  - Run: `npx prisma studio` to inspect data
  - Verify all tickets have valid projectId
  - **Expected**: Clean seed with no errors
  - **Command**: `npm run db:seed`

## Dependencies

**Sequential Execution Required** (schema changes cannot be parallel):
```
T001 (Tests) → T002 (Helpers) → T003 (Schema) → T004 (Migration) → T005 (Seed) → T006 (Reset) → T007 (Generate) → T008-T013 (Validation)
```

**Blocking Dependencies**:
- T001-T002 MUST fail before T003 (TDD requirement)
- T003 blocks T004 (need schema to generate migration)
- T004 blocks T006 (need migration to reset)
- T005 blocks T006 (need updated seed for reset)
- T006 blocks T007 (need DB reset for client generation)
- T007 blocks T008-T013 (need types for validation)

## Task Execution Order

**Phase 1 - Write Failing Tests** (TDD Red):
1. T001: Database constraint tests
2. T002: Test helpers

**Phase 2 - Implement Schema** (TDD Green):
3. T003: Update Prisma schema
4. T004: Generate migration
5. T005: Update seed script
6. T006: Reset database
7. T007: Regenerate Prisma client

**Phase 3 - Validate & Verify** (TDD Refactor):
8. T008: Verify constraints exist
9. T009: Run constraint tests (should pass)
10. T010: Run E2E tests (no regressions)
11. T011: Type check
12. T012: Manual cascade delete test
13. T013: Seed integrity check

## Validation Checklist

- [x] All constraints have corresponding tests (T001)
- [x] Schema changes documented (data-model.md)
- [x] Tests come before implementation (T001-T002 before T003-T007)
- [x] Migration generated (T004)
- [x] Seed updated for required field (T005)
- [x] Each task specifies exact file path
- [x] No parallel tasks (schema changes are sequential)

## Notes

- **No [P] markers**: Schema changes must be sequential (cannot modify same schema file in parallel)
- **TDD Required**: Tests T001-T002 MUST fail before implementing T003-T007
- **Database Reset**: T006 drops all data (acceptable for MVP)
- **No API Changes**: This feature is schema-only, API changes deferred to next feature
- **No UI Changes**: Frontend unaffected by this change

## Success Criteria

After completing all tasks:
- ✅ Prisma schema includes `projectId` field on Ticket
- ✅ Foreign key constraint exists with CASCADE DELETE
- ✅ Index exists on `projectId`
- ✅ All tickets have valid `projectId` after seed
- ✅ Cannot create ticket without `projectId` (test passes)
- ✅ Deleting project deletes all tickets (test passes)
- ✅ Project-scoped queries work (test passes)
- ✅ TypeScript compilation passes
- ✅ E2E tests pass (no regressions)
- ✅ Database constraints verified via SQL

## Implementation Commands Quick Reference

```bash
# T001-T002: Write tests (manual implementation)
# T003: Edit prisma/schema.prisma (manual)
# T004: Generate migration
npx prisma migrate dev --name add-ticket-project-relation

# T005: Edit prisma/seed.ts (manual)
# T006: Reset database
npx prisma migrate reset

# T007: Regenerate client
npx prisma generate

# T008: Verify constraints
psql $DATABASE_URL -c "\d \"Ticket\""

# T009: Run constraint tests
npm run test:e2e -- tests/database/ticket-project-constraints.spec.ts

# T010: Run all E2E tests
npm run test:e2e

# T011: Type check
npm run type-check

# T012: Manual test via Prisma Studio
npx prisma studio

# T013: Re-run seed
npm run db:seed
```
