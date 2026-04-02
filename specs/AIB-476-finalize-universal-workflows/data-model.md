# Data Model: Finalize Universal Workflows

**Feature**: AIB-476 — run-command.sh + Conditional Services
**Date**: 2026-04-01

## Note

This feature modifies GitHub Actions workflow YAML files and shell scripts only. There are **no database schema changes** — no new Prisma models, no migrations required.

## Entity: config.yml Schema (`.ai-board/config.yml`)

Existing schema, no changes needed. Relevant fields for this feature:

```yaml
version: 1                          # Schema version (required, must be 1)

project:
  name: string                      # Project display name (required)
  language: string                  # Primary language (required)
  framework: string                 # Optional framework identifier

runtime:
  manager: enum(bun|npm|yarn|pnpm)  # Package manager (required)
  manager_version: string           # Optional pinned version
  node: string                      # Optional Node.js version

commands:                           # Project-specific command mappings
  install: string                   # Dependency installation (required)
  build: string                     # Build command (optional)
  lint: string                      # Lint command (optional)
  type_check: string                # Type checking (optional)
  test_unit: string                 # Unit test runner (optional)
  test_integration: string          # Integration test runner (optional)
  test_e2e: string                  # E2E test runner (optional)

env:                                # Environment variable overrides
  [key]: string                     # Key-value pairs exported to env

agent:
  cli: enum(claude-code|codex)      # Agent CLI to use (required)
  model: string                     # Optional model override
```

## Entity: Workflow Service Inputs

New inputs added to workflow YAML files that support test execution:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `needs_postgres` | boolean | `false` | Provision PostgreSQL container |
| `needs_redis` | boolean | `false` | Provision Redis container |
| `needs_mysql` | boolean | `false` | Provision MySQL container |
| `needs_mongo` | boolean | `false` | Provision MongoDB container |
| `postgres_version` | string | `'14'` | PostgreSQL image tag |
| `redis_version` | string | `'7'` | Redis image tag |
| `mysql_version` | string | `'8'` | MySQL image tag |
| `mongo_version` | string | `'7'` | MongoDB image tag |

## Entity: run-command.sh Interface

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `$1` | path | Yes | Target directory containing `.ai-board/config.yml` |
| `$2` | string | Yes | Command key (e.g., `install`, `test_unit`, `test_e2e`) |
| Exit code | int | — | 0 if key/config missing (skip), command's exit code otherwise |

## Entity: setup-environment.sh Phase Parameter

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `$1` | path | Yes | — | Target directory |
| `--phase` | enum | No | `full` | `lightweight`: symlinks + runtime only; `full`: all setup steps |

### Phase Breakdown

| Step | lightweight | full |
|------|:-----------:|:----:|
| yq bootstrap | ✓ | ✓ |
| Config validation | ✓ | ✓ |
| Package manager install | ✓ | ✓ |
| Symlink creation | ✓ | ✓ |
| Dependency install | — | ✓ |
| Agent CLI install | — | ✓ |
| Env variable export | — | ✓ |
| Prisma detection + generate | — | ✓ |
| Playwright detection | — | ✓ |
| Final validation | ✓ (partial) | ✓ (full) |
