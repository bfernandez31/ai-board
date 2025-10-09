# Tasks: GitHub Actions Spec-Kit Workflow

**Input**: Design documents from `/specs/016-create-github-actions/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/workflow-schema.yml

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: YAML (GitHub Actions Workflow Syntax 2.0), Shell (Bash 5.x)
   → Libraries: Node.js 22.20.0, Claude Code CLI, Python 3.11, Git 2.x
   → Structure: .github/workflows/ (workflow file), no application code
2. Load optional design documents:
   → data-model.md: Workflow input/output schemas (not database entities)
   → contracts/workflow-schema.yml: Workflow contract specification
   → research.md: GitHub Actions best practices, CLI installation, git config
   → quickstart.md: 9 test scenarios (5 success, 4 error cases)
3. Generate tasks by category:
   → Setup: Workflow file structure, directory creation
   → Tests: Manual test procedures (workflow testing via dispatch)
   → Core: Workflow inputs, environment setup, command execution, git ops
   → Integration: All steps integrated in single workflow file
   → Polish: Documentation, validation procedures
4. Apply task rules:
   → Different workflow sections = mark [P] for conceptual parallel (single file)
   → Same file = all sequential (workflow is single .github/workflows/speckit.yml)
   → Test procedures before implementation (TDD approach)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples (N/A - single workflow file)
8. Validate task completeness:
   → All contracts tested via manual dispatch ✓
   → All 5 commands implemented ✓
   → All test scenarios from quickstart.md covered ✓
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **Note**: This feature creates a single workflow file, so most tasks are sequential
- Include exact file paths in descriptions

## Path Conventions
- **Workflow file**: `.github/workflows/speckit.yml` at repository root
- **Test procedures**: Manual execution via GitHub Actions UI (documented in quickstart.md)
- No application code (src/, components/, etc.) - infrastructure only

---

## Phase 3.1: Setup

- [X] **T001** Create `.github/workflows/` directory if it doesn't exist
  - Path: `.github/workflows/`
  - Command: `mkdir -p .github/workflows`

- [X] **T002** Create empty workflow file `.github/workflows/speckit.yml`
  - Path: `.github/workflows/speckit.yml`
  - Initial content: YAML skeleton with name and workflow_dispatch trigger

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: Manual test procedures MUST be documented and workflow MUST FAIL initial tests before implementation**

- [X] **T003** Document Test 1: Specify command test procedure
  - Reference: quickstart.md lines 28-63
  - Verify: Workflow exists, inputs defined, expected to fail (no implementation)

- [X] **T004** Document Test 2: Plan command test procedure
  - Reference: quickstart.md lines 67-102
  - Prerequisites: Test 1 branch exists
  - Expected: Workflow fails (command not implemented)

- [X] **T005** Document Test 3: Task command test procedure
  - Reference: quickstart.md lines 104-122
  - Prerequisites: Test 2 planning artifacts exist
  - Expected: Workflow fails (command not implemented)

- [X] **T006** Document Test 4: Implement command test procedure
  - Reference: quickstart.md lines 124-145
  - Prerequisites: Test 3 tasks.md exists
  - Expected: Workflow fails (command not implemented)

- [X] **T007** Document Test 5: Clarify command test procedure
  - Reference: quickstart.md lines 147-177
  - Prerequisites: Specification with clarification needs
  - Expected: Workflow fails (command not implemented)

- [X] **T008** Document Test 6: Missing branch error test
  - Reference: quickstart.md lines 183-195
  - Expected: Error handling not yet implemented

- [X] **T009** Document Test 7: Invalid API key error test
  - Reference: quickstart.md lines 197-213
  - Expected: Error handling not yet implemented

- [X] **T010** Document Test 8: No changes scenario test
  - Reference: quickstart.md lines 215-235
  - Expected: Git logic not yet implemented

- [X] **T011** Document Test 9: Git push conflict error test
  - Reference: quickstart.md lines 237-252
  - Expected: Error handling not yet implemented

---

## Phase 3.3: Core Implementation (ONLY after test procedures documented)

### Workflow Structure (FR-001 to FR-005)

- [ ] **T012** Add workflow_dispatch trigger with no automatic execution
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-001 (manual workflow_dispatch only)
  - Implementation: `on: workflow_dispatch:` with inputs section

- [ ] **T013** Define ticket_id input (string, required)
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-002 (first input parameter)
  - Validation: Pattern `^[a-zA-Z0-9-]+$`, max length 50

- [ ] **T014** Define ticketTitle input (string, required)
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-002 (second input parameter)
  - Validation: Min 1, max 200 characters

- [ ] **T015** Define ticketDescription input (string, required)
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-002 (third input parameter)
  - Validation: Min 1, max 5000 characters

- [ ] **T016** Define branch input (string, optional)
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-002 (fourth input parameter)
  - Default: empty string, used conditionally

- [ ] **T017** Define command input (choice, required)
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-002 (fifth input parameter)
  - Options: specify, plan, task, implement, clarify

- [ ] **T018** Define answers_json input (string, optional)
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-003 (clarify command answers)
  - Default: `{}`

- [ ] **T019** Configure job to run on ubuntu-latest with 120-minute timeout
  - File: `.github/workflows/speckit.yml`
  - Requirements: FR-004 (runner), FR-005 (timeout)
  - Config: `runs-on: ubuntu-latest`, `timeout-minutes: 120`

### Environment Setup (FR-006 to FR-011)

- [ ] **T020** Add checkout step with full git history
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-006 (checkout on branch with fetch-depth 0)
  - Action: `actions/checkout@v4` with `ref: ${{ inputs.branch || github.ref }}`, `fetch-depth: 0`

- [ ] **T021** Add Node.js 22.20.0 setup step
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-007 (Node.js via actions/setup-node@v4)
  - Config: `node-version: '22.20.0'`

- [ ] **T022** Add Python 3.11 setup step
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-008 (Python via actions/setup-python@v5)
  - Config: `python-version: '3.11'`

- [ ] **T023** Add Claude Code CLI installation step
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-009 (install Claude CLI globally)
  - Command: `npm install -g @anthropic-ai/claude-code`

- [ ] **T024** Add git user configuration step
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-010 (configure git user as ai-board[bot])
  - Commands: `git config --global user.name "ai-board[bot]"`, `git config --global user.email "bot@ai-board.app"`

- [ ] **T025** Add ANTHROPIC_API_KEY environment variable
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-011 (authenticate Claude CLI)
  - Config: `env: ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`

### Command Execution (FR-012 to FR-017)

- [ ] **T026** Implement specify command execution
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-012 (execute claude /specify with ticket details)
  - Command: `claude /specify "Ticket ${{ inputs.ticket_id }}: ${{ inputs.ticketTitle }}\n\n${{ inputs.ticketDescription }}"`

- [ ] **T027** Implement plan command execution
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-013 (execute claude /plan)
  - Command: `claude /plan`

- [ ] **T028** Implement task command execution
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-014 (execute claude /task)
  - Command: `claude /task`

- [ ] **T029** Implement implement command execution
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-015 (execute claude /implement)
  - Command: `claude /implement`

- [ ] **T030** Implement clarify command execution
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-016 (write answers_json to file, execute claude /clarify)
  - Commands: `echo '${{ inputs.answers_json }}' > clarifications.json`, `claude /clarify --answers clarifications.json`

- [ ] **T031** Add case statement for command routing with error handling
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-017 (exit with error for unknown commands)
  - Logic: Bash case statement matching inputs.command, default case exits with code 1

### Git Operations (FR-018 to FR-022)

- [ ] **T032** Add git staging step
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-018 (stage all changes with git add .)
  - Command: `git add .`

- [ ] **T033** Add conditional commit step (skip if no changes)
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-019 (skip commit when no staged changes)
  - Command: `git diff --staged --quiet || git commit -m "..."`

- [ ] **T034** Implement commit message format
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-020 (conventional commit format)
  - Message: `feat(ticket-${{ inputs.ticket_id }}): ${{ inputs.command }} - automated spec-kit execution`

- [ ] **T035** Add git push step with GITHUB_TOKEN
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-021 (push to origin branch using GITHUB_TOKEN)
  - Command: `git push origin ${{ inputs.branch }}`

- [ ] **T036** Verify commit author is ai-board[bot]
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-022 (ai-board[bot] as commit author)
  - Validation: Check git config from T024 is applied before commit

### Status Reporting (FR-023 to FR-025)

- [ ] **T037** Add success message step
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-023 (success message with ✅ indicator, ticket ID, branch)
  - Command: `echo "✅ Spec-kit command '${{ inputs.command }}' completed successfully"`, `echo "📍 Branch: ${{ inputs.branch }}"`, `echo "🎫 Ticket: ${{ inputs.ticket_id }}"`

- [ ] **T038** Add failure message step with exit code 1
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-024 (error message with ❌ indicator, exit code 1)
  - Command: `echo "❌ Spec-kit command '${{ inputs.command }}' failed"`, `echo "📋 Check logs above for error details"`, `exit 1`

- [ ] **T039** Verify workflow logs visible in GitHub Actions tab
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-025 (workflow execution logs visible)
  - Validation: Run test workflow and check Actions tab for logs

### Security & Secrets (FR-026 to FR-028)

- [ ] **T040** Verify ANTHROPIC_API_KEY secret usage
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-026 (use ANTHROPIC_API_KEY for Claude API)
  - Validation: Check env section references `${{ secrets.ANTHROPIC_API_KEY }}`

- [ ] **T041** Verify GITHUB_TOKEN secret usage for git operations
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-027 (use GITHUB_TOKEN for git push)
  - Validation: Default GITHUB_TOKEN automatically available, used by git push

- [ ] **T042** Ensure secrets not exposed in logs
  - File: `.github/workflows/speckit.yml`
  - Requirement: FR-028 (secrets not exposed in logs/outputs)
  - Validation: GitHub Actions automatically masks secret values, verify no explicit echo of secrets

---

## Phase 3.4: Integration

**Note**: All integration happens within single workflow file - no separate integration tasks needed

- [ ] **T043** Test complete workflow integration for specify command
  - Path: GitHub Actions UI → Run workflow
  - Reference: Test 1 from quickstart.md
  - Validation: Branch created, spec.md generated, commit with ai-board[bot] author

- [ ] **T044** Test complete workflow integration for plan command
  - Path: GitHub Actions UI → Run workflow
  - Reference: Test 2 from quickstart.md
  - Validation: plan.md, research.md, data-model.md generated

- [ ] **T045** Test complete workflow integration for task command
  - Path: GitHub Actions UI → Run workflow
  - Reference: Test 3 from quickstart.md
  - Validation: tasks.md generated

- [ ] **T046** Test complete workflow integration for implement command
  - Path: GitHub Actions UI → Run workflow
  - Reference: Test 4 from quickstart.md
  - Validation: Implementation files created

- [ ] **T047** Test complete workflow integration for clarify command
  - Path: GitHub Actions UI → Run workflow
  - Reference: Test 5 from quickstart.md
  - Validation: clarifications.json created, spec.md updated

---

## Phase 3.5: Polish

- [ ] **T048** Test error scenario: missing branch for non-specify command
  - Path: GitHub Actions UI → Run workflow
  - Reference: Test 6 from quickstart.md
  - Expected: Workflow fails with clear error message

- [ ] **T049** Test error scenario: invalid/missing ANTHROPIC_API_KEY
  - Path: GitHub Actions UI → Run workflow (with secret removed)
  - Reference: Test 7 from quickstart.md
  - Expected: Authentication error, secret not exposed in logs

- [ ] **T050** Test error scenario: no changes to commit
  - Path: GitHub Actions UI → Run workflow (duplicate execution)
  - Reference: Test 8 from quickstart.md
  - Expected: Success with "No changes to commit" message, no empty commit

- [ ] **T051** Test error scenario: git push conflict
  - Path: GitHub Actions UI → Run workflow (with local changes)
  - Reference: Test 9 from quickstart.md
  - Expected: Git push fails with conflict error

- [ ] **T052** Validate workflow timeout is 120 minutes
  - File: `.github/workflows/speckit.yml`
  - Validation: Check `timeout-minutes: 120` in job configuration

- [ ] **T053** Validate all 28 functional requirements implemented
  - Files: `.github/workflows/speckit.yml`, quickstart.md test results
  - Validation: Checklist FR-001 through FR-028 all satisfied

- [ ] **T054** Update repository documentation with workflow usage
  - Path: Repository README or docs/
  - Content: Link to quickstart.md, explain workflow dispatch process

---

## Dependencies

**Phase Order**:
1. Setup (T001-T002) → All other phases
2. Test Documentation (T003-T011) → Core Implementation (T012-T042)
3. Core Implementation → Integration Testing (T043-T047)
4. Integration Testing → Polish & Error Testing (T048-T054)

**Sequential Dependencies Within Workflow File**:
- T001 (create directory) blocks T002 (create file)
- T002 (workflow file) blocks all T012-T042 (all workflow content)
- T012 (trigger) blocks T013-T018 (input definitions)
- T019 (job config) blocks T020-T025 (setup steps)
- T020-T025 (environment) blocks T026-T031 (command execution)
- T026-T031 (commands) blocks T032-T036 (git operations)
- T032-T036 (git ops) blocks T037-T038 (status reporting)
- T040-T042 (security validation) can be done after any step that uses secrets
- T043-T047 (integration tests) require T002-T042 complete
- T048-T054 (polish) require T043-T047 complete

**No Parallel Execution** (single file):
- All tasks modify `.github/workflows/speckit.yml` except test tasks
- Test tasks (T003-T011, T043-T054) are manual procedures, not code changes
- Mark [P] not applicable for this feature (single workflow file architecture)

---

## Parallel Example

**Note**: This feature does not support parallel task execution as all implementation tasks modify the same file (`.github/workflows/speckit.yml`). However, test procedures can be documented concurrently if multiple developers are available.

**Conceptual Parallel Documentation (T003-T011)**:
```bash
# IF multiple developers document test procedures simultaneously:
# Developer 1:
Task: "Document Test 1: Specify command test procedure"
Task: "Document Test 2: Plan command test procedure"

# Developer 2:
Task: "Document Test 3: Task command test procedure"
Task: "Document Test 4: Implement command test procedure"

# Developer 3:
Task: "Document Test 5: Clarify command test procedure"
Task: "Document Test 6-9: Error scenario test procedures"
```

**Sequential Implementation Required**:
All T012-T042 must be done sequentially as they build a single YAML file.

---

## Notes

- **Single File Architecture**: All workflow logic in `.github/workflows/speckit.yml` (no parallel task execution possible)
- **TDD Approach**: Document test procedures first (T003-T011), then implement to make tests pass
- **Manual Testing**: All integration tests (T043-T054) executed via GitHub Actions UI, not automated
- **Commit Strategy**: Commit after major milestones (structure complete, commands implemented, git ops working, status reporting added)
- **Error Handling**: Bash error handling (`set -e`, exit codes) critical for workflow reliability
- **Secret Safety**: GitHub Actions automatically masks secrets in logs - verify no explicit echo statements

---

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts (workflow-schema.yml)**:
   - 6 inputs → 7 input definition tasks (T013-T018, T019 for job config)
   - 5 commands → 5 command execution tasks (T026-T030)
   - Error scenarios → 4 error test tasks (T048-T051)

2. **From Data Model (data-model.md)**:
   - Input/output schemas → validation tasks (included in T013-T018)
   - State transitions → git operation tasks (T032-T036)
   - No database entities (N/A for this feature)

3. **From User Stories (spec.md acceptance scenarios)**:
   - 8 acceptance scenarios → 8 integration test tasks (T043-T047 success, T048-T051 errors)
   - Quickstart scenarios → manual test procedure tasks (T003-T011)

4. **Ordering**:
   - Setup (T001-T002) → Test Documentation (T003-T011) → Workflow Structure (T012-T019) → Environment Setup (T020-T025) → Command Execution (T026-T031) → Git Operations (T032-T036) → Status Reporting (T037-T039) → Security Validation (T040-T042) → Integration Tests (T043-T047) → Polish (T048-T054)

---

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts tested via manual dispatch (T043-T047 cover workflow-schema.yml)
- [x] All 5 commands implemented (T026-T030 implement specify, plan, task, implement, clarify)
- [x] All tests come before implementation (T003-T011 documented before T012-T042 implementation)
- [x] Parallel tasks truly independent (N/A - single file architecture, no parallel execution)
- [x] Each task specifies exact file path (`.github/workflows/speckit.yml` or test procedure reference)
- [x] No task modifies same file as another [P] task (N/A - no [P] tasks, all sequential)
- [x] All 28 functional requirements mapped to tasks (FR-001 to FR-028 covered by T012-T042 + validation tasks)
- [x] Security requirements validated (T040-T042 verify secret handling, T049 tests secret exposure)
- [x] Error scenarios covered (T048-T051 test all error cases from spec)
- [x] Manual testing procedures documented (T003-T011 reference quickstart.md)

---

**Status**: Tasks ready for execution. Total: 54 tasks (2 setup, 9 test documentation, 31 core implementation, 5 integration, 7 polish/validation)
