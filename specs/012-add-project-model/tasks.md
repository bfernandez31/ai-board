# Tasks: Add Project Model

**Input**: Design documents from `/specs/012-add-project-model/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript 5.6, Prisma 6.x, Next.js 15, PostgreSQL 14+
   → Structure: Web app with prisma/, app/, lib/, tests/
2. Load optional design documents:
   → data-model.md: Project entity with constraints and indexes
   → contracts/: Database layer only (no API endpoints this feature)
   → quickstart.md: Validation test scenarios extracted
3. Generate tasks by category:
   → Setup: Schema definition, migration, environment config
   → Tests: Seed idempotency, constraints, cascade delete
   → Core: Seed script implementation
   → Integration: Environment validation
   → Polish: Documentation, verification
4. Apply task rules:
   → Different test files = mark [P] for parallel
   → Schema changes = sequential (single schema.prisma)
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. All contracts tested: N/A (database layer only)
   All entities modeled: ✓ Project entity
   All endpoints implemented: N/A (no API endpoints)
7. Return: SUCCESS (12 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Web app structure (Next.js App Router):
- **Database**: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`
- **Library**: `lib/prisma.ts`
- **Tests**: `tests/*.spec.ts`

## Phase 3.1: Setup & Schema Definition
- [X] T001 Define Project model in prisma/schema.prisma with all fields (id, name, description, githubOwner, githubRepo, createdAt, updatedAt)
- [X] T002 Add unique constraint on (githubOwner, githubRepo) and composite index in prisma/schema.prisma
- [X] T003 Add projectId foreign key field to Ticket model with cascade delete in prisma/schema.prisma
- [X] T004 Generate Prisma migration for Project model and Ticket.projectId: `npx prisma migrate dev --name add-project-model`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY seed implementation**
- [X] T005 [P] E2E test for seed idempotency in tests/seed-idempotency.spec.ts (run seed twice, verify single project)
- [X] T006 [P] E2E test for environment validation in tests/seed-env-validation.spec.ts (missing env vars throws error)
- [X] T007 [P] E2E test for unique constraint in tests/project-uniqueness.spec.ts (duplicate repo creation fails)
- [X] T008 [P] E2E test for cascade delete in tests/project-cascade.spec.ts (delete project deletes tickets)

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [X] T009 Implement idempotent seed script in prisma/seed.ts with environment validation
- [X] T010 Add environment variable checks (GITHUB_OWNER, GITHUB_REPO required) in prisma/seed.ts
- [X] T011 Create default project with name="ai-board" using env vars in prisma/seed.ts
- [ ] T012 Verify all E2E tests pass: `npm run test:e2e`

## Dependencies
```
T001 → T002 (constraints require model definition)
T002 → T003 (foreign key requires Project model exists)
T003 → T004 (migration requires complete schema changes)
T004 → T005-T008 (tests require migration applied)
T005-T008 → T009-T011 (TDD: tests before implementation)
T009-T011 → T012 (implementation before final verification)
```

## Parallel Execution Example
```bash
# After T004 (migration applied), launch T005-T008 test creation in parallel:
# These are independent test files with no shared state

# Terminal 1:
# Task: "E2E test for seed idempotency in tests/seed-idempotency.spec.ts"

# Terminal 2:
# Task: "E2E test for environment validation in tests/seed-env-validation.spec.ts"

# Terminal 3:
# Task: "E2E test for unique constraint in tests/project-uniqueness.spec.ts"

# Terminal 4:
# Task: "E2E test for cascade delete in tests/project-cascade.spec.ts"
```

## Task Details

### T001: Define Project Model
**File**: `prisma/schema.prisma`
**Description**: Add Project model with fields:
- id: Int @id @default(autoincrement())
- name: String @db.VarChar(100)
- description: String @db.VarChar(1000)
- githubOwner: String @db.VarChar(100)
- githubRepo: String @db.VarChar(100)
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- tickets: Ticket[] (relation)

**Validation**: TypeScript compiler accepts schema, no syntax errors

### T002: Add Constraints and Indexes
**File**: `prisma/schema.prisma`
**Description**: Add to Project model:
- @@unique([githubOwner, githubRepo])
- @@index([githubOwner, githubRepo])

**Validation**: Prisma validates schema, no constraint errors

### T003: Add Foreign Key to Ticket
**File**: `prisma/schema.prisma`
**Description**: Add to Ticket model:
- projectId: Int
- project: Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
- @@index([projectId])

**Validation**: Prisma validates relationship, no circular dependency errors

### T004: Generate Migration
**File**: `prisma/migrations/[timestamp]_add_project_model/`
**Command**: `npx prisma migrate dev --name add-project-model`
**Description**: Generate and apply migration for:
- CREATE TABLE "Project" with all fields and constraints
- ALTER TABLE "Ticket" ADD COLUMN "projectId" INT NOT NULL
- CREATE INDEX on Project(githubOwner, githubRepo)
- CREATE INDEX on Ticket(projectId)

**Validation**: Migration SQL generated, database schema updated, Prisma Client regenerated

### T005: Seed Idempotency Test
**File**: `tests/seed-idempotency.spec.ts`
**Description**: Playwright E2E test that:
1. Clears test database
2. Runs seed script (npm run db:seed)
3. Counts projects (expect 1)
4. Runs seed script again
5. Counts projects (expect still 1, not 2)
6. Verifies project data unchanged

**Expected**: Test FAILS initially (no seed implementation yet)

### T006: Environment Validation Test
**File**: `tests/seed-env-validation.spec.ts`
**Description**: Playwright E2E test that:
1. Unsets GITHUB_OWNER environment variable
2. Attempts to run seed script
3. Expects error: "GITHUB_OWNER and GITHUB_REPO environment variables are required"
4. Restores environment variables

**Expected**: Test FAILS initially (no validation yet)

### T007: Unique Constraint Test
**File**: `tests/project-uniqueness.spec.ts`
**Description**: Playwright E2E test that:
1. Creates project with (githubOwner="test", githubRepo="repo")
2. Attempts to create duplicate project with same owner/repo
3. Expects unique constraint error
4. Verifies only one project exists

**Expected**: Test PASSES after migration (database constraint enforced)

### T008: Cascade Delete Test
**File**: `tests/project-cascade.spec.ts`
**Description**: Playwright E2E test that:
1. Creates project
2. Creates 3 tickets with projectId
3. Deletes project
4. Verifies all 3 tickets automatically deleted
5. Confirms cascade delete works

**Expected**: Test PASSES after migration (database constraint enforced)

### T009: Implement Seed Script
**File**: `prisma/seed.ts`
**Description**: Create seed script that:
1. Imports PrismaClient
2. Checks for GITHUB_OWNER and GITHUB_REPO env vars
3. Uses findUnique with githubOwner_githubRepo unique constraint
4. If project exists: logs and skips creation
5. If not exists: creates project with name="ai-board"
6. Creates sample tickets for the project
7. Handles errors gracefully with try/catch

**Validation**: TypeScript compiles, seed runs without errors

### T010: Add Environment Validation
**File**: `prisma/seed.ts`
**Description**: Add at start of main() function:
```typescript
const githubOwner = process.env.GITHUB_OWNER;
const githubRepo = process.env.GITHUB_REPO;

if (!githubOwner || !githubRepo) {
  throw new Error(
    "GITHUB_OWNER and GITHUB_REPO environment variables are required"
  );
}
```

**Validation**: T006 test now passes (environment validation works)

### T011: Create Default Project
**File**: `prisma/seed.ts`
**Description**: Implement idempotent project creation:
```typescript
let project = await prisma.project.findUnique({
  where: {
    githubOwner_githubRepo: { githubOwner, githubRepo }
  }
});

if (project) {
  console.log("Default project already exists:", project);
} else {
  project = await prisma.project.create({
    data: {
      name: "ai-board",
      description: "AI-powered project management board",
      githubOwner,
      githubRepo
    }
  });
  console.log("Created default project:", project);
}
```

**Validation**: T005 test now passes (idempotency works)

### T012: Final Verification
**Command**: `npm run test:e2e`
**Description**: Run all E2E tests to verify:
- ✅ T005: Seed idempotency test passes
- ✅ T006: Environment validation test passes
- ✅ T007: Unique constraint test passes
- ✅ T008: Cascade delete test passes
- All tests pass, feature complete

**Validation**: All 4 E2E tests pass with green status

## Notes
- [P] tasks = different files, can run in parallel
- T001-T003 modify same file (schema.prisma), must be sequential
- T005-T008 create different test files, can run in parallel
- Verify tests FAIL before implementing (Red-Green-Refactor)
- Commit after T004 (migration), T008 (tests), T011 (implementation), T012 (verification)

## Validation Checklist
- [x] All contracts have corresponding tests: N/A (database layer only)
- [x] All entities have model tasks: Project entity in T001-T003
- [x] All tests come before implementation: T005-T008 before T009-T011
- [x] Parallel tasks truly independent: T005-T008 are different files
- [x] Each task specifies exact file path: All tasks have file paths
- [x] No task modifies same file as another [P] task: T005-T008 all unique files

## Quickstart Reference
After completing all tasks, follow `/specs/012-add-project-model/quickstart.md` to:
- Verify seed runs successfully
- Test idempotency manually
- Inspect database with Prisma Studio
- Validate all acceptance criteria met
