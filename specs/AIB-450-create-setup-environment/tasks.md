# Tasks: Create setup-environment.sh Script

**Input**: Design documents from `/specs/AIB-450-create-setup-environment/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/cli-interface.md

**Tests**: Included — plan.md testing strategy specifies integration tests for all user stories.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Script**: `.github/scripts/setup-environment.sh`
- **Tests**: `tests/integration/setup-environment/`
- **Fixtures**: `tests/integration/setup-environment/fixtures/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and test fixtures needed by all phases

- [x] T001 Create directory structure: `.github/scripts/`, `tests/integration/setup-environment/fixtures/`
- [x] T002 [P] Create test fixture `tests/integration/setup-environment/fixtures/valid-bun-config.yml` with bun runtime, claude-code agent, env vars, and commands.install
- [x] T003 [P] Create test fixture `tests/integration/setup-environment/fixtures/valid-npm-config.yml` with npm runtime and claude-code agent
- [x] T004 [P] Create test fixture `tests/integration/setup-environment/fixtures/valid-yarn-config.yml` with yarn runtime, manager_version 4.1, and claude-code agent
- [x] T005 [P] Create test fixture `tests/integration/setup-environment/fixtures/valid-pnpm-config.yml` with pnpm runtime, manager_version 9, and claude-code agent
- [x] T006 [P] Create test fixture `tests/integration/setup-environment/fixtures/missing-required-fields.yml` with missing commands.install and agent.cli fields
- [x] T007 [P] Create test fixture `tests/integration/setup-environment/fixtures/unsupported-manager.yml` with runtime.manager set to "pip"
- [x] T008 [P] Create test fixture `tests/integration/setup-environment/fixtures/python-runtime.yml` with runtime.manager set to "poetry"

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core script skeleton with argument parsing, config loading, validation framework, logging helpers, and error handling. MUST be complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create `.github/scripts/setup-environment.sh` with shebang (`#!/usr/bin/env bash`), `set -euo pipefail`, usage function, and argument parsing that validates exactly one argument (target-dir) is provided and the directory exists
- [x] T010 Implement logging helper functions in `.github/scripts/setup-environment.sh`: `log_step` (::group::), `end_step` (::endgroup::), `log_error` (::error::), `log_warn` (::warning::), and `log_info` — with graceful fallback when not in GitHub Actions (per research.md R7)
- [x] T011 Implement config loading in `.github/scripts/setup-environment.sh`: verify `yq` is available (exit with install instructions if missing), verify `.ai-board/config.yml` exists in target-dir (exit code 1 if missing), load config via `yq` dot-notation queries into shell variables (runtime_manager, runtime_node, runtime_manager_version, commands_install, agent_cli, etc.)
- [x] T012 Implement required field validation in `.github/scripts/setup-environment.sh`: validate `runtime.manager` is non-empty, `commands.install` is non-empty, `agent.cli` is non-empty — exit code 1 with specific error message per data-model.md validation rules for each missing field
- [x] T013 Implement supported-values validation in `.github/scripts/setup-environment.sh`: validate `runtime.manager` is one of bun|npm|yarn|pnpm (exit code 1 with specific error for unsupported; special warning message for pip|poetry|cargo per research.md R8), validate `agent.cli` is one of claude-code|codex (exit code 1 with specific error)

**Checkpoint**: Script can parse config, validate all fields, and produce correct error messages — ready for user story implementation

---

## Phase 3: User Story 1 — Standard Node.js Setup (Priority: P1) 🎯 MVP

**Goal**: Workflow runs setup script on a standard Node.js project with bun or npm, completing all setup steps in a single invocation

**Independent Test**: Run script against a mock target directory with valid-bun-config.yml fixture; verify Node.js check passes, bun is available, agent CLI is installed, env vars are exported, and symlinks are created

### Implementation for User Story 1

- [x] T014 [US1] Implement Node.js version verification step in `.github/scripts/setup-environment.sh`: read `runtime.node` from config (default "22"), check `node --version` against it, log warning if mismatch (per research.md R3 — script validates but does not install Node.js)
- [x] T015 [US1] Implement bun package manager installation step in `.github/scripts/setup-environment.sh`: when `runtime.manager` is "bun", install via `curl -fsSL https://bun.sh/install | bash` with version pinning from `runtime.manager_version` if specified (per research.md R2), verify `bun --version` after install
- [x] T016 [US1] Implement npm package manager handling in `.github/scripts/setup-environment.sh`: when `runtime.manager` is "npm", skip installation (npm ships with Node.js), upgrade to specific version via `npm install -g npm@${version}` only if `runtime.manager_version` is specified
- [x] T017 [US1] Implement dependency install command execution step in `.github/scripts/setup-environment.sh`: run the command from `commands.install` config field in the target directory context, exit code 2 on failure
- [x] T018 [US1] Implement agent CLI installation step in `.github/scripts/setup-environment.sh`: when `agent.cli` is "claude-code", run `npm install -g @anthropic-ai/claude-code`; when "codex", run `npm install -g @openai/codex` (per research.md R6), verify binary is available via `command -v`
- [x] T019 [US1] Implement environment variable export step in `.github/scripts/setup-environment.sh`: iterate over `env` section key-value pairs from config, write to `$GITHUB_ENV` when `$GITHUB_ACTIONS` is set, fall back to `export` otherwise (per research.md R4), log count of exported variables
- [x] T020 [US1] Implement plugin symlink creation step in `.github/scripts/setup-environment.sh`: create `<target>/.claude/` directory, create symlinks for `commands` and `skills` pointing to `../../ai-board/.claude-plugin/commands` and `../../ai-board/.claude-plugin/skills` using `ln -sfn` (per research.md R5 and contracts/cli-interface.md)
- [x] T021 [US1] Implement final validation summary step in `.github/scripts/setup-environment.sh`: log success message "✅ Environment setup complete", verify all expected tools are on PATH, verify symlinks exist and point to valid targets
- [x] T022 [US1] Make `.github/scripts/setup-environment.sh` executable (`chmod +x`) and verify end-to-end script flow: argument → config parse → validate → Node.js check → package manager → dependencies → agent CLI → env vars → symlinks → summary

### Tests for User Story 1

- [x] T023 [P] [US1] Create integration test `tests/integration/setup-environment/setup-environment.test.ts` with test suite for US1: test script exits 0 with valid bun config fixture, verify stdout contains all expected ::group:: step markers per contracts/cli-interface.md stdout contract
- [x] T024 [P] [US1] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script with valid npm config fixture exits 0 and uses npm for dependency installation

**Checkpoint**: Script fully handles bun and npm projects end-to-end. User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 — Missing or Invalid Config Handling (Priority: P1)

**Goal**: Script detects missing or invalid config and fails immediately with clear, actionable error messages

**Independent Test**: Run script against directories with missing config, empty config, and invalid field values; verify non-zero exit codes and specific error messages

### Implementation for User Story 2

- [x] T025 [US2] Verify and refine error messages in `.github/scripts/setup-environment.sh` for all validation failure paths: missing config file (exit 1), missing required fields (exit 1 per field with field name in message), unsupported runtime.manager (exit 1 with supported list), unsupported agent.cli (exit 1 with supported list) — ensure messages match contracts/cli-interface.md stderr contract exactly
- [x] T026 [US2] Add version field validation in `.github/scripts/setup-environment.sh`: check `version` field equals 1, exit code 1 with "Unsupported config version: {value}. Expected: 1" if not (per data-model.md validation rules)

### Tests for User Story 2

- [x] T027 [P] [US2] Add integration test cases in `tests/integration/setup-environment/setup-environment.test.ts`: test script exits 1 when target directory has no `.ai-board/config.yml`, verify error message contains "Missing .ai-board/config.yml"
- [x] T028 [P] [US2] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script exits 1 with `missing-required-fields.yml` fixture, verify error identifies the specific missing field
- [x] T029 [P] [US2] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script exits 1 with `unsupported-manager.yml` fixture, verify error message lists supported package managers
- [x] T030 [P] [US2] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script exits 1 with `python-runtime.yml` fixture, verify warning message mentions Python support coming soon

**Checkpoint**: All error paths produce clear, actionable messages matching the stderr contract.

---

## Phase 5: User Story 3 — Multiple Package Managers (Priority: P2)

**Goal**: Script correctly installs and uses yarn and pnpm via corepack, in addition to the bun/npm support from US1

**Independent Test**: Run script with yarn and pnpm config fixtures; verify correct package manager is available at the specified version

### Implementation for User Story 3

- [x] T031 [US3] Implement yarn installation step in `.github/scripts/setup-environment.sh`: when `runtime.manager` is "yarn", run `corepack enable && corepack prepare yarn@${version} --activate` (per research.md R2), fall back to latest if `runtime.manager_version` is omitted, verify `yarn --version` after install
- [x] T032 [US3] Implement pnpm installation step in `.github/scripts/setup-environment.sh`: when `runtime.manager` is "pnpm", run `corepack enable && corepack prepare pnpm@${version} --activate` (per research.md R2), fall back to latest if `runtime.manager_version` is omitted, verify `pnpm --version` after install

### Tests for User Story 3

- [x] T033 [P] [US3] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script with `valid-yarn-config.yml` fixture, verify yarn is available and script exits 0
- [x] T034 [P] [US3] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script with `valid-pnpm-config.yml` fixture, verify pnpm is available and script exits 0

**Checkpoint**: All 4 package managers (bun, npm, yarn, pnpm) are fully supported.

---

## Phase 6: User Story 4 — Agent CLI Installation (Priority: P2)

**Goal**: Script installs the correct AI agent CLI (claude-code or codex) based on config, making the binary available on PATH

**Independent Test**: Run script with configs specifying each supported agent CLI; verify the CLI binary is available after setup

### Implementation for User Story 4

- [x] T035 [US4] Verify and harden agent CLI installation in `.github/scripts/setup-environment.sh`: ensure both claude-code (`claude` binary) and codex (`codex` binary) paths work, add `command -v` verification after install with exit code 2 on failure, test with codex config variant

### Tests for User Story 4

- [x] T036 [P] [US4] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script with config specifying `agent.cli: codex`, verify codex binary is available
- [x] T037 [P] [US4] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: test script exits 1 with config specifying `agent.cli: unsupported-cli`, verify error message

**Checkpoint**: Both agent CLIs install correctly and unsupported values produce clear errors.

---

## Phase 7: User Story 5 — Idempotent Plugin Symlinks (Priority: P2)

**Goal**: Script creates plugin symlinks idempotently — safe to re-run, detects real directory conflicts

**Independent Test**: Run script twice on same target directory; verify symlinks are correct after both runs. Then test with a real directory conflict.

### Implementation for User Story 5

- [x] T038 [US5] Verify and harden symlink creation in `.github/scripts/setup-environment.sh`: ensure `create_symlink` helper checks `[ -d path ] && [ ! -L path ]` for real directory conflicts (exit code 3 with actionable error per research.md R5), ensure `ln -sfn` replaces existing symlinks atomically, verify symlink targets resolve correctly

### Tests for User Story 5

- [x] T039 [P] [US5] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: run script twice on same mock target directory, verify symlinks are correct after both runs (idempotency)
- [x] T040 [P] [US5] Add integration test case in `tests/integration/setup-environment/setup-environment.test.ts`: create a real directory at `<target>/.claude/commands`, run script, verify exit code 3 and error message about real directory conflict

**Checkpoint**: Symlinks are fully idempotent and conflict-safe.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening and cross-story validation

- [x] T041 [P] Add inline documentation comments in `.github/scripts/setup-environment.sh`: document env var merge precedence (secrets > config per Decision 4), supported managers list, exit code meanings, and symlink path conventions
- [x] T042 Run full integration test suite in `tests/integration/setup-environment/setup-environment.test.ts` — verify all tests pass across all user stories
- [x] T043 Run quickstart.md validation: execute the "Locally (for testing)" invocation from `specs/AIB-450-create-setup-environment/quickstart.md` against a real target directory with valid config, verify all verification commands succeed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (directory structure) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — implements core script logic
- **User Story 2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different code paths)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (builds on package manager switch/case from US1)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (builds on agent CLI step from US1)
- **User Story 5 (Phase 7)**: Depends on Phase 3 (builds on symlink step from US1)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependencies on other stories. **This is the MVP.**
- **US2 (P1)**: After Phase 2 — can run in parallel with US1 (focuses on error paths vs happy path)
- **US3 (P2)**: After US1 — extends the package manager installation logic
- **US4 (P2)**: After US1 — extends the agent CLI installation logic
- **US5 (P2)**: After US1 — extends the symlink creation logic

### Within Each User Story

- Implementation tasks before test tasks (script must exist before testing)
- Core logic before edge case handling
- Story complete before moving to next priority

### Parallel Opportunities

- All fixture creation tasks (T002–T008) can run in parallel
- US1 and US2 can be developed in parallel (happy path vs error path)
- US3, US4, US5 can all be developed in parallel after US1 completes
- All test tasks marked [P] within a story can run in parallel
- T041 (docs) can run in parallel with T042–T043

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all fixture creation tasks together:
Task T002: "Create valid-bun-config.yml fixture"
Task T003: "Create valid-npm-config.yml fixture"
Task T004: "Create valid-yarn-config.yml fixture"
Task T005: "Create valid-pnpm-config.yml fixture"
Task T006: "Create missing-required-fields.yml fixture"
Task T007: "Create unsupported-manager.yml fixture"
Task T008: "Create python-runtime.yml fixture"
```

## Parallel Example: User Story 2 Tests

```bash
# Launch all US2 error path tests together:
Task T027: "Test missing config file"
Task T028: "Test missing required fields"
Task T029: "Test unsupported manager"
Task T030: "Test Python runtime warning"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (fixtures and directories)
2. Complete Phase 2: Foundational (script skeleton, config parsing, validation)
3. Complete Phase 3: User Story 1 (full happy path with bun/npm)
4. **STOP and VALIDATE**: Run script against valid-bun-config.yml fixture, verify all steps complete
5. Deploy if ready — this alone replaces the duplicated setup blocks for bun projects

### Incremental Delivery

1. Setup + Foundational → Script skeleton ready
2. Add US1 → Test with bun/npm → **MVP complete** (covers all existing workflows)
3. Add US2 → Test error paths → Clear error messages for misconfigurations
4. Add US3 → Test yarn/pnpm → Full package manager coverage (SC-004)
5. Add US4 → Test codex CLI → Full agent CLI coverage
6. Add US5 → Test idempotency → Safe for workflow retries
7. Polish → Documentation, full test suite, quickstart validation

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - Parallel track A: US1 (happy path) + US2 (error path)
3. Once US1 is done:
   - Parallel track B: US3 (yarn/pnpm) + US4 (codex) + US5 (idempotency)
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Single script file means most tasks modify the same file — parallel opportunities are mainly in fixtures and tests
- Exit codes follow contracts/cli-interface.md: 0 (success), 1 (config error), 2 (install error), 3 (filesystem error)
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
