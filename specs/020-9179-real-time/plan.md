
# Implementation Plan: Real-Time Job Status Updates with Visual Indicators

**Branch**: `020-9179-real-time` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/020-9179-real-time/spec.md`

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
Implement real-time job status updates on ticket cards using WebSocket connections, removing legacy metadata sections and adding animated visual indicators for job execution. Users will see live updates as jobs transition through PENDING, RUNNING, COMPLETED, FAILED, and CANCELLED states with distinct visual styling and smooth animations. The system prioritizes the most recent active job and persists terminal statuses indefinitely until a new job starts.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, WebSocket (ws library for server, native WebSocket API for client), TailwindCSS 3.4, shadcn/ui components
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Job and Ticket models)
**Testing**: Playwright with E2E tests for real-time updates, animations, and visual states
**Target Platform**: Web browsers (modern Chrome, Firefox, Safari, Edge)
**Project Type**: web (Next.js frontend + backend API routes)
**Performance Goals**: WebSocket latency <100ms, animation frame rate 60fps, 500ms minimum status display duration
**Constraints**: Must not impact board scrolling/interaction performance, animations must be subtle and professional, status updates must sync across all open browser tabs
**Scale/Scope**: Single board view with ~10-50 tickets, WebSocket connections per active browser session, real-time updates for job status transitions

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
✅ **PASS** - All code will use TypeScript 5.6 strict mode with explicit type annotations
- WebSocket message types will be defined with Zod schemas
- Job status types already defined in Prisma schema (JobStatus enum)
- React component props will have explicit TypeScript interfaces
- No `any` types will be used

### II. Component-Driven Architecture
✅ **PASS** - Following shadcn/ui patterns and Next.js conventions
- Will use existing shadcn/ui components (Badge, Card, Skeleton for loading states)
- New job status indicator component will follow feature-based folder structure: `/components/board/job-status-indicator.tsx`
- Server Components by default, Client Components only for WebSocket connection management
- API routes will follow `/app/api/ws/route.ts` pattern for WebSocket upgrade

### III. Test-Driven Development (NON-NEGOTIABLE)
✅ **PASS** - E2E tests will be written before implementation
- Playwright tests for real-time status updates (FR-018)
- Tests for animation rendering (FR-019)
- Tests for minimum 500ms display duration (FR-020)
- Tests for FAILED vs CANCELLED styling distinction (FR-021)
- Tests must fail initially, then pass after implementation

### IV. Security-First Design
✅ **PASS** - Input validation and secure queries
- WebSocket connections will validate message schemas with Zod
- Job status queries use existing Prisma parameterized queries
- No sensitive data (logs, internal IDs) exposed in WebSocket messages
- WebSocket authentication via session tokens (existing Next.js session)

### V. Database Integrity
✅ **PASS** - No schema changes required
- Feature uses existing Job and Ticket models
- Existing JobStatus enum already supports all required states
- Query logic will use existing Prisma client
- No migrations needed for this feature

**Initial Constitution Check Result**: ✅ ALL GATES PASSED - Ready for Phase 0

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
│   └── ws/
│       └── route.ts              # WebSocket upgrade endpoint (NEW)
└── projects/
    └── [projectId]/
        └── board/
            └── page.tsx          # Board page (MODIFY for WebSocket integration)

components/
└── board/
    ├── job-status-indicator.tsx # Job status display component (NEW)
    ├── ticket-card.tsx          # Ticket card (MODIFY - remove metadata, add status)
    └── board.tsx                # Board component (MODIFY - WebSocket provider)

lib/
├── websocket-client.ts          # WebSocket client hook (NEW)
├── websocket-server.ts          # WebSocket server utilities (NEW)
└── job-queries.ts               # Job status query functions (NEW)

prisma/
└── schema.prisma                # Existing schema (NO CHANGES)

tests/
├── e2e/
│   ├── job-status-realtime.spec.ts    # Real-time updates E2E tests (NEW)
│   ├── job-status-animations.spec.ts   # Animation tests (NEW)
│   └── ticket-card-visual.spec.ts      # Visual styling tests (NEW)
└── helpers/
    └── websocket-mock.ts        # WebSocket mock utilities (NEW)
```

**Structure Decision**: Next.js App Router web application structure. WebSocket server logic in API routes (`/app/api/ws`), client-side WebSocket hooks in `/lib`, React components in `/components/board`, and E2E tests in `/tests/e2e`.

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

The `/tasks` command will generate implementation tasks following TDD principles and constitutional requirements:

1. **Infrastructure Layer** (Tests First)
   - WebSocket server setup: Test → Implementation
   - WebSocket client hook: Test → Implementation
   - Message schema validation: Test → Implementation
   - Job query functions: Test → Implementation

2. **Component Layer** (Tests First)
   - JobStatusIndicator component: Visual test → Unit test → Implementation
   - TicketCard modification: Visual test → Integration test → Implementation
   - WebSocketProvider context: Integration test → Implementation

3. **Integration Layer** (Tests First)
   - Real-time status updates: E2E test → Implementation
   - Animation performance: E2E test → Implementation
   - Display duration enforcement: E2E test → Implementation
   - Visual distinction (FAILED/CANCELLED): E2E test → Implementation

4. **Existing Test Updates** (Parallel with Implementation)
   - Update ticket card tests to remove metadata assertions
   - Update board tests to include WebSocket context
   - Update E2E tests for new visual states

**Ordering Strategy**:

- **Phase 1 (Foundation)**: WebSocket infrastructure tests and implementation [Sequential - dependencies]
- **Phase 2 (Components)**: UI component tests and implementation [Parallel - independent files marked [P]]
- **Phase 3 (Integration)**: End-to-end tests and integration [Sequential - depends on Phase 1 & 2]
- **Phase 4 (Polish)**: Animation tests, visual tests, existing test updates [Parallel - independent]

**Task Categories**:
- **[TEST-E2E]**: Playwright end-to-end tests (must fail initially)
- **[TEST-INTEGRATION]**: Component integration tests
- **[TEST-UNIT]**: Isolated component/function tests
- **[IMPL-API]**: Server-side API implementation
- **[IMPL-COMPONENT]**: React component implementation
- **[IMPL-HOOK]**: React hook implementation
- **[REFACTOR]**: Modify existing code (ticket card, board)
- **[TEST-UPDATE]**: Update existing test files

**Dependency Chain**:
```
WebSocket Server [TEST + IMPL]
    ↓
WebSocket Client Hook [TEST + IMPL]
    ↓
Job Query Functions [TEST + IMPL]
    ↓
┌─────────────────────┬─────────────────────┐
│                     │                     │
JobStatusIndicator    WebSocketProvider     TicketCard Refactor
[TEST + IMPL] [P]    [TEST + IMPL] [P]     [TEST + IMPL] [P]
    │                     │                     │
    └─────────────────────┴─────────────────────┘
                     ↓
            Board Integration
            [TEST + IMPL]
                     ↓
    ┌────────────────┼────────────────┐
    │                │                │
Real-Time E2E    Animation E2E    Visual E2E
[TEST + IMPL] [P] [TEST + IMPL] [P] [TEST + IMPL] [P]
```

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**Task Naming Convention**:
- Test tasks: "Write E2E test for [feature]" (e.g., "Write E2E test for WebSocket connection establishment")
- Implementation tasks: "Implement [component/feature]" (e.g., "Implement JobStatusIndicator component")
- Refactor tasks: "Refactor [component] to [change]" (e.g., "Refactor TicketCard to remove metadata section")

**Success Criteria per Task**:
- Test tasks: Test file created, test fails (Red state)
- Implementation tasks: Test passes (Green state), no new test failures
- Refactor tasks: Existing tests still pass, refactored code meets requirements

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
  - ✅ research.md created with 6 research questions resolved
  - ✅ WebSocket implementation strategy defined
  - ✅ Technology stack confirmed (no schema changes)
- [x] Phase 1: Design complete (/plan command)
  - ✅ data-model.md created (Job, JobStatus, Ticket entities documented)
  - ✅ contracts/websocket-api.md created (WebSocket protocol specification)
  - ✅ contracts/component-interfaces.md created (React component interfaces)
  - ✅ quickstart.md created (TDD implementation guide)
  - ✅ CLAUDE.md updated with new technologies
- [x] Phase 2: Task planning approach described (/plan command)
  - ✅ Task generation strategy documented
  - ✅ Dependency chain defined
  - ✅ 35-40 tasks estimated with TDD ordering
- [ ] Phase 3: Tasks generated (/tasks command - NOT executed by /plan)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: ✅ PASS (all 5 principles compliant)
  - ✅ TypeScript strict mode (no `any` types)
  - ✅ shadcn/ui component usage
  - ✅ TDD with Playwright tests
  - ✅ Security (Zod validation, no sensitive data in WebSocket)
  - ✅ No schema changes (uses existing Job/Ticket models)
- [x] Post-Design Constitution Check: ✅ PASS (re-validated after Phase 1)
- [x] All NEEDS CLARIFICATION resolved
  - ✅ No unresolved items in Technical Context
  - ✅ All research questions answered
- [x] Complexity deviations documented
  - ✅ None - feature fits within constitutional guidelines

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
