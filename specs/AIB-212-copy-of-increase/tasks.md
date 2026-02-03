# Tasks: Increase Ticket Description Limit to 10000 Characters

**Input**: Design documents from `/specs/AIB-212-copy-of-increase/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Tests are included as spec.md references existing unit tests that must be updated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Migration)

**Purpose**: Database schema change that enables all other changes

- [ ] T001 Update Prisma schema to increase description limit in prisma/schema.prisma (line 112: `@db.VarChar(2500)` → `@db.VarChar(10000)`)
- [ ] T002 Run Prisma migrate to create migration: `bunx prisma migrate dev --name increase-ticket-description-limit`
- [ ] T003 Regenerate Prisma client: `bunx prisma generate`

**Checkpoint**: Database can now store descriptions up to 10000 characters

---

## Phase 2: Foundational (Validation Schemas)

**Purpose**: Server-side validation that MUST be complete before UI changes

**⚠️ CRITICAL**: No UI work can begin until validation schemas are updated

- [ ] T004 [P] Update DescriptionFieldSchema in lib/validations/ticket.ts (line 48: `.max(2500)` → `.max(10000)`, update error message)
- [ ] T005 [P] Update CreateTicketSchema refine in lib/validations/ticket.ts (line 82: `<= 2500` → `<= 10000`, update error message)
- [ ] T006 [P] Update descriptionSchema (patch) in lib/validations/ticket.ts (line 105: `.max(2500)` → `.max(10000)`, update error message)

**Checkpoint**: All server-side validation now accepts 10000 characters

---

## Phase 3: User Story 1 - Create Ticket with Extended Description (Priority: P1) 🎯 MVP

**Goal**: Enable users to create tickets with descriptions up to 10000 characters

**Independent Test**: Create a new ticket with exactly 10000 characters and verify it saves successfully

### Implementation for User Story 1

- [ ] T007 [P] [US1] Update new ticket form placeholder text in components/board/new-ticket-modal.tsx (line 263: "max 10000 characters")
- [ ] T008 [P] [US1] Update character counter display in components/board/new-ticket-modal.tsx (line 274: "X/10000 characters")

**Checkpoint**: New ticket creation supports 10000-character descriptions with correct UI feedback

---

## Phase 4: User Story 2 - Edit Ticket with Extended Description (Priority: P1)

**Goal**: Enable users to edit existing tickets and expand descriptions up to 10000 characters

**Independent Test**: Edit an existing ticket, expand description to 10000 characters, and verify update saves

### Implementation for User Story 2

- [ ] T009 [US2] Update maxLength prop in components/board/ticket-detail-modal.tsx (line 1096: `maxLength={2500}` → `maxLength={10000}`)

**Checkpoint**: Ticket editing supports 10000-character descriptions with correct validation

---

## Phase 5: User Story 3 - View Long Descriptions (Priority: P2)

**Goal**: Ensure long descriptions display correctly without truncation

**Independent Test**: View a ticket with a 10000-character description and verify full display

### Implementation for User Story 3

No implementation tasks required - existing components already handle variable-length descriptions without truncation. The CharacterCounter component dynamically uses the `max` prop passed to it, and the display components render full descriptions.

**Checkpoint**: Long descriptions display correctly (no code changes needed - verify through testing)

---

## Phase 6: Polish & Verification

**Purpose**: Update tests and verify all changes work correctly

- [ ] T010 [P] Update unit test for max length acceptance in tests/unit/ticket-validation.test.ts (lines 144-148: change to "10000 chars" and `'a'.repeat(10000)`)
- [ ] T011 [P] Update unit test for exceeding limit rejection in tests/unit/ticket-validation.test.ts (lines 165-172: change to "10001 characters" and `'a'.repeat(10001)`, update expected error message)
- [ ] T012 Run type check: `bun run type-check`
- [ ] T013 Run lint: `bun run lint`
- [ ] T014 Run unit tests: `bun run test:unit`
- [ ] T015 Run integration tests: `bun run test:integration`

**Checkpoint**: All tests pass with new 10000-character limit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - must start first (database change enables all other changes)
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all UI changes
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion (can run parallel with US1)
- **User Story 3 (Phase 5)**: No implementation needed - verification only after US1 and US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Verification only - depends on US1 and US2 for test data

### Parallel Opportunities

- **Phase 2**: All validation schema tasks (T004, T005, T006) can run in parallel - different locations in same file but independent changes
- **Phase 3**: Both new-ticket-modal tasks (T007, T008) can run in parallel - different lines in same file
- **Phase 3 & 4**: US1 and US2 can execute in parallel after Phase 2 - different files
- **Phase 6**: Test update tasks (T010, T011) can run in parallel - different test cases

---

## Parallel Example: User Story Implementation

```bash
# After Phase 2 (Foundational) is complete, launch US1 and US2 in parallel:
Task: "Update new ticket form placeholder text in components/board/new-ticket-modal.tsx"
Task: "Update character counter display in components/board/new-ticket-modal.tsx"
# Parallel with:
Task: "Update maxLength prop in components/board/ticket-detail-modal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (database migration)
2. Complete Phase 2: Foundational (validation schemas)
3. Complete Phase 3: User Story 1 (new ticket creation)
4. **STOP and VALIDATE**: Create a ticket with 10000 characters
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Validation ready
2. Add User Story 1 → Test new ticket creation → Deploy/Demo (MVP!)
3. Add User Story 2 → Test ticket editing → Deploy/Demo
4. Add User Story 3 → Verify display → Deploy/Demo
5. Complete Polish → All tests pass → Final deployment

### Suggested MVP Scope

**User Story 1** alone provides immediate value - users can create tickets with extended descriptions. User Story 2 (editing) should follow quickly as a critical companion feature.

---

## Notes

- This is a simple constant change propagated across 5 files + migration
- All changes follow the pattern: 2500 → 10000
- No new components or architectural changes needed
- Existing CharacterCounter component handles any `max` value dynamically
- Migration is non-destructive (increasing limit never truncates data)
- Total estimated changes: ~15 lines across 5 files

