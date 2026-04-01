# Data Model: Finalize Universal Workflows

**Feature Branch**: `AIB-475-finalize-universal-workflows`
**Date**: 2026-04-01

---

## Overview

This feature does NOT introduce new database entities or modify the Prisma schema. All changes are to GitHub Actions workflow YAML files and shell scripts. The "data model" for this feature is the configuration schema and script interfaces.

---

## Entity: `.ai-board/config.yml` (Configuration File)

**Location**: `<target-repo>/.ai-board/config.yml`
**Format**: YAML v1 schema

### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | integer | Yes | — | Schema version (currently `1`) |
| `project.name` | string | Yes | — | Project display name |
| `project.language` | string | Yes | — | Primary language (typescript, python, go, etc.) |
| `project.framework` | string | No | — | Framework (nextjs, django, gin, etc.) |
| `runtime.manager` | string | Yes | — | Package manager (bun, npm, yarn, pnpm) |
| `runtime.manager_version` | string | No | — | Package manager version |
| `runtime.node` | string | No | — | Node.js version |
| `commands.install` | string | Yes | — | Dependency install command |
| `commands.build` | string | No | — | Build command |
| `commands.lint` | string | No | — | Lint command |
| `commands.type_check` | string | No | — | Type-check command |
| `commands.test_unit` | string | No | — | Unit test command |
| `commands.test_integration` | string | No | — | Integration test command |
| `commands.test_e2e` | string | No | — | E2E test command |
| `env.*` | string | No | — | Environment variables (key-value pairs) |
| `agent.cli` | string | Yes | — | Agent CLI (claude-code, codex) |
| `agent.model` | string | No | — | Default model identifier |

### Validation Rules

- `version` must equal `1`
- `runtime.manager` must be one of: `bun`, `npm`, `yarn`, `pnpm`
- `agent.cli` must be one of: `claude-code`, `codex`
- YAML must be syntactically valid (FR-015: parse error on invalid YAML)
- Empty string values treated as undefined (FR-005)

---

## Entity: `run-command.sh` Interface

**Location**: `.github/scripts/run-command.sh`

### Input Parameters

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `$1` | path | Yes | Target directory containing `.ai-board/config.yml` |
| `$2` | string | Yes | Command key (one of the 7 defined keys) |

### Valid Command Keys

`install`, `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e`

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Command succeeded OR key not found/empty (silent skip) |
| 1 | Command failed (exit code passed through) |
| 2 | Invalid YAML in config file (parse error) |
| N | Any non-zero exit from the executed command (passed through) |

### State Transitions

```
Input: (target-dir, command-key)
  │
  ├─ Config missing? ──► Use fallback defaults table
  │                          │
  │                          ├─ Key in fallback? ──► Execute fallback command ──► Return exit code
  │                          └─ Key NOT in fallback? ──► Exit 0 (silent skip)
  │
  ├─ Config invalid YAML? ──► Exit 2 with error message
  │
  └─ Config valid
       │
       ├─ Key found & non-empty? ──► Execute command in target-dir ──► Return exit code
       ├─ Key found & empty string? ──► Exit 0 (silent skip)
       └─ Key not found? ──► Exit 0 (silent skip)
```

---

## Entity: `setup-environment.sh` Mode Parameter

**Location**: `.github/scripts/setup-environment.sh`

### Input Parameters (Extended)

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `$1` | path | Yes | Target directory |
| `--mode` | string | No | `lightweight` (default) or `full` |

### Mode Behaviors

| Step | lightweight | full |
|------|------------|------|
| yq bootstrap | ✓ | ✓ |
| Config validation | ✓ | ✓ |
| Symlink creation | ✓ | ✓ |
| Runtime install (bun/node) | ✓ | ✓ |
| Git config | ✓ | ✓ |
| Agent CLI install | ✓ | ✓ |
| Dependency install | ✗ | ✓ |
| Prisma detect + generate/migrate | ✗ | ✓ |
| Playwright detect + install | ✗ | ✓ |
| Env vars export | ✗ | ✓ |

---

## Entity: Workflow Service Inputs

### New Inputs (added to applicable workflows)

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `needs_postgres` | boolean | `true` | Start PostgreSQL container |
| `postgres_version` | string | `'14'` | PostgreSQL version |
| `needs_redis` | boolean | `false` | Start Redis container |
| `redis_version` | string | `'7'` | Redis version |
| `needs_mysql` | boolean | `false` | Start MySQL container |
| `mysql_version` | string | `'8'` | MySQL version |
| `needs_mongo` | boolean | `false` | Start MongoDB container |
| `mongo_version` | string | `'7'` | MongoDB version |

### Conditional Image Expression Pattern

```yaml
services:
  postgres:
    image: ${{ inputs.needs_postgres == 'true' && format('postgres:{0}', inputs.postgres_version || '14') || '' }}
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_board_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

When `needs_postgres` is `false`, `image` resolves to `''` and no container starts.
