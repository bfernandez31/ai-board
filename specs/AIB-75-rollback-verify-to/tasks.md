# Tasks: Rollback VERIFY to PLAN

**Input**: Design documents from `/specs/AIB-75-rollback-verify-to/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included following TDD approach per quickstart.md - validators need unit tests, flow needs integration tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js App Router at repository root
- Frontend: `components/`, `app/`
- Backend: `app/api/`, `lib/`
- Tests: `tests/unit/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend existing types and interfaces needed for rollback validation

- [X] T001 Create RollbackValidation TypeScript interface in lib/workflows/rollback-validator.ts ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validator function that ALL user stories depend on

**CRITICAL**: User Story implementations cannot work without this phase

- [X] T002 Write unit test for canRollbackToPlan() function in tests/unit/rollback-validator.test.ts ✅ DONE
- [X] T003 Implement canRollbackToPlan() function in lib/workflows/rollback-validator.ts (depends on T001, T002) ✅ DONE
- [X] T004 Update isValidTransition() to recognize VERIFY to PLAN transition in lib/stage-transitions.ts ✅ DONE

**Checkpoint**: Foundation ready - canRollbackToPlan() exists and passes all unit tests

---

## Phase 3: User Story 1 - Rollback Verification to Re-Plan (Priority: P1)

**Goal**: Enable users to rollback from VERIFY to PLAN stage for FULL workflows, reverting implementation changes while preserving specification files

**Independent Test**: Drag a VERIFY-stage ticket with COMPLETED/FAILED/CANCELLED job status to PLAN column, confirm via modal, verify ticket resets to PLAN stage with previewUrl cleared

### Implementation for User Story 1

- [X] T005 [US1] Create RollbackVerifyModal component in components/board/rollback-verify-modal.tsx ✅ DONE
- [X] T006 [US1] Add VERIFY to PLAN rollback handling in API route app/api/projects/[projectId]/tickets/[id]/transition/route.ts ✅ DONE
- [X] T007 [US1] Add pendingVerifyRollback state and modal rendering in components/board/board.tsx ✅ DONE
- [X] T008 [US1] Add handleVerifyRollbackConfirm handler in components/board/board.tsx ✅ DONE
- [X] T009 [US1] Update handleDragEnd to detect VERIFY to PLAN drag and show modal in components/board/board.tsx ✅ DONE
- [X] T010 [US1] Write E2E test for VERIFY to PLAN rollback flow in tests/e2e/verify-rollback.spec.ts ✅ DONE

**Checkpoint**: At this point, User Story 1 should be fully functional - users can drag VERIFY tickets to PLAN, see confirmation modal, and execute rollback

---

## Phase 4: User Story 2 - Prevent Accidental Rollback (Priority: P2)

**Goal**: Protect users from accidental rollback by blocking when job is RUNNING/PENDING and requiring explicit confirmation

**Independent Test**: Attempt to drag VERIFY tickets with RUNNING job - should show disabled drop zone and block transition

### Implementation for User Story 2

- [X] T011 [P] [US2] Write unit tests for edge cases (RUNNING/PENDING job, QUICK workflow, no job) in tests/unit/rollback-validator.test.ts ✅ DONE
- [X] T012 [US2] Add early return with toast for non-FULL workflows in handleDragEnd in components/board/board.tsx ✅ DONE (handled by isValidTransition and getDropZoneStyle)
- [X] T013 [US2] Add frontend validation check before showing modal in components/board/board.tsx ✅ DONE (handled by getDropZoneStyle)
- [X] T014 [US2] Write E2E test for blocked rollback scenarios in tests/e2e/verify-rollback.spec.ts ✅ DONE

**Checkpoint**: At this point, both User Stories 1 AND 2 work - valid rollbacks succeed, invalid attempts are properly blocked

---

## Phase 5: User Story 3 - Visual Feedback During Drag (Priority: P3)

**Goal**: Provide clear visual feedback during drag operations to indicate rollback availability, consistent with BUILD to INBOX rollback patterns

**Independent Test**: Drag VERIFY tickets and observe PLAN column styling - amber dashed border for eligible, disabled for ineligible

### Implementation for User Story 3

- [X] T015 [US3] Add isVerifyToPlanRollback detection logic to stage-column.tsx in components/board/stage-column.tsx ✅ DONE (handled in board.tsx getDropZoneStyle)
- [X] T016 [US3] Add amber dashed border styling for rollback drop zone in components/board/stage-column.tsx ✅ DONE (handled in board.tsx getDropZoneStyle)
- [X] T017 [US3] Add disabled overlay styling when rollback not allowed in components/board/stage-column.tsx ✅ DONE (handled in board.tsx getDropZoneStyle)
- [X] T018 [US3] Pass draggedTicket prop from board.tsx to stage-column.tsx for rollback detection ✅ DONE (handled via dropZoneStyle prop)
- [X] T019 [US3] Write E2E test for visual feedback during drag in tests/e2e/verify-rollback.spec.ts ✅ DONE (covered in blocked rollback tests)

**Checkpoint**: All user stories should now be independently functional with complete visual feedback

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [X] T020 Run all unit tests (bun run test:unit) and fix any failures ✅ DONE
- [ ] T021 Run all E2E tests (bun run test:e2e) and fix any failures
- [X] T022 Run type-check (bun run type-check) and fix any TypeScript errors ✅ DONE
- [ ] T023 Run quickstart.md verification checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories should proceed sequentially in priority order (P1 to P2 to P3)
  - US2 extends validation from US1, US3 extends UI from US1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core rollback flow
- **User Story 2 (P2)**: Depends on US1 components existing (adds edge case handling)
- **User Story 3 (P3)**: Depends on US1 modal/drag logic (adds visual polish)

### Within Each User Story

- Unit tests before implementation where applicable
- API changes before frontend consumption
- Modal component before board integration
- Handler logic before drag detection
- Story complete before moving to next priority

### Parallel Opportunities

- T011 unit tests can run in parallel (different test file sections)
- T015, T016, T017 modify different aspects of stage-column.tsx (but same file - execute sequentially)
- T020, T021, T022 are independent validation tasks - can run in parallel

---

## Parallel Example: User Story 1 Initial Tasks

```bash
# After Phase 2 completion, start US1:
# T005 (modal component) has no dependency on API changes
# However, T006-T009 should be sequential as they build on each other

# Best approach: Complete T005 first, then T006-T009 sequentially
Task: "Create RollbackVerifyModal component in components/board/rollback-verify-modal.tsx"
# Then sequentially:
Task: "Add VERIFY to PLAN rollback handling in API route"
Task: "Add pendingVerifyRollback state and modal rendering in board.tsx"
Task: "Add handleVerifyRollbackConfirm handler in board.tsx"
Task: "Update handleDragEnd to detect VERIFY to PLAN drag"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T004)
3. Complete Phase 3: User Story 1 (T005-T010)
4. **STOP and VALIDATE**: Test rollback flow end-to-end
5. Deploy/demo if ready - basic rollback works

### Incremental Delivery

1. Complete Setup + Foundational to Foundation ready
2. Add User Story 1 to Test rollback flow to Deploy (MVP!)
3. Add User Story 2 to Add protection to Deploy
4. Add User Story 3 to Add visual polish to Deploy
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify unit tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Key files from plan.md:
  - `lib/workflows/rollback-validator.ts` - Validation logic
  - `lib/stage-transitions.ts` - Transition rules
  - `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` - API handler
  - `components/board/rollback-verify-modal.tsx` - Confirmation modal (NEW)
  - `components/board/board.tsx` - Drag handling and state
  - `components/board/stage-column.tsx` - Visual feedback

---

## Summary

| Phase | Task Count | Purpose |
|-------|------------|---------|
| Phase 1: Setup | 1 | Types and interfaces |
| Phase 2: Foundational | 3 | Core validator (blocks all stories) |
| Phase 3: US1 (P1) | 6 | Core rollback flow |
| Phase 4: US2 (P2) | 4 | Protection mechanisms |
| Phase 5: US3 (P3) | 5 | Visual feedback |
| Phase 6: Polish | 4 | Validation and cleanup |
| **Total** | **23** | |

**MVP Scope**: Phases 1-3 (10 tasks) - delivers working VERIFY to PLAN rollback with confirmation modal
