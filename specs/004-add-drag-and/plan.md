# Implementation Plan: Drag-and-Drop Ticket Movement

**Branch**: `004-add-drag-and` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/004-add-drag-and/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

## Summary
Enable users to drag ticket cards between sequential workflow stages (INBOX→PLAN→BUILD→VERIFY→SHIP) with <100ms latency, optimistic UI updates, first-write-wins conflict resolution, and full touch device support using @dnd-kit/core library.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 20.x
**Primary Dependencies**: Next.js 15 (App Router), React 18, @dnd-kit/core, @dnd-kit/sortable, Prisma 6.x, Zod 4.x, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Playwright with E2E focus
**Target Platform**: Web (Next.js on Vercel)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: <100ms drag-and-drop latency from drop to visual update
**Constraints**: Sequential stage transitions only (no skipping, no backwards), optimistic UI with rollback on error, sub-100ms performance with up to 100 tickets per column
**Scale/Scope**: Single-board application with 5 workflow stages, support for concurrent users with first-write-wins conflict resolution

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- ✅ **PASS**: TypeScript 5.6 strict mode already configured
- ✅ **PASS**: All @dnd-kit types will be explicitly defined
- ✅ **PASS**: API request/response interfaces will use Zod schemas
- ✅ **PASS**: No `any` types - drag event types will be properly typed

### II. Component-Driven Architecture
- ✅ **PASS**: Will use shadcn/ui for UI primitives (no custom components from scratch)
- ✅ **PASS**: Server Components by default, Client Components only for drag-and-drop interaction
- ✅ **PASS**: Feature-based structure: `/components/board/` for drag-drop components
- ✅ **PASS**: API route: `/app/api/tickets/[id]/route.ts` with PATCH method
- ✅ **PASS**: Shared utilities in `/lib/` (stage validation, optimistic updates)

### III. Test-Driven Development (NON-NEGOTIABLE)
- ✅ **PASS**: Playwright E2E tests will be written BEFORE implementation
- ✅ **PASS**: Tests will cover critical user flows: drag to next stage, invalid transitions, concurrent updates, touch interactions
- ✅ **PASS**: Tests in `/tests/drag-drop.spec.ts` describing user actions
- ✅ **PASS**: Red-Green-Refactor cycle: failing tests first, then implementation

### IV. Security-First Design
- ✅ **PASS**: Zod validation for all PATCH requests (stage transitions, ticket IDs)
- ✅ **PASS**: Prisma parameterized queries only (no raw SQL)
- ✅ **PASS**: No sensitive data exposure (only ticket ID, stage in responses)
- ✅ **PASS**: Database URL in environment variables (already configured)
- ⚠️ **DEFERRED**: Authentication middleware not yet implemented (constitution notes "Future: NextAuth.js")

### V. Database Integrity
- ✅ **PASS**: Schema changes via Prisma migrations
- ✅ **PASS**: Add `version` field to Ticket model for optimistic concurrency control
- ✅ **PASS**: Database constraints at schema level (foreign keys, unique constraints)
- ✅ **PASS**: Stage transitions validated at application AND database level (enum constraint)
- ⚠️ **NOTE**: Current schema uses different stage names (IDLE vs INBOX, REVIEW vs VERIFY, SHIPPED vs SHIP) - migration required

**GATE RESULT**: ✅ PASS with migration requirement

## Project Structure

### Documentation (this feature)
```
specs/004-add-drag-and/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── patch-ticket-stage.json
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── board/
│   └── page.tsx         # Board view with drag-drop (Client Component)
├── api/
│   └── tickets/
│       ├── route.ts     # POST (create), GET (list)
│       └── [id]/
│           └── route.ts # PATCH (update stage), DELETE

components/
├── board/
│   ├── ticket-card.tsx       # Draggable ticket component
│   ├── stage-column.tsx      # Droppable column component
│   ├── drag-overlay.tsx      # Drag preview component
│   └── offline-indicator.tsx # Network status indicator
└── ui/                       # shadcn/ui primitives (existing)

lib/
├── db.ts                     # Prisma client instance (existing)
├── stage-validation.ts       # Sequential stage transition logic
├── optimistic-updates.ts     # Client-side optimistic update utilities
└── types.ts                  # Shared TypeScript types

prisma/
├── schema.prisma             # Updated with version field, aligned stage names
└── migrations/
    └── [timestamp]_add_ticket_version_align_stages/

tests/
└── drag-drop.spec.ts         # Playwright E2E tests for drag-drop
```

**Structure Decision**: Web application using Next.js App Router. Frontend and backend code colocated in `/app` directory following Next.js 15 conventions. Components organized by feature in `/components/board/`. API routes follow REST conventions in `/app/api/tickets/`.

## Phase 0: Outline & Research

### Research Tasks

1. **@dnd-kit Integration Best Practices**
   - Research: @dnd-kit/core and @dnd-kit/sortable setup with Next.js 15
   - Research: Touch sensor configuration for mobile support
   - Research: Accessibility requirements (keyboard navigation, screen readers)
   - Research: Performance optimization for 100+ items

2. **Optimistic UI Patterns**
   - Research: React optimistic update patterns with rollback
   - Research: First-write-wins conflict detection strategies
   - Research: Network status detection for offline handling

3. **Sequential Stage Validation**
   - Research: Client-side vs server-side validation patterns
   - Research: Database-level constraint enforcement options

4. **Performance Optimization**
   - Research: Sub-100ms latency techniques
   - Research: React rendering optimization for large lists
   - Research: Database query optimization for concurrent updates

**Output**: research.md with all findings consolidated

## Phase 1: Design & Contracts

### 1. Data Model (`data-model.md`)

**Schema Changes Required**:
- Add `version` field to Ticket model (INTEGER, default 1) for optimistic concurrency control
- Align Stage enum values with spec requirements:
  - Rename IDLE → INBOX
  - Keep PLAN, BUILD
  - Rename REVIEW → VERIFY
  - Rename SHIPPED → SHIP
  - Remove ERRORED (not in spec)

**Migration**: Prisma migration to update schema + data migration for existing tickets

### 2. API Contracts (`/contracts/patch-ticket-stage.json`)

**PATCH /api/tickets/[id]**
- Request: `{ stage: Stage, version: number }`
- Success Response (200): `{ id: number, stage: Stage, version: number, updatedAt: string }`
- Conflict Response (409): `{ error: "Ticket modified by another user", currentStage: Stage, currentVersion: number }`
- Validation Error (400): `{ error: "Invalid stage transition", message: string }`
- Not Found (404): `{ error: "Ticket not found" }`

### 3. Contract Tests (failing initially)

- `tests/contracts/patch-ticket-stage.test.ts`: Assert request/response schemas
- Verify Zod validation rejects invalid stage transitions
- Verify version mismatch returns 409 conflict

### 4. Integration Test Scenarios (`quickstart.md`)

From user stories → test scenarios:
1. Drag INBOX ticket to PLAN (success)
2. Attempt to drag PLAN ticket to SHIP (rejected - skipping stages)
3. Attempt to drag BUILD ticket to PLAN (rejected - backwards)
4. Concurrent update: User A drags, User B drags same ticket (User B gets conflict)
5. Offline: Disable drag when network unavailable
6. Touch device: Long-press and drag on mobile

### 5. Update CLAUDE.md

Run `.specify/scripts/bash/update-agent-context.sh claude` to add:
- @dnd-kit/core and @dnd-kit/sortable patterns
- Optimistic concurrency control with version field
- Sequential stage validation logic
- Network status detection

**Output**: data-model.md, /contracts/patch-ticket-stage.json, failing tests, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Database Migration Tasks**:
   - Create Prisma migration for schema changes
   - Write data migration script for existing tickets
   - Verify migration in local environment

2. **Contract Test Tasks** (from Phase 1 contracts):
   - Write Zod schema for PATCH request validation
   - Write contract test for successful stage update
   - Write contract test for version conflict (409)
   - Write contract test for invalid transition (400)

3. **Model & Validation Tasks**:
   - Implement stage validation utility (lib/stage-validation.ts)
   - Implement optimistic update utilities (lib/optimistic-updates.ts)
   - Add version field to Ticket type definition

4. **API Implementation Tasks**:
   - Implement PATCH /api/tickets/[id] with version check
   - Add sequential stage validation to API
   - Handle conflict responses (409) properly

5. **Component Implementation Tasks** (TDD: write E2E tests FIRST):
   - Write E2E test: Drag ticket to next sequential stage
   - Implement DndContext setup with sensors
   - Implement draggable TicketCard component
   - Implement droppable StageColumn component
   - Implement drag overlay component

6. **Edge Case Implementation Tasks**:
   - Write E2E test: Reject invalid stage transitions
   - Implement client-side validation for drop zones
   - Write E2E test: Handle concurrent updates
   - Implement optimistic UI with rollback on conflict
   - Write E2E test: Disable drag when offline
   - Implement network status detection

7. **Touch Support Tasks**:
   - Write E2E test: Touch drag on mobile viewport
   - Configure @dnd-kit touch sensor
   - Test across mobile devices

**Ordering Strategy**:
1. Database migrations (blocking)
2. Contract tests [P] (parallel with model)
3. Model & validation [P]
4. API implementation (depends on model)
5. E2E test → Component implementation cycles
6. Edge cases & touch support

**Estimated Output**: 25-30 numbered, dependency-ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No complexity deviations - all constitutional requirements met*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A       | N/A        | N/A                                 |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (resolved in spec via /clarify)
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
