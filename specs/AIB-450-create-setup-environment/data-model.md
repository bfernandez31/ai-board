# Data Model: setup-environment.sh

**Feature**: AIB-450 — Create setup-environment.sh Script
**Date**: 2026-04-01

## Overview

This feature has no database entities. The "data model" is the `.ai-board/config.yml` schema that the script parses. This document defines the config structure, field types, validation rules, and defaults.

## Entity: Config File (`.ai-board/config.yml`)

### Schema Definition

```yaml
version: 1                          # REQUIRED — integer, currently only 1

project:                             # OPTIONAL section
  name: string                       # Display name (informational only)
  language: string                   # typescript | python | go | rust | java
  framework: string                  # nextjs | express | fastapi | django | gin | none

runtime:                             # REQUIRED section
  manager: string                    # REQUIRED — bun | npm | yarn | pnpm
  manager_version: string            # OPTIONAL — semver or major version (e.g., "1.2", "4.1", "9")
  node: string                       # OPTIONAL — Node.js major version (default: latest LTS)
  python: string                     # OPTIONAL — Python version (future use)

services:                            # OPTIONAL section — map of service configs
  [service_name]:                    # postgres | redis | mysql | mongo
    version: string                  # Service version
    database: string                 # DB name (postgres/mysql/mongo only)
    user: string                     # DB user
    password: string                 # DB password

commands:                            # REQUIRED section
  install: string                    # REQUIRED — dependency install command
  build: string                      # OPTIONAL — build command
  lint: string                       # OPTIONAL — lint command
  type_check: string                 # OPTIONAL — type check command
  test_unit: string                  # OPTIONAL — unit test command
  test_integration: string           # OPTIONAL — integration test command
  test_e2e: string                   # OPTIONAL — e2e test command

env:                                 # OPTIONAL section — map of key-value pairs
  [KEY]: string                      # Environment variable name → value

agent:                               # REQUIRED section
  cli: string                        # REQUIRED — claude-code | codex
  model: string                      # OPTIONAL — model identifier (e.g., claude-opus-4-6)
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `version` | Must equal `1` | "Unsupported config version: {value}. Expected: 1" |
| `runtime.manager` | Must be one of: bun, npm, yarn, pnpm | "Unsupported package manager: '{value}'. Supported: bun, npm, yarn, pnpm" |
| `runtime.manager` | If pip, poetry, cargo → special warning | "Package manager '{value}' is not yet supported. Python/Go/Rust support coming soon." |
| `commands.install` | Must be non-empty string | "Missing required field: commands.install" |
| `agent.cli` | Must be one of: claude-code, codex | "Unsupported agent CLI: '{value}'. Supported: claude-code, codex" |
| Config file exists | `.ai-board/config.yml` must exist at target root | "Missing .ai-board/config.yml in {target_dir}" |

### Default Values

| Field | Default |
|-------|---------|
| `runtime.node` | Latest LTS (currently "22") |
| `runtime.manager_version` | Latest stable of the chosen manager |
| `env` | Empty (no extra env vars) |
| `services` | Empty (no sidecar services) |
| `agent.model` | Not used by setup script (passed through to agent) |

### Relationships

```
config.yml
├── runtime.manager ──→ determines which package manager to install
├── runtime.node ──→ determines Node.js version validation
├── commands.install ──→ executed after package manager is ready
├── agent.cli ──→ determines which global CLI to install
├── env.* ──→ exported to $GITHUB_ENV or shell environment
└── services.* ──→ NOT handled by setup-environment.sh (handled by workflow services: block)
```

### State Transitions

The script itself is stateless — it reads config and executes steps sequentially. However, the setup process has an implicit state machine:

```
START
  → [1] Parse Config (fail → EXIT with parse error)
  → [2] Validate Required Fields (fail → EXIT with validation error)
  → [3] Verify Node.js (warn if version mismatch)
  → [4] Install Package Manager (fail → EXIT with install error)
  → [5] Run Install Command (fail → EXIT with install error)
  → [6] Install Agent CLI (fail → EXIT with CLI error)
  → [7] Export Env Vars
  → [8] Create Symlinks (fail if real dir conflict → EXIT)
  → [9] Validation Summary
  → SUCCESS
```

Each step is atomic — failure at any step halts execution (fail-fast).
