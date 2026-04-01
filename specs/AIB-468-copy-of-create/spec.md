# Feature Specification: Create setup-environment.sh Script

**Feature Branch**: `AIB-468-copy-of-create`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Create a centralized setup-environment.sh script that reads .ai-board/config.yml from target repos and handles all environment setup automatically, replacing duplicated setup blocks across workflow files."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Config File Format and Parser

- **Decision**: Use YAML format for `.ai-board/config.yml` with `yq` as the parser (falling back to basic bash parsing if `yq` is unavailable)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (0.3) — absScore=1, single signal bucket
- **Fallback Triggered?**: Yes — confidence < 0.5, AUTO promoted to CONSERVATIVE
- **Trade-offs**:
  1. YAML is human-readable and widely adopted for CI/CD configuration; `yq` is a standard tool in GitHub Actions runners
  2. Requiring `yq` adds a dependency but avoids fragile regex-based parsing
- **Reviewer Notes**: Verify that `yq` is available on all GitHub Actions runner images used by the project. If not, a lightweight install step or bash fallback must be included.

### Decision 2: Unsupported Runtime/Manager Behavior

- **Decision**: The script MUST fail immediately with a clear error message when encountering an unsupported runtime or package manager, rather than silently skipping or attempting a best-effort fallback
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback applied due to low confidence
- **Trade-offs**:
  1. Fail-fast prevents silent misconfiguration that could cause hard-to-debug downstream failures
  2. Requires updating the script when new runtimes/managers are added
- **Reviewer Notes**: Confirm that the set of supported managers (bun, npm, yarn, pnpm) and runtimes (node, python) covers all current and near-term project needs.

### Decision 3: Env Var Merge Strategy

- **Decision**: Workflow-level environment variables (secrets) take precedence over values defined in `.ai-board/config.yml` `env` section. Config values serve as defaults only.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE via fallback)
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback for security-adjacent decision (secrets should never be overridden by config files)
- **Trade-offs**:
  1. Prevents config files from accidentally or maliciously overriding secrets
  2. May require documentation so users understand the precedence order
- **Reviewer Notes**: Validate that secret values are never logged or echoed during the merge process.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workflow Author Runs Setup for a Standard Project (Priority: P1)

A workflow author invokes the setup script from a GitHub Actions workflow step, pointing it at a target repository directory that contains a valid `.ai-board/config.yml`. The script reads the config, installs the specified runtime and package manager, runs the install command, installs the agent CLI, exports environment variables, and creates plugin symlinks. The workflow proceeds with a fully configured environment.

**Why this priority**: This is the core purpose of the script. Without this working end-to-end, no other scenarios matter.

**Independent Test**: Can be fully tested by creating a minimal `.ai-board/config.yml` with bun/node settings and running the script against it, then verifying that all tools are installed and symlinks exist.

**Acceptance Scenarios**:

1. **Given** a target directory with a valid `.ai-board/config.yml` specifying `runtime.manager: bun` and `agent.cli: claude-code`, **When** the script is executed with that directory as argument, **Then** bun is installed at the specified version, dependencies are installed, Claude Code CLI is available, env vars are exported, and `.claude/commands` and `.claude/skills` symlinks point to the plugin directories.
2. **Given** a target directory with a valid config specifying `runtime.manager: npm` and `runtime.node: "22"`, **When** the script is executed, **Then** Node.js 22 is available and `npm install` is executed successfully.
3. **Given** a target directory with a valid config that includes an `env` section, **When** the script is executed, **Then** all env vars from the config are exported and available to subsequent workflow steps.

---

### User Story 2 - Script Handles Missing or Invalid Configuration (Priority: P2)

A workflow author runs the setup script against a target directory that is missing `.ai-board/config.yml` or has an invalid/malformed config file. The script detects the problem immediately and fails with a clear, actionable error message indicating what is wrong and how to fix it.

**Why this priority**: Robust error handling prevents silent failures that waste CI minutes and produce confusing downstream errors.

**Independent Test**: Can be tested by running the script against a directory with no config file, then against one with invalid YAML, and verifying error messages are clear and exit codes are non-zero.

**Acceptance Scenarios**:

1. **Given** a target directory with no `.ai-board/config.yml` file, **When** the script is executed, **Then** it exits with a non-zero code and prints an error message stating the config file is missing and its expected location.
2. **Given** a target directory with a malformed `.ai-board/config.yml` (invalid YAML syntax), **When** the script is executed, **Then** it exits with a non-zero code and prints an error message indicating the config file could not be parsed.
3. **Given** a config file missing required fields (e.g., no `runtime.manager`), **When** the script is executed, **Then** it exits with a non-zero code and lists the specific missing fields.

---

### User Story 3 - Script Supports Multiple Package Managers (Priority: P2)

A workflow author has projects using different package managers (bun, npm, yarn, pnpm). Each project's `.ai-board/config.yml` specifies its manager. The setup script correctly installs and uses the appropriate manager for each project.

**Why this priority**: Multi-manager support is a key differentiator from the current hardcoded approach and is required for external project support.

**Independent Test**: Can be tested by creating four config files (one per manager) and running the script against each, verifying the correct manager is installed and the install command executes.

**Acceptance Scenarios**:

1. **Given** a config with `runtime.manager: yarn`, **When** the script is executed, **Then** yarn is installed and `yarn install` (or the configured install command) runs successfully.
2. **Given** a config with `runtime.manager: pnpm`, **When** the script is executed, **Then** pnpm is installed and `pnpm install` (or the configured install command) runs successfully.
3. **Given** a config with `runtime.manager: unsupported-tool`, **When** the script is executed, **Then** it exits with a non-zero code and a clear error listing the supported managers.

---

### User Story 4 - Script Installs Correct Agent CLI (Priority: P3)

A workflow author configures a project to use either Claude Code or Codex as its AI agent. The setup script reads the `agent.cli` field and installs the correct CLI tool.

**Why this priority**: Agent CLI selection is essential for multi-agent support but secondary to core runtime setup.

**Independent Test**: Can be tested by running the script with `agent.cli: claude-code` and verifying the CLI is available, then repeating with `agent.cli: codex`.

**Acceptance Scenarios**:

1. **Given** a config with `agent.cli: claude-code`, **When** the script is executed, **Then** the Claude Code CLI is installed and available on the PATH.
2. **Given** a config with `agent.cli: codex`, **When** the script is executed, **Then** the Codex CLI is installed and available on the PATH.

---

### User Story 5 - Plugin Symlinks Are Created Correctly (Priority: P3)

After setup completes, the target repository has `.claude/commands` and `.claude/skills` symlinks pointing to the ai-board plugin directories, enabling the AI agent to access all commands and skills.

**Why this priority**: Symlinks are the mechanism that connects the agent to the platform's capabilities. Important but straightforward.

**Independent Test**: Can be tested by running the script and verifying symlink targets with `readlink`.

**Acceptance Scenarios**:

1. **Given** a target directory, **When** the script completes successfully, **Then** `.claude/commands` in the target directory is a symlink to the ai-board plugin commands directory.
2. **Given** a target directory, **When** the script completes successfully, **Then** `.claude/skills` in the target directory is a symlink to the ai-board plugin skills directory.
3. **Given** a target directory where `.claude/` does not yet exist, **When** the script is executed, **Then** the directory is created and symlinks are established.

---

### Edge Cases

- What happens when the config specifies a runtime version that is not available for download? The script MUST fail with a clear error including the requested version.
- How does the system handle a config file with extra/unknown fields? The script MUST ignore unknown fields and proceed with known ones (forward compatibility).
- What happens when symlink targets already exist (re-run scenario)? The script MUST overwrite existing symlinks without error.
- What happens when the target directory does not exist? The script MUST fail with an error before attempting any setup.
- What happens when network is unavailable during runtime/CLI installation? The script MUST fail with a clear network-related error message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Script MUST accept a single positional argument specifying the target repository directory
- **FR-002**: Script MUST read and parse `.ai-board/config.yml` from the target directory
- **FR-003**: Script MUST validate that required config fields are present (`runtime.manager`, `commands.install`, `agent.cli`) and fail with specific error messages for missing fields
- **FR-004**: Script MUST install the correct runtime based on `runtime.manager` (supporting bun, npm, yarn, pnpm at minimum)
- **FR-005**: Script MUST install the runtime at the version specified in config (e.g., `runtime.node`, `runtime.manager_version`)
- **FR-006**: Script MUST execute the dependency install command from `commands.install`
- **FR-007**: Script MUST install the agent CLI specified by `agent.cli` (claude-code or codex)
- **FR-008**: Script MUST export all environment variables defined in the config `env` section
- **FR-009**: Workflow-level environment variables MUST take precedence over config-defined env vars (secrets are never overridden)
- **FR-010**: Script MUST create symlinks for `.claude/commands` and `.claude/skills` in the target directory, pointing to the ai-board plugin directories
- **FR-011**: Script MUST overwrite existing symlinks on re-runs without error
- **FR-012**: Script MUST perform a final validation step confirming all expected tools are installed and symlinks are valid
- **FR-013**: Script MUST exit with non-zero status and a clear, actionable error message when any step fails
- **FR-014**: Script MUST fail immediately when encountering an unsupported runtime or package manager
- **FR-015**: Script MUST ignore unknown fields in the config file for forward compatibility

### Key Entities *(include if feature involves data)*

- **Config File** (`.ai-board/config.yml`): Project-level configuration defining runtime, package manager, commands, environment variables, and agent preferences. Key attributes: `runtime.manager`, `runtime.node`, `commands.install`, `agent.cli`, `env` map.
- **Plugin Symlinks**: Filesystem symlinks connecting the target repository's `.claude/` directory to the ai-board platform's command and skill definitions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All supported package managers (bun, npm, yarn, pnpm) can be used to set up a project environment via the script with zero manual intervention
- **SC-002**: Setup errors are detected and reported within 5 seconds of encountering the issue, with messages that identify the problem and suggest a fix
- **SC-003**: The script replaces the duplicated setup blocks in existing workflows, reducing per-workflow setup configuration from 15-20 lines to 2 lines (one script call)
- **SC-004**: A new project can be onboarded to the platform by creating only a `.ai-board/config.yml` file, with no workflow file modifications required
- **SC-005**: Re-running the script on an already-configured environment completes successfully (idempotent behavior)

## Assumptions

- GitHub Actions runners have `yq` available or it can be installed as part of the script's bootstrap
- The ai-board repository is checked out alongside the target repository in the workflow (accessible via relative path `../ai-board/`)
- The `.ai-board/config.yml` schema follows the structure defined in `specs/specifications/platform-opening-design.md` Section 1
- Python runtime support is a future extension; the initial implementation focuses on Node.js-based managers (bun, npm, yarn, pnpm)
- The script runs in a bash environment (GitHub Actions ubuntu runners)
