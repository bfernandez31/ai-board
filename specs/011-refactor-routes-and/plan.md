
# Implementation Plan: Refactor Routes and APIs to Require Project Context

**Branch**: `011-refactor-routes-and` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/benoit/Workspace/ai-board/specs/011-refactor-routes-and/spec.md`

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
This feature restructures the application to enforce project context in all routes and APIs. The board URL changes from `/board` to `/projects/[projectId]/board`, and all ticket API endpoints become project-scoped (e.g., `/api/projects/[projectId]/tickets`). This architectural change prevents cross-project data leaks, makes the URL structure explicit, and prepares the codebase for future multi-project support. The root URL redirects to the default project (ID 1) for MVP simplicity.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Project and Ticket models)
**Testing**: Playwright with MCP support for E2E tests
**Target Platform**: Web application (Vercel deployment)
**Project Type**: web (Next.js frontend + API routes)
**Performance Goals**: Standard Next.js performance (<200ms page loads, <100ms API responses)
**Constraints**: Must maintain existing ticket functionality, no breaking changes to data model
**Scale/Scope**: Refactor affects 4 routes, 3 API endpoints, 2 database query functions, ~10 component files

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- ✅ **PASS**: All refactored code will use TypeScript strict mode
- ✅ **PASS**: Route params will be explicitly typed
- ✅ **PASS**: API request/response types will be defined with Zod schemas
- ✅ **PASS**: Database query functions will have explicit return types

### II. Component-Driven Architecture
- ✅ **PASS**: No new UI components needed (route refactoring only)
- ✅ **PASS**: Existing Board component will receive projectId prop
- ✅ **PASS**: Server Components by default (board page already a Server Component)
- ✅ **PASS**: Feature-based folder structure maintained

### III. Test-Driven Development (NON-NEGOTIABLE)
- ✅ **PASS**: E2E tests will be written for project-scoped routes before implementation
- ✅ **PASS**: API contract tests will verify project validation
- ✅ **PASS**: Tests will verify 404/403 error handling
- ✅ **PASS**: Existing tests will be updated to use new routes

### IV. Security-First Design
- ✅ **PASS**: projectId validation using Zod before database queries
- ✅ **PASS**: Prisma parameterized queries (no raw SQL)
- ✅ **PASS**: Cross-project access prevention via WHERE clauses
- ✅ **PASS**: Proper HTTP status codes (404 for invalid project, 403 for unauthorized access)

### V. Database Integrity
- ✅ **PASS**: No schema changes required (projectId FK already exists)
- ✅ **PASS**: All queries will filter by projectId using existing foreign key
- ✅ **PASS**: Database constraints already enforced at schema level
- ✅ **PASS**: No migrations needed for this refactor

**Initial Gate Status**: ✅ **PASS** - All constitutional principles satisfied. No complexity deviations required.

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
├── page.tsx                                    # Root page - redirect to /projects/1/board
├── layout.tsx                                  # Root layout (unchanged)
├── projects/
│   └── [projectId]/
│       └── board/
│           └── page.tsx                        # New: Project-scoped board page
└── api/
    └── projects/
        └── [projectId]/
            ├── tickets/
            │   └── route.ts                    # New: GET/POST /api/projects/:id/tickets
            └── tickets/
                └── [id]/
                    └── route.ts                # New: PATCH /api/projects/:id/tickets/:id

components/
├── board/
│   ├── board.tsx                               # Modified: Accept projectId prop
│   ├── ticket-card.tsx                         # Modified: Use project-scoped API
│   ├── new-ticket-modal.tsx                    # Modified: Use project-scoped API
│   └── [other board components]               # Modified: Update API calls
└── ui/
    └── [shadcn components]                     # Unchanged

lib/
├── db/
│   ├── client.ts                               # Unchanged
│   └── tickets.ts                              # Modified: Add projectId parameter to queries
├── validations/
│   └── ticket.ts                               # Modified: Add project validation schemas
└── [other utilities]                           # Unchanged

prisma/
└── schema.prisma                               # Unchanged (Project/Ticket models already exist)

tests/
├── e2e/
│   ├── project-routing.spec.ts                 # New: Test project-scoped routes
│   ├── project-validation.spec.ts              # New: Test 404/403 errors
│   └── [existing tests]                        # Modified: Update to new routes
└── api/
    ├── projects-tickets-get.spec.ts            # New: Contract test
    ├── projects-tickets-post.spec.ts           # New: Contract test
    └── projects-tickets-patch.spec.ts          # New: Contract test
```

**Structure Decision**: This is a Next.js 15 web application using the App Router. Routes are defined in the `app/` directory with folder-based routing. API routes follow the same folder structure pattern. Components are organized by feature in `components/`. Database logic is centralized in `lib/db/`. This refactor adds a new `projects/[projectId]` route segment and migrates existing `/board` and `/api/tickets` routes under it.

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

The /tasks command will generate tasks based on the following structure:

### 1. Contract Test Tasks (TDD - Write Tests First)
- **T001**: Write contract test for GET /api/projects/[projectId]/tickets [P]
- **T002**: Write contract test for POST /api/projects/[projectId]/tickets [P]
- **T003**: Write contract test for PATCH /api/projects/[projectId]/tickets/[id] [P]

### 2. E2E Test Tasks (TDD - Write Tests First)
- **T004**: Write E2E test for root redirect to /projects/1/board [P]
- **T005**: Write E2E test for project-scoped board access [P]
- **T006**: Write E2E test for invalid project ID (404) [P]
- **T007**: Write E2E test for cross-project access prevention (403) [P]

### 3. Validation Schema Tasks
- **T008**: Add projectId validation schema to /lib/validations/ticket.ts [P]
- **T009**: Add project existence validation helper function [P]

### 4. Database Layer Tasks
- **T010**: Update getTicketsByStage() to accept projectId parameter
- **T011**: Update createTicket() to accept projectId parameter
- **T012**: Add getProjectById() helper function for validation [P]

### 5. API Route Tasks
- **T013**: Create GET /api/projects/[projectId]/tickets route
- **T014**: Create POST /api/projects/[projectId]/tickets route
- **T015**: Create PATCH /api/projects/[projectId]/tickets/[id] route

### 6. Page Route Tasks
- **T016**: Create /projects/[projectId]/board page
- **T017**: Update root page (/) to redirect to /projects/1/board

### 7. Component Update Tasks
- **T018**: Update Board component to accept projectId prop
- **T019**: Update NewTicketModal to use project-scoped API
- **T020**: Update TicketCard to use project-scoped API for updates
- **T021**: Update drag-and-drop handlers to use project-scoped API

### 8. Existing Test Migration Tasks
- **T022**: Update all existing E2E tests to use /projects/1/board route
- **T023**: Update all existing API tests to use project-scoped endpoints
- **T024**: Verify all tests pass with new routes

### 9. Cleanup Tasks
- **T025**: Remove old /board page route
- **T026**: Remove old /api/tickets routes
- **T027**: Verify no references to old routes remain

### 10. Validation Tasks
- **T028**: Run quickstart validation steps
- **T029**: Verify cross-project access returns 403
- **T030**: Performance check: API response times <100ms

**Ordering Strategy**:
1. **Tests First (T001-T007)**: TDD - write failing tests before implementation
2. **Foundation (T008-T012)**: Validation and database layer (dependencies)
3. **API Routes (T013-T015)**: Implement to make contract tests pass
4. **Page Routes (T016-T017)**: Implement to make E2E tests pass
5. **UI Updates (T018-T021)**: Update components to use new APIs
6. **Migration (T022-T024)**: Update existing tests
7. **Cleanup (T025-T027)**: Remove old routes
8. **Validation (T028-T030)**: Final verification

**Parallelization**:
- [P] marks tasks that can run in parallel (independent files)
- Contract tests (T001-T003) can all be written simultaneously
- E2E tests (T004-T007) can all be written simultaneously
- Validation schemas (T008-T009) are independent

**Estimated Output**: 30 numbered, ordered tasks in tasks.md

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
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (None - all principles satisfied)

**Artifacts Generated**:
- [x] research.md - All technical decisions documented
- [x] data-model.md - Query changes and validation logic defined
- [x] contracts/api-projects-tickets-get.md - GET endpoint contract
- [x] contracts/api-projects-tickets-post.md - POST endpoint contract
- [x] contracts/api-projects-tickets-patch.md - PATCH endpoint contract
- [x] quickstart.md - End-to-end validation guide
- [x] CLAUDE.md - Updated with feature context
- [x] tasks.md - 33 implementation tasks in TDD order

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
