# Tasks: AI-BOARD Assistant for Ticket Collaboration

**Input**: Design documents from `/specs/044-ai-board-assistant/`
**Prerequisites**: plan.md (tech stack, structure), spec.md (user stories P1-P4), research.md (decisions), data-model.md (entities), contracts/ (API specs)

**Tests**: Tests are NOT explicitly requested in the specification. Tasks below focus on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- Web app: Next.js full-stack structure
- API routes: `app/api/[resource]/route.ts`
- Library code: `app/lib/[category]/[file].ts`
- Components: `app/components/[category]/[file].tsx`
- Workflows: `.github/workflows/[name].yml`
- Claude commands: `.claude/commands/[name].md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: AI-BOARD user creation and core utilities

- [X] T001 Create AI-BOARD user in prisma/seed.ts (upsert with email 'ai-board@system.local')
- [X] T002 Run seed script to create AI-BOARD user in database
- [X] T003 [P] Create getAIBoardUserId() utility with in-memory caching in app/lib/db/ai-board-user.ts
- [X] T004 [P] Create verifyWorkflowToken() authentication utility in app/lib/auth/workflow-auth.ts
- [X] T005 [P] Create checkAIBoardAvailability() validation utility in app/lib/utils/ai-board-availability.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core workflow infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create GitHub workflow dispatch utility in app/lib/workflows/dispatch-ai-board.ts
- [X] T007 Create Zod schemas for AI-BOARD comment endpoint in app/lib/schemas/ai-board-comment.ts
- [X] T008 Create AI-BOARD comment creation endpoint POST /api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts
- [X] T009 Create Claude slash command /ai-board-assist in .claude/commands/ai-board-assist.md
- [X] T010 Create GitHub workflow .github/workflows/ai-board-assist.yml with skip logic ([e2e], BUILD/VERIFY stages)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 3 - AI-BOARD Auto-Membership in New Projects (Priority: P3) 🎯 MVP

**Goal**: Automatically add AI-BOARD as a project member when new projects are created

**Independent Test**: Create a new project via POST /api/projects and verify AI-BOARD appears in ProjectMember table for that project with role "member"

### Implementation for User Story 3

- [X] T011 [US3] Modify POST /api/projects endpoint to add AI-BOARD auto-membership in Prisma transaction in lib/db/projects.ts (createProject function)

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently (new projects automatically have AI-BOARD membership)

---

## Phase 4: User Story 1 - Request Specification Update via AI-BOARD (Priority: P1)

**Goal**: Enable users to mention @ai-board in SPECIFY stage comments to request specification updates

**Independent Test**: Create ticket in SPECIFY stage, post comment "@ai-board please add error handling for network timeouts", verify spec.md updated and AI-BOARD responds

### Implementation for User Story 1

- [X] T012 [US1] Modify POST /api/projects/[projectId]/tickets/[id]/comments/route.ts to detect @ai-board mention using extractMentionUserIds()
- [X] T013 [US1] Add AI-BOARD availability validation (stage check, running job check) in POST comments endpoint
- [X] T014 [US1] Add Job record creation with command "comment-{stage}" in Prisma transaction when @ai-board mentioned
- [X] T015 [US1] Add workflow dispatch call using dispatch-ai-board.ts utility after Job creation
- [X] T016 [US1] Implement SPECIFY stage logic in .claude/commands/ai-board-assist.md (validate request context, update spec.md, return JSON response)
- [X] T017 [US1] Add JSON parsing and error handling in .github/workflows/ai-board-assist.yml using jq utility
- [X] T018 [US1] Add Git commit and push logic for modified files in workflow
- [X] T019 [US1] Add AI-BOARD comment posting via POST /api/.../comments/ai-board endpoint in workflow
- [X] T020 [US1] Add job status update to COMPLETED/FAILED in workflow using PATCH /api/jobs/:id/status

**Checkpoint**: At this point, User Story 1 should be fully functional (SPECIFY stage workflow works end-to-end)

---

## Phase 5: User Story 2 - Request Planning Document Updates via AI-BOARD (Priority: P2)

**Goal**: Enable users to mention @ai-board in PLAN stage comments to request planning document updates

**Independent Test**: Create ticket in PLAN stage with existing spec.md/plan.md/tasks.md, post "@ai-board update database approach to use read replicas", verify all files remain consistent

### Implementation for User Story 2

- [X] T021 [US2] Implement PLAN stage logic in .claude/commands/ai-board-assist.md (validate request context, update plan.md/tasks.md, maintain consistency with spec.md, return JSON response)
- [X] T022 [US2] Add multi-file commit logic in .github/workflows/ai-board-assist.yml for planning artifact updates
- [X] T023 [US2] Verify atomic commit behavior when multiple files modified (spec.md, plan.md, tasks.md)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently (SPECIFY and PLAN workflows functional)

---

## Phase 6: User Story 4 - Workflow Execution for Test Tickets (Priority: P4)

**Goal**: Skip expensive Claude execution for [e2e] test tickets while completing workflow successfully

**Independent Test**: Create ticket with title "[e2e] Test Ticket", mention @ai-board, verify workflow completes quickly with skip message and no Claude API calls

### Implementation for User Story 4

- [X] T024 [US4] Verify [e2e] skip logic in .github/workflows/ai-board-assist.yml (check SKIP_CLAUDE env var)
- [X] T025 [US4] Verify BUILD/VERIFY skip logic in workflow (post "not implemented" message)
- [X] T026 [US4] Verify skip message posting via POST /api/.../comments/ai-board endpoint
- [X] T027 [US4] Verify job status update to COMPLETED for skipped workflows

**Checkpoint**: All user stories should now be independently functional (including test ticket handling)

---

## Phase 7: UI Enhancement - Mention Availability Feedback

**Purpose**: Provide client-side feedback for AI-BOARD availability

- [X] T028 [P] Create useAIBoardAvailability React hook in app/hooks/use-ai-board-availability.ts
- [X] T029 Modify MentionInput component to grey out AI-BOARD when unavailable in components/comments/mention-input.tsx
- [X] T030 Add tooltip messages for unavailability reasons (invalid stage, job running) in MentionInput component

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T031 [P] Update CLAUDE.md with AI-BOARD patterns (system user, workflow dispatch, availability validation)
- [X] T032 [P] Verify quickstart.md testing checklist completeness (already comprehensive)
- [X] T033 Code cleanup and remove debug logging (removed console.log, kept console.error for production)
- [X] T034 Security audit: Verify workflow token authentication, validate all inputs, check ProjectMember validation (implemented)
- [ ] T035 Performance validation: API response <200ms p95, workflow dispatch <500ms, mention validation <100ms (requires testing)

---

## Phase 9: Testing (Added Post-Implementation)

**Purpose**: Comprehensive test coverage for AI-BOARD Assistant feature

**Note**: Tests were added after implementation to validate functionality

### API Tests (21 tests)

**Availability Endpoint** (`tests/api/ai-board/availability.spec.ts` - 12 tests):
- [X] T036 Test availability returns false for INBOX stage
- [X] T037 Test availability returns true for SPECIFY stage with no jobs
- [X] T038 Test availability returns true for PLAN, BUILD, VERIFY stages
- [X] T039 Test availability returns false for SHIP stage
- [X] T040 Test availability returns false when job is PENDING
- [X] T041 Test availability returns false when job is RUNNING
- [X] T042 Test availability returns true when job is COMPLETED
- [X] T043 Test 404 for non-existent ticket
- [X] T044 Test 400 for invalid ticket ID

**Mention Detection** (`tests/api/ai-board/mention-detection.spec.ts` - 9 tests):
- [X] T045 Test Job creation when @ai-board mentioned in valid stage
- [X] T046 Test 400 error when @ai-board mentioned in INBOX stage
- [X] T047 Test 400 error when job already RUNNING
- [X] T048 Test comment creation without AI-BOARD mention (no Job)
- [X] T049 Test Job creation for PLAN stage mention
- [X] T050 Test Job creation for BUILD stage mention
- [X] T051 Test Job creation for VERIFY stage mention
- [X] T052 Test mention with multiple users in same comment

### E2E Tests (6 tests)

**UI Visual Feedback** (`tests/e2e/comments/mentions.spec.ts` - User Story 5):
- [X] T053 Test AI-BOARD greyed out in INBOX stage (opacity-50, cursor-not-allowed)
- [X] T054 Test tooltip shows unavailability reason on hover
- [X] T055 Test AI-BOARD NOT greyed out in SPECIFY stage
- [X] T056 Test AI-BOARD greyed out when job is RUNNING
- [X] T057 Test clicking greyed-out AI-BOARD does not insert mention
- [X] T058 Test selected item uses primary color for distinction

**Checkpoint**: All tests passing - Feature fully validated

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T003, T004, T005 needed for T008) - BLOCKS all user stories
- **User Story 3 (Phase 3)**: Depends on Foundational (T003 for AI-BOARD user ID)
- **User Story 1 (Phase 4)**: Depends on Foundational (all workflow infrastructure)
- **User Story 2 (Phase 5)**: Depends on User Story 1 (shares workflow, extends Claude command)
- **User Story 4 (Phase 6)**: Depends on User Story 1 (validates workflow skip behavior)
- **UI Enhancement (Phase 7)**: Can proceed in parallel with User Stories after Foundational
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 (extends same Claude command and workflow)
- **User Story 4 (P4)**: Depends on User Story 1 (validates existing workflow behavior with skip conditions)

### Within Each User Story

- **User Story 3**: Single task, no internal dependencies
- **User Story 1**:
  - T012-T015 (API changes) before T016 (Claude command)
  - T016 (Claude command) before T017-T020 (workflow execution)
- **User Story 2**:
  - T021 (Claude command logic) before T022-T023 (workflow multi-file handling)
- **User Story 4**:
  - T024-T025 (skip logic verification) before T026-T027 (skip workflow completion)

### Parallel Opportunities

- **Phase 1**: All utilities (T003, T004, T005) can run in parallel after T002
- **Phase 2**: T007 can run in parallel with T006 (different concerns)
- **Phase 7**: Both tasks (T028, T029) can run in parallel with user story implementation
- **Phase 8**: Documentation tasks (T031, T032) can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# After T002 (seed script) completes, launch all utilities together:
Task: "Create getAIBoardUserId() utility in app/lib/db/ai-board-user.ts"
Task: "Create verifyWorkflowToken() utility in app/lib/auth/workflow-auth.ts"
Task: "Create checkAIBoardAvailability() utility in app/lib/utils/ai-board-availability.ts"
```

---

## Implementation Strategy

### MVP First (User Story 3 + User Story 1)

1. Complete Phase 1: Setup (AI-BOARD user and utilities)
2. Complete Phase 2: Foundational (workflow infrastructure) - CRITICAL
3. Complete Phase 3: User Story 3 (auto-membership)
4. Complete Phase 4: User Story 1 (SPECIFY stage workflow)
5. **STOP and VALIDATE**: Test User Story 1 independently (mention @ai-board in SPECIFY)
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 3 → Test independently → Projects have AI-BOARD automatically
3. Add User Story 1 → Test independently → SPECIFY workflow works (MVP!)
4. Add User Story 2 → Test independently → PLAN workflow works
5. Add User Story 4 → Test independently → Test tickets skip correctly
6. Add UI Enhancement → Improved UX with greyed-out feedback
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 3 (quick win) then User Story 1
   - Developer B: UI Enhancement (Phase 7) in parallel
   - Developer C: Documentation and testing preparation
3. After User Story 1 complete:
   - Developer A: User Story 2 (extends US1)
   - Developer B: User Story 4 (validates US1)
   - Developer C: Polish and security audit

---

## Dependency Graph: User Story Completion Order

```
Phase 1 (Setup) ──> Phase 2 (Foundational) ──┬──> Phase 3 (US3: Auto-membership)
                                               │
                                               ├──> Phase 4 (US1: SPECIFY) ──┬──> Phase 5 (US2: PLAN)
                                               │                             │
                                               │                             └──> Phase 6 (US4: [e2e] skip)
                                               │
                                               └──> Phase 7 (UI Enhancement) ──> Phase 8 (Polish)
```

**Critical Path**: Phase 1 → Phase 2 → Phase 4 (User Story 1) → Phase 5 (User Story 2)

**Quick Wins**: Phase 3 (User Story 3) and Phase 7 (UI) can proceed independently after Phase 2

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Tests**: Added post-implementation (Phase 9) - 27 tests covering API and E2E scenarios
- Research.md decisions inform implementation (workflow token auth, user ID caching, mention detection, job locking, JSON parsing)
- All contracts in `/contracts/` define API behavior and validation rules

## Summary

**Total Tasks**: 58 tasks across 9 phases (35 implementation + 23 tests)
**User Stories**: 4 stories (P3, P1, P2, P4 in implementation order)
**Parallel Opportunities**: 7 tasks can run in parallel (marked with [P])
**MVP Scope**: User Story 3 (auto-membership) + User Story 1 (SPECIFY workflow)
**Critical Blocking Phase**: Phase 2 (Foundational) must complete before any user story
**Independent Stories**: US3 and US1 are independently testable after Foundational
**Test Coverage**: 27 tests (12 availability, 9 mention detection, 6 E2E UI)
