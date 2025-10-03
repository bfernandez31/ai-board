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

### Test Migration - E2E Board Tests
- [ ] **T023** Update board-empty.spec.ts in `/tests/e2e/board-empty.spec.ts`
  - Replace all `/board` → `/projects/1/board` (3 occurrences on lines 18, 165, 178)
  - Update any API calls if present

- [ ] **T024** Update board-multiple.spec.ts in `/tests/e2e/board-multiple.spec.ts`
  - Update BASE_URL references to use `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

- [ ] **T025** Update board-responsive.spec.ts in `/tests/e2e/board-responsive.spec.ts`
  - Update BASE_URL references to use `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

- [ ] **T026** Update drag-drop.spec.ts in `/tests/drag-drop.spec.ts`
  - Update all `/board` → `/projects/1/board` (8+ occurrences)
  - Update POST `/api/tickets` → `/api/projects/1/tickets` (line 37)
  - Update any PATCH calls to use `/api/projects/1/tickets/{id}`

### Test Migration - Ticket E2E Tests
- [ ] **T027** Update ticket-card.spec.ts in `/tests/e2e/ticket-card.spec.ts`
  - Update BASE_URL references to use `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

- [ ] **T028** Update ticket-create.spec.ts in `/tests/e2e/ticket-create.spec.ts`
  - Update BASE_URL references to use `/projects/1/board`
  - Update POST `/api/tickets` → `/api/projects/1/tickets`

- [ ] **T029** Update ticket-errors.spec.ts in `/tests/e2e/ticket-errors.spec.ts`
  - Update BASE_URL references to use `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

- [ ] **T030** Update ticket-truncation.spec.ts in `/tests/e2e/ticket-truncation.spec.ts`
  - Update BASE_URL references to use `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

- [ ] **T031** Update inline-editing.spec.ts in `/tests/e2e/inline-editing.spec.ts`
  - Update BASE_URL references to use `/projects/1/board`
  - Update PATCH `/api/tickets/{id}` → `/api/projects/1/tickets/{id}`

### Test Migration - Root Level Tests
- [ ] **T032** Update ticket-detail-modal.spec.ts in `/tests/ticket-detail-modal.spec.ts`
  - Update `/board` → `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

- [ ] **T033** Update ticket-creation-modal-open.spec.ts in `/tests/ticket-creation-modal-open.spec.ts`
  - Update any route references to use `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

- [ ] **T034** Update ticket-creation-success.spec.ts in `/tests/ticket-creation-success.spec.ts`
  - Update any route references to use `/projects/1/board`
  - Update POST `/api/tickets` → `/api/projects/1/tickets`

- [ ] **T035** Update ticket-creation-form-validation.spec.ts in `/tests/ticket-creation-form-validation.spec.ts`
  - Update any route references to use `/projects/1/board`
  - Update any API calls to use project-scoped endpoints

### Test Migration - API Tests
- [ ] **T036** Update tickets-get.spec.ts in `/tests/api/tickets-get.spec.ts`
  - Update GET `/api/tickets` → `/api/projects/1/tickets`
  - Update all test expectations for new route

- [ ] **T037** Update tickets-post.spec.ts in `/tests/api/tickets-post.spec.ts`
  - Update POST `/api/tickets` → `/api/projects/1/tickets`
  - Update all test expectations for new route

- [ ] **T038** Update tickets-patch.spec.ts in `/tests/api/tickets-patch.spec.ts`
  - Update PATCH `/api/tickets/{id}` → `/api/projects/1/tickets/{id}`
  - Update all test expectations for new route

- [ ] **T039** Update api-tickets-post.contract.spec.ts in `/tests/api-tickets-post.contract.spec.ts`
  - Update POST `/api/tickets` → `/api/projects/1/tickets`
  - Update contract test expectations

### Test Migration - Database Tests
- [ ] **T040** Check ticket-project-constraints.spec.ts in `/tests/database/ticket-project-constraints.spec.ts`
  - Review if any route updates needed
  - Verify database constraint tests still valid

### Test Migration - Verification
- [ ] **T041** Verify all tests pass with new routes
  - Run: `npx playwright test`
  - Fix any failures related to route changes
  - Ensure no flaky tests
  - Verify test coverage maintained
  - Check that all test files have been updated

### Component Migration
- [ ] **T042** Update NewTicketButton to pass projectId prop in `/components/board/new-ticket-button.tsx`
  - Add `projectId: number` to props interface
  - Pass projectId to NewTicketModal

- [ ] **T043** Update StageColumn to pass projectId to children in `/components/board/stage-column.tsx`
  - Add `projectId: number` to props interface
  - Pass projectId to TicketCard components

- [ ] **T044** Update TicketCard to use project-scoped API in `/components/board/ticket-card.tsx`
  - Add `projectId: number` to props interface
  - Update any API calls to include projectId in URL
  - Pass projectId to TicketDetailModal if it makes API calls

- [ ] **T045** Update TicketDetailModal if it makes API calls in `/components/board/ticket-detail-modal.tsx`
  - Check if modal makes any PATCH requests
  - If yes, add `projectId: number` to props and update URLs
  - If no, skip this task

---

## Phase 3.5: Polish (Cleanup and Validation)

### Cleanup
- [ ] **T046** Remove old board route at `/app/board/page.tsx`
  - Delete the file entirely
  - Verify no imports reference it

- [ ] **T047** Remove old ticket API routes
  - Delete `/app/api/tickets/route.ts` (GET/POST)
  - Delete `/app/api/tickets/[id]/route.ts` (PATCH)
  - Verify no references remain

- [ ] **T048** Run quickstart validation steps from `/specs/011-refactor-routes-and/quickstart.md`
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
  T023-T041 ← Test updates (must wait for T015-T017 to exist)
    - T023-T031: E2E board and ticket tests
    - T032-T035: Root level tests
    - T036-T039: API tests
    - T040: Database tests
    - T041: Verification
  T042-T045 ← Component updates (can be parallel with tests)

Phase 3.5 Polish:
  T046-T047 ← Cleanup (wait for T041 to ensure tests pass)
  T048 ← Final validation (depends on everything)
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
- [x] Migration tasks included (T023-T045) - 23 tasks covering all test files
- [x] All existing test files identified and included
- [x] Cleanup tasks included (T046-T047)
- [x] Final validation task included (T048)

---

**Total Tasks**: 48
**Estimated Time**: 10-14 hours (with parallel execution)
**Ready for Execution**: ✅ Yes

**Task Breakdown**:
- Phase 3.2 (Tests): 10 tasks (T001-T010)
- Phase 3.3 (Implementation): 12 tasks (T011-T022)
- Phase 3.4 (Migration): 23 tasks (T023-T045)
  - E2E tests: 9 tasks (T023-T031)
  - Root tests: 4 tasks (T032-T035)
  - API tests: 4 tasks (T036-T039)
  - Database tests: 1 task (T040)
  - Verification: 1 task (T041)
  - Components: 4 tasks (T042-T045)
- Phase 3.5 (Polish): 3 tasks (T046-T048)

**Next Command**: `/implement` or start with T001
