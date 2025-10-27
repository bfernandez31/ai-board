---
description: "Task list for PR Ready Notification Enhancement"
---

# Tasks: PR Ready Notification Enhancement

**Input**: Design documents from `/specs/065-916-update-script/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: No test tasks generated - feature does not explicitly request new tests. Existing E2E tests will validate the enhancement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Script path**: `.specify/scripts/bash/` (project scripts)
- **API path**: `app/api/` (Next.js App Router)
- **Test path**: `tests/e2e/` (Playwright E2E tests)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification

- [ ] T001 Verify Git repository is on correct branch (065-916-update-script)
- [ ] T002 Verify target script exists at .specify/scripts/bash/create-pr-and-transition.sh
- [ ] T003 [P] Review existing comment posting logic (lines 111-118)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Analyze current comment template format at .specify/scripts/bash/create-pr-and-transition.sh:117
- [ ] T005 [P] Review PR number extraction logic at .specify/scripts/bash/create-pr-and-transition.sh:108
- [ ] T006 [P] Review error handling pattern at .specify/scripts/bash/create-pr-and-transition.sh:118
- [ ] T007 Confirm API endpoint contract (POST /api/projects/:projectId/tickets/:id/comments) supports markdown format

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Developer receives clear PR ready notification (Priority: P1) 🎯 MVP

**Goal**: When a ticket completes implementation and transitions to VERIFY, the developer receives an unambiguous notification in ticket comments that a pull request has been created and is ready for code review, with direct access to the PR.

**Independent Test**: Trigger any workflow that completes implementation (SPECIFY, PLAN, or BUILD to VERIFY transition) and verify a comment appears with clear "ready for review" messaging and a clickable PR link.

### Implementation for User Story 1

- [ ] T008 [US1] Update comment template content in .specify/scripts/bash/create-pr-and-transition.sh:117 to use enhanced format with "Ready for Review" heading
- [ ] T009 [US1] Replace comment title from "Pull Request Created" to "Pull Request Ready for Review" with checkmark emoji (✅)
- [ ] T010 [US1] Update PR reference format from "PR #${PR_NUMBER} is ready for review:" to "**PR #${PR_NUMBER}**: [View Pull Request](${PR_URL})"
- [ ] T011 [US1] Add explicit "Code review can now begin" language to comment body
- [ ] T012 [US1] Add "Next Steps" section with actionable reviewer checklist (Review code changes, Run tests, Approve and merge)
- [ ] T013 [US1] Verify JSON escaping is correct for all special characters (newlines \\n, quotes \", markdown syntax)
- [ ] T014 [US1] Validate error handling remains non-blocking (|| echo "⚠️ Failed..." pattern preserved at line 118)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T015 [P] Create validation script to test JSON payload format (test-comment-format.sh per quickstart.md)
- [ ] T016 Run validation script with sample PR_NUMBER and PR_URL to verify JSON correctness
- [ ] T017 [P] Verify markdown rendering in ticket UI with manual workflow test
- [ ] T018 [P] Run existing E2E test suite (tests/e2e/workflow-integration.spec.ts) to validate integration
- [ ] T019 Update E2E test assertions if needed to match new comment format expectations
- [ ] T020 Verify comment appears correctly after workflow execution in development project
- [ ] T021 [P] Update CLAUDE.md if workflow behavior documentation needs changes
- [ ] T022 Run quickstart.md validation checklist (Script syntax valid, JSON valid, Markdown renders, PR link clickable, Error handling preserved)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **Polish (Phase 4)**: Depends on User Story 1 completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within User Story 1

- T008-T012: Comment template modifications (can be done sequentially as single edit)
- T013: Validation step (depends on T008-T012 completion)
- T014: Verification step (depends on all previous tasks)

### Parallel Opportunities

- Setup tasks T002 and T003 can run in parallel
- Foundational tasks T005 and T006 can run in parallel
- Polish tasks T015 and T017 and T018 can run in parallel
- Polish tasks T021 can run while testing tasks execute

---

## Parallel Example: User Story 1

```bash
# All implementation tasks are in single file, so must be sequential
# However, validation and testing can be parallelized:

# After implementation complete:
Task: "Create validation script to test JSON payload format"
Task: "Verify markdown rendering in ticket UI with manual workflow test"
Task: "Run existing E2E test suite"
Task: "Update CLAUDE.md if workflow behavior documentation needs changes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify branch and script)
2. Complete Phase 2: Foundational (analyze current implementation)
3. Complete Phase 3: User Story 1 (update comment template)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Complete Phase 4: Polish (validation, testing, documentation)
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (5 minutes)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! - 5 minutes)
3. Add Polish phase → Validate thoroughly → Final deployment (5 minutes)
4. Total estimated time: 10-15 minutes

### Single Developer Strategy

With single developer:

1. Complete Setup + Foundational (understand current state)
2. Implement User Story 1 (single file, ~8 lines changed)
3. Run validation script to verify JSON correctness
4. Run E2E tests to ensure integration works
5. Manual test in workflow to verify UI rendering
6. Update documentation if needed
7. Commit and push

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- User Story 1 is the only story for this feature (simple enhancement)
- No new test files needed - existing E2E tests provide coverage
- Single file modification makes this low-risk with easy rollback
- JSON escaping is critical - validate with test script before committing
- Non-blocking error handling must be preserved (FR-006 requirement)
- Commit after User Story 1 completion, then validate in Phase 4
- Feature can be fully validated with a single workflow run

## Functional Requirements Coverage

This task breakdown satisfies all functional requirements:

- **FR-001**: Script posts comment after PR creation (T008-T012 implement enhanced comment)
- **FR-002**: PR number included in clear format (T010 implements "**PR #${PR_NUMBER}**:")
- **FR-003**: Markdown link for navigation (T010 implements [View Pull Request](${PR_URL}))
- **FR-004**: Explicit "ready for review" language (T009, T011)
- **FR-005**: Handles missing PR number (uses existing extraction logic from line 108)
- **FR-006**: Non-blocking error handling (T014 validates preservation of || echo pattern)

## Success Criteria Validation

The following success criteria will be met:

- **SC-001**: 100% of successful PR creations post comment (validated by T016, T018, T020)
- **SC-002**: Developers identify PR ready status from comments (validated by T017, T020)
- **SC-003**: Comment renders correctly with clickable links (validated by T017, T020)
- **SC-004**: Ticket transitions to VERIFY even if comment fails (validated by T014)
