# Feature Specification: Create Agent Runner Script for GitHub Workflows

**Feature Branch**: `AIB-231-create-agent-runner`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Create a unified agent runner script that abstracts CLI installation, authentication, telemetry, and command invocation across multiple AI agents (Claude Code, Codex CLI) for all GitHub workflow files."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AGENTS.md strategy — create a generated file in the target repo rather than a symlink to CLAUDE.md
- **Policy Applied**: PRAGMATIC (via AUTO recommendation)
- **Confidence**: Medium (0.6) — internal infrastructure feature with clear requirements
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A generated AGENTS.md avoids symlink fragility in CI environments and respects the 32KB limit for Codex
  2. Requires maintaining AGENTS.md generation logic if CLAUDE.md conventions change
- **Reviewer Notes**: Verify that generated AGENTS.md content stays within Codex's 32KB limit and includes essential project conventions

---

- **Decision**: Codex model selection mechanism — use `--model` flag on `codex exec` rather than a config file
- **Policy Applied**: PRAGMATIC (via AUTO recommendation)
- **Confidence**: Medium (0.6) — `--model` flag is simpler and more explicit for CI usage
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. CLI flag is transparent and auditable in workflow logs
  2. Less flexible than config file if multiple model settings are needed, but CI only needs one model per run
- **Reviewer Notes**: Confirm Codex CLI supports `--model` flag with `codex exec` subcommand

---

- **Decision**: Command .md file resolution path for Codex — read from `.claude/commands/` symlink (same path available in CI after workflow setup step)
- **Policy Applied**: PRAGMATIC (via AUTO recommendation)
- **Confidence**: Medium (0.6) — all workflows already create `.claude/commands` symlink during setup
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reuses existing symlink infrastructure; no new file paths to maintain
  2. Relies on the symlink being created before `run-agent.sh` is called (already guaranteed by workflow step ordering)
- **Reviewer Notes**: Ensure the command .md file path resolution handles both self-management (ai-board) and external project scenarios

---

- **Decision**: Script location — `.github/scripts/run-agent.sh` in the ai-board repository (not in target repos)
- **Policy Applied**: PRAGMATIC (via AUTO recommendation)
- **Confidence**: High (0.8) — aligns with existing `.github/scripts/` convention and multi-repo architecture
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Centralized in ai-board means one place to update; all projects benefit immediately
  2. Requires sparse checkout of `.github/scripts` (already done in all workflows)
- **Reviewer Notes**: Confirm sparse checkout includes `.github/scripts` directory in all 6 workflows

---

- **Decision**: Codex default model — use `o3` as the default Codex model (OpenAI's most capable model for code generation)
- **Policy Applied**: PRAGMATIC (via AUTO recommendation)
- **Confidence**: Medium (0.6) — reasonable default that can be overridden via environment variable
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. `o3` provides strong coding capability comparable to Claude Opus for this use case
  2. Model choice may need updating as OpenAI releases new models; environment variable override mitigates this
- **Reviewer Notes**: Verify `o3` availability and pricing; consider making model configurable via workflow input or repository variable

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workflow Executes with Claude Agent (Priority: P1)

A project configured to use the Claude agent triggers any of the 6 GitHub workflows. The workflow calls `run-agent.sh` with `CLAUDE` as the agent type. The script installs Claude Code CLI, sets up authentication via OAuth token, configures telemetry environment variables, and invokes the command using Claude's native slash command syntax. The behavior is identical to the current hardcoded implementation.

**Why this priority**: This is the zero-regression path. All existing projects use Claude, so this must work identically to current behavior before any new agent support matters.

**Independent Test**: Can be fully tested by running any workflow with `agent=CLAUDE` and verifying the command executes successfully with the same output as the current hardcoded approach.

**Acceptance Scenarios**:

1. **Given** a workflow dispatched with `agent=CLAUDE`, **When** `run-agent.sh` executes, **Then** `@anthropic-ai/claude-code` is installed, `CLAUDE_CODE_OAUTH_TOKEN` is used for auth, and the command is invoked via `claude --dangerously-skip-permissions "/ai-board.xxx $ARGS"`
2. **Given** a workflow dispatched with `agent=CLAUDE` and telemetry enabled, **When** `run-agent.sh` executes, **Then** all `OTEL_*` and `CLAUDE_CODE_ENABLE_TELEMETRY` environment variables are passed through unchanged
3. **Given** a workflow dispatched with `agent=CLAUDE`, **When** the command completes, **Then** the exit code from `claude` is propagated to the calling workflow step

---

### User Story 2 - Workflow Executes with Codex Agent (Priority: P2)

A project configured to use the Codex agent triggers a GitHub workflow. The workflow calls `run-agent.sh` with `CODEX` as the agent type. The script installs Codex CLI, sets up authentication via OpenAI API key, reads the command's `.md` file content, configures Codex telemetry, and invokes the command by injecting the `.md` content as a prompt to `codex exec --full-auto`.

**Why this priority**: This is the new capability that enables multi-agent support. It depends on P1 being stable (shared script infrastructure).

**Independent Test**: Can be tested by running a workflow with `agent=CODEX` and an `OPENAI_API_KEY` secret, verifying CLI installation, command .md content injection, and successful execution.

**Acceptance Scenarios**:

1. **Given** a workflow dispatched with `agent=CODEX`, **When** `run-agent.sh` executes, **Then** `@openai/codex` is installed, `OPENAI_API_KEY` is used for auth, and the command is invoked via `codex exec` with the .md file content injected as prompt text
2. **Given** a Codex workflow invoking `/ai-board.specify`, **When** `run-agent.sh` resolves the command, **Then** it reads `.claude/commands/ai-board.specify.md`, concatenates the prompt content with the provided arguments, and passes the combined text to `codex exec --full-auto`
3. **Given** a workflow dispatched with `agent=CODEX` and OTLP telemetry configured, **When** `run-agent.sh` executes, **Then** it writes `~/.codex/config.toml` with an `[otel]` section pointing to the same OTLP endpoint used by Claude

---

### User Story 3 - AGENTS.md Generated for Codex Convention Reading (Priority: P2)

When the Codex agent is selected, the runner script generates an `AGENTS.md` file in the target repository's working directory. This file contains the essential project conventions from `CLAUDE.md` so that Codex can automatically read them (Codex reads `AGENTS.md` by convention, similar to how Claude reads `CLAUDE.md`).

**Why this priority**: Without AGENTS.md, Codex would execute commands without project context, leading to poor-quality output that violates project conventions.

**Independent Test**: Can be tested by verifying that when `agent=CODEX`, an `AGENTS.md` file is created in the target repo working directory with content derived from CLAUDE.md, and that the file is under 32KB.

**Acceptance Scenarios**:

1. **Given** a workflow dispatched with `agent=CODEX`, **When** `run-agent.sh` prepares the environment, **Then** an `AGENTS.md` file is created in the target repo root containing project conventions
2. **Given** a generated `AGENTS.md`, **When** its size is checked, **Then** it is under 32KB (Codex's documented limit)
3. **Given** a workflow dispatched with `agent=CLAUDE`, **When** `run-agent.sh` prepares the environment, **Then** no `AGENTS.md` file is created or modified (CLAUDE.md is sufficient)

---

### User Story 4 - All 6 Workflows Updated to Use Unified Script (Priority: P1)

All 6 GitHub workflow files (speckit.yml, quick-impl.yml, verify.yml, cleanup.yml, ai-board-assist.yml, iterate.yml) replace their hardcoded `bun add -g @anthropic-ai/claude-code` and `claude --dangerously-skip-permissions` calls with invocations of `run-agent.sh`, passing the agent type from the workflow input.

**Why this priority**: The script only delivers value when workflows actually use it. This is a structural prerequisite for multi-agent support across the platform.

**Independent Test**: Can be tested by verifying each workflow YAML file references `run-agent.sh` for CLI installation and command invocation, and that the `agent` input is passed through.

**Acceptance Scenarios**:

1. **Given** any of the 6 workflow files, **When** its YAML is inspected, **Then** it no longer contains hardcoded `bun add -g @anthropic-ai/claude-code` or direct `claude` CLI invocations for command execution
2. **Given** a workflow that previously invoked `claude --dangerously-skip-permissions "/ai-board.xxx"`, **When** updated, **Then** it calls `run-agent.sh` with the agent type, command name, and arguments
3. **Given** the `speckit.yml` workflow with its `agent` input defaulting to `CLAUDE`, **When** dispatched without specifying an agent, **Then** the workflow behaves identically to the current implementation

---

### User Story 5 - Graceful Error Handling for Missing Secrets (Priority: P3)

When a workflow is dispatched with an agent type but the required authentication secret is missing or empty, the script fails early with a clear error message indicating which secret is needed.

**Why this priority**: Prevents confusing failures deep in execution when secrets are misconfigured.

**Independent Test**: Can be tested by running the script with an empty auth token for the selected agent and verifying the error message.

**Acceptance Scenarios**:

1. **Given** `agent=CODEX` and `OPENAI_API_KEY` is not set, **When** `run-agent.sh` starts, **Then** it exits with a non-zero code and a message indicating `OPENAI_API_KEY` is required for Codex
2. **Given** `agent=CLAUDE` and `CLAUDE_CODE_OAUTH_TOKEN` is not set, **When** `run-agent.sh` starts, **Then** it exits with a non-zero code and a message indicating `CLAUDE_CODE_OAUTH_TOKEN` is required for Claude

---

### Edge Cases

- What happens when an unsupported agent type is passed (e.g., `GEMINI`)? The script exits with a clear error listing supported agents.
- What happens when the command `.md` file doesn't exist for Codex? The script exits with an error indicating the file path it tried to read.
- What happens when `AGENTS.md` generation produces content exceeding 32KB? The script truncates or summarizes to stay within the limit.
- What happens when `codex exec` is invoked with a very long prompt (large `.md` file + arguments)? The script passes the prompt via stdin or a temporary file to avoid shell argument length limits.
- What happens when `bun add -g` fails for either CLI? The script exits with a clear installation error rather than proceeding with a missing CLI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a unified shell script (`run-agent.sh`) that accepts agent type, command identifier, and arguments as parameters
- **FR-002**: System MUST install the correct CLI tool based on agent type — `@anthropic-ai/claude-code` for Claude, `@openai/codex` for Codex
- **FR-003**: System MUST configure authentication for the selected agent — `CLAUDE_CODE_OAUTH_TOKEN` for Claude, `OPENAI_API_KEY` for Codex
- **FR-004**: System MUST invoke commands using the agent's native execution mode — slash commands for Claude, prompt injection from `.md` files for Codex
- **FR-005**: System MUST configure telemetry for the selected agent — environment variables for Claude, `~/.codex/config.toml` with `[otel]` section for Codex
- **FR-006**: System MUST generate an `AGENTS.md` file for Codex containing essential project conventions from `CLAUDE.md`, respecting the 32KB size limit
- **FR-007**: System MUST validate that required authentication secrets are present before attempting CLI operations, failing early with descriptive error messages
- **FR-008**: System MUST propagate the exit code from the underlying CLI tool to the calling workflow step
- **FR-009**: All 6 GitHub workflow files MUST be updated to use `run-agent.sh` instead of hardcoded Claude CLI installation and invocation
- **FR-010**: System MUST support the `agent` workflow input parameter (defaulting to `CLAUDE`) across all workflows that don't already have it
- **FR-011**: The Claude execution path through `run-agent.sh` MUST produce identical behavior to the current hardcoded workflow steps (zero regression)

### Key Entities

- **Agent Runner Script**: The central shell script (`run-agent.sh`) that encapsulates agent-specific logic for CLI installation, auth, telemetry, and command invocation
- **Agent Type**: An enumerated value (`CLAUDE` or `CODEX`) that determines which CLI, auth mechanism, and invocation strategy to use
- **Command Identifier**: A reference to an ai-board command (e.g., `ai-board.specify`, `ai-board.plan`) that maps to both a slash command (Claude) and an `.md` file (Codex)
- **AGENTS.md**: A generated project instructions file that Codex reads automatically, containing conventions derived from CLAUDE.md

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing workflows continue to pass when dispatched with `agent=CLAUDE` — zero regression in command execution, commit behavior, and job status updates
- **SC-002**: A workflow dispatched with `agent=CODEX` successfully installs the Codex CLI, authenticates, and invokes a command within the same timeout limits as Claude workflows
- **SC-003**: The `run-agent.sh` script handles all 6 workflow files, reducing duplicated CLI setup code by consolidating installation and invocation into a single reusable script
- **SC-004**: Missing authentication secrets are detected and reported within 5 seconds of script start, before any CLI installation attempt
- **SC-005**: Generated `AGENTS.md` files remain under 32KB for all target repositories
- **SC-006**: Telemetry data from Codex workflows reaches the same OTLP endpoint as Claude workflows, enabling unified observability

### Assumptions

- `OPENAI_API_KEY` secret will be added to the GitHub repository settings before Codex workflows are dispatched
- Codex CLI (`@openai/codex`) is available via `bun add -g` on the GitHub Actions runner environment
- The `codex exec --full-auto` command accepts prompt text as a positional argument and executes autonomously
- Codex CLI reads `AGENTS.md` from the working directory automatically (documented behavior)
- The existing `.claude/commands/` symlink setup step runs before `run-agent.sh` in all workflows
