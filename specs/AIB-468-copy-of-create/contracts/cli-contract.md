# CLI Contract: setup-environment.sh

**Feature**: AIB-468 — Create centralized setup-environment.sh script
**Date**: 2026-04-01

## Interface

```
setup-environment.sh <target-directory>
```

### Arguments

| Argument | Position | Required | Description |
|----------|----------|----------|-------------|
| `target-directory` | 1 | Yes | Absolute or relative path to the target repository root |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — environment fully configured and validated |
| 1 | Error — setup failed (see stderr for details) |

### Environment Variables (Input)

The script reads these from the environment if set (workflow-level secrets/vars):

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Auth for Claude Code CLI |
| `CODEX_AUTH_JSON` | Auth for Codex CLI |
| `GITHUB_TOKEN` | GitHub API access |
| Any workflow secret | Takes precedence over config `env` values |

### Environment Variables (Output)

The script exports:
1. All variables from config `env` section (only if not already set)
2. `HAS_PRISMA` — `true`/`false` based on project detection
3. `HAS_PLAYWRIGHT` — `true`/`false` based on project detection

### Filesystem Side Effects

| Path | Action | Condition |
|------|--------|-----------|
| `<target>/.claude/` | Created (mkdir -p) | Always |
| `<target>/.claude/commands` | Symlink created/replaced | Always |
| `<target>/.claude/skills` | Symlink created/replaced | Always |
| `<target>/node_modules/` | Created by install command | When `commands.install` succeeds |

### Standard Output

The script prints progress messages to stdout:
```
🔧 Parsing .ai-board/config.yml...
📦 Installing dependencies via bun install...
🤖 Installing agent CLI: claude-code...
🔗 Creating plugin symlinks...
🌍 Exporting environment variables...
✅ Environment setup complete. Validation passed.
```

### Standard Error

On failure, error messages go to stderr:
```
ERROR: Target directory does not exist: /path/to/repo
ERROR: Config file not found: /path/to/repo/.ai-board/config.yml
ERROR: Config file parse error: <yq error details>
ERROR: Missing required field: runtime.manager
ERROR: Unsupported package manager: unsupported-tool. Supported: bun, npm, yarn, pnpm
ERROR: Unsupported agent CLI: unknown. Supported: claude-code, codex
ERROR: Validation failed: agent CLI not found on PATH
```

## Workflow Integration

### Before (current — duplicated per workflow)

```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v1
  with:
    bun-version: 1.3.1

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22.20.0'

- name: Install Dependencies
  working-directory: target
  run: bun install --frozen-lockfile

- name: Setup ai-board commands and skills
  run: |
    mkdir -p target/.claude
    ln -sf ../../ai-board/.claude-plugin/commands target/.claude/commands
    ln -sf ../../ai-board/.claude-plugin/skills target/.claude/skills

# ... plus detection, prisma, git config, etc.
```

### After (centralized)

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22.20.0'

- name: Setup Environment
  working-directory: target
  run: ../ai-board/.github/scripts/setup-environment.sh .
```

**Note**: `actions/setup-node` remains a workflow step (for GitHub Actions caching). The script handles everything after runtime availability.

## Config File Contract

### Minimal Valid Config

```yaml
version: 1
project:
  name: "My Project"
  language: typescript
runtime:
  manager: bun
commands:
  install: bun install
agent:
  cli: claude-code
```

### Full Config (all optional fields)

```yaml
version: 1
project:
  name: "AI Board"
  language: typescript
  framework: nextjs
runtime:
  manager: bun
  manager_version: "1.2"
  node: "22"
services:
  postgres:
    version: "16"
    database: ai_board_test
    user: test
    password: test
commands:
  install: bun install
  build: bun run build
  lint: bun run lint
  type_check: bun run type-check
  test_unit: bun run test:unit
  test_integration: bun run test:integration
  test_e2e: bunx playwright test
env:
  DATABASE_URL: postgresql://test:test@localhost:5432/ai_board_test
  NODE_ENV: test
  TEST_MODE: "true"
agent:
  cli: claude-code
  model: claude-opus-4-6
```
