# Implementation Plan: Ticket Creation Modal

**Branch**: `003-add-new-ticket` | **Date**: 2025-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-add-new-ticket/spec.md`

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

Add a "+ New Ticket" button and creation modal in the IDLE column. Users fill in title and description fields with validation, then submit to create a new ticket that appears in IDLE. The feature includes client-side validation, loading states, error handling, and API integration with the existing POST /api/tickets endpoint.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TailwindCSS 3.4, Prisma 6.x, Zod 4.x, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Playwright E2E tests with MCP support
**Target Platform**: Web (modern browsers), server-side with Next.js App Router
**Project Type**: Web application (frontend + backend combined via Next.js)
**Performance Goals**: Modal open <100ms, form validation real-time, API response <2s (15s timeout)
**Constraints**: Title ≤100 chars, description ≤1000 chars (both required), alphanumeric + basic punctuation only
**Scale/Scope**: Small feature, 1 modal component + form validation + API integration, ~5-8 components/utilities

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. TypeScript-First Development

- ✅ All code will use TypeScript strict mode (tsconfig.json already configured)
- ✅ No `any` types (all modal props, form state, API responses explicitly typed)
- ✅ All function parameters and return types explicitly typed
- ✅ API responses have TypeScript interfaces matching Zod schemas

### II. Component-Driven Architecture

- ✅ Will use shadcn/ui Dialog component for modal (existing primitive)
- ✅ Will use shadcn/ui Form components for inputs (Button, Input, Textarea)
- ✅ Server Components by default, Client Component only for modal interactivity
- ✅ Feature-based structure: `/components/board/new-ticket-modal.tsx`
- ✅ API route exists: `/app/api/tickets/route.ts` (will update validation)
- ✅ Utilities in `/lib/validations/ticket.ts` for Zod schemas

### III. Test-Driven Development

- ✅ Will write Playwright E2E test BEFORE implementation
- ✅ Test will verify: open modal, fill form, submit, see new ticket in IDLE
- ✅ Test will verify validation: empty fields, char limits, invalid characters
- ✅ Test file: `/tests/ticket-creation.spec.ts`
- ✅ Red-Green-Refactor cycle mandatory

### IV. Security-First Design

- ✅ Zod schema validation for all inputs (title, description)
- ✅ Prisma parameterized queries (already used in existing /api/tickets)
- ✅ No sensitive data exposure (only public ticket data)
- ✅ Input sanitization: alphanumeric + basic punctuation only
- ✅ No authentication needed yet (public board)

### V. Database Integrity

- ✅ Schema changes via Prisma migration (title max 100, description required & max 1000)
- ✅ No multi-table operations (single INSERT into Ticket)
- ✅ Existing soft delete pattern not needed (tickets don't delete in this feature)
- ✅ Schema constraints: title varchar(100), description text NOT NULL

**Initial Assessment**: ✅ PASS - All constitutional requirements satisfied. No violations or deviations needed.

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
│   └── tickets/
│       └── route.ts         # POST handler (will update validation)
├── board/
│   └── page.tsx            # Board page (uses NewTicketButton)
├── layout.tsx
└── page.tsx

components/
├── board/
│   ├── new-ticket-button.tsx    # Existing (will update to open modal)
│   ├── new-ticket-modal.tsx     # NEW - Main modal component
│   ├── board.tsx                # Existing kanban board
│   ├── column.tsx               # Existing column component
│   └── ticket-card.tsx          # Existing ticket card
└── ui/
    ├── dialog.tsx               # NEW - shadcn/ui Dialog primitive
    ├── input.tsx                # NEW - shadcn/ui Input primitive
    ├── textarea.tsx             # NEW - shadcn/ui Textarea primitive
    ├── label.tsx                # NEW - shadcn/ui Label primitive
    ├── button.tsx               # Existing shadcn/ui Button
    └── [other existing UI components]

lib/
├── validations/
│   └── ticket.ts                # NEW - Zod schemas for ticket creation
└── [existing utilities]

prisma/
├── schema.prisma                # UPDATE - Change description to required & add length limits
└── migrations/
    └── [new migration]          # Generated by prisma migrate dev

tests/
└── ticket-creation.spec.ts      # NEW - E2E test for modal workflow
```

**Structure Decision**: Next.js App Router monolith structure (web application pattern). Frontend and backend are unified in a single Next.js application:

- **App Router pages** in `/app` for routing
- **API routes** in `/app/api` for backend endpoints
- **React components** in `/components` (feature-based organization)
- **Shared utilities** in `/lib` (validations, helpers)
- **Database schema** in `/prisma` with migrations
- **E2E tests** in `/tests` with Playwright

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

_Prerequisites: research.md complete_

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

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:

- TDD order: Tests before implementation
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---

_Based on Constitution v1.0.0 - See `/memory/constitution.md`_
