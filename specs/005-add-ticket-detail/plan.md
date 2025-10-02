
# Implementation Plan: Ticket Detail Modal

**Branch**: `005-add-ticket-detail` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-add-ticket-detail/spec.md`

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
Add a modal dialog that displays complete ticket details when a user clicks on any ticket card in the kanban board. The modal will show the ticket's title, full description, current stage, creation date, and last updated date. Users can close the modal using a close button, ESC key, or clicking outside. The modal must be responsive (full-screen on mobile, centered on desktop) and follow the application's dark theme design.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, shadcn/ui (Dialog component), Radix UI
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Ticket model)
**Testing**: Playwright with E2E tests
**Target Platform**: Web (responsive: mobile + desktop)
**Project Type**: Web application (Next.js frontend + API routes)
**Performance Goals**: Modal open <100ms, responsive interaction <16ms (60fps)
**Constraints**: Dark theme only, read-only view (no editing), full-screen on mobile
**Scale/Scope**: Single modal component, ~5 UI elements, existing Ticket entity

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### TypeScript-First Development ✅
- [x] TypeScript strict mode enabled (tsconfig.json already configured)
- [x] All types explicitly defined (no `any` types planned)
- [x] Component props will be fully typed
- [x] Event handlers will have explicit types

### Component-Driven Architecture ✅
- [x] Using shadcn/ui Dialog component (already installed)
- [x] Client Component pattern for interactivity (`"use client"`)
- [x] Feature-based folder: `/components/board/ticket-detail-modal.tsx`
- [x] No custom primitives, composing existing shadcn components

### Test-Driven Development (TDD) ✅
- [x] Will write Playwright E2E tests before implementation
- [x] Test file: `/tests/ticket-detail-modal.spec.ts`
- [x] Red-Green-Refactor cycle planned
- [x] Critical user flow: Click card → view details → close modal

### Security-First Design ✅
- [x] No user input (read-only display)
- [x] Data from existing Prisma queries (already validated)
- [x] No new API endpoints required
- [x] No sensitive data exposure concerns

### Database Integrity ✅
- [x] No schema changes required
- [x] Using existing Ticket model
- [x] Read-only operations only
- [x] No migrations needed

**Initial Constitution Check: PASS** ✅

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
├── board/
│   └── page.tsx              # Board page that uses modal
└── layout.tsx

components/
├── board/
│   ├── board.tsx             # Main board component (existing)
│   ├── ticket-card.tsx       # Ticket card component (existing, add click handler)
│   └── ticket-detail-modal.tsx  # NEW: Modal component
└── ui/
    └── dialog.tsx            # shadcn Dialog (existing)

lib/
├── types.ts                  # TypeScript types (existing)
└── utils.ts                  # Utilities (existing)

tests/
└── ticket-detail-modal.spec.ts  # NEW: E2E tests

prisma/
└── schema.prisma             # Database schema (no changes)
```

**Structure Decision**: Web application using Next.js 15 App Router. New modal component in `/components/board/` following existing feature-based organization. Tests in `/tests/` following Playwright conventions. No API changes needed as existing ticket data is sufficient.

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
The /tasks command will generate a comprehensive task list following TDD principles:

1. **E2E Test Tasks** (from quickstart.md scenarios):
   - Task: Write E2E test for modal open/close
   - Task: Write E2E test for ESC key dismissal
   - Task: Write E2E test for click-outside-to-close
   - Task: Write E2E test for multiple tickets
   - Task: Write E2E test for responsive behavior (mobile/desktop)
   - Task: Write E2E test for long content scrolling
   - Task: Write E2E test for stage badge colors
   - Task: Write E2E test for keyboard navigation
   - Each test task should FAIL initially (Red phase)

2. **Component Implementation Tasks** (from contracts):
   - Task: Create TicketDetailModal component shell
   - Task: Implement modal structure with Dialog component
   - Task: Add ticket data display (title, description, stage)
   - Task: Add date formatting with date-fns
   - Task: Add stage badge with color mapping
   - Task: Add responsive styling (mobile full-screen, desktop centered)
   - Task: Add close interactions (button, ESC, overlay)

3. **Integration Tasks** (from integration-points.md):
   - Task: Add onClick handler to TicketCard component
   - Task: Prevent modal open during drag operations
   - Task: Add modal state management to Board component
   - Task: Wire up ticket click handlers
   - Task: Test drag-and-drop not affected by click handler

4. **Type Safety Tasks**:
   - Task: Add TypeScript prop interfaces for TicketDetailModal
   - Task: Add type guards for null checking
   - Task: Ensure strict mode compliance

**Ordering Strategy**:
- **Phase 1** (Tests): All E2E tests written first (tasks 1-8) [P]
- **Phase 2** (Component): Modal component implementation (tasks 9-15) [Sequential]
- **Phase 3** (Integration): TicketCard and Board integration (tasks 16-20) [Sequential]
- **Phase 4** (Validation): Run tests, verify Green phase (task 21)

**Dependency Management**:
- E2E tests are independent: [P] parallel execution
- Component tasks depend on previous component work: Sequential
- Integration tasks depend on component completion: Sequential
- All tests must pass before feature is complete

**Estimated Output**: 20-22 numbered, ordered tasks in tasks.md

**TDD Cycle**:
1. Red: Write failing E2E tests
2. Green: Implement features to make tests pass
3. Refactor: Clean up code while keeping tests green

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
- [x] Phase 3: Tasks generated (/tasks command) - 28 tasks created
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (N/A - no deviations)

**Artifacts Generated**:
- [x] research.md - Technology decisions and best practices
- [x] data-model.md - Entity definitions and data flow
- [x] contracts/component-interface.md - Component API contract
- [x] contracts/integration-points.md - Integration specifications
- [x] quickstart.md - Manual testing scenarios
- [x] CLAUDE.md updated - Agent context file
- [x] tasks.md - 28 implementation tasks with TDD approach

**Next Steps**:
1. Execute tasks T001-T028 following TDD cycle (Red-Green-Refactor)
2. Validate with quickstart.md scenarios after T022
3. Run full E2E test suite (T028)
4. Perform final code review
5. Submit for approval and merge

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
