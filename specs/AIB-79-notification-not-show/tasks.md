# Tasks: AI-Board Comment Mention Notifications

**Input**: Design documents from `/specs/AIB-79-notification-not-show/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Test tasks are included as this is a bug fix that requires validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router: `app/api/`, `app/lib/`, `tests/`
- This is a web application with paths at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verification of existing infrastructure and dependencies

- [x] T001 Verify AI-board user exists in database via prisma/seed.ts
- [x] T002 Verify extractMentionUserIds utility exists in app/lib/utils/mention-parser.ts
- [x] T003 [P] Verify getAIBoardUserId utility exists in app/lib/db/ai-board-user.ts
- [x] T004 [P] Verify Notification schema in prisma/schema.prisma has all required fields

**Status**: ✅ All verification complete - infrastructure ready (confirmed in research.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Review reference implementation in app/api/projects/[projectId]/tickets/[id]/comments/route.ts (lines 252-290)
- [x] T006 Confirm AI-board endpoint location at app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T007 Verify existing test file at tests/e2e/notifications.spec.ts for extension

**Checkpoint**: ✅ Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - AI-Board Response Notification (Priority: P1) 🎯 MVP

**Goal**: When AI-board posts a comment mentioning project members, those mentioned users receive notifications identical to mentions in regular comments.

**Independent Test**: Create a ticket, mention @ai-board with a request like "@ai-board please notify @[user-123:Alice] about this issue", verify Alice receives notification when AI-board responds with a comment mentioning her.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Add test for single user mention notification in tests/api/ai-board-comment-notifications.spec.ts
- [x] T009 [P] [US1] Add test for multiple user mentions notification in tests/api/ai-board-comment-notifications.spec.ts
- [x] T010 [P] [US1] Add test for no mentions scenario (should not error) in tests/api/ai-board-comment-notifications.spec.ts
- [x] T011 [P] [US1] Add test for notification failure non-blocking behavior in tests/api/ai-board-comment-notifications.spec.ts

### Implementation for User Story 1

- [x] T012 [US1] Add extractMentionUserIds import to app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T013 [US1] Extract mentions from comment content after comment creation (line 112) in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T014 [US1] Add project membership query with members relation in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T015 [US1] Filter valid recipients (project members, exclude self) in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T016 [US1] Create notifications using Notification.createMany() in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T017 [US1] Add try-catch wrapper with error logging (non-blocking) in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T018 [US1] Verify tests pass for User Story 1 scenarios

**Checkpoint**: At this point, User Story 1 should be fully functional - AI-board mentions trigger notifications for valid project members

---

## Phase 4: User Story 2 - Non-Member Mention Handling (Priority: P2)

**Goal**: AI-board comments gracefully handle mentions of users who are not project members, maintaining consistency with how regular comments handle invalid mentions.

**Independent Test**: Have AI-board post a comment mentioning a non-member user ID, verify no notification is created and no error is thrown.

### Tests for User Story 2

- [x] T019 [P] [US2] Add test for non-member mention filtering in tests/api/ai-board-comment-notifications.spec.ts
- [x] T020 [P] [US2] Add test for mixed members and non-members mentions in tests/api/ai-board-comment-notifications.spec.ts

### Implementation for User Story 2

- [x] T021 [US2] Verify filtering logic excludes non-members in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T022 [US2] Run tests to validate non-member mentions are filtered correctly
- [x] T023 [US2] Verify no errors logged for valid non-member filtering

**Checkpoint**: Non-member mentions should be gracefully filtered without errors

---

## Phase 5: User Story 3 - Self-Mention Exclusion (Priority: P3)

**Goal**: If AI-board's comment mentions itself (@ai-board in the response), no notification should be created for the AI-board user account.

**Independent Test**: Have AI-board post a comment with "@ai-board" in the text, verify no notification is created for AI-board user.

### Tests for User Story 3

- [x] T024 [P] [US3] Add test for AI-board self-mention exclusion in tests/api/ai-board-comment-notifications.spec.ts
- [x] T025 [P] [US3] Add test for mixed self-mention and valid mentions in tests/api/ai-board-comment-notifications.spec.ts

### Implementation for User Story 3

- [x] T026 [US3] Verify self-exclusion logic (id !== aiBoardUserId) in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [x] T027 [US3] Run tests to validate self-mention exclusion
- [x] T028 [US3] Verify AI-board user never receives self-notifications

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T029 Run TypeScript type checking: bun run type-check
- [x] T030 Run all E2E tests: bun run test (all AI-board notification tests passed)
- [x] T031 [P] Verify code follows existing patterns from regular comments endpoint
- [x] T032 [P] Verify constitution compliance (no 'any' types, security validation present)
- [ ] T033 Manual test: AI-board comment with mention creates notification visible in UI within 15 seconds
- [ ] T034 Manual test: Verify notification shows AI-board as actor
- [x] T035 Review error logging format matches pattern: '[ai-board-comment] Failed to create notifications:'

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ Complete - All infrastructure verified
- **Foundational (Phase 2)**: ✅ Complete - Reference implementation reviewed
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (P1 → P2 → P3)
  - Or in parallel if different aspects are being tested
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories - CRITICAL MVP
- **User Story 2 (P2)**: Depends on User Story 1 implementation (uses same filtering logic)
- **User Story 3 (P3)**: Depends on User Story 1 implementation (uses same filtering logic)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Implementation follows this order:
  1. Import statements
  2. Mention extraction
  3. Project membership query
  4. Recipient filtering (with non-member and self-exclusion)
  5. Notification creation
  6. Error handling wrapper
- Tests run after implementation to verify

### Parallel Opportunities

- **Setup Phase**: T002, T003, T004 can run in parallel (different files)
- **User Story 1 Tests**: T008, T009, T010, T011 can be written in parallel
- **User Story 2 Tests**: T019, T020 can be written in parallel
- **User Story 3 Tests**: T024, T025 can be written in parallel
- **Polish Phase**: T029, T031, T032 can run in parallel

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together:
# Write these test cases in parallel before implementation:
- "Add test for single user mention notification in tests/e2e/notifications.spec.ts"
- "Add test for multiple user mentions notification in tests/e2e/notifications.spec.ts"
- "Add test for no mentions scenario in tests/e2e/notifications.spec.ts"
- "Add test for notification failure non-blocking behavior in tests/e2e/notifications.spec.ts"

# Then implement the feature in a single file:
- "Add notification creation logic in app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Complete Phase 1: Setup (verification)
2. ✅ Complete Phase 2: Foundational (review reference implementation)
3. Complete Phase 3: User Story 1
   - Write tests T008-T011 (should FAIL)
   - Implement T012-T017 (notification creation logic)
   - Run tests T018 (should PASS)
4. **STOP and VALIDATE**: Test User Story 1 independently with manual testing
5. Deploy/demo if ready - **This delivers critical bug fix value**

### Incremental Delivery

1. ✅ Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - Critical bug fix!)
3. Add User Story 2 → Test independently → Deploy/Demo (Data integrity improvement)
4. Add User Story 3 → Test independently → Deploy/Demo (Polish - prevents meaningless notifications)
5. Polish phase → Final validation → Production ready

### Sequential Implementation (Recommended for Single Developer)

1. Complete Setup + Foundational together (already done)
2. User Story 1 (P1) - Critical path, delivers core value
3. User Story 2 (P2) - Builds on US1, adds robustness
4. User Story 3 (P3) - Builds on US1, adds polish
5. Polish phase - Final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable
- **CRITICAL**: Write tests FIRST, ensure they FAIL, then implement
- All implementation happens in ONE file: `app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts`
- All tests added to ONE existing file: `tests/e2e/notifications.spec.ts` (constitution requirement)
- Non-blocking error handling is ESSENTIAL - notification failures must not block AI-board comments
- Follow exact pattern from regular comments endpoint (lines 252-290) for consistency

## File Summary

**Files Modified**: 2 total
1. `app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts` (+45 lines for notification logic)
2. `tests/e2e/notifications.spec.ts` (+50-70 lines for test cases)

**Files Created**: 0 (all work extends existing files)

**Migrations Required**: 0 (existing schema sufficient)

**Dependencies Added**: 0 (all utilities already exist)

**Estimated Implementation Time**: ~30 minutes (per quickstart.md)
