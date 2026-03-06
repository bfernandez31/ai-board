# Quickstart: Agent Runner Implementation

**Feature Branch**: `AIB-231-create-agent-runner`

## Implementation Order

### Step 1: Create `run-agent.sh`

**File**: `.github/scripts/run-agent.sh`

Core logic flow:
1. Parse args: `AGENT_TYPE=$1`, `COMMAND=$2`, `ARGS=${@:3}`
2. Validate agent type (CLAUDE|CODEX, else error)
3. Validate auth secret for selected agent
4. Install CLI: `bun add -g <package>`
5. Agent-specific setup (CODEX: login, AGENTS.md, config.toml)
6. Build invocation command
7. Execute and propagate exit code

**Key patterns**:
- Use `set -euo pipefail` for strict error handling
- Use functions for each agent path (`install_claude`, `install_codex`, `invoke_claude`, `invoke_codex`)
- Codex prompt delivery via stdin to handle large .md files

### Step 2: Update Workflows

**For each of the 6 workflows**, replace:
```yaml
# REMOVE these steps:
- name: Install Claude Code CLI
  run: bun add -g @anthropic-ai/claude-code

# And replace claude invocations:
- name: Run command
  run: claude --dangerously-skip-permissions "/ai-board.xxx $ARGS"

# WITH:
- name: Run agent command
  run: .github/scripts/run-agent.sh "${{ inputs.agent }}" "ai-board.xxx" "$ARGS"
```

**Order** (by risk, lowest first):
1. `iterate.yml` — simplest, single command invocation
2. `cleanup.yml` — single command invocation
3. `quick-impl.yml` — single invocation + add missing `agent` input
4. `ai-board-assist.yml` — multiple command branches
5. `verify.yml` — multiple sequential commands
6. `speckit.yml` — most complex (multiple commands, conditionals, loops)

### Step 3: Testing Approach

Since this is CI infrastructure (shell script + YAML), testing is via:
1. **ShellCheck**: Lint `run-agent.sh` for shell scripting errors
2. **Unit tests**: Vitest tests for any helper functions if extracted
3. **Dry-run validation**: Verify YAML syntax with `actionlint` or similar
4. **Integration**: Dispatch test workflow with `agent=CLAUDE` to confirm zero regression

## Critical Constraints

- Claude path MUST be zero-regression (identical behavior to current hardcoded approach)
- Environment variables (telemetry) stay in workflow YAML env blocks — `run-agent.sh` reads them, doesn't set them
- `run-agent.sh` must be executable (`chmod +x`)
- Script must work with both self-management (ai-board) and external project scenarios
