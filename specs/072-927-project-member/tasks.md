---
description: "Task list for Project Member Authorization implementation"
---

# Tasks: Project Member Authorization

**Input**: Design documents from `/specs/072-927-project-member/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-authorization.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Tests**: Tests are MANDATORY for this feature (constitution requirement for authorization changes).

## Format: `- [ ] [ID] [P?] [Story?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router: `app/`, `lib/`, `tests/`
- API routes: `app/api/projects/[projectId]/**`
- Components: `components/`
- Tests: `tests/unit/`, `tests/api/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and test data setup

- [X] T001 Review existing ProjectMember schema in prisma/schema.prisma (no migration needed)
- [X] T002 [P] Create test data setup script for member auth in tests/helpers/db-setup.ts
- [X] T003 [P] Update test cleanup to handle ProjectMember records in tests/helpers/db-cleanup.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core authorization infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create verifyProjectAccess() helper in app/lib/db/auth-helpers.ts
- [X] T005 Create verifyTicketAccess() helper in app/lib/db/auth-helpers.ts
- [X] T006 Add TypeScript types for authorization helpers in app/lib/db/auth-helpers.ts
- [X] T007 [P] Create unit test file for auth helpers at tests/unit/auth-helpers.test.ts
- [X] T008 [P] Write unit tests for verifyProjectAccess() (owner, member, non-member) in tests/unit/auth-helpers.test.ts
- [X] T009 [P] Write unit tests for verifyTicketAccess() (owner, member, non-member) in tests/unit/auth-helpers.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Project Member Board Access (Priority: P1) 🎯 MVP

**Goal**: Enable project members (not owners) to access the project board and view all tickets

**Independent Test**: Add user as ProjectMember, login as that user, navigate to `/projects/:id/board`, verify board loads without 404/403

### Tests for User Story 1 (MANDATORY)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] Create API test file at tests/api/project-member-auth.spec.ts with consolidated authorization tests (owner, member, non-member scenarios for all endpoints)

### Implementation for User Story 1

- [X] T011 [US1] Update board page authorization in app/projects/[projectId]/board/page.tsx (replace verifyProjectOwnership with verifyProjectAccess)
- [X] T012 [US1] Update GET /api/projects/:projectId in app/api/projects/[projectId]/route.ts (replace verifyProjectOwnership with verifyProjectAccess)
- [X] T013 [US1] Update GET /api/projects/:projectId/tickets in app/api/projects/[projectId]/tickets/route.ts (replace verifyProjectOwnership with verifyProjectAccess)
- [X] T014 [US1] Update GET /api/projects/:projectId/jobs/status in app/api/projects/[projectId]/jobs/status/route.ts (replace verifyProjectOwnership with verifyProjectAccess)

**Checkpoint**: At this point, User Story 1 should be fully functional - members can view boards and tickets

---

## Phase 4: User Story 2 - Project Member Ticket Creation (Priority: P2)

**Goal**: Enable project members to create new tickets in the project

**Independent Test**: Member creates ticket via POST `/api/projects/:id/tickets`, verify ticket appears on board

### Tests for User Story 2 (MANDATORY)

- [X] T015 [P] [US2] Write API test: ticket creation for owner/member/non-member in tests/api/project-member-auth.spec.ts

### Implementation for User Story 2

- [X] T016 [US2] Update POST /api/projects/:projectId/tickets in app/api/projects/[projectId]/tickets/route.ts (replace verifyProjectOwnership with verifyProjectAccess)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Project Member Ticket Updates (Priority: P2)

**Goal**: Enable project members to update ticket titles, descriptions, and stages

**Independent Test**: Member updates ticket via PATCH `/api/projects/:id/tickets/:ticketId`, verify changes persist

### Tests for User Story 3 (MANDATORY)

- [X] T017 [P] [US3] Write API test: ticket updates (GET/PATCH/DELETE/transition/branch) for owner/member/non-member in tests/api/project-member-auth.spec.ts

### Implementation for User Story 3

- [X] T018 [P] [US3] Update GET /api/projects/:projectId/tickets/:id in app/api/projects/[projectId]/tickets/[id]/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T019 [P] [US3] Update PATCH /api/projects/:projectId/tickets/:id in app/api/projects/[projectId]/tickets/[id]/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T020 [P] [US3] Update DELETE /api/projects/:projectId/tickets/:id in app/api/projects/[projectId]/tickets/[id]/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T021 [P] [US3] Update POST /api/projects/:projectId/tickets/:id/transition in app/api/projects/[projectId]/tickets/[id]/transition/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T022 [P] [US3] Update PATCH /api/projects/:projectId/tickets/:id/branch in app/api/projects/[projectId]/tickets/[id]/branch/route.ts (replace verifyTicketOwnership with verifyTicketAccess)

**Checkpoint**: All core ticket operations now support member access

---

## Phase 6: User Story 4 - Project Member Commenting (Priority: P3)

**Goal**: Enable project members to add comments to tickets

**Independent Test**: Member posts comment via POST `/api/projects/:id/tickets/:ticketId/comments`, verify comment visible to all

### Tests for User Story 4 (MANDATORY)

- [X] T023 [P] [US4] Write API test: comments (GET/POST/PATCH/DELETE) and timeline for owner/member/non-member in tests/api/project-member-auth.spec.ts

### Implementation for User Story 4

- [X] T024 [P] [US4] Update GET /api/projects/:projectId/tickets/:id/comments in app/api/projects/[projectId]/tickets/[id]/comments/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T025 [P] [US4] Update POST /api/projects/:projectId/tickets/:id/comments in app/api/projects/[projectId]/tickets/[id]/comments/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T026 [P] [US4] Update PATCH /api/projects/:projectId/tickets/:id/comments/:commentId in app/api/projects/[projectId]/tickets/[id]/comments/[commentId]/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T027 [P] [US4] Update DELETE /api/projects/:projectId/tickets/:id/comments/:commentId in app/api/projects/[projectId]/tickets/[id]/comments/[commentId]/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T028 [US4] Update GET /api/projects/:projectId/tickets/:id/timeline in app/api/projects/[projectId]/tickets/[id]/timeline/route.ts (replace verifyTicketOwnership with verifyTicketAccess)

**Checkpoint**: All commenting features now support member access

---

## Phase 7: User Story 5 - Project Owner Member Management (Priority: P3)

**Goal**: Ensure project owners retain exclusive control over member management

**Independent Test**: Verify only owners can add/remove members, members receive 403 when attempting member management

### Tests for User Story 5 (MANDATORY)

- [X] T029 [P] [US5] Write API test: member management (POST/DELETE) for owner/member/non-member in tests/api/project-member-auth.spec.ts

### Implementation for User Story 5

- [X] T030 [US5] Verify POST /api/projects/:projectId/members still uses verifyProjectOwnership in app/api/projects/[projectId]/members/route.ts (no change needed)
- [X] T031 [US5] Verify DELETE /api/projects/:projectId/members/:memberId still uses verifyProjectOwnership in app/api/projects/[projectId]/members/route.ts (no change needed)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Image & Attachments Support

**Goal**: Update image upload/delete endpoints for member access

**Independent Test**: Member can upload and delete ticket images

### Tests for Image Support (MANDATORY)

- [X] T032 [P] Write API test: image operations (POST/DELETE) for owner/member/non-member in tests/api/project-member-auth.spec.ts

### Implementation for Image Support

- [X] T033 [P] Update POST /api/projects/:projectId/tickets/:id/images in app/api/projects/[projectId]/tickets/[id]/images/route.ts (replace verifyTicketOwnership with verifyTicketAccess)
- [X] T034 [P] Update DELETE /api/projects/:projectId/tickets/:id/images/:attachmentIndex in app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts (replace verifyTicketOwnership with verifyTicketAccess)

**Checkpoint**: All 22 endpoints now support member authorization

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T035 [P] Add deprecation comments to old helper functions in app/lib/db/auth-helpers.ts
- [X] T036 [P] Update CLAUDE.md with member authorization patterns
- [X] T037 Run full test suite (bun test) and verify all tests pass
- [X] T038 Add performance assertions to API tests (<100ms p95 target) in tests/api/project-member-auth.spec.ts
- [X] T039 [P] Code review authorization logic for security vulnerabilities
- [X] T040 Run manual testing following quickstart.md validation steps
- [X] T041 [P] Update project documentation with member authorization patterns in docs/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P2 → P3 → P3)
- **Image Support (Phase 8)**: Depends on Foundational phase completion
- **Polish (Phase 9)**: Depends on all user stories and image support being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Builds on US3 but independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Independent of other stories
- **Image Support (Phase 8)**: Can start after Foundational (Phase 2) - Independent of user stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Authorization helper updates before endpoint updates
- API route updates can be done in parallel within same story
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003)
- All Foundational unit tests marked [P] can run in parallel (T007-T009)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- All API endpoint updates within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 3

```bash
# Launch all tests for User Story 3 together:
Task T023: "Write API test: owner can update ticket"
Task T024: "Write API test: member can update ticket title"
Task T025: "Write API test: member can update ticket description"
Task T026: "Write API test: member can transition ticket stage"
Task T027: "Write API test: non-member receives 403"

# Launch all endpoint updates for User Story 3 together:
Task T028: "Update GET /api/projects/:projectId/tickets/:id"
Task T029: "Update PATCH /api/projects/:projectId/tickets/:id"
Task T030: "Update DELETE /api/projects/:projectId/tickets/:id"
Task T031: "Update POST /api/projects/:projectId/tickets/:id/transition"
Task T032: "Update PATCH /api/projects/:projectId/tickets/:id/branch"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Board Access)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready - members can now view boards

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! Members can view)
3. Add User Story 2 → Test independently → Deploy/Demo (Members can create tickets)
4. Add User Story 3 → Test independently → Deploy/Demo (Members can update tickets)
5. Add User Story 4 → Test independently → Deploy/Demo (Members can comment)
6. Add User Story 5 + Images → Test independently → Deploy/Demo (Complete feature)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Board Access)
   - Developer B: User Story 2 + 3 (Ticket CRUD)
   - Developer C: User Story 4 + 5 (Comments + Member Management)
   - Developer D: Image Support (Phase 8)
3. Stories complete and integrate independently

---

## Task Summary

**Total Tasks**: 41 (reduced from 63)
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 6 tasks (BLOCKS all user stories)
- **Phase 3 (User Story 1 - P1)**: 5 tasks (1 test, 4 implementation)
- **Phase 4 (User Story 2 - P2)**: 2 tasks (1 test, 1 implementation)
- **Phase 5 (User Story 3 - P2)**: 6 tasks (1 test, 5 implementation)
- **Phase 6 (User Story 4 - P3)**: 6 tasks (1 test, 5 implementation)
- **Phase 7 (User Story 5 - P3)**: 3 tasks (1 test, 2 verification)
- **Phase 8 (Images)**: 3 tasks (1 test, 2 implementation)
- **Phase 9 (Polish)**: 7 tasks

**Parallel Opportunities**: 20 tasks marked [P] can run in parallel within their phase

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1) = 14 tasks

**Test Coverage**: 7 consolidated test tasks covering all 22 endpoints (owner, member, non-member scenarios)

**Optimization**: Tests consolidated into parameterized test scenarios in single API contract test file. E2E test file eliminated (board access validated via API tests). Same security coverage with 50% fewer test tasks.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are MANDATORY for authorization changes (constitution requirement)
- Tests use parameterized scenarios to validate owner/member/non-member in single test case
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Performance target: <100ms p95 for authorization queries
- Backward compatibility: Existing owner access must continue to work
