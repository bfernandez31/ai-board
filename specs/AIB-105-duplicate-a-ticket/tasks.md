# Tasks: Duplicate a Ticket

**Input**: Design documents from `/specs/AIB-105-duplicate-a-ticket/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/duplicate-ticket-api.md

**Tests**: Included per Constitution Principle III (Test-Driven) - unit tests for utility functions, E2E tests for full flow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create new files and project structure for the duplicate feature

- [x] T001 Create title utility file at lib/utils/ticket-title.ts with createDuplicateTitle function stub
- [x] T002 Create API route directory at app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts with placeholder export

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utility and unit tests that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Unit Tests (TDD - Red)

- [x] T003 [P] Create Vitest unit tests for createDuplicateTitle in tests/unit/ticket-title.test.ts - test short titles, long titles (95+ chars), exactly 92 char boundary

### Core Utility Implementation (TDD - Green)

- [x] T004 Implement createDuplicateTitle function in lib/utils/ticket-title.ts - prefix with "Copy of ", truncate to 100 chars max

### Verification

- [x] T005 Run `bun run test:unit` to verify all title truncation tests pass

**Checkpoint**: Foundation ready - title utility complete and tested, user story implementation can now begin

---

## Phase 3: User Story 1 - Duplicate Ticket from Modal (Priority: P1) MVP

**Goal**: User can click a duplicate button in ticket modal to create a new ticket in INBOX with copied content (title, description, policy, attachments)

**Independent Test**: Open any ticket modal, click duplicate button, verify new ticket appears in INBOX with "Copy of" prefix and all content copied

### API Implementation for User Story 1

- [x] T006 [US1] Implement POST handler in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts:
  - Validate projectId and ticketId params
  - Use verifyProjectAccess for authorization
  - Fetch source ticket with required fields
  - Call createDuplicateTitle for title
  - Call createTicket with copied fields (title, description, clarificationPolicy, attachments)
  - Return 201 with new ticket data

- [x] T007 [US1] Add error handling to duplicate route.ts:
  - 400 for invalid project/ticket ID
  - 401 for unauthorized
  - 404 for ticket/project not found
  - 500 for database errors

### UI Implementation for User Story 1

- [x] T008 [US1] Add duplicate button to components/board/ticket-detail-modal.tsx:
  - Import Copy icon from lucide-react
  - Add isDuplicating state with useState
  - Place button in metadata row (around line 791) with variant="ghost", size="sm"
  - Add data-testid="duplicate-button"
  - Show "Duplicate" text with Copy icon

- [x] T009 [US1] Implement handleDuplicate function in ticket-detail-modal.tsx:
  - Set isDuplicating to true on start
  - POST to /api/projects/{projectId}/tickets/{ticketId}/duplicate
  - Parse response for new ticket data
  - Reset isDuplicating in finally block
  - Disable button while isDuplicating is true

**Checkpoint**: User Story 1 core functionality complete - duplicate creates new ticket in INBOX

---

## Phase 4: User Story 2 - Immediate Feedback After Duplication (Priority: P2)

**Goal**: User receives toast notification with new ticket key and can navigate to the duplicated ticket via "View" action

**Independent Test**: Duplicate any ticket, observe success toast with ticket key (e.g., "AIB-106"), click "View" to open new ticket modal

### UI Implementation for User Story 2

- [x] T010 [US2] Add success toast to handleDuplicate in ticket-detail-modal.tsx:
  - Import ToastAction from @/components/ui/toast
  - On success: show toast with title "Ticket duplicated", description = newTicket.ticketKey
  - Add action prop with ToastAction containing "View" text

- [x] T011 [US2] Implement toast "View" action navigation in ticket-detail-modal.tsx:
  - Import useRouter from next/navigation (or use existing router if present)
  - onClick: router.push(`/projects/${projectId}/board?ticket=${newTicket.id}&tab=details`)

- [x] T012 [US2] Add error toast to handleDuplicate catch block in ticket-detail-modal.tsx:
  - Show toast with variant="destructive"
  - title: "Error"
  - description: "Failed to duplicate ticket. Please try again."

**Checkpoint**: User Story 2 complete - toast feedback with navigation working

---

## Phase 5: User Story 3 - Duplicate Ticket with Long Description (Priority: P3)

**Goal**: Tickets with descriptions at or near 2500 character limit can be duplicated successfully with full content preserved

**Independent Test**: Create ticket with 2500 char description, duplicate it, verify full description copied without truncation

### Verification for User Story 3

- [x] T013 [US3] Verify description handling in duplicate route.ts - confirm description is copied exactly without modification (already handled by createTicket, just verify in code review)

**Checkpoint**: User Story 3 complete - long descriptions preserved

---

## Phase 6: E2E Tests

**Purpose**: End-to-end Playwright tests for complete duplicate flow

- [x] T014 [P] Create E2E test file at tests/e2e/duplicate-ticket.spec.ts with test structure
- [x] T015 [P] Add E2E test: duplicate ticket and verify toast appears with ticket key
- [x] T016 [P] Add E2E test: click "View" action on toast and verify new ticket modal opens with "Copy of" title
- [x] T017 Add E2E test: verify duplicate appears in INBOX column on board

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T018 Run `bun run type-check` to verify TypeScript compilation
- [x] T019 Run `bun run test:unit` to verify all unit tests pass
- [x] T020 Run `bun run test:e2e` to verify all E2E tests pass
- [x] T021 Run quickstart.md manual verification checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T004 must be complete)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (T008, T009 must be complete)
- **User Story 3 (Phase 5)**: Can run in parallel with User Story 2 (verification only)
- **E2E Tests (Phase 6)**: Depends on User Stories 1 and 2 being complete
- **Polish (Phase 7)**: Depends on all previous phases

### Task Dependencies Detail

```
T001, T002 (Setup)
    ↓
T003 (Unit tests - RED) → T004 (Implementation - GREEN) → T005 (Verify)
    ↓
T006, T007 (API) → T008, T009 (UI button)
                        ↓
                T010, T011, T012 (Toast feedback)
                        ↓
                    T013 (Long description verification)
                        ↓
                T014, T015, T016, T017 (E2E tests)
                        ↓
                T018, T019, T020, T021 (Polish)
```

### Parallel Opportunities

**Within Foundational (Phase 2)**:
- T003 can start immediately after Setup

**Within User Story 1 (Phase 3)**:
- T006 and T008 can start in parallel (API and UI are separate files)

**Within E2E Tests (Phase 6)**:
- T014, T015, T016 can run in parallel (different test cases in same file)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 complete, launch API and UI work together:
Task: "Implement POST handler in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts"
Task: "Add duplicate button to components/board/ticket-detail-modal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 (T006-T009)
4. **STOP and VALIDATE**: Test duplicate button creates ticket in INBOX
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Title utility tested
2. Add User Story 1 → Core duplicate functionality works → Deploy/Demo (MVP!)
3. Add User Story 2 → Toast feedback and navigation → Deploy/Demo
4. Add User Story 3 → Edge case verified
5. E2E Tests → Full test coverage
6. Polish → Final verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD approach: Unit tests written and failing BEFORE implementation (T003 before T004)
- No schema changes needed - uses existing Ticket model and createTicket function
- Attachments are copied as-is (same Cloudinary URL references)
- Title truncation ensures "Copy of " + title <= 100 chars
