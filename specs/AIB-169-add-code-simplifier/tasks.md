# Tasks: Add Code Simplifier and PR Review to Verify Workflow

**Input**: Design documents from `/specs/AIB-169-add-code-simplifier/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in specification. Integration tests mentioned for workflow verification but no TDD approach mandated.

**Organization**: Tasks grouped by user story to enable independent implementation. US1 and US2 are both P1 priority but can be implemented sequentially since US2 depends on workflow modifications from US1.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup required - this feature adds to existing infrastructure

This feature extends the existing verify workflow and follows established command file patterns. No new project initialization or infrastructure setup is needed.

**Checkpoint**: N/A - proceed directly to Foundational phase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Understand existing workflow structure and command patterns

**⚠️ CRITICAL**: Must understand current workflow structure before making modifications

- [x] T001 Read existing verify workflow to understand integration points in .github/workflows/verify.yml
- [x] T002 [P] Read existing command patterns from .claude/commands/cleanup.md for code-simplifier reference
- [x] T003 [P] Read existing command patterns from .claude/commands/verify.md for code-review reference
- [x] T004 [P] Read constitution file structure at .specify/memory/constitution.md for review criteria integration

**Checkpoint**: Foundation ready - existing patterns understood, command file integration points identified

---

## Phase 3: User Story 1 - Code Simplification Before Documentation (Priority: P1) 🎯 MVP

**Goal**: Automatically simplify recently modified code after test fixes and before documentation update

**Independent Test**: Run verify workflow on a branch with modified code and verify simplification step executes, makes improvements (if applicable), and commits changes before documentation sync

### Implementation for User Story 1

- [x] T005 [US1] Create code-simplifier command file with YAML frontmatter in .claude/commands/code-simplifier.md
- [x] T006 [US1] Add Context Discovery section to code-simplifier command (CLAUDE.md auto-load, constitution read, git diff for changed files)
- [x] T007 [US1] Add Phase 1: Identify Targets section (list changed TypeScript files excluding tests)
- [x] T008 [US1] Add Phase 2: Analyze & Simplify section (patterns: nested ternaries, redundant abstractions, complex booleans, callback nesting, indirection)
- [x] T009 [US1] Add Phase 3: Commit section (commit message format: refactor(ticket-{id}): simplify code)
- [x] T010 [US1] Add Safety Rules section (preserve functionality, run impacted tests, revert on failure)
- [x] T011 [US1] Add Execute /code-simplifier step to verify.yml after "Commit Test Fixes" step (around line 370)
- [x] T012 [US1] Add Commit Simplification Changes step to verify.yml after code-simplifier execution

**Checkpoint**: User Story 1 complete - code simplifier runs in workflow, simplifies code, commits changes

---

## Phase 4: User Story 2 - PR Code Review After Creation (Priority: P1)

**Goal**: Automatically review PR changes against CLAUDE.md and constitution guidelines after PR is created

**Independent Test**: Create a PR through verify workflow and verify code review comment is posted to PR with findings or confirmation of no issues

### Implementation for User Story 2

- [x] T013 [US2] Create code-review command file with YAML frontmatter in .claude/commands/code-review.md
- [x] T014 [US2] Add Context Discovery section to code-review command (CLAUDE.md auto-load, constitution read, gh pr diff for changes)
- [x] T015 [US2] Add Phase 1: Gather Context section (read changed files, load constitution, understand criteria)
- [x] T016 [US2] Add Phase 2: Review section (check against CLAUDE.md conventions, check against constitution principles, assign confidence scores 0-100)
- [x] T017 [US2] Add Phase 3: Report section (filter to confidence ≥80, post comment via gh pr comment)
- [x] T018 [US2] Add Scoring section with confidence thresholds table (90-100 Critical, 80-89 High, <80 Do not report)
- [x] T019 [US2] Add Execute /code-review step to verify.yml after "Create Pull Request" step with PR_URL conditional

**Checkpoint**: User Story 2 complete - code review runs after PR creation, posts review comment to PR

---

## Phase 5: User Story 3 - Constitution-Aware Review Criteria (Priority: P2)

**Goal**: Code review reads constitution file to establish project-specific review criteria

**Independent Test**: Verify review command loads constitution file and uses its principles when evaluating code compliance; verify graceful fallback when constitution is missing

### Implementation for User Story 3

- [x] T020 [US3] Enhance code-review command constitution loading with graceful fallback if file missing in .claude/commands/code-review.md
- [x] T021 [US3] Add constitution compliance section to review report format (principle, status, notes)
- [x] T022 [US3] Add CLAUDE.md alignment section to review report format (convention, status)
- [x] T023 [US3] Add comment structure template matching research.md specification (Issues Found, Constitution Compliance, CLAUDE.md Alignment sections)

**Checkpoint**: User Story 3 complete - code review uses constitution principles, provides structured compliance report

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T024 Validate code-simplifier command follows existing command patterns (compare with cleanup.md)
- [x] T025 Validate code-review command follows existing command patterns (compare with verify.md)
- [x] T026 Verify workflow step conditions are correct (success conditions, SKIP_EXECUTION checks, PR_URL availability)
- [x] T027 Run quickstart.md validation - verify implementation matches guide

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - no setup required
- **Foundational (Phase 2)**: No dependencies - understand existing patterns first
- **User Story 1 (Phase 3)**: Depends on Foundational - must understand workflow before modifying
- **User Story 2 (Phase 4)**: Depends on Foundational - can run in parallel with US1 since different files
- **User Story 3 (Phase 5)**: Depends on US2 completion - enhances the code-review command created in US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Creates code-simplifier.md and modifies verify.yml
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Creates code-review.md and modifies verify.yml (different section)
- **User Story 3 (P2)**: Depends on US2 completion - Enhances code-review.md with constitution awareness

### Within Each User Story

- Command file creation before workflow integration
- Core functionality before safety rules
- Workflow step addition after command is complete
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003, T004 can run in parallel (reading different reference files)
- US1 (T005-T012) and US2 (T013-T019) can run in parallel since they create different files
- T024, T025 can run in parallel (validating different command files)

---

## Parallel Example: Foundational Phase

```bash
# Launch all reference reads together:
Task: "Read existing command patterns from .claude/commands/cleanup.md"
Task: "Read existing command patterns from .claude/commands/verify.md"
Task: "Read constitution file structure at .specify/memory/constitution.md"
```

## Parallel Example: User Stories 1 & 2

```bash
# US1 and US2 can run in parallel since they create different files:
# US1: Creates .claude/commands/code-simplifier.md
# US2: Creates .claude/commands/code-review.md
# Both modify verify.yml but at different locations (non-conflicting)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (understand existing patterns)
2. Complete Phase 3: User Story 1 (code simplifier)
3. **STOP and VALIDATE**: Test code simplifier runs in verify workflow
4. Proceed to User Story 2

### Incremental Delivery

1. Complete Foundational → Patterns understood
2. Add User Story 1 → Test code simplifier → Workflow improved (MVP!)
3. Add User Story 2 → Test code review → PR review automated
4. Add User Story 3 → Test constitution awareness → Review quality enhanced
5. Each story adds value without breaking previous functionality

### Recommended Execution Order

1. T001-T004 (Foundational - parallel where marked)
2. T005-T012 (US1 - Code Simplifier) in parallel with T013-T019 (US2 - Code Review)
3. T020-T023 (US3 - Constitution Awareness) - after US2
4. T024-T027 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
