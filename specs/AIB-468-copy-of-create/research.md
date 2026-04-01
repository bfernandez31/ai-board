# Research: setup-environment.sh

**Feature**: AIB-468 — Create centralized setup-environment.sh script
**Date**: 2026-04-01

## Research Question 1: YAML Parser Selection

**Decision**: Use `yq` v4 (Mike Farah's Go-based version) with explicit installation as a bootstrap step

**Rationale**:
- `yq` is NOT pre-installed on GitHub Actions `ubuntu-latest` runners (verified: no existing workflows use it)
- However, `yq` can be installed in a single line: `sudo snap install yq` or via direct binary download (~3MB)
- `yq` provides reliable, spec-compliant YAML parsing — avoids fragile regex/sed-based approaches
- The spec's auto-resolved Decision 1 chose `yq` with a bash fallback for low-confidence scenarios

**Alternatives Considered**:
- **Pure bash parsing (grep/sed/awk)**: Fragile with nested YAML, quoting issues, multiline values. Rejected — too error-prone for production CI.
- **Python `pyyaml`**: Python 3.x is available on runners, but adds a heavyweight dependency for simple key-value extraction. Rejected — overkill.
- **`dasel`**: Similar to `yq` but less widely adopted. Rejected — `yq` has broader community support.

**Implementation**: Install `yq` at script start via direct binary download (fastest, no snap/apt):
```bash
YQ_VERSION="v4.44.1"
sudo wget -qO /usr/local/bin/yq "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64"
sudo chmod +x /usr/local/bin/yq
```

## Research Question 2: Package Manager Installation Approaches

**Decision**: Use GitHub Actions setup actions where available (via composite actions or inline steps), with direct installation for managers not covered by actions

**Rationale**:
- Existing workflows already use `oven-sh/setup-bun@v1` and `actions/setup-node@v4` — proven patterns
- However, `setup-environment.sh` is a bash script, not a workflow YAML, so it cannot use GitHub Actions directly
- The script must install tools via CLI commands

**Package Manager Installation Methods**:
| Manager | Installation Method |
|---------|-------------------|
| bun | `curl -fsSL https://bun.sh/install \| bash` (with version pinning via `BUN_INSTALL_VERSION`) |
| npm | Comes with Node.js — install Node.js via `nvm` or `actions/setup-node` (pre-step) |
| yarn | `corepack enable && corepack prepare yarn@<version> --activate` (Node.js 16.10+) |
| pnpm | `corepack enable && corepack prepare pnpm@<version> --activate` (Node.js 16.10+) |

**Key Insight**: Since the script runs AFTER `actions/setup-node` (which must remain a workflow step for caching), the script focuses on package-manager-specific setup and `bun install`/`yarn install`/etc. Runtime installation (Node.js, Python) should remain as workflow-level `uses:` actions for caching benefits. The script handles everything AFTER runtime availability.

**Revised Approach**: The script assumes Node.js is already available (installed by workflow step) and focuses on:
1. Package manager activation (corepack for yarn/pnpm, direct install for bun)
2. Dependency installation (`commands.install`)
3. Agent CLI installation
4. Env var export
5. Symlink creation
6. Validation

## Research Question 3: Environment Variable Merge Strategy

**Decision**: Config `env` values are exported first, then workflow-level variables (already in environment) naturally take precedence since they're set before script execution

**Rationale**:
- Spec Decision 3 requires workflow-level env vars to override config values
- In bash, `export VAR=value` only sets if not already set when using `${VAR:-default}` pattern
- Implementation: For each config env var, use `export VAR="${VAR:-$config_value}"` — preserves existing values

**Alternatives Considered**:
- **Always overwrite**: Would allow config to override secrets — security risk. Rejected.
- **Skip if set**: Correct approach — secrets remain intact.

**Security Consideration**: Never echo/log env var values during the merge process. Only log variable names being set.

## Research Question 4: Symlink Strategy

**Decision**: Use `ln -sf` (force symlink) with relative paths from target repo

**Rationale**:
- Existing workflows use `ln -sf ../../ai-board/.claude-plugin/commands target/.claude/commands`
- The `-f` flag handles re-run idempotency (overwrites existing symlinks)
- Relative paths work because the workflow checks out both repos side-by-side

**Implementation**:
```bash
mkdir -p "${TARGET_DIR}/.claude"
ln -sf "../../ai-board/.claude-plugin/commands" "${TARGET_DIR}/.claude/commands"
ln -sf "../../ai-board/.claude-plugin/skills" "${TARGET_DIR}/.claude/skills"
```

**Note**: The relative path `../../ai-board/` assumes the standard checkout layout where `ai-board` and the target repo are sibling directories. This is documented in the spec's Assumptions section.

## Research Question 5: Agent CLI Installation

**Decision**: Install agent CLI based on `agent.cli` config field using npm/bun global install

**Rationale**:
- `claude-code`: Install via `npm install -g @anthropic-ai/claude-code` (or `bun install -g`)
- `codex`: Install via `npm install -g @openai/codex` (or equivalent)
- The specific install command depends on the package manager available

**Implementation**:
```bash
case "$AGENT_CLI" in
  claude-code) npm install -g @anthropic-ai/claude-code ;;
  codex) npm install -g @openai/codex ;;
  *) echo "ERROR: Unsupported agent CLI: $AGENT_CLI"; exit 1 ;;
esac
```

## Research Question 6: Existing Setup Infrastructure

**Decision**: Place script at `.github/scripts/setup-environment.sh` alongside existing `setup-test-env.sh`

**Rationale**:
- `.github/scripts/` already contains `setup-test-env.sh` for test environment setup
- `setup-environment.sh` handles the broader environment setup (runtime, deps, agent, symlinks)
- `setup-test-env.sh` handles test-specific env file generation (`.env` from `.env.test` template)
- These are complementary — `setup-environment.sh` runs first, `setup-test-env.sh` runs after for test workflows

**Duplicated Blocks Being Replaced** (from workflow analysis):
| Pattern | Lines per workflow | Occurrences | Total duplicated lines |
|---------|-------------------|-------------|----------------------|
| Symlink creation | 8 | 6 | 48 |
| Dependency installation | 4 | 4 | 16 |
| Project dependency detection | 15 | 3 | 45 |
| Prisma setup | 12 | 4 | 48 |
| Git configuration | 4 | 5 | 20 |
| Agent CLI check | varies | 5 | ~25 |
| **Total** | | | **~200 lines** |

## Research Question 7: Validation Step

**Decision**: Script performs final validation checking all expected outcomes before exiting successfully

**Validation Checklist**:
1. Package manager is available on PATH
2. `node_modules/` (or equivalent) exists after install
3. Agent CLI is available on PATH
4. Symlinks exist and point to valid targets
5. All config env vars are exported

**On failure**: Print which check failed with actionable fix suggestion, exit with code 1.
