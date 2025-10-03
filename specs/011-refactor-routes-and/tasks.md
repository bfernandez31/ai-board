# Tasks: Refactor Routes and APIs to Require Project Context

**Feature**: 011-refactor-routes-and
**Input**: Design documents from `/home/benoit/Workspace/ai-board/specs/011-refactor-routes-and/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Tech stack: TypeScript 5.6, Next.js 15, Prisma 6.x, Zod 4.x
   → Structure: Next.js App Router with dynamic routes
2. Load optional design documents ✅
   → data-model.md: No new entities, query modifications only
   → contracts/: 3 API contracts (GET, POST, PATCH)
   → research.md: 8 technical decisions documented
3. Generate tasks by category ✅
   → Setup: No setup needed (existing project)
   → Tests: 10 test tasks (3 contract + 7 E2E)
   → Core: 12 implementation tasks (routes, APIs, DB layer)
   → Integration: 8 migration tasks (existing tests, components)
   → Polish: 3 cleanup + 3 validation tasks
4. Apply task rules ✅
   → Contract tests: All [P] (different files)
   → E2E tests: All [P] (different files)
   → Implementation: Sequential where dependencies exist
5. Number tasks sequentially (T001-T033) ✅
6. Generate dependency graph ✅
7. Create parallel execution examples ✅
8. Validate task completeness ✅
   → All 3 contracts have tests ✅
   → All 3 API endpoints have implementations ✅
   → All user stories have E2E tests ✅
9. Return: SUCCESS (33 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All file paths are absolute from repository root

## Path Conventions
This is a Next.js 15 web application using App Router:
- **Routes**: `/app/` directory with folder-based routing
- **API Routes**: `/app/api/` directory
- **Components**: `/components/` directory (feature-based)
- **Database**: `/lib/db/` directory
- **Tests**: `/tests/` directory (E2E and contract tests)
- **Validations**: `/lib/validations/` directory

---

## Phase 3.1: Setup
No setup tasks required - this is a refactor of an existing project.

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Validation)
- [ ] **T001** [P] Write contract test for GET /api/projects/[projectId]/tickets in `/tests/api/projects-tickets-get.spec.ts`
  - Verify 200 response with tickets grouped by stage
  - Verify 400 for invalid projectId format
  - Verify 404 for non-existent project
  - Verify only returns tickets from specified project (no leaks)
  - Verify all stages present in response

- [ ] **T002** [P] Write contract test for POST /api/projects/[projectId]/tickets in `/tests/api/projects-tickets-post.spec.ts`
  - Verify 201 response with created ticket
  - Verify ticket has stage=INBOX and version=1
  - Verify ticket has projectId from URL
  - Verify 400 for missing/invalid fields
  - Verify 404 for non-existent project

- [ ] **T003** [P] Write contract test for PATCH /api/projects/[projectId]/tickets/[id] in `/tests/api/projects-tickets-patch.spec.ts`
  - Verify 200 for valid stage update
  - Verify 200 for valid inline edit
  - Verify version incremented
  - Verify 403 for ticket in different project
  - Verify 404 for non-existent project/ticket
  - Verify 409 for version mismatch

### E2E Tests (User Flows)
- [ ] **T004** [P] Write E2E test for root redirect in `/tests/e2e/project-routing.spec.ts`
  - Navigate to `/` and verify redirect to `/projects/1/board`
  - Verify URL contains projectId
  - Verify board loads successfully

- [ ] **T005** [P] Write E2E test for project-scoped board access in `/tests/e2e/project-board.spec.ts`
  - Navigate to `/projects/1/board`
  - Verify only project 1 tickets displayed
  - Verify all stages visible
  - Verify API request to `/api/projects/1/tickets`

- [ ] **T006** [P] Write E2E test for invalid project ID in `/tests/e2e/project-validation-404.spec.ts`
  - Navigate to `/projects/999999/board`
  - Verify 404 error or error message
  - Verify no tickets displayed

- [ ] **T007** [P] Write E2E test for non-numeric project ID in `/tests/e2e/project-validation-format.spec.ts`
  - Navigate to `/projects/abc/board`
  - Verify 404 error
  - Verify application doesn't crash

- [ ] **T008** [P] Write E2E test for cross-project access prevention in `/tests/e2e/cross-project-prevention.spec.ts`
  - Create ticket in project 2
  - Attempt to update via `/api/projects/1/tickets/{id}`
  - Verify 403 Forbidden response
  - Verify ticket unchanged in database

- [ ] **T009** [P] Write E2E test for create ticket with project context in `/tests/e2e/project-ticket-create.spec.ts`
  - Navigate to `/projects/1/board`
  - Click "New Ticket" button
  - Fill and submit form
  - Verify POST to `/api/projects/1/tickets`
  - Verify created ticket has projectId=1

- [ ] **T010** [P] Write E2E test for update ticket with project context in `/tests/e2e/project-ticket-update.spec.ts`
  - Navigate to `/projects/1/board`
  - Drag ticket to new stage
  - Verify PATCH to `/api/projects/1/tickets/{id}`
  - Verify update persists after refresh

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Validation Layer
- [ ] **T011** [P] Add projectId validation schema in `/lib/validations/ticket.ts`
  - Create `ProjectIdSchema` with Zod (string regex for positive integer)
  - Export schema for use in API routes
  - Add JSDoc comments

- [ ] **T012** [P] Create project validation helpers in `/lib/db/projects.ts`
  - Implement `getProjectById(projectId: number): Promise<Project | null>`
  - Use Prisma to query Project table
  - Return null if not found
  - Add explicit TypeScript return types

### Database Layer
- [ ] **T013** Update `getTicketsByStage()` to accept projectId in `/lib/db/tickets.ts`
  - Change signature: `getTicketsByStage(projectId: number): Promise<...>`
  - Add `where: { projectId }` filter to Prisma query
  - Update JSDoc comments
  - Keep existing orderBy and select logic

- [ ] **T014** Update `createTicket()` to accept projectId in `/lib/db/tickets.ts`
  - Change signature: `createTicket(projectId: number, input: CreateTicketInput): Promise<...>`
  - Remove default project logic (upsert block)
  - Use projectId parameter directly: `data: { ...input, projectId }`
  - Update JSDoc comments

### API Routes (Project-Scoped)
- [ ] **T015** Create GET /api/projects/[projectId]/tickets route in `/app/api/projects/[projectId]/tickets/route.ts`
  - Await and parse projectId from `context.params`
  - Validate projectId format with Zod (return 400 if invalid)
  - Check project exists with `getProjectById()` (return 404 if not found)
  - Call `getTicketsByStage(projectId)`
  - Return tickets grouped by stage (200 OK)
  - Add try-catch with 500 error handling

- [ ] **T016** Create POST /api/projects/[projectId]/tickets route in same file as T015
  - Await and parse projectId from `context.params`
  - Validate projectId format with Zod
  - Check project exists (return 404 if not found)
  - Parse and validate request body with `CreateTicketSchema`
  - Call `createTicket(projectId, validatedData)`
  - Revalidate `/projects/{projectId}/board` path
  - Return created ticket (201 Created)

- [ ] **T017** Create PATCH /api/projects/[projectId]/tickets/[id] route in `/app/api/projects/[projectId]/tickets/[id]/route.ts`
  - Await and parse projectId and ticketId from `context.params`
  - Validate both IDs are numeric (return 400 if invalid)
  - Check project exists (return 404 if not found)
  - Parse request body (stage update OR inline edit)
  - Validate request with appropriate schema
  - Query ticket with composite WHERE: `{ id: ticketId, projectId }`
  - If not found, distinguish 404 (ticket doesn't exist) from 403 (wrong project)
  - Update ticket with version check (return 409 on conflict)
  - Return updated ticket (200 OK)

### Page Routes
- [ ] **T018** Create project-scoped board page in `/app/projects/[projectId]/board/page.tsx`
  - Mark as Server Component with `export const dynamic = 'force-dynamic'`
  - Accept params: `{ params: Promise<{ projectId: string }> }`
  - Await params and parse projectId
  - Convert projectId to number and validate
  - Check project exists (return notFound() if not)
  - Call `getTicketsByStage(projectId)`
  - Render `<Board ticketsByStage={...} projectId={projectId} />`

- [ ] **T019** Update root page to redirect in `/app/page.tsx`
  - Import `redirect` from 'next/navigation'
  - Replace entire component body with: `redirect('/projects/1/board')`
  - Keep it as a Server Component (no "use client")

### Component Updates
- [ ] **T020** Update Board component to accept projectId in `/components/board/board.tsx`
  - Add `projectId: number` to component props interface
  - Pass projectId to child components (NewTicketButton, StageColumn)
  - Update type annotations

- [ ] **T021** Update NewTicketModal to use project-scoped API in `/components/board/new-ticket-modal.tsx`
  - Add `projectId: number` to props interface
  - Update fetch URL: `` `/api/projects/${projectId}/tickets` ``
  - Keep existing form validation and error handling
  - No changes to request body format

- [ ] **T022** Update ticket update handlers to use project-scoped API in `/components/board/board.tsx`
  - Update drag-and-drop PATCH URL: `` `/api/projects/${projectId}/tickets/${ticketId}` ``
  - Update inline edit PATCH URL: `` `/api/projects/${projectId}/tickets/${ticketId}` ``
  - Keep existing optimistic update logic
  - Keep existing error handling

---

## Phase 3.4: Integration (Migrate Existing Tests and Clean Up)

### Test Migration
- [ ] **T023** Update all existing E2E tests to use `/projects/1/board` route
  - Find all occurrences of `/board` in `/tests/e2e/*.spec.ts`
  - Replace with `/projects/1/board`
  - Update any hardcoded URLs in test setup

- [ ] **T024** Update all existing API tests to use project-scoped endpoints
  - Find all API calls in `/tests/api/*.spec.ts`
  - Update GET `/api/tickets` → `/api/projects/1/tickets`
  - Update POST `/api/tickets` → `/api/projects/1/tickets`
  - Update PATCH `/api/tickets/{id}` → `/api/projects/1/tickets/{id}`

- [ ] **T025** Update ticket-related E2E tests to use project-scoped APIs
  - Update `/tests/e2e/ticket-create.spec.ts` to verify `/api/projects/1/tickets` POST
  - Update `/tests/e2e/inline-editing.spec.ts` to verify `/api/projects/1/tickets/{id}` PATCH
  - Update `/tests/e2e/drag-drop.spec.ts` to verify project-scoped PATCH
  - Update any other tests that interact with ticket APIs

- [ ] **T026** Verify all tests pass with new routes
  - Run: `npx playwright test`
  - Fix any failures related to route changes
  - Ensure no flaky tests
  - Verify test coverage maintained

### Component Migration
- [ ] **T027** Update NewTicketButton to pass projectId prop in `/components/board/new-ticket-button.tsx`
  - Add `projectId: number` to props interface
  - Pass projectId to NewTicketModal

- [ ] **T028** Update StageColumn to pass projectId to children in `/components/board/stage-column.tsx`
  - Add `projectId: number` to props interface
  - Pass projectId to TicketCard components

- [ ] **T029** Update TicketCard to use project-scoped API in `/components/board/ticket-card.tsx`
  - Add `projectId: number` to props interface
  - Update any API calls to include projectId in URL
  - Pass projectId to TicketDetailModal if it makes API calls

- [ ] **T030** Update TicketDetailModal if it makes API calls in `/components/board/ticket-detail-modal.tsx`
  - Check if modal makes any PATCH requests
  - If yes, add `projectId: number` to props and update URLs
  - If no, skip this task

---

## Phase 3.5: Polish (Cleanup and Validation)

### Cleanup
- [ ] **T031** Remove old board route at `/app/board/page.tsx`
  - Delete the file entirely
  - Verify no imports reference it

- [ ] **T032** Remove old ticket API routes
  - Delete `/app/api/tickets/route.ts` (GET/POST)
  - Delete `/app/api/tickets/[id]/route.ts` (PATCH)
  - Verify no references remain

- [ ] **T033** Run quickstart validation steps from `/specs/011-refactor-routes-and/quickstart.md`
  - Execute Steps 1-9 manually
  - Verify root redirect works
  - Verify project-scoped board access
  - Verify invalid project returns 404
  - Verify cross-project access returns 403
  - Verify create/update use project-scoped APIs
  - Check performance targets met (<100ms API responses)
  - Run full test suite: `npx playwright test`

---

## Dependencies

```
Phase 3.2 (Tests) MUST complete before Phase 3.3 (Implementation)

Phase 3.2 Tests (All parallel):
  T001-T010 [P] ← All test files are independent

Phase 3.3 Implementation:
  T011, T012 [P] ← Validation layer (independent files)
  ↓
  T013, T014 ← Database layer (same file, sequential)
  ↓
  T015, T016 ← GET/POST API (same file, sequential)
  T017 ← PATCH API (different file, can be parallel with T015-T016)
  ↓
  T018 ← Board page (depends on T015 for data fetching)
  T019 [P] ← Root redirect (independent)
  ↓
  T020 ← Board component (depends on T018)
  ↓
  T021, T022 ← Modal and handlers (depend on T020 for props)

Phase 3.4 Migration:
  T023-T026 ← Test updates (must wait for T015-T017 to exist)
  T027-T030 ← Component updates (can be parallel with tests)

Phase 3.5 Polish:
  T031-T032 ← Cleanup (wait for T026 to ensure tests pass)
  T033 ← Final validation (depends on everything)
```

---

## Parallel Execution Examples

### Batch 1: All Contract Tests (After Project Setup)
```typescript
// Launch T001-T003 in parallel (different test files)
Task: "Write contract test for GET /api/projects/[projectId]/tickets in /tests/api/projects-tickets-get.spec.ts"
Task: "Write contract test for POST /api/projects/[projectId]/tickets in /tests/api/projects-tickets-post.spec.ts"
Task: "Write contract test for PATCH /api/projects/[projectId]/tickets/[id] in /tests/api/projects-tickets-patch.spec.ts"
```

### Batch 2: All E2E Tests (After Contract Tests)
```typescript
// Launch T004-T010 in parallel (different test files)
Task: "Write E2E test for root redirect in /tests/e2e/project-routing.spec.ts"
Task: "Write E2E test for project-scoped board access in /tests/e2e/project-board.spec.ts"
Task: "Write E2E test for invalid project ID in /tests/e2e/project-validation-404.spec.ts"
Task: "Write E2E test for non-numeric project ID in /tests/e2e/project-validation-format.spec.ts"
Task: "Write E2E test for cross-project access prevention in /tests/e2e/cross-project-prevention.spec.ts"
Task: "Write E2E test for create ticket with project context in /tests/e2e/project-ticket-create.spec.ts"
Task: "Write E2E test for update ticket with project context in /tests/e2e/project-ticket-update.spec.ts"
```

### Batch 3: Validation Layer (After Tests Fail)
```typescript
// Launch T011-T012 in parallel (different files)
Task: "Add projectId validation schema in /lib/validations/ticket.ts"
Task: "Create project validation helpers in /lib/db/projects.ts"
```

### Batch 4: Independent Routes (After Database Layer)
```typescript
// T017 and T019 can run in parallel with T015-T016
Task: "Create PATCH /api/projects/[projectId]/tickets/[id] route in /app/api/projects/[projectId]/tickets/[id]/route.ts"
Task: "Update root page to redirect in /app/page.tsx"
```

---

## Notes
- **[P] tasks**: Different files, no dependencies - safe to run in parallel
- **Verify tests fail**: Before T011, run tests to ensure they fail (red in TDD)
- **Commit strategy**: Commit after each phase completion
- **Avoid**:
  - Same file conflicts (T013-T014 are sequential, same file)
  - Implementing before tests fail (violates TDD)
  - Skipping validation (T033 is mandatory)

---

## Task Generation Rules Applied

1. **From Contracts** ✅:
   - 3 contract files → 3 contract test tasks (T001-T003) [P]
   - 3 endpoints → 3 implementation tasks (T015-T017)

2. **From Data Model** ✅:
   - No new entities → no new model tasks
   - Query changes → update existing functions (T013-T014)

3. **From User Stories** ✅:
   - 6 acceptance scenarios → 7 E2E tests (T004-T010) [P]
   - 3 edge cases → covered in E2E tests

4. **Ordering** ✅:
   - Tests (T001-T010) → Validation (T011-T012) → DB Layer (T013-T014) → APIs (T015-T017) → Pages (T018-T019) → Components (T020-T022) → Migration (T023-T030) → Cleanup (T031-T033)

---

## Validation Checklist
*GATE: Completed before task execution*

- [x] All 3 contracts have corresponding tests (T001-T003)
- [x] All 3 endpoints have implementation tasks (T015-T017)
- [x] All tests come before implementation (T001-T010 before T011-T022)
- [x] Parallel tasks truly independent (verified file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task (T013-T014 marked sequential)
- [x] TDD order enforced (Phase 3.2 before 3.3)
- [x] Migration tasks included (T023-T030)
- [x] Cleanup tasks included (T031-T032)
- [x] Final validation task included (T033)

---

**Total Tasks**: 33
**Estimated Time**: 8-12 hours (with parallel execution)
**Ready for Execution**: ✅ Yes

**Next Command**: `/implement` or start with T001
