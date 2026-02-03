# Tasks: Increase Ticket Description Limit to 10000 Characters

**Input**: Design documents from `/specs/AIB-209-increase-ticket-description/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests will be updated (existing tests referenced in research.md), not new tests created.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Migration)

**Purpose**: Update database schema to support 10000-character descriptions

- [ ] T001 Update Prisma schema to change description column from VARCHAR(2500) to VARCHAR(10000) in prisma/schema.prisma
- [ ] T002 Generate and apply Prisma migration with name "increase-description-limit"
- [ ] T003 Regenerate Prisma client with `bunx prisma generate`

---

## Phase 2: Foundational (Validation Layer)

**Purpose**: Update all Zod validation schemas - MUST complete before UI updates

**⚠️ CRITICAL**: API validation must be updated before UI to ensure consistency

- [ ] T004 Update DescriptionFieldSchema max length from 2500 to 10000 in lib/validations/ticket.ts
- [ ] T005 Update CreateTicketSchema refinement from 2500 to 10000 in lib/validations/ticket.ts
- [ ] T006 Update descriptionSchema (PATCH) max length from 2500 to 10000 in lib/validations/ticket.ts
- [ ] T007 Update all error messages from "2500 characters" to "10000 characters" in lib/validations/ticket.ts

**Checkpoint**: Validation layer ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create Ticket with Long Description (Priority: P1) 🎯 MVP

**Goal**: Users can create tickets with descriptions up to 10000 characters

**Independent Test**: Create a ticket with a 5000-character description and verify it saves completely without truncation

### Implementation for User Story 1

- [ ] T008 [US1] Update placeholder text referencing character limit in components/board/new-ticket-modal.tsx
- [ ] T009 [US1] Update character counter max value from 2500 to 10000 in components/board/new-ticket-modal.tsx
- [ ] T010 [US1] Update validation test for max description length (2500→10000 chars) in tests/unit/ticket-validation.test.ts
- [ ] T011 [US1] Update validation test for over-limit description (2501→10001 chars) in tests/unit/ticket-validation.test.ts

**Checkpoint**: User Story 1 complete - creating tickets with long descriptions works

---

## Phase 4: User Story 2 - Edit Existing Ticket Description (Priority: P1)

**Goal**: Users can edit existing ticket descriptions up to 10000 characters

**Independent Test**: Open an existing ticket, edit description to 8000 characters, verify save succeeds

### Implementation for User Story 2

- [ ] T012 [US2] Verify and update placeholder text in components/board/ticket-detail-modal.tsx (if hardcoded)
- [ ] T013 [US2] Verify and update character counter in components/board/ticket-detail-modal.tsx (if hardcoded)
- [ ] T014 [US2] Verify integration test handles larger descriptions in tests/integration/tickets/crud.test.ts

**Checkpoint**: User Story 2 complete - editing tickets with long descriptions works

---

## Phase 5: User Story 3 - View Ticket with Long Description (Priority: P2)

**Goal**: Users can view tickets with descriptions up to 10000 characters without truncation or performance issues

**Independent Test**: View a ticket with a 10000-character description and confirm full content is visible

### Implementation for User Story 3

- [ ] T015 [US3] Verify ticket detail modal scrolling behavior with long descriptions in components/board/ticket-detail-modal.tsx
- [ ] T016 [US3] Verify ticket list view performance with varying description lengths (no code change expected - verification only)

**Checkpoint**: User Story 3 complete - viewing long descriptions works correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T017 Run type-check to verify no TypeScript errors: `bun run type-check`
- [ ] T018 Run unit tests to verify validation updates: `bun run test:unit`
- [ ] T019 Run integration tests to verify API behavior: `bun run test:integration`
- [ ] T020 Manual validation per quickstart.md: create ticket with ~5000 chars, edit to ~9000 chars, verify counters

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - database migration first
- **Foundational (Phase 2)**: Depends on Phase 1 - validation must align with database
- **User Story 1 (Phase 3)**: Depends on Phase 2 - UI needs valid schemas
- **User Story 2 (Phase 4)**: Depends on Phase 2 - can run parallel with US1
- **User Story 3 (Phase 5)**: Depends on Phase 2 - verification tasks, can run parallel
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent after Phase 2 - new ticket modal updates
- **User Story 2 (P1)**: Independent after Phase 2 - ticket detail modal updates (may share components with US1)
- **User Story 3 (P2)**: Independent after Phase 2 - verification of viewing behavior

### Within Each Phase

- T001 → T002 → T003 (sequential - migration workflow)
- T004, T005, T006, T007 can run sequentially on same file (lib/validations/ticket.ts)
- T008, T009 same file - run together
- T010, T011 same file - run together
- T012, T013 same file - run together
- T017 → T018 → T019 → T020 (sequential - verification workflow)

### Parallel Opportunities

```bash
# After Phase 2 completion, these can run in parallel:
# User Story 1: T008-T011 (new-ticket-modal + tests)
# User Story 2: T012-T014 (ticket-detail-modal + verification)
# User Story 3: T015-T016 (view verification)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Database migration
2. Complete Phase 2: Validation updates
3. Complete Phase 3: User Story 1 (create tickets)
4. **STOP and VALIDATE**: Create a ticket with 5000+ characters
5. Ready for use - users can create detailed tickets

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready (database + validation)
2. Add User Story 1 → Test create flow → MVP complete
3. Add User Story 2 → Test edit flow → Full editing support
4. Add User Story 3 → Verify view behavior → Complete feature
5. Phase 6 → Final validation → Ship ready

### Parallel Execution Strategy

1. Complete Phase 1 + 2 sequentially (critical path)
2. User stories 1, 2, 3 can execute in parallel after Phase 2
3. Phase 6 runs after all user stories complete

---

## Notes

- All tasks in same file should run together (avoid merge conflicts)
- US1 and US2 modify different modal components - can parallelize
- US3 is primarily verification - minimal code changes expected
- Test updates in Phase 3 verify the validation layer changes from Phase 2
- Commit after each phase for clean rollback points
- PostgreSQL VARCHAR expansion is instant - no downtime during migration
