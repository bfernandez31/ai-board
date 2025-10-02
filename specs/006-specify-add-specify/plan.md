# Implementation Plan: Add SPECIFY Stage to Kanban Workflow

**Branch**: `006-specify-add-specify` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/006-specify-add-specify/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → COMPLETE: Spec loaded and analyzed
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → COMPLETE: Web application (Next.js 15 + React 18 + Prisma)
   → Structure Decision: Next.js App Router with Prisma database
3. Fill the Constitution Check section based on the content of the constitution document.
   → COMPLETE: All 5 principles + technology standards verified
4. Evaluate Constitution Check section below
   → COMPLETE: All gates PASS, no violations
5. Execute Phase 0 → research.md
   → COMPLETE: All 7 research tasks completed, patterns documented
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → COMPLETE: All artifacts generated successfully
7. Re-evaluate Constitution Check section
   → COMPLETE: No new violations, all principles satisfied
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → COMPLETE: Task generation strategy documented
9. STOP - Ready for /tasks command
   → SUCCESS: All planning complete, ready for /tasks
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Add a SPECIFY stage to the kanban workflow between INBOX and PLAN to support the spec-kit pipeline. This requires updating the Prisma Stage enum, enforcing sequential forward-only transitions, rendering a new column on the board with proper styling, and migrating existing data without loss. The SPECIFY stage allows tickets to be specified and refined before planning begins.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, @dnd-kit/core, @dnd-kit/sortable, Zod 4.x, shadcn/ui (Radix UI)
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Playwright with MCP support
**Target Platform**: Web (Vercel deployment)
**Project Type**: web (Next.js full-stack application)
**Performance Goals**: <200ms API response time, <3s page load on 3G
**Constraints**: Sequential workflow enforcement (forward-only transitions), zero data loss during migration, existing UI/UX patterns maintained
**Scale/Scope**: Single enum value addition, 1 new column, validation logic updates, existing tickets preserved

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Verification**: All code will use TypeScript strict mode with explicit types
- **Details**:
  - Prisma schema changes generate type-safe client
  - Zod schemas for API validation
  - Stage enum type enforced across components and API routes
  - No `any` types required for this feature

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Verification**: Follows Next.js 15 App Router conventions and shadcn/ui patterns
- **Details**:
  - Board column component will reuse existing column pattern
  - Stage badge component follows existing badge implementation
  - Server Components by default for board rendering
  - Empty state follows existing pattern (clarified)
  - API route follows REST conventions in `/app/api/tickets/[id]/route.ts`

### III. Test-Driven Development (NON-NEGOTIABLE) ✅
- **Status**: PASS
- **Verification**: Playwright E2E tests will be written before implementation
- **Details**:
  - Critical user flows defined in acceptance scenarios (7 scenarios)
  - Tests for drag-and-drop INBOX→SPECIFY transition
  - Tests for invalid transition prevention (INBOX→PLAN, backwards)
  - Tests for badge rendering and empty states
  - Tests for migration data integrity

### IV. Security-First Design ✅
- **Status**: PASS
- **Verification**: Input validation and secure database queries required
- **Details**:
  - Zod schema validates stage transitions in API
  - Prisma parameterized queries for all database operations
  - Sequential transition validation prevents invalid state changes
  - No sensitive data exposure (stage enum is user-facing)
  - Migration preserves data integrity

### V. Database Integrity ✅
- **Status**: PASS
- **Verification**: All schema changes via Prisma migrations
- **Details**:
  - Stage enum updated via `prisma migrate dev`
  - Migration adds SPECIFY between INBOX and PLAN
  - Existing tickets retain current stage (clarified: no backwards migration)
  - Default value remains INBOX for new tickets
  - Database constraints enforced at schema level

### Technology Standards ✅
- **Status**: PASS
- **Mandatory Stack Compliance**:
  - Frontend: Next.js 15 (App Router), React 18, TypeScript ✅
  - UI Components: shadcn/ui exclusively ✅
  - Drag & Drop: @dnd-kit/core and @dnd-kit/sortable ✅
  - Backend: Next.js API Routes ✅
  - Database: PostgreSQL via Prisma ORM ✅
  - Testing: Playwright with MCP support ✅
- **No forbidden dependencies required** ✅

## Project Structure

### Documentation (this feature)
```
specs/006-specify-add-specify/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── stage-enum.schema.json
│   └── patch-ticket-stage.schema.json
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
ai-board/
├── app/
│   ├── page.tsx                    # Board page (update: add SPECIFY column)
│   └── api/
│       └── tickets/
│           └── [id]/
│               └── route.ts        # PATCH handler (update: validate SPECIFY transitions)
├── components/
│   ├── board/
│   │   ├── Board.tsx              # Main board (update: render SPECIFY column)
│   │   ├── Column.tsx             # Column component (reuse for SPECIFY)
│   │   └── TicketCard.tsx         # Ticket card (update: SPECIFY badge)
│   └── ui/
│       ├── badge.tsx              # Badge component (reuse for SPECIFY)
│       └── toast.tsx              # Toast for error messages (reuse)
├── lib/
│   └── validation.ts              # Stage validation logic (update: add SPECIFY rules)
├── prisma/
│   ├── schema.prisma              # Schema (update: add SPECIFY to Stage enum)
│   └── migrations/                # New migration for SPECIFY stage
└── tests/
    └── specify-stage.spec.ts      # E2E tests (new file)
```

**Structure Decision**: Next.js App Router full-stack application. Single codebase with frontend components in `/components`, backend API routes in `/app/api`, and shared database schema in `/prisma`. Tests colocated in `/tests` directory. This follows the existing ai-board structure and aligns with constitution requirements.

## Phase 0: Outline & Research
*Research existing implementation patterns to ensure consistency*

### Research Tasks

1. **Existing Stage Enum Pattern**
   - **Question**: How is the current Stage enum defined and used?
   - **Investigation**: Review `prisma/schema.prisma` for Stage enum structure
   - **Outcome**: Document current enum values and default behavior

2. **Current Transition Validation**
   - **Question**: How are stage transitions currently validated (if at all)?
   - **Investigation**: Review `/app/api/tickets/[id]/route.ts` and `/lib/validation.ts`
   - **Outcome**: Document existing validation logic or identify need for new implementation

3. **Board Column Rendering Pattern**
   - **Question**: How are columns currently rendered on the board?
   - **Investigation**: Review `/components/board/Board.tsx` and `/components/board/Column.tsx`
   - **Outcome**: Document column rendering pattern for reuse with SPECIFY

4. **Stage Badge Styling Pattern**
   - **Question**: How are stage badges currently styled?
   - **Investigation**: Review `/components/board/TicketCard.tsx` and badge usage
   - **Outcome**: Document badge color pattern to apply to SPECIFY (clarified: match existing)

5. **Empty State Pattern**
   - **Question**: What empty state message do other columns show?
   - **Investigation**: Review `/components/board/Column.tsx` for empty state implementation
   - **Outcome**: Document empty state pattern for reuse (clarified: same as other columns)

6. **Error Toast Pattern**
   - **Question**: How are error messages currently displayed?
   - **Investigation**: Review toast usage in drag-and-drop handlers
   - **Outcome**: Document error toast pattern for invalid transitions (clarified: use existing pattern)

7. **Migration Best Practices**
   - **Question**: What's the best practice for adding enum values in Prisma?
   - **Investigation**: Review Prisma migration docs for enum updates
   - **Outcome**: Document safe migration approach for adding SPECIFY

**Output**: research.md documenting all findings from existing codebase

## Phase 1: Design & Contracts

### 1. Data Model (`data-model.md`)

**Entities**:

**Stage** (enum - update existing)
- **Current Values**: INBOX, PLAN, BUILD, VERIFY, SHIP
- **New Values**: INBOX, **SPECIFY**, PLAN, BUILD, VERIFY, SHIP
- **Position**: SPECIFY inserted between INBOX and PLAN
- **Validation**: Sequential forward-only transitions enforced

**Ticket** (model - no changes to structure)
- **Fields**: id, title, description, stage (references Stage), version, createdAt, updatedAt
- **Default**: stage defaults to INBOX (unchanged)
- **Constraints**: stage must be valid Stage enum value
- **Indexes**: Existing indexes on stage and updatedAt maintained

**State Transitions**:
```
Valid transitions (forward-only):
INBOX → SPECIFY ✅
SPECIFY → PLAN ✅
PLAN → BUILD ✅
BUILD → VERIFY ✅
VERIFY → SHIP ✅

Invalid transitions (examples):
INBOX → PLAN ❌ (skips SPECIFY)
SPECIFY → INBOX ❌ (backwards)
PLAN → SPECIFY ❌ (backwards)
PLAN → VERIFY ❌ (skips BUILD)
```

### 2. API Contracts (`contracts/`)

**Contract 1: Stage Enum Schema** (`stage-enum.schema.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Stage Enum",
  "description": "Kanban board workflow stages in sequential order",
  "type": "string",
  "enum": ["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"]
}
```

**Contract 2: PATCH /api/tickets/[id]** (`patch-ticket-stage.schema.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Update Ticket Stage",
  "description": "API contract for updating ticket stage with sequential validation",
  "request": {
    "method": "PATCH",
    "path": "/api/tickets/{id}",
    "body": {
      "type": "object",
      "properties": {
        "stage": {
          "$ref": "#/definitions/stage"
        }
      },
      "required": ["stage"]
    }
  },
  "response": {
    "success": {
      "status": 200,
      "body": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "stage": { "$ref": "#/definitions/stage" },
          "version": { "type": "integer" },
          "updatedAt": { "type": "string", "format": "date-time" }
        }
      }
    },
    "error_invalid_transition": {
      "status": 400,
      "body": {
        "type": "object",
        "properties": {
          "error": {
            "type": "string",
            "pattern": "Invalid stage transition"
          }
        }
      }
    }
  },
  "definitions": {
    "stage": {
      "type": "string",
      "enum": ["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"]
    }
  }
}
```

### 3. Quickstart Validation (`quickstart.md`)

**Quickstart Test Scenario**: Drag ticket through SPECIFY stage
```
1. Start local dev environment: npm run dev
2. Open browser to http://localhost:3000
3. Create a new ticket (should default to INBOX column)
4. Drag the ticket from INBOX to SPECIFY column
   → Expected: Ticket moves to SPECIFY, database updates
5. Drag the same ticket from SPECIFY to PLAN column
   → Expected: Ticket moves to PLAN, database updates
6. Attempt to drag any ticket from SPECIFY back to INBOX
   → Expected: Drag blocked, error toast shown
7. Attempt to drag a ticket from INBOX directly to PLAN (skipping SPECIFY)
   → Expected: Drag blocked, error toast shown
8. Verify SPECIFY badge color matches other stage badge patterns
9. Verify SPECIFY empty state message matches other columns
```

### 4. Agent Context Update (`CLAUDE.md`)

Execute: `.specify/scripts/bash/update-agent-context.sh claude`

This will incrementally update the CLAUDE.md file with:
- New Stage enum value: SPECIFY
- Stage transition validation rules
- Recent change: "006-specify-add-specify: Added SPECIFY stage between INBOX and PLAN"

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base structure
2. Generate tasks from Phase 1 design docs in TDD order:

   **Database Layer** (foundation):
   - Update Prisma schema (add SPECIFY to Stage enum)
   - Generate and review migration
   - Apply migration to test database
   - Verify migration data integrity (existing tickets unchanged)

   **Validation Layer** (business logic):
   - Create stage transition validation utility
   - Write unit tests for validation (forward-only, no skipping)
   - Implement validation logic to pass tests

   **API Layer** (backend):
   - Write contract tests for PATCH /api/tickets/[id] with SPECIFY transitions
   - Update API route handler to use validation utility
   - Verify contract tests pass

   **UI Layer** (frontend):
   - Write E2E test for SPECIFY column rendering
   - Update Board component to render SPECIFY column
   - Verify E2E test passes
   - Write E2E test for SPECIFY badge styling
   - Update TicketCard component badge logic
   - Verify badge test passes
   - Write E2E test for empty state message
   - Update Column component empty state
   - Verify empty state test passes

   **Interaction Layer** (drag-and-drop):
   - Write E2E test for INBOX→SPECIFY drag
   - Update drag-and-drop handler to allow INBOX→SPECIFY
   - Verify drag test passes
   - Write E2E test for SPECIFY→PLAN drag
   - Update drag-and-drop handler to allow SPECIFY→PLAN
   - Verify drag test passes
   - Write E2E test for invalid transitions (backwards, skipping)
   - Update drag-and-drop handler to show error toast
   - Verify error handling tests pass

   **Integration** (end-to-end):
   - Execute quickstart.md scenario
   - Fix any integration issues
   - Verify all acceptance criteria met

**Ordering Strategy**:
- **TDD order**: All tests written before implementation
- **Dependency order**: Database → Validation → API → UI → Interactions
- **Parallel opportunities [P]**: Independent file modifications can run in parallel
  - Schema update [P] with validation tests [P]
  - Badge styling [P] with empty state [P] with column rendering [P]

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md following TDD principles

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitution violations - all gates passed*

This feature introduces no architectural complexity:
- Uses existing patterns (enum update, column rendering, drag-and-drop)
- No new abstractions or patterns required
- Follows established Next.js + Prisma + shadcn/ui conventions
- All constitutional principles satisfied without exceptions

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command) - 31 tasks in TDD order
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none - no violations)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
