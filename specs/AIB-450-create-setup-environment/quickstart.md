# Quickstart: setup-environment.sh

**Feature**: AIB-450 — Create setup-environment.sh Script

## Prerequisites

- GitHub Actions runner (Ubuntu 22.04+) or local Linux/macOS environment
- `yq` v4 installed (`brew install yq` or pre-installed on GitHub Actions)
- Node.js installed (matching `runtime.node` from config)
- Target repository checked out with `.ai-board/config.yml` present
- ai-board repository checked out (for plugin symlinks)

## Quick Usage

### In a GitHub Actions Workflow

```yaml
steps:
  - name: Checkout ai-board
    uses: actions/checkout@v4
    with:
      path: ai-board
      sparse-checkout: |
        .claude-plugin
        .github/scripts

  - name: Checkout target repository
    uses: actions/checkout@v4
    with:
      repository: ${{ inputs.githubRepository }}
      path: target

  - name: Setup environment
    run: ../ai-board/.github/scripts/setup-environment.sh target/
```

### Locally (for testing)

```bash
# From the workspace root where both repos are checked out
./ai-board/.github/scripts/setup-environment.sh ./target/
```

## Config File Example

Create `.ai-board/config.yml` in the target repository:

```yaml
version: 1

runtime:
  manager: bun
  manager_version: "1.3"
  node: "22"

commands:
  install: bun install

agent:
  cli: claude-code

env:
  NODE_ENV: test
```

## Minimum Required Config

```yaml
version: 1
runtime:
  manager: bun
commands:
  install: bun install
agent:
  cli: claude-code
```

## Verifying Setup

After the script runs successfully:

```bash
# Check package manager
bun --version  # or npm/yarn/pnpm

# Check agent CLI
claude --version  # or codex --version

# Check symlinks
ls -la target/.claude/commands  # Should point to ai-board plugin
ls -la target/.claude/skills    # Should point to ai-board plugin
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing .ai-board/config.yml" | Config not in target repo | Create the config file per schema |
| "Unsupported package manager" | `runtime.manager` not in bun/npm/yarn/pnpm | Update config to use a supported manager |
| "Missing required field: commands.install" | `commands.install` not set | Add the install command to config |
| "Real directory exists at .claude/commands" | Non-symlink directory blocking setup | Remove or rename the directory |
| "yq: command not found" | yq not installed | Install via `brew install yq` or `snap install yq` |
