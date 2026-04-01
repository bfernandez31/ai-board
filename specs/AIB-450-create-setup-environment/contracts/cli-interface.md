# Contract: setup-environment.sh CLI Interface

**Feature**: AIB-450 — Create setup-environment.sh Script
**Date**: 2026-04-01

## Interface

```bash
setup-environment.sh <target-dir>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `target-dir` | Yes | Path to the root of the target repository (e.g., `target/`, `./my-project`) |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All setup steps completed successfully |
| 1 | Configuration error (missing config, invalid fields, unsupported values) |
| 2 | Installation error (package manager install failed, CLI install failed) |
| 3 | Filesystem error (symlink conflict with real directory) |

### Environment Variables Read

| Variable | Purpose | Required |
|----------|---------|----------|
| `GITHUB_ACTIONS` | Detect GitHub Actions environment | No (graceful degradation) |
| `GITHUB_ENV` | File path for persisting env vars across steps | No (uses `export` fallback) |

### Environment Variables Written

All key-value pairs from `.ai-board/config.yml` `env:` section are exported, plus:

| Variable | Value | When |
|----------|-------|------|
| Config env vars | From `env:` section | Always |

### Stdout Contract

The script outputs structured log messages for GitHub Actions:

```
::group::Step 1: Parsing .ai-board/config.yml
  Config loaded: runtime.manager=bun, agent.cli=claude-code
::endgroup::

::group::Step 2: Verifying Node.js
  Node.js v22.20.0 detected (config requires: 22) ✓
::endgroup::

::group::Step 3: Installing package manager (bun@1.3.1)
  bun 1.3.1 installed ✓
::endgroup::

::group::Step 4: Installing dependencies
  Running: bun install
  ...
::endgroup::

::group::Step 5: Installing agent CLI (claude-code)
  @anthropic-ai/claude-code installed ✓
::endgroup::

::group::Step 6: Exporting environment variables
  Exported 2 variables from config
::endgroup::

::group::Step 7: Creating plugin symlinks
  .claude/commands → ../../ai-board/.claude-plugin/commands ✓
  .claude/skills → ../../ai-board/.claude-plugin/skills ✓
::endgroup::

✅ Environment setup complete
```

### Stderr Contract (Errors)

```
::error::Missing .ai-board/config.yml in target/
::error::Missing required field: commands.install. Expected: a shell command (e.g., "bun install")
::error::Unsupported package manager: 'pip'. Supported: bun, npm, yarn, pnpm
::error::Real directory exists at target/.claude/commands — remove or rename it before running setup
```

### Filesystem Side Effects

| Path | Action | Condition |
|------|--------|-----------|
| `<target>/.claude/` | Created (mkdir -p) | Always |
| `<target>/.claude/commands` | Symlink → `../../ai-board/.claude-plugin/commands` | Always (replaces existing symlink) |
| `<target>/.claude/skills` | Symlink → `../../ai-board/.claude-plugin/skills` | Always (replaces existing symlink) |

### Idempotency Guarantees

- Running the script multiple times with the same config produces the same result
- Existing symlinks are replaced atomically via `ln -sfn`
- Package manager and CLI re-installation is handled by the underlying tools (npm, corepack)
- Env var export is additive (does not clear previous values)

### Invocation from Workflows

```yaml
# In any workflow YAML
- name: Setup environment
  run: ../ai-board/.github/scripts/setup-environment.sh target/
```

Replaces the current 15-20 line setup blocks across speckit.yml, quick-impl.yml, iterate.yml, verify.yml, ai-board-assist.yml, and health-scan.yml.
