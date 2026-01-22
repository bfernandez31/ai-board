# Tasks: /review Command for AI-Board Assistance

**Input**: Design documents from `/specs/AIB-178-review-command-from/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as required by III. Test-Driven principle in plan.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Extend existing code-review.md with `--force` flag support

- [x] T001 Modify `.claude/commands/code-review.md` to add `--force` flag support: when `--force` is provided in arguments, skip step 1d (previous review check) and proceed with review regardless of existing reviews

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Workflow routing infrastructure that MUST be complete before user stories can be validated

**⚠️ CRITICAL**: User story testing depends on this phase being complete

- [x] T002 Add `/review` command routing in `.github/workflows/ai-board-assist.yml` after the `/compare` routing block (around line 222), including stage validation (`$STAGE != "verify"` error), PR lookup with `gh pr list --head "$BRANCH" --json number --jq '.[0].number'`, and Claude invocation with `/code-review $PR_NUMBER --force`
- [x] T003 [P] Add `/review` entry to `AI_BOARD_COMMANDS` array in `app/lib/data/ai-board-commands.ts` with name `/review` and description "Request code review for the current PR"

**Checkpoint**: Foundation ready - command routing, autocomplete, and `--force` flag in code-review.md all in place

---

## Phase 3: User Story 1 - Request Code Review via Comment (Priority: P1) 🎯 MVP

**Goal**: User in VERIFY stage can request code review by posting `@ai-board /review` - system finds PR and executes code review

**Independent Test**: Post `@ai-board /review` on a VERIFY stage ticket with existing PR, verify code review executes and summary posts to ticket

### Tests for User Story 1

- [x] T004 [P] [US1] Add unit test in `tests/unit/ai-board-commands.test.ts` to verify `/review` appears in command list and `filterCommands('review')` returns the command
- [x] T005 [P] [US1] Add integration test in `tests/integration/commands/review-command.test.ts` to verify `/review` command routing detects the pattern and routes correctly

### Implementation for User Story 1

- [x] T006 [US1] Verify `/code-review` skill with `--force` flag correctly performs review and posts summary comment mentioning requesting user (acceptance criteria 1-3 from spec.md)

**Checkpoint**: User Story 1 complete - users can request code reviews via ticket comments in VERIFY stage

---

## Phase 4: User Story 2 - Re-Review After Previous Review (Priority: P2)

**Goal**: User can request `/review` on a PR that already has a code review, and a new review is generated

**Independent Test**: Request `/review` on a PR with existing code review comment, verify new review is generated

### Tests for User Story 2

- [x] T007 [US2] Add integration test in `tests/integration/commands/review-command.test.ts` to verify `--force` flag behavior - ensure code-review.md handles the flag correctly

### Implementation for User Story 2

- [x] T008 [US2] Verify `.claude/commands/code-review.md` correctly handles `--force` flag to skip step 1d (previous review check) per research.md decision and FR-004

**Checkpoint**: User Story 2 complete - re-reviews work correctly regardless of previous reviews

---

## Phase 5: User Story 3 - Error Handling for Missing PR (Priority: P3)

**Goal**: User receives clear error messages when `/review` cannot execute (wrong stage, no PR)

**Independent Test**: Post `@ai-board /review` on SPECIFY stage ticket or VERIFY ticket without PR, verify error message

### Tests for User Story 3

- [x] T009 [P] [US3] Add integration test in `tests/integration/commands/review-command.test.ts` for error when stage is not VERIFY
- [x] T010 [P] [US3] Add integration test in `tests/integration/commands/review-command.test.ts` for error when no PR exists for branch

### Implementation for User Story 3

- [x] T011 [US3] Verify `.github/workflows/ai-board-assist.yml` returns correct error message for wrong stage per contracts/review-command.md error responses
- [x] T012 [US3] Verify `.github/workflows/ai-board-assist.yml` returns correct error message when no PR found per contracts/review-command.md error responses

**Checkpoint**: User Story 3 complete - all error cases handled with user-friendly messages

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T013 Run `bun run type-check` to verify no TypeScript errors
- [x] T014 Run `bun run lint` to verify no linting errors
- [x] T015 Run `bun run test:unit` to verify all unit tests pass
- [x] T016 Run `bun run test:integration` to verify all integration tests pass
- [x] T017 Validate quickstart.md checklist items are complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - modifies code-review.md with `--force` flag first
- **Foundational (Phase 2)**: Depends on Setup - adds workflow routing and autocomplete
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core review functionality
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Re-review behavior (validates instruction in command spec)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Error handling (validates workflow routing)

### Within Each User Story

- Tests MUST be written and verified before implementation validation
- Implementation validation confirms existing code meets acceptance criteria

### Parallel Opportunities

- T002 and T003 can run in parallel (different files)
- T004 and T005 can run in parallel (different test files)
- T009 and T010 can run in parallel (same file but independent test cases)
- User Stories 2 and 3 can start in parallel after User Story 1

---

## Parallel Example: Foundational Phase

```bash
# Launch in parallel:
Task: "Add /review command routing in .github/workflows/ai-board-assist.yml"
Task: "Add /review entry to AI_BOARD_COMMANDS in app/lib/data/ai-board-commands.ts"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch in parallel:
Task: "Unit test for /review in command list"
Task: "Integration test for /review command routing"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (add `--force` flag to code-review.md)
2. Complete Phase 2: Foundational (workflow routing + autocomplete)
3. Complete Phase 3: User Story 1 (core review via comment)
4. **STOP and VALIDATE**: Test `/review` command on VERIFY stage ticket with PR
5. Deploy if ready - MVP delivers core functionality

### Incremental Delivery

1. Complete Setup + Foundational → Command routing ready
2. Add User Story 1 → Test independently → Deploy (MVP!)
3. Add User Story 2 → Test re-review → Deploy
4. Add User Story 3 → Test error handling → Deploy
5. Each story adds robustness without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (where applicable)
- Commit after each task or logical group
- This feature has minimal complexity - reuses existing `/code-review` skill
- No database schema changes required (per data-model.md)
- Output limit: 1500 characters (buffer from 2000 DB limit per research.md)
