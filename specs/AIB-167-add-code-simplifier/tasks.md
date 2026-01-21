# Tasks: Add Code Simplifier and PR Code Review to Verify Workflow

**Input**: Design documents from `/specs/AIB-167-add-code-simplifier/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: No tests explicitly requested in the specification. Implementation is workflow-based (YAML + markdown commands).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new setup required - this feature extends existing infrastructure

*No setup tasks needed - the project structure, workflows, and Claude Code command patterns already exist.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Review existing patterns to ensure new commands follow established conventions

**⚠️ CRITICAL**: These tasks inform all user story implementation

- [x] T001 Review existing verify.yml workflow structure in .github/workflows/verify.yml ✅ DONE
- [x] T002 [P] Review existing Claude Code command patterns in .claude/commands/verify.md ✅ DONE
- [x] T003 [P] Review constitution.md structure in .specify/memory/constitution.md ✅ DONE

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Code Simplification Before Documentation (Priority: P1) 🎯 MVP

**Goal**: Automatically refine recently modified code for clarity, consistency, and maintainability before documentation synchronization

**Independent Test**: Implement a feature with verbose code, verify the verify workflow simplifies it before updating documentation. Delivers cleaner code merged to main.

### Implementation for User Story 1

- [x] T004 [US1] Create code simplifier command spec in .claude/commands/code-simplifier.md ✅ DONE
  - YAML frontmatter with command metadata (command: '/code-simplify', category: 'Code Quality')
  - Phase 1: Discovery (get modified files via `git diff --name-only main...HEAD`)
  - Phase 2: Analysis (identify simplification patterns: NESTED_TERNARY, REDUNDANT_ABSTRACTION, VERBOSE_CONDITIONAL, COMPLEX_EXPRESSION)
  - Phase 3: Implementation (apply changes via Edit tool)
  - Phase 4: Validation (run affected tests to verify functionality preserved)
  - Phase 5: Commit (if changes made)
  - Include constraints: MUST NOT change public API signatures, MUST preserve comments, focus only on modified files

- [x] T005 [US1] Add code simplifier step to verify.yml workflow in .github/workflows/verify.yml ✅ DONE
  - Add new step after test-fixes-commit (Phase 4) and before documentation-update (Phase 5)
  - Execute command: `claude --dangerously-skip-permissions "/code-simplify"`
  - Set timeout: 10m
  - Set continue_on_error: false (simplification failures should stop workflow)
  - Pass environment variables: FEATURE_BRANCH, TICKET_ID, GH_TOKEN

- [x] T006 [US1] Add simplification commit step to verify.yml workflow in .github/workflows/verify.yml ✅ DONE
  - Add step after code simplifier execution
  - Commit changes with message: `refactor(ticket-{TICKET_ID}): simplify code for clarity`
  - Only commit if changes exist (`git diff --staged --quiet` check)
  - Push to feature branch

**Checkpoint**: Code simplifier executes in verify workflow and commits simplifications before documentation sync

---

## Phase 4: User Story 2 - Automated PR Code Review (Priority: P1)

**Goal**: After a pull request is created, automatically review for bugs, CLAUDE.md compliance, and constitution compliance, posting findings as a PR comment

**Independent Test**: Create a PR with intentional violations (e.g., missing type annotation, any type usage), verify the code review posts a comment listing the issues.

### Implementation for User Story 2

- [x] T007 [US2] Create code review command spec in .claude/commands/code-review.md ✅ DONE
  - YAML frontmatter with command metadata (command: '/code-review', category: 'Code Quality')
  - Context loading section: Read CLAUDE.md (root + modified directories), constitution.md (.specify/memory/constitution.md)
  - Get PR diff via `gh pr diff ${PR_NUMBER}`
  - Get current Git SHA via `git rev-parse HEAD`
  - Define 5 parallel review agents (FR-008):
    1. CLAUDE_MD_COMPLIANCE agent (ES modules, function keyword, explicit return types)
    2. CONSTITUTION_COMPLIANCE agent (TypeScript strict, no `any` types, shadcn/ui, Prisma queries)
    3. BUG_DETECTION agent (null handling, promise errors, logic errors, race conditions)
    4. GIT_HISTORY_CONTEXT agent (regression risk, breaking changes)
    5. CODE_COMMENT_COMPLIANCE agent (JSDoc, TODO resolution, dead comments)
  - Confidence scoring: 0-100 per issue, filter threshold 80 (FR-009, FR-010)
  - Output formatting: Markdown table with file references using full Git SHA links (FR-011, FR-012)
  - GitHub CLI comment posting via `gh pr comment ${PR_NUMBER}` (FR-014)
  - Include constraints: MUST NOT run build/typecheck/tests (FR-013)

- [x] T008 [US2] Add code review step to verify.yml workflow in .github/workflows/verify.yml ✅ DONE
  - Add new step after PR creation (Phase 6)
  - Execute command: `claude --dangerously-skip-permissions "/code-review"`
  - Set timeout: 15m
  - Set continue_on_error: true (non-blocking per edge case spec)
  - Pass environment variables: FEATURE_BRANCH, PR_NUMBER, PR_URL, GH_TOKEN, GITHUB_REPOSITORY

**Checkpoint**: Code review executes after PR creation and posts formatted findings as PR comment

---

## Phase 5: User Story 3 - Constitution-Aware Confidence Scoring (Priority: P2)

**Goal**: Use both CLAUDE.md guidelines and constitution principles to determine issue confidence scores, ensuring comprehensive compliance checking

**Independent Test**: Create a PR with a constitution violation (e.g., `any` type usage), verify the review identifies it with appropriate confidence based on constitution rules.

### Implementation for User Story 3

*Note: This functionality is integrated into the code review command (T007). The tasks below ensure the scoring logic is properly implemented.*

- [x] T009 [US3] Enhance code-review.md confidence scoring section in .claude/commands/code-review.md ✅ DONE
  - Define confidence scoring factors from contract:
    - Explicit rule violation: +30 points
    - Pattern match: +20 points
    - Context suggests: +10 points
    - Uncertain but suspicious: +5 points
  - Map constitution rules to high-confidence checks:
    - TypeScript strict mode violations: base confidence 80+
    - `any` type usage without justification: base confidence 85+
    - shadcn/ui violations: base confidence 80+
    - Testing Trophy violations: base confidence 80+
  - Map CLAUDE.md guidelines to checks:
    - Coding style violations: base confidence 75-85
    - Pattern violations: base confidence 70-80
  - Ensure findings reference source (CLAUDE.md or Constitution) per spec requirement

- [x] T010 [US3] Add edge case handling to code-review.md in .claude/commands/code-review.md ✅ DONE
  - Handle missing constitution.md: proceed with CLAUDE.md only, log warning
  - Handle PR creation failure: skip code review step gracefully
  - Handle API timeout: log warning, continue workflow without review comment

**Checkpoint**: Code review correctly scores issues based on both CLAUDE.md and constitution with appropriate confidence levels

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [x] T011 Validate code simplifier command follows existing command patterns in .claude/commands/ ✅ DONE
- [x] T012 [P] Validate code review command follows existing command patterns in .claude/commands/ ✅ DONE
- [x] T013 Verify workflow step ordering matches spec requirements (simplifier before docs, review after PR) ✅ DONE
- [x] T014 Run quickstart.md validation to ensure implementation matches documented steps ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies - can start immediately
- **User Story 1 (Phase 3)**: Depends on T001, T002, T003 completion
- **User Story 2 (Phase 4)**: Depends on T001, T002, T003 completion (can run parallel to US1)
- **User Story 3 (Phase 5)**: Depends on T007 completion (enhances code review command)
- **Polish (Phase 6)**: Depends on US1, US2, US3 completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on US1
- **User Story 3 (P2)**: Depends on US2 (T007) - Enhances the code review command

### Within Each User Story

- Review existing patterns before creating new files
- Create command spec before adding workflow steps
- Workflow steps must reference the created commands

### Parallel Opportunities

- T002 and T003 can run in parallel (different files)
- T004 and T007 can run in parallel (different command specs)
- T005/T006 and T008 can run in parallel (different workflow modifications if not conflicting)
- T011 and T012 can run in parallel (validation of different commands)

---

## Parallel Example: Foundational Phase

```bash
# Launch foundational reviews in parallel:
Task: "Review existing Claude Code command patterns in .claude/commands/verify.md"
Task: "Review constitution.md structure in .specify/memory/constitution.md"
```

## Parallel Example: User Story 1 & 2 Commands

```bash
# Launch command creation in parallel (different files):
Task: "Create code simplifier command spec in .claude/commands/code-simplifier.md"
Task: "Create code review command spec in .claude/commands/code-review.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001, T002, T003)
2. Complete Phase 3: User Story 1 (T004, T005, T006)
3. **STOP and VALIDATE**: Code simplifier runs in verify workflow
4. Deploy/demo if ready - code is simplified before documentation sync

### Incremental Delivery

1. Complete Foundational → Pattern understanding ready
2. Add User Story 1 → Code simplifier working → MVP delivered
3. Add User Story 2 → PR code review working → Full P1 scope delivered
4. Add User Story 3 → Constitution-aware scoring → Complete feature

### Parallel Execution Strategy

ai-board can execute User Story 1 and User Story 2 in parallel:

1. Complete Foundational phase sequentially (T001, T002, T003)
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 1 (T004, T005, T006)
   - Parallel task 2: User Story 2 (T007, T008)
3. User Story 3 (T009, T010) after T007 completes
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database changes required - all workflow/command file changes
- Code simplifier is blocking (workflow stops on failure)
- Code review is non-blocking (workflow continues on failure)
- Both commands follow existing Claude Code command patterns in `.claude/commands/`
- Verify workflow modifications preserve existing step ordering
- Commit after each task or logical group
