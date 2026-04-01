# Tasks: Create setup-environment.sh Script

**Input**: Design documents from `/specs/AIB-468-copy-of-create/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the script file, directory structure, and reference config for the ai-board project itself

- [ ] T001 Create script file `.github/scripts/setup-environment.sh` with shebang, `set -euo pipefail`, and usage/help function
- [ ] T002 [P] Create ai-board self-config file `.ai-board/config.yml` with version 1 schema for this project (bun, typescript, nextjs, claude-code)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented — argument parsing, yq bootstrap, config loading, and error output helpers

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement target directory argument parsing and validation (check directory exists) in `.github/scripts/setup-environment.sh`
- [ ] T004 Implement yq bootstrap installation (download binary to `/usr/local/bin/yq` if not present) in `.github/scripts/setup-environment.sh`
- [ ] T005 Implement config file loading — read `.ai-board/config.yml` from target directory via `yq`, extract all fields into shell variables in `.github/scripts/setup-environment.sh`
- [ ] T006 [P] Implement logging helper functions (`info`, `error`, `success`) with emoji-prefixed output (stdout for info/success, stderr for errors) in `.github/scripts/setup-environment.sh`

**Checkpoint**: Foundation ready — config parsing works, yq is available, error reporting is in place

---

## Phase 3: User Story 1 — Workflow Author Runs Setup for a Standard Project (Priority: P1) MVP

**Goal**: Complete happy-path setup flow — parse config, install bun, run dependency install, install claude-code CLI, export env vars, create symlinks, validate all outcomes

**Independent Test**: Create a minimal `.ai-board/config.yml` with `runtime.manager: bun` and `agent.cli: claude-code`, run the script, verify bun is available, `node_modules/` exists, claude-code CLI is on PATH, env vars are exported, and symlinks point to valid targets

### Implementation for User Story 1

- [ ] T007 [US1] Implement package manager installation for bun (download via `curl -fsSL https://bun.sh/install` with optional version pinning from `runtime.manager_version`) in `.github/scripts/setup-environment.sh`
- [ ] T008 [US1] Implement dependency installation step — execute `commands.install` value from config in the target directory in `.github/scripts/setup-environment.sh`
- [ ] T009 [US1] Implement agent CLI installation for claude-code (via `npm install -g @anthropic-ai/claude-code`) in `.github/scripts/setup-environment.sh`
- [ ] T010 [US1] Implement environment variable export — iterate config `env` section, export each as `VAR="${VAR:-config_value}"` (preserving existing workflow secrets) in `.github/scripts/setup-environment.sh`
- [ ] T011 [US1] Implement plugin symlink creation — `mkdir -p <target>/.claude`, `ln -sf` for commands and skills pointing to `../../ai-board/.claude-plugin/` in `.github/scripts/setup-environment.sh`
- [ ] T012 [US1] Implement project dependency detection — check for Prisma (`prisma/schema.prisma`) and Playwright (`playwright.config`), export `HAS_PRISMA` and `HAS_PLAYWRIGHT`, run `bunx prisma generate` if Prisma detected in `.github/scripts/setup-environment.sh`
- [ ] T013 [US1] Implement final validation step — verify package manager on PATH, `node_modules/` exists, agent CLI on PATH, symlinks valid, env vars exported in `.github/scripts/setup-environment.sh`
- [ ] T014 [US1] Wire all steps together in correct execution order (parse → install manager → install deps → install agent → export env → symlinks → detect deps → validate) in `.github/scripts/setup-environment.sh`

**Checkpoint**: Full happy path works end-to-end with bun + claude-code

---

## Phase 4: User Story 2 — Script Handles Missing or Invalid Configuration (Priority: P2)

**Goal**: Robust error handling for missing config file, malformed YAML, and missing required fields with clear actionable error messages

**Independent Test**: Run the script against a directory with no config, then with invalid YAML, then with missing required fields — verify non-zero exit codes and descriptive error messages on stderr

### Implementation for User Story 2

- [ ] T015 [US2] Add config file existence check — fail with `ERROR: Config file not found: <path>` if `.ai-board/config.yml` is missing in `.github/scripts/setup-environment.sh`
- [ ] T016 [US2] Add YAML parse validation — wrap yq calls to catch parse errors, fail with `ERROR: Config file parse error: <details>` in `.github/scripts/setup-environment.sh`
- [ ] T017 [US2] Add required field validation — check `version`, `project.name`, `project.language`, `runtime.manager`, `commands.install`, `agent.cli` are present, fail listing specific missing fields in `.github/scripts/setup-environment.sh`
- [ ] T018 [US2] Add schema version check — verify `version` equals `1`, fail with clear message if unsupported in `.github/scripts/setup-environment.sh`

**Checkpoint**: Script fails fast with clear messages for all invalid config scenarios

---

## Phase 5: User Story 3 — Script Supports Multiple Package Managers (Priority: P2)

**Goal**: Support npm, yarn, and pnpm in addition to bun, with correct installation and activation for each

**Independent Test**: Create four config files (one per manager: bun, npm, yarn, pnpm), run the script against each, verify the correct manager is available and install command executes

### Implementation for User Story 3

- [ ] T019 [US3] Implement npm support — npm is bundled with Node.js, so just verify it's available and run the install command in `.github/scripts/setup-environment.sh`
- [ ] T020 [P] [US3] Implement yarn support — activate via `corepack enable && corepack prepare yarn@<version> --activate`, then run install command in `.github/scripts/setup-environment.sh`
- [ ] T021 [P] [US3] Implement pnpm support — activate via `corepack enable && corepack prepare pnpm@<version> --activate`, then run install command in `.github/scripts/setup-environment.sh`
- [ ] T022 [US3] Refactor package manager installation into a `case` statement dispatching on `runtime.manager` value, with unsupported manager producing `ERROR: Unsupported package manager: <value>. Supported: bun, npm, yarn, pnpm` in `.github/scripts/setup-environment.sh`

**Checkpoint**: All four package managers work correctly when specified in config

---

## Phase 6: User Story 4 — Script Installs Correct Agent CLI (Priority: P3)

**Goal**: Support codex CLI in addition to claude-code, selected via `agent.cli` config field

**Independent Test**: Run the script with `agent.cli: codex` and verify the Codex CLI is available on PATH

### Implementation for User Story 4

- [ ] T023 [US4] Implement codex CLI installation (via `npm install -g @openai/codex`) in `.github/scripts/setup-environment.sh`
- [ ] T024 [US4] Refactor agent CLI installation into a `case` statement dispatching on `agent.cli` value, with unsupported agent producing `ERROR: Unsupported agent CLI: <value>. Supported: claude-code, codex` in `.github/scripts/setup-environment.sh`

**Checkpoint**: Both claude-code and codex agent CLIs can be installed from config

---

## Phase 7: User Story 5 — Plugin Symlinks Are Created Correctly (Priority: P3)

**Goal**: Ensure symlinks handle edge cases — missing `.claude/` dir, existing symlinks, re-run idempotency

**Independent Test**: Run the script against a fresh target (no `.claude/`), verify symlinks created. Run again, verify symlinks overwritten without error. Use `readlink` to confirm targets.

### Implementation for User Story 5

- [ ] T025 [US5] Ensure `mkdir -p` creates `.claude/` directory if it doesn't exist before symlink creation in `.github/scripts/setup-environment.sh`
- [ ] T026 [US5] Ensure `ln -sf` overwrites existing symlinks on re-runs without error in `.github/scripts/setup-environment.sh`
- [ ] T027 [US5] Add symlink validation in the final validation step — verify symlinks exist and targets are readable via `readlink` and `test -d` in `.github/scripts/setup-environment.sh`

**Checkpoint**: Symlinks work correctly for first-run, re-run, and validation scenarios

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Replace duplicated setup blocks in existing workflow files with the centralized script call

- [ ] T028 [P] Replace duplicated setup blocks in `.github/workflows/speckit.yml` with a single `setup-environment.sh` invocation (keep `actions/setup-node` step)
- [ ] T029 [P] Replace duplicated setup blocks in `.github/workflows/quick-impl.yml` with a single `setup-environment.sh` invocation
- [ ] T030 [P] Replace duplicated setup blocks in `.github/workflows/verify.yml` with a single `setup-environment.sh` invocation
- [ ] T031 [P] Replace duplicated setup blocks in `.github/workflows/ai-board-assist.yml` with a single `setup-environment.sh` invocation
- [ ] T032 [P] Replace duplicated setup blocks in `.github/workflows/iterate.yml` with a single `setup-environment.sh` invocation
- [ ] T033 [P] Replace duplicated setup blocks in `.github/workflows/health-scan.yml` with a single `setup-environment.sh` invocation
- [ ] T034 Run quickstart.md validation — verify the script works per documented usage examples

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 exists) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — core happy path
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — extends the manager installation logic
- **US4 (Phase 6)**: Depends on US1 (Phase 3) — extends the agent CLI installation logic
- **US5 (Phase 7)**: Depends on US1 (Phase 3) — hardens the symlink creation logic
- **Polish (Phase 8)**: Depends on US1 + US2 + US3 completion (script must be feature-complete before modifying workflows)

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **US2 (P2)**: Can start after Foundational (Phase 2) — Independent of US1 (error paths are separate from happy path)
- **US3 (P2)**: Should start after US1 — refactors the manager installation into a multi-manager dispatch
- **US4 (P3)**: Should start after US1 — refactors the agent CLI installation into a multi-agent dispatch
- **US5 (P3)**: Should start after US1 — hardens the symlink logic already implemented in US1

### Within Each User Story

- Config parsing before installation steps
- Installation before validation
- Core implementation before edge case handling

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T006 can run in parallel with T003-T005 (helper functions are independent)
- T020 and T021 can run in parallel (yarn and pnpm are independent implementations)
- T028-T033 can ALL run in parallel (each modifies a different workflow file)
- US1 and US2 can start in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# T007-T013 are mostly sequential within the script, but T010 and T011 touch independent sections:
Task: "T010 [US1] Implement environment variable export"
Task: "T011 [US1] Implement plugin symlink creation"

# These can be written in parallel as they are independent code blocks within the script
```

## Parallel Example: Polish Phase

```bash
# All workflow modifications can run in parallel (different files):
Task: "T028 Replace setup blocks in speckit.yml"
Task: "T029 Replace setup blocks in quick-impl.yml"
Task: "T030 Replace setup blocks in verify.yml"
Task: "T031 Replace setup blocks in ai-board-assist.yml"
Task: "T032 Replace setup blocks in iterate.yml"
Task: "T033 Replace setup blocks in health-scan.yml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T006)
3. Complete Phase 3: User Story 1 (T007-T014)
4. **STOP and VALIDATE**: Run script against ai-board's own `.ai-board/config.yml`
5. Working end-to-end setup for bun + claude-code projects

### Incremental Delivery

1. Setup + Foundational → Script skeleton ready
2. Add US1 → Full happy path works (MVP!)
3. Add US2 → Error handling hardened
4. Add US3 → All package managers supported
5. Add US4 → All agent CLIs supported
6. Add US5 → Symlink edge cases handled
7. Polish → Workflows migrated to use centralized script

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. US1 and US2 can proceed in parallel (happy path vs error handling)
3. After US1: US3, US4, US5 can proceed in parallel (each extends different parts of the script)
4. After all stories: Polish phase workflow modifications run in parallel (6 independent files)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All implementation is in a single file (`.github/scripts/setup-environment.sh`) — parallel opportunities within the script are limited to independent code blocks
- The script is bash, not TypeScript — no models/services/endpoints pattern applies
- Workflow modifications (Phase 8) are the highest-value deliverable after the script itself
- Config file (`.ai-board/config.yml`) schema follows data-model.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
