# Quickstart: setup-environment.sh

**Feature**: AIB-468 — Create centralized setup-environment.sh script

## Prerequisites

- GitHub Actions `ubuntu-latest` runner
- Node.js installed (via `actions/setup-node`)
- ai-board repo checked out as sibling directory to target repo

## Usage

### 1. Create `.ai-board/config.yml` in your project

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

### 2. Call the script from your workflow

```yaml
- name: Setup Environment
  working-directory: target
  run: ../ai-board/.github/scripts/setup-environment.sh .
```

### 3. The script handles

1. Parses your `.ai-board/config.yml`
2. Installs/activates the package manager (bun, npm, yarn, pnpm)
3. Runs `commands.install` to install dependencies
4. Installs the agent CLI (claude-code or codex)
5. Exports environment variables from config (workflow secrets take precedence)
6. Creates `.claude/commands` and `.claude/skills` symlinks
7. Detects project dependencies (Prisma, Playwright)
8. Validates all setup completed successfully

## Local Development

The script can be run locally for testing:

```bash
# From the ai-board repo root, targeting a sibling project
.github/scripts/setup-environment.sh ../my-project
```

## Error Handling

The script fails fast with clear error messages:

```
ERROR: Config file not found: ../my-project/.ai-board/config.yml
ERROR: Missing required field: runtime.manager
ERROR: Unsupported package manager: cargo. Supported: bun, npm, yarn, pnpm
```

## Supported Package Managers

| Manager | Version Source | Install Method |
|---------|--------------|----------------|
| bun | `runtime.manager_version` | Direct binary install |
| npm | Bundled with Node.js | Already available |
| yarn | `runtime.manager_version` | corepack activate |
| pnpm | `runtime.manager_version` | corepack activate |
