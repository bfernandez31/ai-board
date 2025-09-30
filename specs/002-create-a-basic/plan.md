
# Implementation Plan: Basic Kanban Board with 6 Columns

**Branch**: `002-create-a-basic` | **Date**: 2025-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/002-create-a-basic/spec.md`

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
Build a visual kanban board with 6 workflow columns (IDLE, PLAN, BUILD, REVIEW, SHIPPED, ERRORED) displaying ticket cards with basic information. Users can view tickets organized by stage and create new tickets that appear in the IDLE column. This is a display-focused MVP without drag-drop, modals, or AI integration—establishing the visual foundation for future enhancements.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 20.x
**Primary Dependencies**: Next.js 15 (App Router), React 18, TailwindCSS 3.4, Prisma (to be added), shadcn/ui (to be added)
**Storage**: PostgreSQL via Prisma ORM (database setup required)
**Testing**: Playwright 1.48 for E2E tests
**Target Platform**: Web browsers (desktop >= 1024px, mobile >= 375px with horizontal scroll)
**Project Type**: web (Next.js full-stack application)
**Performance Goals**: Initial page load <2s, board render <500ms, support 100 tickets without performance degradation
**Constraints**: <200ms API response time, responsive design with horizontal scroll <375px, dark theme only
**Scale/Scope**: Single board, 100 tickets initially, 6 fixed workflow stages, no authentication in this phase

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- [x] `strict: true` enabled in tsconfig.json (verified in project)
- [x] All function parameters and return types will be explicitly typed
- [x] API responses and database models will have TypeScript interfaces
- [x] No `any` types without justification
**Status**: ✅ PASS - Project already configured with TypeScript strict mode

### II. Component-Driven Architecture
- [x] Will use shadcn/ui components for UI primitives (buttons, cards, badges)
- [x] Server Components by default, Client Components only for interactivity
- [x] Feature-based folder structure: `/components/board/*`, `/app/board/*`
- [x] API routes follow Next.js App Router conventions: `/app/api/tickets/route.ts`
**Status**: ✅ PASS - Aligns with Next.js 15 App Router and shadcn/ui patterns

### III. Test-Driven Development
- [x] Playwright E2E tests will be written before implementation
- [x] Tests in `/tests/board.spec.ts` covering critical user flows
- [x] Test names describe user actions: "user can view board with 6 columns"
- [x] Red-Green-Refactor cycle for board display and ticket creation
**Status**: ✅ PASS - TDD approach planned for critical flows

### IV. Security-First Design
- [x] Zod schemas for input validation on ticket creation
- [x] Prisma parameterized queries (no raw SQL)
- [x] No sensitive data exposure in API responses
- [x] Environment variables for database connection (not in git)
**Status**: ✅ PASS - Input validation and Prisma ORM ensure security

### V. Database Integrity
- [x] Prisma migrations for all schema changes (`prisma migrate dev`)
- [x] Prisma transactions for multi-step operations (if needed)
- [x] Database constraints (unique IDs, foreign keys) at schema level
- [x] Soft deletes consideration (not in MVP, but design allows for it)
**Status**: ✅ PASS - Prisma migration workflow enforces integrity

**Overall Initial Constitution Check**: ✅ PASS - No violations, design aligns with all 5 core principles

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
app/                           # Next.js App Router
├── board/
│   └── page.tsx              # Main board page (Server Component)
├── api/
│   └── tickets/
│       └── route.ts          # GET (list) and POST (create) handlers
├── layout.tsx                # Root layout (existing)
├── globals.css               # Global styles (existing)
└── page.tsx                  # Home page (existing)

components/
└── board/
    ├── board.tsx             # Board container component
    ├── column.tsx            # Column component (stage + cards)
    └── ticket-card.tsx       # Individual ticket card component

lib/
├── db.ts                     # Prisma client singleton
├── validations.ts            # Zod schemas for ticket validation
└── utils.ts                  # Utility functions (date formatting, etc.)

prisma/
├── schema.prisma             # Database schema (Ticket model + Stage enum)
└── migrations/               # Migration files

tests/
└── board.spec.ts             # E2E tests for board display and ticket creation

public/                       # Static assets (existing)
```

**Structure Decision**: Next.js 15 App Router structure selected. This is a web application with integrated frontend and API routes in a single Next.js project. Uses the `/app` directory for pages and API routes, `/components` for React components, `/lib` for shared utilities, and `/prisma` for database schema. This aligns with the Constitution's Component-Driven Architecture principle and Next.js conventions.

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
The `/tasks` command will generate a comprehensive, dependency-ordered task list from the Phase 1 design artifacts:

1. **Foundation Tasks** (Setup & Configuration):
   - Install dependencies (Prisma, Zod, date-fns, shadcn/ui)
   - Initialize Prisma schema
   - Setup environment variables
   - Configure Prisma client singleton

2. **Database Tasks** (Data Layer):
   - Create Prisma schema (Stage enum + Ticket model)
   - Generate Prisma client
   - Run initial migration
   - Create seed script (optional)

3. **Validation & Types Tasks** (Type Safety Layer):
   - Define TypeScript types (lib/types.ts)
   - Create Zod validation schemas (lib/validations.ts)
   - Create utility functions (lib/utils.ts for date formatting)

4. **API Contract Test Tasks** (TDD - Tests First):
   - Write contract tests for GET /api/tickets [P]
   - Write contract tests for POST /api/tickets [P]
   - Verify tests fail (Red phase)

5. **API Implementation Tasks**:
   - Implement GET /api/tickets endpoint
   - Implement POST /api/tickets endpoint
   - Add error handling and validation
   - Verify contract tests pass (Green phase)

6. **UI Component Test Tasks** (TDD - Tests First):
   - Write E2E test: empty board with 6 columns [P]
   - Write E2E test: ticket creation and display [P]
   - Write E2E test: ticket card information [P]
   - Write E2E test: long title truncation [P]
   - Write E2E test: responsive design [P]
   - Write E2E test: error handling [P]
   - Verify tests fail (Red phase)

7. **UI Component Implementation Tasks**:
   - Install shadcn/ui components (Card, Badge, ScrollArea, Skeleton)
   - Create TicketCard component (Client Component for interactivity)
   - Create Column component (Server Component)
   - Create Board component (Server Component)
   - Create board page (/app/board/page.tsx)
   - Implement responsive CSS Grid layout
   - Implement dark theme styling with TailwindCSS
   - Verify E2E tests pass (Green phase)

8. **Integration & Validation Tasks**:
   - Run full E2E test suite
   - Validate quickstart scenarios
   - Performance testing (100 tickets load test)
   - Cross-browser testing (Playwright)
   - Mobile responsiveness testing
   - Accessibility validation

9. **Documentation Tasks**:
   - Update README with setup instructions
   - Document API endpoints
   - Add inline code documentation (JSDoc)

**Ordering Strategy**:
- **TDD Principle**: Tests before implementation (Constitution III)
- **Dependency Order**: Database → Types → API → UI (bottom-up)
- **Parallel Opportunities**: Tests can be written in parallel [P], independent component tests [P]
- **Constitution Compliance**: Each task must align with constitution principles

**Task Dependencies**:
```
Foundation → Database → Types → API Tests → API Impl → UI Tests → UI Impl → Validation
     ↓          ↓         ↓          ↓           ↓          ↓          ↓          ↓
  [1-4]      [5-8]     [9-11]    [12-13]     [14-16]    [17-22]    [23-29]    [30-35]
```

**Estimated Task Count**: 30-35 numbered, dependency-ordered tasks

**Parallel Execution Markers**:
- Database setup tasks: Sequential (migrations must run in order)
- Contract test writing: Parallel [P] (independent test files)
- E2E test writing: Parallel [P] (independent test scenarios)
- Component implementation: Sequential (Board depends on Column, Column depends on TicketCard)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 2 Completion Status
✅ Task generation approach documented
✅ Dependency order defined
✅ Parallel execution opportunities identified
✅ Ready for `/tasks` command execution

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
- [x] Phase 0: Research complete (/plan command) - ✅ research.md created
- [x] Phase 1: Design complete (/plan command) - ✅ data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - ✅ Approach described below
- [ ] Phase 3: Tasks generated (/tasks command) - Ready for execution
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS - No violations, design aligns with all 5 core principles
- [x] Post-Design Constitution Check: PASS - Design validated against constitution
- [x] All NEEDS CLARIFICATION resolved - Resolved via /clarify command and research phase
- [x] Complexity deviations documented - None (no deviations from constitution)

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
