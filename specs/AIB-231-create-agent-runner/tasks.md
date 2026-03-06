# Tasks: Create Agent Runner Script

**Input**: Design documents from `/specs/AIB-231-create-agent-runner/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No test tasks generated — spec does not request automated tests. ShellCheck linting is included in Polish phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the script file and establish the basic structure

- [ ] T001 Create `.github/scripts/run-agent.sh` with shebang, `set -euo pipefail`, positional arg parsing (`AGENT_TYPE=$1`, `COMMAND=$2`, `shift 2; ARGS="$*"`), and main `case` dispatch skeleton for CLAUDE/CODEX with unsupported agent error fallback
- [ ] T002 Make `.github/scripts/run-agent.sh` executable (`chmod +x`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation and utility functions that ALL agent paths depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement `validate_auth()` function in `.github/scripts/run-agent.sh` that checks `CLAUDE_CODE_OAUTH_TOKEN` for CLAUDE agent and `OPENAI_API_KEY` for CODEX agent, exiting with descriptive error messages per contracts/run-agent-interface.md
- [ ] T004 Implement `log_info()` and `log_error()` helper functions in `.github/scripts/run-agent.sh` for consistent script output formatting

**Checkpoint**: Foundation ready — agent-specific implementation can now begin

---

## Phase 3: User Story 1 — Workflow Executes with Claude Agent (Priority: P1) MVP

**Goal**: The Claude path through `run-agent.sh` produces identical behavior to the current hardcoded workflow steps (zero regression)

**Independent Test**: Run any workflow with `agent=CLAUDE` and verify the command executes identically to the current hardcoded approach

### Implementation for User Story 1

- [ ] T005 [US1] Implement `install_claude()` function in `.github/scripts/run-agent.sh` that runs `bun add -g @anthropic-ai/claude-code` with error handling on install failure
- [ ] T006 [US1] Implement `invoke_claude()` function in `.github/scripts/run-agent.sh` that executes `claude --dangerously-skip-permissions "/$COMMAND $ARGS"` and propagates exit code
- [ ] T007 [US1] Wire `install_claude` and `invoke_claude` into the CLAUDE case of the main dispatch in `.github/scripts/run-agent.sh`, calling `validate_auth` → `install_claude` → `invoke_claude`

**Checkpoint**: Claude path in run-agent.sh is fully functional — calling `run-agent.sh CLAUDE ai-board.specify "payload"` should behave identically to the current `claude --dangerously-skip-permissions "/ai-board.specify payload"`

---

## Phase 4: User Story 4 — All 6 Workflows Updated to Use Unified Script (Priority: P1)

**Goal**: Replace hardcoded `bun add -g @anthropic-ai/claude-code` and direct `claude` CLI invocations with `run-agent.sh` calls in all 6 workflow files

**Independent Test**: Inspect each workflow YAML to confirm no hardcoded `bun add -g @anthropic-ai/claude-code` or direct `claude --dangerously-skip-permissions` calls remain, and all invocations use `run-agent.sh`

### Implementation for User Story 4

- [ ] T008 [US4] Update `.github/workflows/iterate.yml` — remove hardcoded Claude CLI install step and replace `claude --dangerously-skip-permissions` invocations with `.github/scripts/run-agent.sh "${{ inputs.agent }}" "command" "$args"` calls, passing the existing `agent` input
- [ ] T009 [US4] Update `.github/workflows/cleanup.yml` — remove hardcoded Claude CLI install step and replace `claude --dangerously-skip-permissions` invocations with `run-agent.sh` calls, passing the existing `agent` input
- [ ] T010 [US4] Update `.github/workflows/quick-impl.yml` — add missing `agent` input parameter (default `'CLAUDE'`), remove hardcoded Claude CLI install step, and replace `claude --dangerously-skip-permissions` invocations with `run-agent.sh` calls per contracts/workflow-input.md
- [ ] T011 [US4] Update `.github/workflows/ai-board-assist.yml` — remove hardcoded Claude CLI install step and replace `claude --dangerously-skip-permissions` invocations with `run-agent.sh` calls, passing the existing `agent` input
- [ ] T012 [US4] Update `.github/workflows/verify.yml` — remove hardcoded Claude CLI install step and replace all `claude --dangerously-skip-permissions` invocations with `run-agent.sh` calls, passing the existing `agent` input
- [ ] T013 [US4] Update `.github/workflows/speckit.yml` — remove hardcoded Claude CLI install step and replace all `claude --dangerously-skip-permissions` invocations (including conditional/looped ones) with `run-agent.sh` calls, passing the existing `agent` input

**Checkpoint**: All 6 workflows use `run-agent.sh` exclusively. Dispatching any workflow with default `agent=CLAUDE` should produce identical behavior to pre-change workflows.

---

## Phase 5: User Story 2 — Workflow Executes with Codex Agent (Priority: P2)

**Goal**: Enable Codex CLI execution through `run-agent.sh` — install, authenticate, resolve command .md files, configure telemetry, and invoke via `codex exec --full-auto`

**Independent Test**: Run `run-agent.sh CODEX ai-board.specify "payload"` with `OPENAI_API_KEY` set and verify Codex CLI installs, authenticates, reads the command .md file, and executes successfully

### Implementation for User Story 2

- [ ] T014 [US2] Implement `install_codex()` function in `.github/scripts/run-agent.sh` that runs `bun add -g @openai/codex` with error handling, then authenticates via `codex login --api-key "$OPENAI_API_KEY"`
- [ ] T015 [US2] Implement `setup_codex_telemetry()` function in `.github/scripts/run-agent.sh` that writes `~/.codex/config.toml` with `[otel]` and `[otel.exporter."otlp-http"]` sections, mapping `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, and protocol per research.md R-002 telemetry mapping
- [ ] T016 [US2] Implement `invoke_codex()` function in `.github/scripts/run-agent.sh` that reads `.claude/commands/${COMMAND}.md`, concatenates with `$ARGS`, and pipes combined prompt to `codex exec --full-auto -m "${CODEX_MODEL:-o3}" -` via stdin, propagating exit code
- [ ] T017 [US2] Wire `install_codex`, `setup_codex_telemetry`, and `invoke_codex` into the CODEX case of the main dispatch in `.github/scripts/run-agent.sh`, calling `validate_auth` → `install_codex` → `setup_codex_env` → `invoke_codex`

**Checkpoint**: Codex path in run-agent.sh is fully functional — `run-agent.sh CODEX ai-board.specify "payload"` installs Codex, authenticates, reads the .md file, configures telemetry, and invokes the command

---

## Phase 6: User Story 3 — AGENTS.md Generated for Codex (Priority: P2)

**Goal**: Generate an `AGENTS.md` file from `CLAUDE.md` in the target repo working directory so Codex reads project conventions automatically

**Independent Test**: Run `run-agent.sh CODEX ...` in a repo with `CLAUDE.md` and verify `AGENTS.md` is created with matching content under 32KB. Run with `agent=CLAUDE` and verify no `AGENTS.md` is created.

### Implementation for User Story 3

- [ ] T018 [US3] Implement `generate_agents_md()` function in `.github/scripts/run-agent.sh` that copies `CLAUDE.md` content to `AGENTS.md` in the working directory, checks file size, and truncates at 32KB boundary with a truncation notice if needed
- [ ] T019 [US3] Integrate `generate_agents_md()` call into the CODEX setup path in `.github/scripts/run-agent.sh` (called between `install_codex` and `invoke_codex`), skipping generation if `CLAUDE.md` does not exist

**Checkpoint**: AGENTS.md is correctly generated for Codex workflows and stays under 32KB

---

## Phase 7: User Story 5 — Graceful Error Handling for Missing Secrets (Priority: P3)

**Goal**: Fail early with clear error messages when required secrets are missing or when edge cases are hit

**Independent Test**: Run `run-agent.sh CODEX ...` without `OPENAI_API_KEY` set and verify a descriptive error within 5 seconds. Run with `agent=GEMINI` and verify unsupported agent error.

### Implementation for User Story 5

- [ ] T020 [US5] Add missing command .md file validation to `invoke_codex()` in `.github/scripts/run-agent.sh` — check that `.claude/commands/${COMMAND}.md` exists before reading, exit with descriptive error per contracts/run-agent-interface.md if not found
- [ ] T021 [US5] Add CLI installation failure detection to both `install_claude()` and `install_codex()` in `.github/scripts/run-agent.sh` — verify the CLI binary is available after `bun add -g`, exit with descriptive error if not

**Checkpoint**: All error paths produce clear, actionable messages and fail before expensive operations

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Linting, validation, and final quality checks

- [ ] T022 [P] Run ShellCheck on `.github/scripts/run-agent.sh` and fix all reported issues
- [ ] T023 Verify all 6 workflow YAML files have valid syntax (no broken `${{ }}` expressions, correct indentation)
- [ ] T024 Run `bun run type-check` and `bun run lint` to ensure no regressions in the broader project

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — Claude path in script
- **US4 (Phase 4)**: Depends on Phase 3 — workflows need working script to reference
- **US2 (Phase 5)**: Depends on Phase 2 — Codex path in script (independent of US1/US4)
- **US3 (Phase 6)**: Depends on Phase 5 — AGENTS.md is part of Codex setup
- **US5 (Phase 7)**: Depends on Phases 3 and 5 — enhances both agent paths
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no dependencies on other stories
- **US4 (P1)**: Depends on US1 — workflows must reference a working script
- **US2 (P2)**: Depends on Foundational only — independent of US1/US4 (different code path)
- **US3 (P2)**: Depends on US2 — AGENTS.md is used by Codex path
- **US5 (P3)**: Depends on US1 + US2 — enhances error handling for both paths

### Within Each User Story

- Functions before wiring
- Core behavior before edge cases
- Script changes before workflow changes

### Parallel Opportunities

- **Phase 2**: T003 and T004 can run in parallel (different functions)
- **Phase 3**: T005 and T006 can run in parallel (different functions, same file)
- **Phase 4**: T008-T013 modify different workflow files — all can run in parallel after T007
- **Phase 5**: T014, T015, T016 can run in parallel (different functions)
- **Phase 6**: T018 and T019 are sequential (function then integration)
- **Phase 8**: T022 and T023 can run in parallel

---

## Parallel Example: User Story 4 (Workflow Updates)

```
# All workflow updates can run in parallel (different files):
Task T008: Update iterate.yml
Task T009: Update cleanup.yml
Task T010: Update quick-impl.yml
Task T011: Update ai-board-assist.yml
Task T012: Update verify.yml
Task T013: Update speckit.yml
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 4)

1. Complete Phase 1: Setup (script skeleton)
2. Complete Phase 2: Foundational (validation, helpers)
3. Complete Phase 3: US1 — Claude path works in run-agent.sh
4. Complete Phase 4: US4 — All 6 workflows use run-agent.sh
5. **STOP and VALIDATE**: Dispatch a workflow with `agent=CLAUDE` and confirm zero regression
6. Deploy if ready — all existing functionality preserved

### Incremental Delivery

1. Setup + Foundational → Script skeleton ready
2. US1 + US4 → Zero-regression Claude path through unified script (MVP!)
3. US2 + US3 → Codex agent fully supported
4. US5 → Enhanced error handling for edge cases
5. Polish → ShellCheck clean, YAML validated

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. After Foundational:
   - **Track A**: US1 → US4 (Claude path + workflow updates)
   - **Track B**: US2 → US3 (Codex path + AGENTS.md)
3. After both tracks: US5 (error handling enhancements)
4. Polish phase last

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database changes — this is pure infrastructure (shell script + YAML)
- Claude path MUST be zero-regression — identical behavior to current hardcoded approach
- Environment variables (telemetry) stay in workflow YAML env blocks — run-agent.sh reads them, doesn't set them
- run-agent.sh must be executable and use `set -euo pipefail`
- Commit after each task or logical group
