# Implementation Plan: Inline Ticket Editing

**Branch**: `007-enable-inline-editing` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/007-enable-inline-editing/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   ✓ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   ✓ Project Type: web application (Next.js 15 App Router)
   ✓ Structure Decision: Single Next.js monorepo
3. Fill the Constitution Check section
   ✓ All constitutional principles identified
4. Evaluate Constitution Check section
   ✓ No violations detected
   ✓ Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   ✓ Complete - All technical decisions finalized
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   ✓ Complete - All design artifacts generated
7. Re-evaluate Constitution Check section
   ✓ PASS - Design aligns with all constitutional principles
8. Plan Phase 2 → Describe task generation approach
   ✓ Complete - Task strategy documented
9. STOP - Ready for /tasks command
   ✓ All planning phases complete
```

## Summary
Enable inline editing of ticket title and description within the ticket detail modal. Users can click title or description to enter edit mode, see real-time validation feedback, and save changes with optimistic updates and concurrency control. The feature enhances existing ticket management by eliminating navigation overhead while maintaining data integrity through version-based conflict detection.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, shadcn/ui (Radix UI), @dnd-kit
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Ticket model with version field)
**Testing**: Playwright with MCP support
**Target Platform**: Web (Vercel hosting)
**Project Type**: web - Next.js App Router monorepo
**Performance Goals**: <100ms UI response, <500ms API response (p95), optimistic updates
**Constraints**: Title ≤100 chars, description 1-1000 chars, version-based concurrency control
**Scale/Scope**: Single feature enhancement to existing modal component, 2 editable fields, ~10 test scenarios

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- [x] `strict: true` enabled in tsconfig.json (verified)
- [x] All new functions will have explicit parameter and return types
- [x] Zod schemas for API validation (title, description length constraints)
- [x] No `any` types planned

### II. Component-Driven Architecture
- [x] Using shadcn/ui components (Dialog, Input, Textarea, Toast already in use)
- [x] Extending existing `ticket-detail-modal.tsx` component
- [x] Server Components by default; Client Component for interactive modal
- [x] API routes: `/app/api/tickets/[id]/route.ts` (PATCH method)
- [x] Feature folder: `/components/board/` (existing pattern)

### III. Test-Driven Development
- [x] Playwright E2E tests required before implementation
- [x] Test scenarios defined in spec (8 acceptance scenarios + 7 edge cases)
- [x] Tests in `/tests/007-inline-editing.spec.ts`
- [x] Red-Green-Refactor cycle enforced

### IV. Security-First Design
- [x] Zod validation for all inputs (title, description, version)
- [x] Prisma parameterized queries (no raw SQL)
- [x] Version field for optimistic concurrency (prevents race conditions)
- [x] No sensitive data exposure

### V. Database Integrity
- [x] Existing Ticket model has version field (optimistic locking ready)
- [x] Schema changes via Prisma migrations (if needed)
- [x] Transaction for update operation (title + description + version bump)
- [x] Database constraints already enforced (VARCHAR limits in schema)

**Initial Assessment**: ✅ PASS - No constitutional violations. All principles align with planned implementation.

## Project Structure

### Documentation (this feature)
```
specs/007-enable-inline-editing/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── patch-ticket.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── api/
│   └── tickets/
│       └── [id]/
│           └── route.ts          # PATCH endpoint (existing GET, needs PATCH)
├── board/
│   └── page.tsx                  # Board page (existing)
└── layout.tsx

components/
├── board/
│   ├── ticket-detail-modal.tsx   # EXTEND: Add inline editing UI
│   ├── ticket-card.tsx           # Existing (no changes)
│   └── board.tsx                 # EXTEND: Refresh after save
└── ui/
    ├── dialog.tsx                # Existing shadcn component
    ├── input.tsx                 # Existing shadcn component
    ├── textarea.tsx              # Existing shadcn component
    └── toast.tsx                 # Existing shadcn component

lib/
├── hooks/
│   └── use-ticket-edit.ts        # NEW: Edit state management hook
└── validations/
    └── ticket.ts                 # NEW: Zod schemas for validation

prisma/
└── schema.prisma                 # Existing (Ticket model with version field)

tests/
└── 007-inline-editing.spec.ts    # NEW: E2E tests
```

**Structure Decision**: Single Next.js App Router monorepo. Using existing `/components/board/` for modal modifications, `/app/api/tickets/[id]/` for PATCH endpoint, and `/lib/` for shared validation logic. This aligns with constitutional Component-Driven Architecture principle and maintains existing project patterns.

## Phase 0: Outline & Research

### Research Tasks
Since all technical decisions are well-defined in the constitution and existing codebase, research focuses on patterns and best practices:

1. **Inline Editing UX Patterns**
   - **Question**: What are React best practices for inline editing with keyboard navigation (Enter/ESC)?
   - **Focus**: State management patterns, focus handling, accessibility

2. **Optimistic Concurrency Control**
   - **Question**: How to implement version-based optimistic locking with Prisma?
   - **Focus**: Prisma transaction patterns, conflict detection, rollback strategies

3. **Character Counter Components**
   - **Question**: Best patterns for real-time character counting with warning states?
   - **Focus**: Performance (avoid re-renders), accessibility (screen reader announcements)

4. **Optimistic UI Updates**
   - **Question**: React patterns for optimistic updates with rollback on error?
   - **Focus**: State management, error boundaries, toast notifications

### Research Output (research.md)

**Decision 1: Inline Editing Pattern**
- **Chosen**: Controlled input with local state + useEffect for keyboard handlers
- **Rationale**: Provides fine control over Enter/ESC behavior, integrates with React's state management
- **Alternatives**: Uncontrolled inputs (rejected: harder to validate), contentEditable (rejected: accessibility issues)
- **Implementation**: Custom hook `useInlineEdit` managing edit mode, value, and keyboard events

**Decision 2: Optimistic Concurrency**
- **Chosen**: Prisma's `update` with `where: { id, version }` + manual version increment
- **Rationale**: Prisma's conditional update returns null on version mismatch, enabling conflict detection
- **Alternatives**: Row-level locking (rejected: overkill for this use case), timestamp-based (rejected: less reliable)
- **Implementation**: `WHERE id = ? AND version = ?`, increment version on success, return 409 Conflict on null result

**Decision 3: Character Counter**
- **Chosen**: Separate `<CharacterCounter>` component with useMemo for warning state
- **Rationale**: Reusable, performant (memoized calculations), accessible (aria-live region)
- **Alternatives**: Inline calculation (rejected: re-renders), CSS-only (rejected: no screen reader support)
- **Implementation**: `useMemo(() => ({ count, max, isWarning: count > max * 0.9 }), [count, max])`

**Decision 4: Optimistic Updates**
- **Chosen**: Optimistic update → API call → rollback on error with toast notification
- **Rationale**: Immediate feedback, graceful degradation, clear error communication
- **Alternatives**: Wait for server (rejected: slow UX), no rollback (rejected: misleading)
- **Implementation**: Local state update → `fetch(PATCH)` → on error: restore original + toast

**No NEEDS CLARIFICATION remain**: All technical decisions resolved through existing architecture and research.

---

## Phase 1: Design & Contracts
*Prerequisites: research.md complete ✓*

### Artifacts Generated

1. **data-model.md** ✓
   - Existing Ticket entity documented (no schema changes)
   - Validation rules defined (Zod schemas)
   - Request/response schemas specified
   - Error response formats documented
   - State transitions for version management

2. **contracts/patch-ticket.yaml** ✓
   - OpenAPI 3.0 specification for PATCH /api/tickets/[id]
   - Request schema: `{ title?, description?, version }`
   - Response schemas: 200 (success), 400 (validation), 404 (not found), 409 (conflict), 500 (error)
   - Examples for all scenarios

3. **quickstart.md** ✓
   - 8 manual test scenarios (title edit, description edit, ESC cancel, validations, etc.)
   - API contract validation via cURL examples
   - Performance validation checklist
   - Success criteria mapping (28 functional requirements)

4. **CLAUDE.md updated** ✓
   - Added TypeScript 5.6 + Next.js 15 App Router stack
   - Added Prisma 6.x + Zod 4.x + shadcn/ui dependencies
   - Added PostgreSQL 14+ database reference
   - Updated recent changes log

### Contract Test Strategy (Ready for /tasks)
- **Test 1**: PATCH with valid title → 200 OK, version incremented
- **Test 2**: PATCH with valid description → 200 OK, version incremented
- **Test 3**: PATCH with both fields → 200 OK, version incremented
- **Test 4**: PATCH with empty title → 400 Bad Request, validation error
- **Test 5**: PATCH with stale version → 409 Conflict
- **Test 6**: PATCH non-existent ticket → 404 Not Found

---

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - NOT executed during /plan*

### Task Generation Strategy

**Source Documents**:
- Phase 1 contracts: `contracts/patch-ticket.yaml`
- Phase 1 data model: `data-model.md`
- Phase 1 quickstart: `quickstart.md`
- Feature spec user stories: `spec.md`

**Task Categories** (TDD order):

1. **Test-First Tasks** (Red phase)
   - Contract tests for PATCH endpoint (6 tests from contract)
   - E2E tests for user scenarios (8 acceptance + 7 edge cases)
   - Tests will initially fail (no implementation)

2. **Foundation Tasks** (Infrastructure)
   - Create Zod validation schemas in `lib/validations/ticket.ts`
   - Create custom hook `lib/hooks/use-ticket-edit.ts`
   - Create CharacterCounter component `components/ui/character-counter.tsx`

3. **API Implementation** (Green phase - backend)
   - Implement PATCH handler in `app/api/tickets/[id]/route.ts`
   - Add version-based update logic (optimistic concurrency)
   - Add error handling (400, 404, 409, 500)

4. **UI Implementation** (Green phase - frontend)
   - Extend `ticket-detail-modal.tsx` with inline editing UI
   - Add title inline edit (click, Enter/ESC handlers)
   - Add description inline edit (click, Save/Cancel)
   - Integrate CharacterCounter component
   - Add optimistic update + rollback logic

5. **Integration Tasks** (Green phase - glue)
   - Wire API endpoint to modal save handlers
   - Implement board refresh after save
   - Add toast notifications (success/error/conflict)

6. **Refinement Tasks** (Refactor phase)
   - Accessibility improvements (ARIA, keyboard nav)
   - Performance optimization (useMemo, debouncing if needed)
   - Error message refinement

### Ordering Strategy

**Dependency Order**:
```
Tests (contract + E2E) [P]
  ↓
Validation schemas [P]
  ↓
Custom hooks [P] | CharacterCounter [P]
  ↓
API PATCH handler
  ↓
Modal UI inline edit
  ↓
Board integration
  ↓
Accessibility & polish
```

**Parallelization** (marked with [P]):
- All test files can be written in parallel
- Validation schemas independent of hooks
- CharacterCounter independent of hooks
- After API + UI complete, refinements can be parallel

**Estimated Task Count**: 20-25 numbered tasks
- 6 contract test tasks
- 8-10 E2E test tasks
- 3 foundation tasks
- 3 implementation tasks (API, modal, board)
- 2-3 refinement tasks

### TDD Cycle Enforcement
1. **Red**: Write failing tests first (contract + E2E)
2. **Green**: Implement minimum code to pass tests
3. **Refactor**: Improve code quality while keeping tests green

**IMPORTANT**: All tests must be written and verified failing BEFORE implementation tasks.

---

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md with 20-25 tasks)
**Phase 4**: Implementation (execute tasks.md following TDD and constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance checks)

---

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** This feature aligns fully with all constitutional principles:
- ✅ TypeScript strict mode enforced
- ✅ Component-driven architecture maintained
- ✅ TDD workflow planned (tests before implementation)
- ✅ Security-first design (Zod validation, Prisma queries)
- ✅ Database integrity preserved (no schema changes, version-based concurrency)

---

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
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

**Generated Artifacts**:
- [x] research.md (Phase 0)
- [x] data-model.md (Phase 1)
- [x] contracts/patch-ticket.yaml (Phase 1)
- [x] quickstart.md (Phase 1)
- [x] CLAUDE.md updated (Phase 1)
- [ ] tasks.md (Phase 2 - awaits /tasks command)

---

## Post-Design Constitution Re-Check

### I. TypeScript-First Development ✅
- **Zod schemas**: Created in `data-model.md` with explicit types
- **API types**: Request/response schemas fully typed
- **Hook types**: `useTicketEdit` return type defined
- **No `any` types**: All types explicit in design

### II. Component-Driven Architecture ✅
- **shadcn/ui components**: Reusing Input, Textarea, Dialog, Toast
- **Feature structure**: Following `/components/board/` pattern
- **Client component**: Modal requires `"use client"` (interactive)
- **API route**: Standard Next.js pattern `/app/api/tickets/[id]/route.ts`

### III. Test-Driven Development ✅
- **Contract tests**: 6 tests specified in quickstart.md
- **E2E tests**: 15+ scenarios from acceptance criteria
- **Test-first order**: Tasks.md will enforce Red-Green-Refactor
- **Test coverage**: All 28 functional requirements mapped

### IV. Security-First Design ✅
- **Input validation**: Zod schemas on client and server
- **Prisma queries**: Parameterized, no raw SQL
- **Version concurrency**: Prevents race conditions
- **No secrets**: Environment-based config (existing pattern)

### V. Database Integrity ✅
- **No migrations**: Using existing Ticket schema
- **Optimistic locking**: Version field atomic check-and-increment
- **Constraints**: VARCHAR limits enforced at schema level
- **Transaction**: Single atomic update operation

**Final Assessment**: ✅ **PASS** - Design fully complies with constitution v1.0.0

---

*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
