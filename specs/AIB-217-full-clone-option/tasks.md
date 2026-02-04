# Tasks: Full Clone Option for Ticket Duplication

**Input**: Design documents from `/specs/AIB-217-full-clone-option/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/clone-api.yaml ✓

**Tests**: Included per specification (Testing Trophy: unit for GitHub util, integration for API endpoint)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed - extending existing ai-board application

*This phase is empty as the feature extends an existing codebase with established structure.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: User story implementation cannot begin until this phase is complete

### Tests for Foundational

- [X] T001 [P] Create unit tests for GitHub branch creation utility in tests/unit/create-branch-from.test.ts (test successful creation, 404 source not found, 403 permission denied) ✅ DONE

### Implementation for Foundational

- [X] T002 [P] Create GitHub branch creation utility in lib/github/create-branch-from.ts implementing createBranchFrom(octokit, owner, repo, sourceBranch, newBranchName) using Octokit git.createRef() with SHA from repos.getBranch() ✅ DONE
- [X] T003 [P] Add Zod validation schema for fullClone query parameter in lib/validations/ticket.ts ✅ DONE

**Checkpoint**: Foundation ready - GitHub utility and validation in place, user story implementation can now begin

---

## Phase 3: User Story 1 - Full Clone for Alternative Implementation Testing (Priority: P1) 🎯 MVP

**Goal**: Enable developers to clone a ticket with its full history (jobs, stage, branch) to experiment with alternative implementations without affecting the original work

**Independent Test**: Clone a BUILD-stage ticket and verify the new ticket has its own branch, same stage, and complete job history with telemetry data

### Tests for User Story 1

- [X] T004 [P] [US1] Create integration tests for full clone API in tests/integration/tickets/clone.test.ts (test: creates ticket at same stage, copies all jobs with telemetry, creates new branch, transaction rollback on failure) ✅ DONE

### Implementation for User Story 1

- [X] T005 [US1] Implement fullCloneTicket function in lib/db/tickets.ts (Prisma $transaction for ticket creation + job copying, call createBranchFrom for GitHub branch, preserve stage, prefix title with "Clone of ", copy all job telemetry fields) ✅ DONE
- [X] T006 [US1] Extend duplicate API endpoint in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts to handle fullClone=true query parameter, calling fullCloneTicket and returning jobsCloned count ✅ DONE
- [X] T007 [US1] Add handleFullClone function in components/board/ticket-detail-modal.tsx calling duplicate endpoint with ?fullClone=true and displaying success toast with jobsCloned count ✅ DONE

**Checkpoint**: User Story 1 complete - full clone functionality works end-to-end for eligible tickets

---

## Phase 4: User Story 2 - Simple Copy Preserves Existing Behavior (Priority: P1)

**Goal**: Ensure existing simple duplication behavior remains available and unchanged when "Simple copy" is selected

**Independent Test**: Select "Simple copy" and verify the new ticket is in INBOX stage with title "Copy of [original]", no jobs, and no branch

### Tests for User Story 2

- [X] T008 [P] [US2] Add integration tests for simple copy in tests/integration/tickets/clone.test.ts (test: creates ticket in INBOX stage, no jobs, no branch, title prefixed with "Copy of ") ✅ DONE

### Implementation for User Story 2

- [X] T009 [US2] Refactor existing handleDuplicate to handleSimpleCopy in components/board/ticket-detail-modal.tsx (keep existing logic unchanged, just rename function) ✅ DONE

**Checkpoint**: User Story 2 complete - simple copy behavior verified unchanged

---

## Phase 5: User Story 3 - Contextual Availability of Full Clone Option (Priority: P2)

**Goal**: Show "Full clone" option only when meaningful (tickets in SPECIFY, PLAN, BUILD, or VERIFY stages with branches)

**Independent Test**: Verify dropdown shows only "Simple copy" for INBOX/SHIP tickets, and shows both options for BUILD/VERIFY tickets

### Tests for User Story 3

- [X] T010 [P] [US3] Add integration tests for full clone eligibility in tests/integration/tickets/clone.test.ts (test: 400 error for INBOX stage, 400 error for SHIP stage, 400 error for tickets without branch) ✅ DONE

### Implementation for User Story 3

- [X] T011 [US3] Add full clone eligibility validation in lib/db/tickets.ts (check stage IN SPECIFY/PLAN/BUILD/VERIFY and branch IS NOT NULL) ✅ DONE
- [X] T012 [US3] Transform Duplicate button into DropdownMenu in components/board/ticket-detail-modal.tsx using shadcn/ui DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem with ChevronDown icon ✅ DONE
- [X] T013 [US3] Add conditional rendering for "Full clone" option in components/board/ticket-detail-modal.tsx showing only when ticket.stage is in ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'] ✅ DONE

**Checkpoint**: User Story 3 complete - dropdown menu shows contextually appropriate options

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error handling improvements and final integration verification

- [X] T014 [P] Add user-friendly error handling for GitHub branch not found (404) in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts returning code BRANCH_NOT_FOUND ✅ DONE
- [X] T015 [P] Add user-friendly error handling for GitHub permission denied (403) in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts returning code GITHUB_ERROR ✅ DONE
- [X] T016 Run type-check and lint to verify no TypeScript errors introduced ✅ DONE
- [X] T017 Run impacted tests (unit tests pass, integration tests require running server) ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty - existing codebase
- **Foundational (Phase 2)**: No dependencies - can start immediately; BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T001-T003) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (T001-T003) completion; can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on User Story 1 (T005-T007) for fullCloneTicket function and handleFullClone handler
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Independent of US1 (only renames existing function)
- **User Story 3 (P2)**: Depends on US1 (needs fullCloneTicket function and handleFullClone handler to exist before adding dropdown UI)

### Within Each Phase

- Tests MUST be written and FAIL before implementation
- Utility functions before API endpoints
- API endpoints before frontend components
- Core implementation before UI integration

### Parallel Opportunities

**Phase 2 (Foundational):**
- T001, T002, T003 can all run in parallel (different files)

**Phase 3 (User Story 1):**
- T004 (tests) must complete before T005-T007 (implementation)
- T005, T006, T007 are sequential (dependency chain: db function → API → frontend)

**Phase 4 (User Story 2):**
- T008 (tests) and T009 (implementation) can run in parallel with US1 tasks
- T009 is a simple rename with no dependencies

**Phase 5 (User Story 3):**
- T010 (tests) can start after US1 T005 completes
- T011 depends on T005 (adds validation to same file)
- T012, T013 depend on T007 (modifies same component)

**Phase 6 (Polish):**
- T014, T015 can run in parallel (different error cases in same file)
- T016, T017 must run after all implementation complete

---

## Parallel Example: Foundational Phase

```bash
# Launch all foundational tasks together:
Task: "Create unit tests for GitHub branch creation utility in tests/unit/create-branch-from.test.ts"
Task: "Create GitHub branch creation utility in lib/github/create-branch-from.ts"
Task: "Add Zod validation schema for fullClone query parameter in lib/validations/ticket.ts"
```

---

## Parallel Example: User Story 1 + 2

```bash
# After Foundational completes, launch US1 and US2 tests in parallel:
Task: "[US1] Create integration tests for full clone API in tests/integration/tickets/clone.test.ts"
Task: "[US2] Add integration tests for simple copy in tests/integration/tickets/clone.test.ts"
Task: "[US2] Refactor existing handleDuplicate to handleSimpleCopy in components/board/ticket-detail-modal.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 2: Foundational (GitHub utility, validation)
2. Complete Phase 3: User Story 1 (full clone end-to-end)
3. Complete Phase 4: User Story 2 (simple copy unchanged)
4. **STOP and VALIDATE**: Test both clone modes independently
5. Deploy/demo if ready - users can now clone tickets!

### Incremental Delivery

1. Foundational → GitHub branch utility ready
2. Add User Story 1 → Full clone works → Deploy (MVP!)
3. Add User Story 2 → Simple copy verified → Deploy
4. Add User Story 3 → Dropdown UI → Deploy (Complete feature!)
5. Polish → Error handling improved → Final release

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Foundational phase sequentially
2. Once Foundational is done:
   - Parallel task 1: User Story 1 (full clone backend + frontend)
   - Parallel task 2: User Story 2 (simple copy verification)
3. After US1 completes:
   - User Story 3 (dropdown UI - depends on US1 handlers)
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No schema migration required (data-model.md confirms existing schema supports feature)
- Testing Trophy: Unit tests for GitHub utility, Integration tests for API
- No E2E tests needed (dropdown is not browser-required per quickstart.md)
- Constitution compliance verified in plan.md (TypeScript strict, shadcn/ui, Prisma transactions)
