
# Implementation Plan: Add required projectId foreign key to Ticket model

**Branch**: `010-add-required-projectid` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/benoit/Workspace/ai-board/specs/010-add-required-projectid/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Link every ticket to a project through a required foreign key relationship, enforcing data integrity and enabling project-scoped organization. This foundational schema change establishes the relationship between tickets and projects with cascade delete behavior and indexed lookups.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, PostgreSQL 14+
**Storage**: PostgreSQL 14+ via Prisma ORM with existing Project and Ticket models
**Testing**: Playwright E2E tests
**Target Platform**: Web application (Linux server via Vercel)
**Project Type**: Web (frontend + backend with Next.js App Router)
**Performance Goals**: Sub-100ms query performance for project-scoped ticket retrieval
**Constraints**: Required field (no null values), cascade delete behavior, indexed for efficient queries
**Scale/Scope**: Single default project for MVP, foundation for future multi-project support

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- Schema changes use Prisma (TypeScript-native ORM)
- All migrations will be type-safe through Prisma client generation
- Strict mode compliance maintained (no `any` types)

### II. Component-Driven Architecture ✅
- Schema-only change, no UI components affected
- Existing Next.js App Router patterns unchanged

### III. Test-Driven Development ✅
- Will write database constraint tests before schema migration
- Seed data validation test before implementation
- E2E tests verify project-ticket relationship enforcement

### IV. Security-First Design ✅
- Foreign key constraint prevents orphaned data
- Cascade delete ensures referential integrity
- Required field prevents null references
- Prisma migrations ensure safe schema evolution

### V. Database Integrity ✅
- All changes via Prisma migrations (`prisma migrate dev`)
- Database constraints at schema level (foreign key, required, indexed)
- Referential integrity enforced by PostgreSQL
- Seed data creates project before tickets

**Result**: PASS - All constitutional principles satisfied

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── api/
│   └── tickets/          # API routes for ticket operations
├── page.tsx              # Main board UI
└── layout.tsx

components/
└── board/                # Board and ticket UI components

lib/
└── db.ts                 # Prisma client instance

prisma/
├── schema.prisma         # Database schema (PRIMARY CHANGE)
├── migrations/           # Migration files (NEW MIGRATION)
└── seed.ts               # Seed data (REQUIRES UPDATE)

tests/
└── board.spec.ts         # E2E tests (REQUIRES UPDATE)
```

**Structure Decision**: Next.js 15 App Router monolith structure. All schema changes occur in `prisma/schema.prisma`. Database relationship enforced at the Prisma/PostgreSQL level. No frontend or API changes required for this feature (schema foundation only).

## Phase 0: Outline & Research ✅

No NEEDS CLARIFICATION items in Technical Context - all technologies specified.

**Research Topics Addressed**:
1. Prisma foreign key with cascade delete syntax
2. Migration strategy for adding required field to existing model
3. Index strategy for project-scoped queries
4. Seed data creation order (project before tickets)
5. Testing strategy for constraints and relationships

**Key Findings**:
- Use Prisma `@relation` with `onDelete: Cascade` for automatic cleanup
- Database reset acceptable for MVP (no production data)
- Single index on `projectId` sufficient for query performance
- Seed must create project first, then reference in ticket creation
- Test database constraints directly, not just application logic

**Output**: ✅ research.md created with all decisions documented

## Phase 1: Design & Contracts ✅

**Entities Extracted**:
- Ticket model: Added required `projectId` field with foreign key to Project
- Project model: Added inverse `tickets[]` relationship
- Relationship: One Project → Many Tickets (cascade delete)

**Contracts Generated**:
- `contracts/ticket-schema.json`: Updated Ticket schema with required projectId
- `contracts/database-constraints.md`: Database-level constraint specifications
  - Foreign key constraint with cascade delete
  - NOT NULL constraint on projectId
  - Index on projectId for query performance

**Test Scenarios Documented**:
- Required field validation test (creation without projectId must fail)
- Foreign key constraint test (invalid projectId must fail)
- Cascade delete test (deleting project deletes tickets)
- Query performance test (index usage verification)

**Quickstart Guide Created**:
- `quickstart.md`: 10-step validation procedure
- Manual verification steps for schema changes
- Database constraint verification queries
- Cascade delete demonstration script
- Type safety validation

**Agent Context Updated**:
- ✅ Ran `.specify/scripts/bash/update-agent-context.sh claude`
- Updated CLAUDE.md with Prisma 6.x, PostgreSQL 14+ context
- Recent changes tracked for this feature

**Output**: ✅ data-model.md, contracts/, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base structure
2. Generate tasks from Phase 1 artifacts:
   - **From data-model.md**: Schema modification tasks
   - **From contracts/**: Constraint validation test tasks
   - **From quickstart.md**: Migration and verification tasks
3. Apply TDD ordering: Tests → Implementation → Verification

**Expected Task Categories**:
1. **Database Schema Tasks**:
   - Update Prisma schema (add projectId to Ticket)
   - Add cascade delete relation
   - Add projectId index

2. **Test Tasks** (write BEFORE implementation):
   - Test: Ticket creation without projectId fails
   - Test: Ticket creation with invalid projectId fails
   - Test: Cascade delete removes all tickets
   - Test: Project-scoped queries use index

3. **Implementation Tasks**:
   - Generate Prisma migration
   - Run database reset
   - Update seed.ts (create project before tickets)
   - Run seed and verify

4. **Validation Tasks**:
   - Verify foreign key constraint exists
   - Verify index created
   - Run E2E tests
   - Type check passes

**Ordering Strategy**:
- Schema changes first (enable migrations)
- Tests before migration execution (TDD)
- Migration/seed before validation
- Mark independent tasks with [P] for parallel execution

**Estimated Output**: 12-15 numbered, dependency-ordered tasks in tasks.md

**Dependencies**:
- No API/UI changes (out of scope for this feature)
- No new routes or components
- Pure schema/database work with tests

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command) ← NEXT STEP
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅ (None found)
- [x] Complexity deviations documented ✅ (None - all principles satisfied)

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
