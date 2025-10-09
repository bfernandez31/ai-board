# Implementation Plan: E2E Test Data Isolation with [e2e] Prefixes

**Branch**: `017-il-faudrait-modifier` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/017-il-faudrait-modifier/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Project Type: web (Next.js frontend + backend)
   → Structure Decision: Existing test infrastructure with selective cleanup
3. Fill the Constitution Check section
   → ✅ All principles aligned
4. Evaluate Constitution Check section below
   → ✅ No violations, no complexity tracking needed
   → ✅ Updated Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → ✅ Current test patterns analyzed
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ Test modification contracts defined
7. Re-evaluate Constitution Check section
   → ✅ No new violations
   → ✅ Updated Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach
   → ✅ TDD-based task ordering defined
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Modify E2E test infrastructure to isolate test data using `[e2e]` prefixes for tickets and projects. Replace database-wide cleanup with selective deletion targeting only test-generated entities, preserving manual/production data while maintaining backward compatibility with all existing tests.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Playwright (testing), Prisma 6.x (ORM), Next.js 15 (App Router)
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Playwright E2E tests with MCP support
**Target Platform**: Web (Next.js App Router)
**Project Type**: web (frontend + backend integrated)
**Performance Goals**: <2s test cleanup, <500ms per selective delete operation
**Constraints**: Zero test failures during migration, backward compatibility mandatory
**Scale/Scope**: ~40 existing test files, selective cleanup for tickets and projects

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- ✅ Test helpers maintain strict TypeScript mode
- ✅ All cleanup functions explicitly typed
- ✅ Prisma queries remain type-safe with `where` clause filtering

### II. Component-Driven Architecture
- ✅ N/A - Test infrastructure changes only
- ✅ No UI component modifications required

### III. Test-Driven Development (NON-NEGOTIABLE)
- ✅ Existing tests preserved, migration approach maintains TDD compliance
- ✅ New selective cleanup functionality tested before implementation
- ✅ Backward compatibility validated via existing test suite

### IV. Security-First Design
- ✅ Prisma parameterized queries for selective deletion (prevents SQL injection)
- ✅ No raw SQL, using Prisma's type-safe `where` clauses
- ✅ No sensitive data exposure risk (test data isolation improvement)

### V. Database Integrity
- ✅ Selective deletion uses Prisma transactions for multi-table cleanup
- ✅ No schema changes required (using existing `title` and `name` fields)
- ✅ Soft delete not applicable (test data cleanup by design)
- ✅ Foreign key constraints preserved (cascade handled by Prisma)

**Constitution Compliance**: ✅ PASS - No violations, no complexity tracking required

## Project Structure

### Documentation (this feature)
```
specs/017-il-faudrait-modifier/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── cleanup-tickets.contract.md
│   ├── cleanup-projects.contract.md
│   └── test-prefix.contract.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Web application (Next.js App Router with integrated frontend/backend)
tests/
├── helpers/
│   └── db-cleanup.ts          # Modified: selective cleanup logic
├── e2e/                       # Modified: all tests use [e2e] prefixed data
│   ├── ticket-create.spec.ts
│   ├── board-empty.spec.ts
│   ├── board-multiple.spec.ts
│   └── [38+ other test files]
├── api/                       # Modified: API tests use [e2e] prefixed data
│   ├── projects-tickets-get.spec.ts
│   ├── projects-tickets-post.spec.ts
│   └── [7+ other test files]
├── contracts/                 # Modified: contract tests use [e2e] prefixed data
│   ├── tickets-branch.spec.ts
│   ├── tickets-create.spec.ts
│   └── tickets-update.spec.ts
└── integration/               # Modified: integration tests use [e2e] prefixed data
    ├── ticket-automode.spec.ts
    ├── ticket-branch-assignment.spec.ts
    └── [5+ other test files]

prisma/
└── schema.prisma              # No changes - using existing fields
```

**Structure Decision**: Existing web application structure preserved. All changes confined to test infrastructure (`tests/` directory) with focus on `tests/helpers/db-cleanup.ts` and systematic prefix addition across all test files.

## Phase 0: Outline & Research

### Current Test Infrastructure Analysis

#### Existing Cleanup Pattern (tests/helpers/db-cleanup.ts:17-74)
```
Current: await client.ticket.deleteMany({})  // Database-wide deletion
Problem: Destroys all tickets, including manual/production data
```

#### Test Data Creation Pattern
```
Current: await createTicket(request, { title: 'Fix login bug', ... })
Required: await createTicket(request, { title: '[e2e] Fix login bug', ... })
Pattern: All test-created entities must have [e2e] prefix
```

#### Affected Test Categories
1. **E2E Tests** (20 files in `tests/e2e/`): UI interaction tests
2. **API Tests** (7 files in `tests/api/`): HTTP endpoint tests
3. **Contract Tests** (3 files in `tests/contracts/`): API contract validation
4. **Integration Tests** (5 files in `tests/integration/`): Multi-component tests
5. **Database Tests** (3 files): Schema and constraint tests
6. **Other Tests** (2 files): Foundation and specialized tests

**Total Impact**: ~40 test files requiring prefix modifications

### Research Decisions

**Decision 1: Prefix Format**
- **Chosen**: `[e2e]` prefix at start of title/name
- **Rationale**: Clear, searchable, visually distinct, preserves readability
- **Alternatives considered**:
  - `__test__` suffix: Less visually prominent
  - UUID suffix: Not human-readable
  - Separate `isTestData` boolean field: Requires schema migration

**Decision 2: Selective Cleanup Strategy**
- **Chosen**: Prisma `where` clause filtering on `title.startsWith('[e2e]')`
- **Rationale**: Type-safe, no SQL injection risk, leverages existing fields
- **Alternatives considered**:
  - Raw SQL with LIKE: Rejected per constitution (no raw SQL)
  - Separate test database: Rejected (adds complexity, not requested)
  - Tagging table: Rejected (schema changes unnecessary)

**Decision 3: Cleanup Timing**
- **Chosen**: `beforeEach` hook for both cleanup and project setup
- **Rationale**: Ensures clean state, handles test failures gracefully
- **Alternatives considered**:
  - `afterEach` only: Rejected (leaves pollution on test failure)
  - `beforeAll` only: Rejected (tests interfere with each other)
  - Both `beforeEach` + `afterEach`: Redundant, slower

**Decision 4: Test Migration Strategy**
- **Chosen**: Systematic prefix injection via helper function or direct modification
- **Rationale**: Maintains test logic, minimal code changes, backward compatible
- **Alternatives considered**:
  - Wrapper functions: Adds indirection, harder to debug
  - Test data factories: Over-engineering for simple prefix
  - Global test config: Not supported by Playwright

**Decision 5: Project Creation Pattern**
- **Chosen**: Create `[e2e] Test Project` with deterministic ID, cleanup via prefix
- **Rationale**: Consistent with ticket pattern, preserves test expectations
- **Alternatives considered**:
  - Dynamic project IDs: Rejected (breaks tests expecting project ID 1)
  - Never cleanup projects: Rejected (violates isolation requirement)

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts

### Data Model Changes (data-model.md)

**No schema migrations required** - using existing Prisma schema fields:

#### Ticket Entity
- **Field Used**: `title` (String, max 200 chars)
- **Modification**: Prefix with `[e2e] ` for test-generated tickets
- **Cleanup Logic**: `where: { title: { startsWith: '[e2e]' } }`
- **Example**: `[e2e] Fix login bug`

#### Project Entity
- **Field Used**: `name` (String, max 100 chars)
- **Modification**: Prefix with `[e2e] ` for test-generated projects
- **Cleanup Logic**: `where: { name: { startsWith: '[e2e]' } }`
- **Example**: `[e2e] Test Project`

### API Contracts (contracts/)

#### Contract 1: Selective Ticket Cleanup (cleanup-tickets.contract.md)
```typescript
// Function: cleanupDatabase() - Ticket cleanup portion
// Location: tests/helpers/db-cleanup.ts

Input: None (operates on global Prisma client)
Operation: await client.ticket.deleteMany({
  where: { title: { startsWith: '[e2e]' } }
})
Output: Promise<void>

Assertions:
- MUST delete all tickets with title starting with '[e2e]'
- MUST preserve all tickets without '[e2e]' prefix
- MUST use Prisma parameterized query (no raw SQL)
- MUST complete in <500ms for <100 test tickets
```

#### Contract 2: Selective Project Cleanup (cleanup-projects.contract.md)
```typescript
// Function: cleanupDatabase() - Project cleanup portion
// Location: tests/helpers/db-cleanup.ts

Input: None (operates on global Prisma client)
Operation: await client.project.deleteMany({
  where: { name: { startsWith: '[e2e]' } }
})
Then: Create [e2e] test projects if missing
Output: Promise<void>

Assertions:
- MUST delete all projects with name starting with '[e2e]'
- MUST preserve all projects without '[e2e]' prefix
- MUST recreate [e2e] test projects (ID 1, ID 2) for test stability
- MUST use Prisma parameterized query (no raw SQL)
```

#### Contract 3: Test Data Prefix Enforcement (test-prefix.contract.md)
```typescript
// Pattern: All test data creation
// Location: All test files

Input: Test data object (e.g., { title: string })
Modification: Inject '[e2e] ' prefix before title/name
Output: Prefixed data object

Assertions:
- ALL test-created tickets MUST have '[e2e] ' prefix in title
- ALL test-created projects MUST have '[e2e] ' prefix in name
- Prefix MUST be at start of string
- Prefix MUST be consistent across all test files
- No test logic changes beyond data creation
```

### Quickstart Validation (quickstart.md)

**Pre-Implementation Validation**:
```bash
# 1. Verify existing tests pass (baseline)
npm run test

# 2. Verify current cleanup deletes all tickets
# Expected: All tickets deleted regardless of content
```

**Post-Implementation Validation**:
```bash
# 1. Manually create non-test data
# In Prisma Studio or psql:
INSERT INTO "Ticket" (title, description, stage, "projectId")
VALUES ('Manual Test Ticket', 'Should persist', 'INBOX', 1);

# 2. Run single E2E test
npx playwright test tests/e2e/ticket-create.spec.ts

# 3. Verify selective cleanup worked
# Expected: '[e2e]' prefixed tickets deleted, manual ticket persists

# 4. Run full test suite
npm run test
# Expected: All tests pass, manual ticket still exists

# 5. Verify test isolation (run test twice)
npx playwright test tests/e2e/ticket-create.spec.ts
npx playwright test tests/e2e/ticket-create.spec.ts
# Expected: Both runs pass, no interference
```

### Agent Context Update (CLAUDE.md)

Incremental update to capture test infrastructure changes:
- Add E2E test isolation pattern to "Recent Changes"
- Document `[e2e]` prefix convention in "Code Style"
- Note selective cleanup pattern for future test creation
- Keep under 150 lines (remove oldest entries if needed)

**Output**: data-model.md, /contracts/*, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 contracts and research decisions
- Prioritize TDD approach: Write failing tests first, then implementation

**Task Categories**:
1. **Setup Tasks**: Modify cleanup helper with selective deletion
2. **Test Migration Tasks**: Add `[e2e]` prefix to test data across categories
3. **Validation Tasks**: Run test suite, verify isolation, validate contracts

**Ordering Strategy**:
1. **Phase A: Cleanup Infrastructure** (Foundation)
   - Modify `tests/helpers/db-cleanup.ts` with selective deletion
   - Add contract tests for cleanup functions
   - Verify cleanup isolation with manual data test

2. **Phase B: Test Data Prefixing** (Systematic Migration)
   - Category 1: E2E tests (20 files) - UI critical path
   - Category 2: API tests (7 files) - Endpoint validation
   - Category 3: Contract tests (3 files) - API contracts
   - Category 4: Integration tests (5 files) - Multi-component
   - Category 5: Remaining tests (5 files) - Database/foundation

3. **Phase C: Validation** (Quality Gate)
   - Run full test suite
   - Verify selective cleanup with manual data persistence
   - Execute quickstart validation steps
   - Document any edge cases or failures

**Parallelization Opportunities [P]**:
- Within each category, test files can be modified in parallel
- Validation tasks must be sequential (dependencies on completion)

**Estimated Output**: 50-60 tasks total
- 5 cleanup infrastructure tasks
- 40 test migration tasks (1 per file)
- 5 validation tasks
- 5 documentation/verification tasks

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (systematic test migration following task order)
**Phase 5**: Validation (full test suite, isolation verification, quickstart execution)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations - section not applicable.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning approach described (/plan command) ✅
- [ ] Phase 3: Tasks generated (/tasks command) - NEXT STEP
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented (none) ✅

**Artifacts Generated**:
- [x] plan.md (this file) ✅
- [x] research.md (Phase 0) ✅
- [x] data-model.md (Phase 1) ✅
- [x] contracts/cleanup-tickets.contract.md (Phase 1) ✅
- [x] contracts/cleanup-projects.contract.md (Phase 1) ✅
- [x] contracts/test-prefix.contract.md (Phase 1) ✅
- [x] quickstart.md (Phase 1) ✅
- [x] CLAUDE.md updated (Phase 1) ✅
- [ ] tasks.md (Phase 2 - awaiting /tasks command)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
