# Implementation Plan: GitHub Branch Tracking and Automation Flags

**Branch**: `014-add-github-branch` | **Date**: 2025-10-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-add-github-branch/spec.md`

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
Add branch name tracking and automation mode flag to the Ticket model to support GitHub workflow integration. Tickets will store the Git branch created by the `/specify` workflow and a boolean flag controlling whether automation scripts should automatically advance the ticket through development stages.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Prisma 6.x (ORM), Zod 4.x (validation), Next.js 15 (App Router)
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Ticket model)
**Testing**: Playwright with MCP support
**Target Platform**: Vercel (Next.js deployment)
**Project Type**: web (Next.js App Router with API routes)
**Performance Goals**: <200ms API response for ticket queries
**Constraints**: Max 200 character branch names, reversible migrations, preserve existing data
**Scale/Scope**: Existing Ticket table with ~10 fields, adding 2 new optional fields

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### TypeScript-First Development
- ✅ All Prisma schema fields will have corresponding TypeScript types via generated client
- ✅ Validation schemas will use Zod with explicit types
- ✅ API route handlers will have explicit request/response types
- ✅ No `any` types needed (standard Prisma + Next.js patterns)

### Component-Driven Architecture
- ✅ No UI changes required in this feature (backend-only)
- ✅ API routes follow `/app/api/tickets/route.ts` convention
- ✅ Future UI components will use shadcn/ui patterns when implemented

### Test-Driven Development
- ✅ Playwright E2E tests will validate ticket creation with default values
- ✅ Tests will verify branch assignment after `/specify` workflow
- ✅ Tests will validate automation flag behavior
- ✅ Tests written before implementation (Red-Green-Refactor)

### Security-First Design
- ✅ Zod validation for branch names (max 200 chars)
- ✅ Prisma parameterized queries (no raw SQL)
- ✅ No sensitive data exposed (branch names are non-sensitive)
- ✅ Input validation on all API endpoints

### Database Integrity
- ✅ Schema changes via `prisma migrate dev`
- ✅ Migration includes default values for new fields
- ✅ Nullable branch field (set only after workflow creates branch)
- ✅ Non-null autoMode with default false
- ✅ Migration is reversible (can drop columns)
- ✅ Maintains existing foreign key to Project

**Constitution Status**: ✅ PASS - No violations

## Project Structure

### Documentation (this feature)
```
specs/014-add-github-branch/
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
│   └── tickets/
│       ├── route.ts          # POST /api/tickets (create ticket)
│       └── [id]/
│           ├── route.ts      # GET/PATCH /api/tickets/:id
│           └── branch/
│               └── route.ts  # PATCH /api/tickets/:id/branch (new endpoint)
├── projects/
│   └── [projectId]/
│       └── board/
│           └── page.tsx      # Board UI (future: display branch)
└── board/
    └── page.tsx              # Legacy board (to be removed)

components/
└── ticket/
    └── ticket-card.tsx       # Ticket display component (future: show branch)

lib/
├── db.ts                     # Prisma client singleton
├── validations/
│   └── ticket.ts             # Ticket validation schemas (update with branch/autoMode)
└── types/
    └── ticket.ts             # TypeScript types (generated from Prisma)

prisma/
├── schema.prisma             # Update Ticket model
└── migrations/
    └── [timestamp]_add_branch_tracking/
        └── migration.sql     # Generated migration

tests/
├── ticket-branch.spec.ts     # New E2E tests for branch tracking
└── ticket-automation.spec.ts # New E2E tests for automation mode
```

**Structure Decision**: Web application structure (Next.js App Router). This is a backend-only feature extending the existing Ticket model. The project already uses Next.js 15 App Router with Prisma ORM and PostgreSQL. Source code follows the established pattern with API routes in `/app/api` and database models in `/prisma/schema.prisma`.

## Phase 0: Outline & Research
No unknowns identified - all Technical Context fields are concrete. However, research is needed for best practices:

1. **Prisma nullable field patterns**:
   - Decision: Use optional `String?` for branch field
   - Rationale: Branch is set only after `/specify` workflow succeeds
   - Alternative: Required field with empty string default (rejected - null is semantically clearer)

2. **Prisma migration backfill strategies**:
   - Decision: Use `@default(false)` for autoMode, no backfill query needed
   - Rationale: Prisma handles defaults during migration
   - Alternative: Manual UPDATE query (rejected - unnecessary complexity)

3. **Zod validation for optional strings**:
   - Decision: `z.string().max(200).nullable()` or `z.string().max(200).optional()`
   - Rationale: Matches Prisma nullable field semantics
   - Alternative: Transform null to empty string (rejected - loses semantic meaning)

4. **Next.js API route patterns for PATCH**:
   - Decision: Follow existing `/app/api/tickets/[id]/route.ts` PATCH handler pattern
   - Rationale: Consistency with current codebase (see existing ticket update endpoint)
   - Alternative: Separate `/branch` sub-route (considered for clarity)

**Output**: research.md (to be created)

## Phase 1: Design & Contracts

### Entities (from spec.md)
1. **Ticket** (existing, extending):
   - Add `branch: String? @db.VarChar(200)` (nullable, max 200 chars)
   - Add `autoMode: Boolean @default(false)` (required, defaults to false)
   - Preserve existing fields: id, title, description, stage, version, projectId, createdAt, updatedAt
   - Preserve existing relations: Project (many-to-one), Job (one-to-many)

2. **Branch tracking workflow**:
   - Created by: `/specify` workflow via `create-new-feature.sh`
   - Format: `###-feature-name` (e.g., `014-add-github-branch`)
   - Stored in: Ticket.branch field
   - Updated via: PATCH /api/tickets/:id/branch

3. **Automation mode**:
   - Controls: Whether automation scripts advance ticket stages
   - Default: false (manual progression)
   - Settable via: PATCH /api/tickets/:id (include autoMode in body)

### API Contracts (to be generated in /contracts/)

**POST /api/tickets** (existing - update response):
```typescript
Request:
{
  title: string (max 100),
  description: string (max 1000),
  projectId: number
}

Response:
{
  id: number,
  title: string,
  description: string,
  stage: Stage,
  version: number,
  projectId: number,
  branch: null,        // NEW: always null on creation
  autoMode: false,     // NEW: always false on creation
  createdAt: string,
  updatedAt: string
}
```

**PATCH /api/tickets/:id** (existing - update to accept new fields):
```typescript
Request (partial update):
{
  title?: string,
  description?: string,
  stage?: Stage,
  branch?: string | null,    // NEW: optional
  autoMode?: boolean         // NEW: optional
}

Response:
{
  // Same as POST response with updated values
}

Validation:
- branch: max 200 chars, nullable
- autoMode: boolean
```

**PATCH /api/tickets/:id/branch** (NEW endpoint - specialized branch update):
```typescript
Request:
{
  branch: string | null
}

Response:
{
  id: number,
  branch: string | null,
  updatedAt: string
}

Validation:
- branch: required in body, max 200 chars if string
```

### Contract Tests (to be generated)
- `tests/contracts/tickets-create.spec.ts`: Verify POST returns branch=null, autoMode=false
- `tests/contracts/tickets-update.spec.ts`: Verify PATCH accepts branch and autoMode
- `tests/contracts/tickets-branch.spec.ts`: Verify PATCH /branch validates length

### Integration Tests (from user stories)
- Scenario 1: New ticket defaults (from spec acceptance scenario 1)
- Scenario 2: Branch assignment after `/specify` (from spec acceptance scenario 2)
- Scenario 3: Automation flag controls workflow (from spec acceptance scenarios 3-4)
- Scenario 5: Display branch in ticket details (from spec acceptance scenario 5)

### Quickstart Test
Validates the complete user journey:
1. Create ticket → verify branch=null, autoMode=false
2. Simulate `/specify` workflow → update branch via PATCH
3. Toggle autoMode → verify flag persists
4. Query ticket → verify branch and autoMode are returned

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each field → Prisma schema update + migration task
- Each API change → validation schema update + route handler update
- Integration test → E2E test implementation task
- Quickstart scenario → quickstart test implementation

**Ordering Strategy**:
- TDD order: Tests before implementation
- Database first: Schema → migration → Prisma client regeneration
- API second: Validation → route handlers → API tests
- UI last: Display components (future task, not in this feature)
- Mark [P] for parallel execution where independent

**Estimated Task Breakdown**:
1. **Database Tasks** (sequential):
   - Update Prisma schema with new fields
   - Generate migration
   - Run migration (dev)
   - Verify Prisma client types

2. **Validation Tasks** (parallel after DB):
   - Update ticket validation schemas (Zod) [P]
   - Write contract tests for new fields [P]

3. **API Tasks** (sequential after validation):
   - Update POST /api/tickets handler (return new fields)
   - Update PATCH /api/tickets/:id handler (accept new fields)
   - Implement PATCH /api/tickets/:id/branch handler (NEW)

4. **Integration Test Tasks** (parallel after API):
   - E2E test: Ticket creation defaults [P]
   - E2E test: Branch assignment workflow [P]
   - E2E test: AutoMode flag behavior [P]
   - E2E test: Quickstart scenario

5. **Documentation Tasks**:
   - Update CLAUDE.md with new tech context
   - Update API documentation (if exists)

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitution violations - this section intentionally left empty*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (none present)
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
