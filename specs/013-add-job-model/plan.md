
# Implementation Plan: Add Job Model

**Branch**: `013-add-job-model` | **Date**: 2025-10-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-add-job-model/spec.md`

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
Add Job data model to track spec-kit workflow command executions (specify, plan, task, implement, clarify) with status tracking, execution logs, and Git metadata. Jobs are associated with tickets via foreign key with cascade delete, support configurable timeouts per command type, and store unlimited log content with compression/external storage for large traces. All job records are retained indefinitely for complete execution history.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Prisma 6.x (ORM), Zod 4.x (validation), Next.js 15 (App Router), PostgreSQL 14+
**Storage**: PostgreSQL 14+ via Prisma ORM with existing Ticket model relation
**Testing**: Playwright E2E tests (no API routes in this feature - data model only)
**Target Platform**: Vercel (Next.js deployment), PostgreSQL database
**Project Type**: web (Next.js App Router application)
**Performance Goals**: Database query performance optimized via indexes on ticketId, status, startedAt
**Constraints**: Unlimited log storage with compression/external storage for large content, nullable Git metadata fields
**Scale/Scope**: Unlimited job retention per ticket (no cleanup policy), support for 5 command types, configurable timeouts per command

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- [x] Schema defined with explicit Prisma types (no `any` types)
- [x] All model fields explicitly typed (String, Int, DateTime, etc.)
- [x] Enum type (JobStatus) with explicit values
- [x] Strict mode enforced via tsconfig.json (project-wide)

### II. Component-Driven Architecture ✅
- [x] N/A - This is a data model feature (no UI components)
- [x] Follows Next.js/Prisma conventions (schema in /prisma directory)

### III. Test-Driven Development ✅
- [x] N/A - Data model only (no user flows to test)
- [x] Migration testing via Prisma migrate commands
- [x] Schema validation via Prisma client generation

### IV. Security-First Design ✅
- [x] All fields validated via Prisma schema constraints (maxLength, nullable, etc.)
- [x] Parameterized queries enforced by Prisma ORM (no raw SQL)
- [x] No sensitive data exposed (logs are internal debugging data)
- [x] Cascade delete prevents orphaned records

### V. Database Integrity ✅
- [x] All schema changes via Prisma migration (`prisma migrate dev`)
- [x] Foreign key constraint (ticketId → Ticket.id) enforced at schema level
- [x] Cascade delete configured for referential integrity
- [x] Indexes defined for query performance (ticketId, status, startedAt)
- [x] Required fields have defaults or explicit null handling
- [x] No optional fields without default/null specification

**Result**: PASS - All constitutional principles satisfied for data model feature

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
ai-board/
├── prisma/
│   ├── schema.prisma          # Add Job model and JobStatus enum
│   ├── migrations/            # Generated migration files
│   └── seed.ts               # No seed data for jobs (created dynamically)
├── app/
│   └── api/                  # Future: Job API routes (separate ticket)
├── lib/
│   └── prisma.ts            # Existing Prisma client (no changes)
└── tests/
    └── e2e/                  # Future: Job-related E2E tests (if needed)
```

**Structure Decision**: Web application using Next.js App Router. This feature modifies only the Prisma schema (`prisma/schema.prisma`) to add the Job model and JobStatus enum. No API routes, UI components, or application logic in this ticket - pure data model definition and migration generation. Future tickets will add job creation/update logic and API endpoints.

## Phase 0: Outline & Research ✅

**Status**: Complete

**Research Questions Addressed**:
1. Prisma Text field best practices for unlimited logs → Use `@db.Text` PostgreSQL type
2. Nullable field handling in Prisma → Use `Type?` syntax for optional fields
3. Index strategy for job queries → Composite + individual indexes
4. Cascade delete behavior → Use `onDelete: Cascade` on relation
5. Enum vs String for command field → String with application-level validation
6. Large log content handling → Inline with PostgreSQL TOAST compression
7. Timeout configuration storage → External to model (env/config file)

**Output**: [research.md](./research.md) - All unknowns resolved, no blockers for Phase 1

## Phase 1: Design & Contracts ✅

**Status**: Complete

**Deliverables Created**:

1. **Data Model** ([data-model.md](./data-model.md)):
   - Job entity: 11 fields (id, ticketId, command, status, branch, commitSha, logs, startedAt, completedAt, createdAt, updatedAt)
   - JobStatus enum: 4 states (PENDING, RUNNING, COMPLETED, FAILED)
   - Relationships: Job n:1 Ticket (cascade delete)
   - Indexes: 4 indexes for query performance
   - State transitions: pending → running → (completed | failed)
   - Validation rules and constraints documented

2. **Schema Contract** ([contracts/schema.prisma](./contracts/schema.prisma)):
   - Complete Prisma schema with inline documentation
   - Query examples for all CRUD operations
   - Migration checklist
   - TypeScript type definitions (generated by Prisma Client)

3. **Quickstart Guide** ([quickstart.md](./quickstart.md)):
   - 5-minute validation workflow
   - 6 test scenarios (create, update, query, cascade delete)
   - Database verification steps
   - TypeScript type verification
   - Common issues and rollback procedures

4. **Agent Context Update**:
   - Updated CLAUDE.md via `.specify/scripts/bash/update-agent-context.sh claude`
   - Added PostgreSQL 14+ and Prisma 6.x to active technologies
   - Added 013-add-job-model to recent changes

**No API Routes or Tests**: This feature is data-model only. No API endpoints, UI components, or E2E tests required (FR-001 through FR-018 are enforced at database/schema level). Future tickets will add job creation/update APIs.

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (data-model.md, contracts/schema.prisma, quickstart.md)
- Data model only - no API routes, UI components, or E2E tests
- Focus on schema definition, migration, and validation

**Expected Tasks**:
1. Add JobStatus enum to Prisma schema
2. Add Job model to Prisma schema with all fields
3. Add jobs relation to Ticket model
4. Generate Prisma migration
5. Apply migration to database
6. Regenerate Prisma Client
7. Verify schema with quickstart script
8. Verify indexes created correctly
9. Verify cascade delete behavior
10. Update TypeScript type checks

**Ordering Strategy**:
- Sequential execution (schema → migration → client → validation)
- No parallelization needed (single file modification)
- Each task depends on previous completion

**Estimated Output**: 10-12 numbered, ordered tasks in tasks.md

**Validation Criteria**:
- All acceptance criteria from spec.md met
- Quickstart guide tests pass
- No TypeScript errors
- Database constraints enforced

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

**Status**: No constitutional violations - all principles satisfied

This feature is a straightforward data model addition with no complexity deviations:
- Pure Prisma schema modification (no custom patterns)
- Standard PostgreSQL types and constraints
- No additional dependencies beyond existing stack
- No architectural changes or new patterns introduced


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - 2025-10-04
- [x] Phase 1: Design complete (/plan command) - 2025-10-04
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - 2025-10-04
- [x] Phase 3: Tasks generated (/tasks command) - 2025-10-04
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS - All 5 principles satisfied
- [x] Post-Design Constitution Check: PASS - No violations introduced
- [x] All NEEDS CLARIFICATION resolved - No unknowns in technical context
- [x] Complexity deviations documented - None (straightforward data model)

**Artifacts Generated**:
- [x] research.md (Phase 0)
- [x] data-model.md (Phase 1)
- [x] contracts/schema.prisma (Phase 1)
- [x] quickstart.md (Phase 1)
- [x] CLAUDE.md updated (Phase 1)
- [x] tasks.md (Phase 3)

**Next Steps**: Execute tasks T004-T019 to implement Job model

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
