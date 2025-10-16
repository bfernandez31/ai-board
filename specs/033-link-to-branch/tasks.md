---
description: "Task list for Branch Link in Ticket Details feature"
---

# Tasks: Branch Link in Ticket Details

**Input**: Design documents from `/specs/033-link-to-branch/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Tests are included as this is a TDD-required project (per constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (Next.js)**: `components/`, `tests/e2e/` at repository root
- All paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and search for existing tests

- [X] T001 Verify lucide-react dependency is installed and includes GitBranch icon
- [X] T002 Search for existing ticket detail modal tests using `npx grep -r "ticket.*detail" tests/`
- [X] T003 Search for ticket-related test files using `npx glob "tests/**/*ticket*.spec.ts"`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Read existing ticket-detail-modal.tsx component in components/board/ticket-detail-modal.tsx to understand structure and patterns
- [X] T005 Verify TicketData interface includes branch, stage, and project fields with githubOwner/githubRepo

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Branch in GitHub (Priority: P1) 🎯 MVP

**Goal**: Enable users to navigate from ticket details to GitHub branch with one click

**Independent Test**: Create a ticket with a branch value, view the ticket detail modal, click the branch link, and verify it opens the correct GitHub branch page in a new tab

### Tests for User Story 1 (TDD - Write FIRST) ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] Create E2E test "displays branch link when branch exists and stage is not SHIP" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T007 [P] [US1] Create E2E test "opens GitHub in new tab when clicked" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T008 [P] [US1] Create E2E test "constructs correct GitHub URL with owner/repo/branch" in tests/e2e/ticket-detail-modal.spec.ts

### Implementation for User Story 1

- [X] T009 [US1] Add GitBranch icon import to lucide-react imports in components/board/ticket-detail-modal.tsx
- [X] T010 [US1] Create buildGitHubBranchUrl helper function with URL encoding in components/board/ticket-detail-modal.tsx (before component definition)
- [X] T011 [US1] Add branch link JSX rendering with conditional logic in components/board/ticket-detail-modal.tsx (after "View Specification" button section, before "Dates section")
- [X] T012 [US1] Apply purple button styling consistent with "View Specification" button in components/board/ticket-detail-modal.tsx
- [X] T013 [US1] Add target="_blank" and rel="noopener noreferrer" security attributes to branch link in components/board/ticket-detail-modal.tsx
- [X] T014 [US1] Add data-testid="github-branch-link" and aria-label attributes for testing and accessibility in components/board/ticket-detail-modal.tsx
- [X] T015 [US1] Run TypeScript type check with `npm run type-check` to verify no type errors
- [X] T016 [US1] Run E2E tests with `npx playwright test tests/e2e/ticket-detail-modal.spec.ts` and verify all User Story 1 tests pass

**Checkpoint**: At this point, User Story 1 should be fully functional - users can click branch link and open GitHub in new tab

---

## Phase 4: User Story 2 - Link Visibility Based on Branch State (Priority: P1)

**Goal**: Prevent broken or empty links by showing branch link only when branch field has a value

**Independent Test**: View tickets with and without branch values and confirm link presence/absence matches expectations

### Tests for User Story 2 (TDD - Write FIRST) ⚠️

- [X] T017 [P] [US2] Create E2E test "hides branch link when branch is null" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T018 [P] [US2] Create E2E test "hides branch link when branch is empty string" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T019 [P] [US2] Create E2E test "hides branch link when githubOwner is missing" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T020 [P] [US2] Create E2E test "hides branch link when githubRepo is missing" in tests/e2e/ticket-detail-modal.spec.ts

### Implementation for User Story 2

- [X] T021 [US2] Update conditional rendering logic to check ticket.branch is non-null and non-empty in components/board/ticket-detail-modal.tsx
- [X] T022 [US2] Add conditional check for project.githubOwner existence in components/board/ticket-detail-modal.tsx
- [X] T023 [US2] Add conditional check for project.githubRepo existence in components/board/ticket-detail-modal.tsx
- [X] T024 [US2] Run E2E tests with `npx playwright test tests/e2e/ticket-detail-modal.spec.ts` and verify all User Story 2 tests pass

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - link only appears when all required data is present

---

## Phase 5: User Story 3 - Hide Link for Shipped Tickets (Priority: P2)

**Goal**: Reduce visual clutter by hiding branch link when ticket reaches SHIP stage

**Independent Test**: Move a ticket to SHIP stage and verify the branch link is no longer displayed

### Tests for User Story 3 (TDD - Write FIRST) ⚠️

- [X] T025 [P] [US3] Create E2E test "hides branch link when stage is SHIP" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T026 [P] [US3] Create E2E test "shows branch link when stage transitions from SHIP back to VERIFY" in tests/e2e/ticket-detail-modal.spec.ts

### Implementation for User Story 3

- [X] T027 [US3] Add stage check to conditional rendering logic (ticket.stage !== 'SHIP') in components/board/ticket-detail-modal.tsx
- [X] T028 [US3] Run E2E tests with `npx playwright test tests/e2e/ticket-detail-modal.spec.ts` and verify all User Story 3 tests pass

**Checkpoint**: All user stories should now be independently functional - complete visibility logic implemented

---

## Phase 6: Edge Cases & Security Hardening

**Purpose**: Handle edge cases and ensure security compliance

### Tests for Edge Cases (TDD - Write FIRST) ⚠️

- [X] T029 [P] Create E2E test "encodes branch names with spaces" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T030 [P] Create E2E test "encodes branch names with slashes" in tests/e2e/ticket-detail-modal.spec.ts
- [X] T031 [P] Create E2E test "encodes branch names with special characters" in tests/e2e/ticket-detail-modal.spec.ts

### Implementation for Edge Cases

- [X] T032 Verify buildGitHubBranchUrl uses encodeURIComponent() for branch parameter in components/board/ticket-detail-modal.tsx
- [X] T033 Run E2E tests with `npx playwright test tests/e2e/ticket-detail-modal.spec.ts` and verify all edge case tests pass
- [X] T034 Run security audit to verify rel="noopener noreferrer" prevents Tabnabbing

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and quality checks

- [X] T035 [P] Run full test suite with `npm test` and verify all tests pass
- [X] T036 [P] Run ESLint with `npm run lint` and fix any linting errors
- [X] T037 [P] Run TypeScript type check with `npm run type-check` and verify no type errors
- [X] T038 [P] Run Prettier formatting with `npm run format` to ensure consistent code style
- [X] T039 Manual testing: Create ticket with branch, verify link appears and opens GitHub
- [X] T040 Manual testing: Transition ticket to SHIP stage, verify link disappears
- [X] T041 Manual testing: Test with branch name containing special characters (spaces, slashes)
- [X] T042 Accessibility audit: Use Chrome DevTools Lighthouse to verify accessibility score
- [X] T043 Code review: Verify no console.log statements remain in code
- [X] T044 Code review: Verify all security requirements met (rel="noopener noreferrer", URL encoding)
- [X] T045 Update CLAUDE.md recent changes section with this feature (already done by update-agent-context.sh)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P1 → P2)
  - US1 and US2 are both P1, so they can be worked on in parallel by different developers
  - US3 (P2) should start after US1/US2 are complete or near completion
- **Edge Cases (Phase 6)**: Depends on all user stories being complete
- **Polish (Phase 7)**: Depends on all previous phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (modifies same conditional logic as US1)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends conditional logic from US1/US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Implementation tasks for each user story modify the same component file (ticket-detail-modal.tsx)
- Tasks within a user story should be executed sequentially (not in parallel) to avoid file conflicts
- All tests for a user story marked [P] can be written in parallel (different test cases in same file)

### Parallel Opportunities

- **Phase 1**: All 3 setup tasks can run in parallel (T001-T003)
- **Phase 2**: T004 and T005 can run in parallel (reading different aspects of codebase)
- **User Story 1 Tests**: T006, T007, T008 can be written in parallel (different test cases)
- **User Story 2 Tests**: T017-T020 can be written in parallel (different test cases)
- **User Story 3 Tests**: T025, T026 can be written in parallel (different test cases)
- **Edge Case Tests**: T029-T031 can be written in parallel (different test cases)
- **Polish Phase**: T035-T038 can run in parallel (different validation tools)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (write in parallel):
Task T006: "Create E2E test 'displays branch link when branch exists and stage is not SHIP'"
Task T007: "Create E2E test 'opens GitHub in new tab when clicked'"
Task T008: "Create E2E test 'constructs correct GitHub URL with owner/repo/branch'"

# Then implement sequentially (same file, avoid conflicts):
Task T009: Add GitBranch icon import
Task T010: Create buildGitHubBranchUrl helper function
Task T011: Add branch link JSX rendering
...
```

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together (write in parallel):
Task T017: "Create E2E test 'hides branch link when branch is null'"
Task T018: "Create E2E test 'hides branch link when branch is empty string'"
Task T019: "Create E2E test 'hides branch link when githubOwner is missing'"
Task T020: "Create E2E test 'hides branch link when githubRepo is missing'"

# Then implement sequentially (same file, extends US1 logic):
Task T021: Update conditional rendering for branch null/empty check
Task T022: Add conditional check for project.githubOwner
Task T023: Add conditional check for project.githubRepo
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 - Both P1)

1. Complete Phase 1: Setup (verify dependencies and search for tests)
2. Complete Phase 2: Foundational (read existing component, verify interfaces)
3. Complete Phase 3: User Story 1 (basic branch link with click behavior)
4. Complete Phase 4: User Story 2 (visibility logic based on data availability)
5. **STOP and VALIDATE**: Test User Stories 1 & 2 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Basic branch link works
3. Add User Story 2 → Test independently → Branch link only shows when data available (MVP!)
4. Add User Story 3 → Test independently → Branch link hides in SHIP stage
5. Add Edge Cases → Test independently → Handle special characters
6. Add Polish → Final validation → Production ready
7. Each story adds value without breaking previous stories

### Sequential Team Strategy

With a single developer (most likely scenario):

1. Complete Setup + Foundational
2. Write all User Story 1 tests in parallel (T006-T008)
3. Implement User Story 1 sequentially (T009-T016)
4. Write all User Story 2 tests in parallel (T017-T020)
5. Implement User Story 2 sequentially (T021-T024)
6. Write all User Story 3 tests in parallel (T025-T026)
7. Implement User Story 3 sequentially (T027-T028)
8. Write all Edge Case tests in parallel (T029-T031)
9. Implement Edge Cases sequentially (T032-T034)
10. Run all Polish tasks in parallel (T035-T044)

---

## Notes

- [P] tasks = different files or independent operations, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor TDD cycle)
- All implementation tasks modify the same file (components/board/ticket-detail-modal.tsx), so execute sequentially within each user story
- Test tasks within a user story can be written in parallel (different test cases in same test file)
- Stop at any checkpoint to validate story independently
- Commit after each task or logical group of tasks
- Total: 45 tasks (3 setup + 2 foundational + 11 US1 + 8 US2 + 4 US3 + 6 edge cases + 11 polish)
