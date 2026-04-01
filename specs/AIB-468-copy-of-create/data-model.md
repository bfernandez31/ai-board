# Data Model: setup-environment.sh

**Feature**: AIB-468 — Create centralized setup-environment.sh script
**Date**: 2026-04-01

## Entities

### 1. Config File (`.ai-board/config.yml`)

The primary data entity — a YAML configuration file that drives all setup behavior.

**Schema**:

```yaml
version: 1                          # Schema version (integer, required)

project:
  name: string                      # Project display name (required)
  language: enum                    # typescript | python | go | rust | java (required)
  framework: string                 # nextjs | express | fastapi | etc. (optional)

runtime:
  manager: enum                     # bun | npm | yarn | pnpm (required)
  manager_version: string           # Package manager version (optional)
  node: string                      # Node.js version, e.g. "22" (optional)
  python: string                    # Python version, e.g. "3.12" (optional)

services:                           # Sidecar services (optional map)
  <service_name>:
    version: string
    database: string                # DB name (postgres/mysql only)
    user: string
    password: string

commands:
  install: string                   # Dependency installation command (required)
  build: string                     # Build command (optional)
  lint: string                      # Lint command (optional)
  type_check: string                # Type check command (optional)
  test_unit: string                 # Unit test command (optional)
  test_integration: string          # Integration test command (optional)
  test_e2e: string                  # E2E test command (optional)

env:                                # Environment variables (optional map)
  <KEY>: <VALUE>                    # String key-value pairs

agent:
  cli: enum                         # claude-code | codex (required)
  model: string                     # Model identifier (optional)
```

**Required Fields**: `version`, `project.name`, `project.language`, `runtime.manager`, `commands.install`, `agent.cli`

**Validation Rules**:
- `version` must equal `1` (current schema version)
- `runtime.manager` must be one of: `bun`, `npm`, `yarn`, `pnpm`
- `agent.cli` must be one of: `claude-code`, `codex`
- `commands.install` must be a non-empty string
- Unknown fields are silently ignored (forward compatibility per FR-015)

### 2. Plugin Symlinks

Filesystem symlinks that connect the target repo to the ai-board platform.

| Symlink Path | Target | Purpose |
|-------------|--------|---------|
| `<target>/.claude/commands` | `../../ai-board/.claude-plugin/commands` | Agent command definitions |
| `<target>/.claude/skills` | `../../ai-board/.claude-plugin/skills` | Agent skill definitions |

**Rules**:
- Parent directory `.claude/` is created if missing
- Existing symlinks are overwritten via `ln -sf`
- Symlinks use relative paths (assumes sibling directory layout)

### 3. Environment Variable Set

Runtime state exported by the script into the shell environment.

| Source | Precedence | Description |
|--------|-----------|-------------|
| Workflow secrets | 1 (highest) | Set before script runs, never overridden |
| Config `env` section | 2 (lowest) | Applied only if variable is not already set |

**Merge Rule**: `export VAR="${VAR:-$config_value}"` — existing values preserved.

## State Transitions

The script itself is stateless, but it transitions the workflow environment through these phases:

```
[Unconfigured Runner]
  → [Config Parsed]
    → [Runtime Ready]
      → [Dependencies Installed]
        → [Agent CLI Available]
          → [Env Vars Exported]
            → [Symlinks Created]
              → [Validated & Ready]
```

Each transition is atomic — failure at any step exits immediately with a clear error message identifying the failed phase.

## Relationships

```
config.yml ──reads──> setup-environment.sh
                          │
                          ├── installs ──> Package Manager (bun/npm/yarn/pnpm)
                          ├── runs ──────> commands.install
                          ├── installs ──> Agent CLI (claude-code/codex)
                          ├── exports ───> env vars (with merge)
                          ├── creates ───> .claude/commands symlink
                          ├── creates ───> .claude/skills symlink
                          └── validates ─> all outcomes
```
