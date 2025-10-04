
# Implementation Plan: Add Project Model

**Branch**: `012-add-project-model` | **Date**: 2025-10-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-add-project-model/spec.md`

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
Create a Project data model to organize tickets by GitHub repository. Each project stores GitHub owner and repository name to enable workflow automation tools to perform GitHub operations (branches, PRs) in the correct repository. The default project is automatically created during database seeding with repository details from environment variables. The implementation ensures idempotency and prevents duplicate projects via unique constraints.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Prisma 6.x (ORM), Zod 4.x (validation), Next.js 15 (App Router)
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Playwright for E2E tests, TypeScript compiler for type safety
**Target Platform**: Web application (Next.js on Vercel)
**Project Type**: web (frontend + backend in Next.js App Router)
**Performance Goals**: <200ms for database queries, efficient indexing for GitHub repo lookups
**Constraints**: Database-level constraints (unique, foreign keys), environment variable configuration
**Scale/Scope**: Single project per GitHub repository, supports multiple repositories, designed for extensibility

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- [x] All code in TypeScript strict mode with explicit types
- [x] No `any` types (Prisma generates fully-typed client)
- [x] Function parameters and return types explicitly typed
- [x] Database models have corresponding TypeScript interfaces (Prisma-generated)

### II. Component-Driven Architecture
- [x] N/A for data model - server-side only feature
- [x] API routes follow Next.js App Router conventions (future endpoints)
- [x] Utilities in `/lib/` for database client access

### III. Test-Driven Development
- [x] E2E tests will verify seed idempotency and project creation
- [x] Tests written before/alongside implementation
- [x] Red-Green-Refactor cycle for critical flows

### IV. Security-First Design
- [x] Environment variables for GitHub credentials (never committed)
- [x] Prisma parameterized queries (no raw SQL)
- [x] Zod schema validation for any API inputs (future)
- [x] No sensitive data exposure in responses
- [x] .env files in .gitignore

### V. Database Integrity
- [x] All schema changes via Prisma migrations
- [x] Unique constraint on (githubOwner, githubRepo)
- [x] Foreign key constraints (Ticket.projectId → Project.id)
- [x] Cascade delete for referential integrity
- [x] No optional fields without defaults (all fields have defaults or are required)
- [x] Soft deletes not needed (infrastructure data, not user content)

**Result**: ✅ PASS - All constitutional requirements satisfied

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
prisma/
├── schema.prisma        # Project and Ticket models
├── migrations/          # Database migrations
└── seed.ts              # Idempotent seed with default project

app/
├── api/                 # Future API routes for project management
└── page.tsx             # Frontend (uses projects via API)

lib/
└── prisma.ts            # Shared Prisma client instance

tests/
└── foundation.spec.ts   # E2E tests for project seeding and creation
```

**Structure Decision**: Web application using Next.js App Router. Database schema and seed logic in `/prisma`, API routes in `/app/api` (future), shared utilities in `/lib`, and E2E tests in `/tests`. This follows the Next.js 15 App Router convention and the project constitution.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (data-model.md, contracts/, quickstart.md)
- Schema migration tasks based on data-model.md entity definitions
- Seed implementation tasks based on idempotency requirements
- Test tasks based on quickstart.md validation scenarios
- Implementation follows TDD: tests before implementation

**Ordering Strategy**:
1. **Schema Definition**: Define Project model in Prisma schema
2. **Migration Generation**: Generate and review Prisma migration
3. **Seed Implementation**: Create idempotent seed script
4. **Environment Setup**: Configure env variables for seed
5. **Test Implementation**: E2E tests for seed idempotency and constraints
6. **Verification**: Run quickstart validation steps

**Estimated Task Breakdown**:
- Schema tasks: 2-3 (define model, add constraints/indexes)
- Migration tasks: 2 (generate, apply)
- Seed tasks: 3-4 (implement, add env validation, test idempotency)
- Test tasks: 4-5 (seed tests, constraint tests, cascade delete tests)
- Documentation tasks: 1-2 (update schema docs, verify quickstart)
- **Total**: ~12-15 tasks

**Parallel Execution Opportunities** [P]:
- Schema definition and test planning can happen in parallel
- Multiple E2E test files can be created in parallel
- Documentation updates independent of implementation

**Critical Dependencies**:
- Migration must be generated AFTER schema definition
- Seed cannot run BEFORE migration applied
- Tests cannot run BEFORE seed implemented
- All tasks depend on environment variables configured

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
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md created
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command) - tasks.md created with 12 tasks
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS - All requirements satisfied
- [x] Post-Design Constitution Check: PASS - No new violations introduced
- [x] All NEEDS CLARIFICATION resolved - No unknowns in Technical Context
- [x] Complexity deviations documented - None required, all within constitutional bounds

**Artifacts Generated**:
- [x] plan.md - This file with complete planning details
- [x] research.md - Technology decisions and best practices
- [x] data-model.md - Entity definitions and relationships
- [x] contracts/README.md - API contracts (database layer only for this feature)
- [x] quickstart.md - Setup and validation guide
- [x] tasks.md - 12 executable tasks with TDD approach
- [x] CLAUDE.md - Updated agent context file

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
