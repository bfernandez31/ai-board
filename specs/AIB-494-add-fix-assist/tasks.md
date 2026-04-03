# Tasks: Add /fix Assist Command

**Input**: Design documents from `/specs/AIB-494-add-fix-assist/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/fix-command.md

**Tests**: Included per plan.md testing strategy (unit + integration tests specified).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish command skeleton and workflow integration points

- [x] T001 [P] Create /fix command file skeleton with frontmatter, env var documentation, and output rules in .claude-plugin/commands/ai-board.fix.md (reference pattern from .claude-plugin/commands/ai-board.assist.md and .claude-plugin/commands/ai-board.code-review.md)
- [x] T002 [P] Register /fix in autocomplete by adding entry `{ name: '/fix', description: 'Fix PR review findings from code review' }` to AI_BOARD_COMMANDS array in app/lib/data/ai-board-commands.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Workflow routing and argument parsing — MUST be complete before any user story behavior works

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add /fix command routing elif block in .github/workflows/ai-board-assist.yml (after /review block, before else fallback): detect `/fix\b` in $COMMENT, validate VERIFY stage, lookup PR via `gh pr list --head "$BRANCH"`, extract args, invoke `run-agent.sh "CLAUDE" "ai-board.fix" "$PR_NUMBER $ARGS"`
- [x] T004 Add argument parsing section to .claude-plugin/commands/ai-board.fix.md: parse $ARGUMENTS to extract PR number (first arg) and optional finding numbers or "all" keyword; document three invocation forms (no args, specific numbers, "all")

**Checkpoint**: /fix command is routable and receives parsed arguments — story implementation can begin

---

## Phase 3: User Story 1 — Fix All Review Findings (Priority: P1) MVP

**Goal**: Parse PR review comments from all three sources, deduplicate, filter for pertinence, apply fixes, validate, commit, and push — delivering the core automated review remediation loop.

**Independent Test**: Trigger `@ai-board /fix` on a ticket with a PR that has review comments from at least one source; verify pertinent findings are fixed in a single commit pushed to the PR branch with a summary comment posted.

### Implementation for User Story 1

- [x] T005 [US1] Add review source fetching section to .claude-plugin/commands/ai-board.fix.md: fetch PR issue comments via `gh api repos/{owner}/{repo}/issues/{pr}/comments` for ai-board reviews (filter by `### Code review` header), and PR review comments via `gh api repos/{owner}/{repo}/pulls/{pr}/comments` for Codex (filter by `chatgpt-codex-connector[bot]`) and Copilot (filter by `Copilot` author)
- [x] T006 [US1] Add ai-board custom review parsing section to .claude-plugin/commands/ai-board.fix.md: parse numbered findings with regex `/^(\d+)\.\s+(.+)$/`, extract file paths and line ranges from GitHub permalink URLs `/blob\/[a-f0-9]+\/(.+)#L(\d+)(?:-L(\d+))?/`, map to ReviewFinding structure per data-model.md
- [x] T007 [US1] Add Codex and Copilot parsing section to .claude-plugin/commands/ai-board.fix.md: extract findings from inline review comments using `path`, `line`/`original_line` fields from API response; detect P1/P2 priority badges for Codex; map to ReviewFinding structure
- [x] T008 [US1] Add deduplication section to .claude-plugin/commands/ai-board.fix.md: deduplicate findings by (file_path, line_range_overlap) tuple with priority order ai-board > Codex > Copilot; when overlapping line ranges found, keep highest-priority source and mark lower-priority as rejected with reason "duplicate of #N"
- [x] T009 [US1] Add pertinence filtering section to .claude-plugin/commands/ai-board.fix.md: evaluate each Codex/Copilot finding against project context (constitution + CLAUDE.md); reject findings matching categories: documentation nitpicks, issues already caught by TypeScript/ESLint, overengineering suggestions, false positives; ai-board findings skip this filter (always pertinent); record rejection reasons per FindingResolution structure
- [x] T010 [US1] Add fix application section to .claude-plugin/commands/ai-board.fix.md: for each pertinent finding, apply minimal targeted code fix respecting project patterns; process findings sequentially; if a later fix conflicts with an already-applied fix, mark as "conflict with higher-priority fix" and skip
- [x] T011 [US1] Add post-fix validation section to .claude-plugin/commands/ai-board.fix.md: run `bun run type-check && bun run lint` after all fixes; if errors introduced, attempt to resolve them; if unresolvable, report failure and do not commit
- [x] T012 [US1] Add commit and push section to .claude-plugin/commands/ai-board.fix.md: create single commit with message `fix(review): address N review findings`, push to PR branch; skip commit if no fixes were applied
- [x] T013 [US1] Add result file and summary comment section to .claude-plugin/commands/ai-board.fix.md: write `specs/$BRANCH/.ai-board-result.md` with SUCCESS/ERROR status, files modified list, and summary; format summary comment as `@[$USER_ID:$USER] fix **Review Fixes Applied**` with counts (N fixed, M specs updated, K rejected) and per-finding detail; enforce <1500 char limit

**Checkpoint**: At this point, `@ai-board /fix` (no args) should work end-to-end — parse all reviews, deduplicate, filter, fix, validate, commit, push, and report.

---

## Phase 4: User Story 2 — Fix Specific Findings by Number (Priority: P2)

**Goal**: Enable selective fixing of specific ai-board review finding numbers via `@ai-board /fix 1 3` syntax.

**Independent Test**: Trigger `@ai-board /fix 1 3` on a ticket with 3+ ai-board findings; verify only findings #1 and #3 are addressed while #2 is untouched and reported as skipped.

### Implementation for User Story 2

- [x] T014 [US2] Add selective filtering logic to .claude-plugin/commands/ai-board.fix.md: when finding numbers are specified in arguments, mark findings not in the requested set as `skipped`; when "all" keyword is used, treat as no-args (fix all); when specified finding numbers don't exist, report as `not_found` in summary
- [x] T015 [US2] Update summary comment format in .claude-plugin/commands/ai-board.fix.md to include skipped findings section and not-found finding IDs when selective mode is used

**Checkpoint**: `@ai-board /fix 1 3` and `@ai-board /fix all` should work correctly alongside the base `/fix` command.

---

## Phase 5: User Story 3 — Fix Findings with Spec Updates (Priority: P2)

**Goal**: Detect when a code fix creates a contradiction with documented specs and update both code and spec in the same commit.

**Independent Test**: Create a PR with a review finding that contradicts a spec (e.g., wrong error code); trigger `/fix`; verify both the code file and relevant spec file in `specs/specifications/` are updated in the commit.

### Implementation for User Story 3

- [x] T016 [US3] Add spec contradiction detection section to .claude-plugin/commands/ai-board.fix.md: after each code fix, check if the changed code involves a route/feature documented in `specs/specifications/`; detect direct contradictions (field names, error codes, response shapes) between the fix and the documented contract
- [x] T017 [US3] Add spec update logic to .claude-plugin/commands/ai-board.fix.md: when a contradiction is detected, update the relevant spec file to match the fix; include spec files in the commit's modified files list; update summary comment to report "M specs updated" count
- [x] T018 [US3] Update result file section in .claude-plugin/commands/ai-board.fix.md to include updated spec file paths in the Files Modified list

**Checkpoint**: Fixes that contradict specs now update both code and spec files atomically.

---

## Phase 6: User Story 4 — Error Handling for Missing PR or Reviews (Priority: P3)

**Goal**: Provide clear error messages when `/fix` is triggered on tickets without PRs or without review comments.

**Independent Test**: Trigger `/fix` on a ticket without a PR; verify error comment is posted. Trigger on a ticket with PR but no reviews; verify suggestion to run `/review` first.

### Implementation for User Story 4

- [x] T019 [US4] Add error handling section to .claude-plugin/commands/ai-board.fix.md: handle no-PR case (error already caught in workflow routing — add result file with ERROR status); handle PR-exists-but-no-reviews case (post error suggesting `/review` first); handle all-findings-rejected case (no commit, summary lists all rejections with reasons)
- [x] T020 [US4] Add type-check/lint failure error path to .claude-plugin/commands/ai-board.fix.md: when post-fix validation fails and cannot be resolved, write ERROR result file with message "Fix introduced errors that could not be resolved" and list the specific failures

**Checkpoint**: All error paths produce clear, actionable error messages.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tests, validation, and final quality assurance

### Unit Tests

- [x] T021 [P] Write unit test for finding number argument parsing (no args, specific numbers, "all" keyword, invalid input) in tests/unit/fix-command-parsing.test.ts
- [x] T022 [P] Write unit test for deduplication logic (same file + overlapping lines across sources, priority ordering) in tests/unit/fix-command-dedup.test.ts
- [x] T023 [P] Write unit test for pertinence filtering rules (documentation nitpick rejection, overengineering rejection, false positive rejection, valid finding acceptance) in tests/unit/fix-command-pertinence.test.ts

### Integration Tests

- [x] T024 [P] Write integration test for /fix workflow routing: verify command is recognized, stage validation rejects non-VERIFY stages, and PR lookup works in tests/integration/assist/fix-routing.test.ts
- [x] T025 [P] Write integration test for /fix review parsing: verify ai-board, Codex, and Copilot comment formats are parsed correctly into ReviewFinding structures in tests/integration/assist/fix-parsing.test.ts

### Validation

- [x] T026 Run `bun run type-check` to verify no type errors introduced
- [x] T027 Run `bun run lint` to verify no lint errors introduced
- [x] T028 Run quickstart.md verification checklist: confirm command file exists, workflow routes correctly, autocomplete registered, all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (command file skeleton) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion — core fix loop
- **User Story 2 (Phase 4)**: Depends on T004 (argument parsing) + T013 (summary format) — extends core with selective mode
- **User Story 3 (Phase 5)**: Depends on T010 (fix application) — adds spec detection after fixes
- **User Story 4 (Phase 6)**: Depends on T001 (command file) + T003 (workflow routing) — error paths independent of fix logic
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only — no dependencies on other stories
- **User Story 2 (P2)**: Builds on US1 argument parsing and summary format
- **User Story 3 (P2)**: Builds on US1 fix application section — can run parallel with US2
- **User Story 4 (P3)**: Mostly independent — can run parallel with US2/US3 after foundational

### Within Each User Story

- Each task adds a section to the command file or modifies workflow/autocomplete
- Tasks within a story are sequential (each builds on previous sections)
- Cross-story tasks on different files (tests, workflow, autocomplete) can parallelize

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel (different files)
- T014-T015 (US2) and T016-T018 (US3) can run in parallel (different command file sections)
- T019-T020 (US4) can run parallel with US2/US3 (different sections)
- T021, T022, T023, T024, T025 (all tests) can run in parallel (different test files)
- T026, T027 (validation) can run in parallel

---

## Parallel Example: Setup Phase

```bash
# Launch both setup tasks together:
Task T001: "Create /fix command file skeleton in .claude-plugin/commands/ai-board.fix.md"
Task T002: "Register /fix in autocomplete in app/lib/data/ai-board-commands.ts"
```

## Parallel Example: Test Phase

```bash
# Launch all test tasks together:
Task T021: "Unit test for argument parsing in tests/unit/fix-command-parsing.test.ts"
Task T022: "Unit test for deduplication in tests/unit/fix-command-dedup.test.ts"
Task T023: "Unit test for pertinence filtering in tests/unit/fix-command-pertinence.test.ts"
Task T024: "Integration test for routing in tests/integration/assist/fix-routing.test.ts"
Task T025: "Integration test for parsing in tests/integration/assist/fix-parsing.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004)
3. Complete Phase 3: User Story 1 (T005-T013)
4. **STOP and VALIDATE**: Test `/fix` end-to-end on a ticket with review comments
5. Deploy if ready — core value is delivered

### Incremental Delivery

1. Setup + Foundational -> Command is routable
2. Add User Story 1 -> Core fix loop works (MVP!)
3. Add User Story 2 -> Selective fixing works
4. Add User Story 3 -> Spec consistency maintained
5. Add User Story 4 -> Error handling complete
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - **Sequential (recommended)**: US1 first (MVP), then US2+US3 in parallel, then US4
   - **Parallel**: US1 is prerequisite; US2, US3, US4 can then run in parallel
3. Tests can all run in parallel after all stories are complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The command file (.claude-plugin/commands/ai-board.fix.md) is the primary deliverable — it's a Claude agent instruction file, not compiled code
- No database schema changes needed — uses existing Job model with `command: "fix"`
- No UI components needed — workflow-only feature
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
