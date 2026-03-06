# Data Model: Agent Runner Script

**Feature Branch**: `AIB-231-create-agent-runner`
**Date**: 2026-03-06

## Entities

This feature is infrastructure-level (shell script + workflow YAML). There are no database entities. The "data model" consists of the script's interface contract and configuration entities.

### Agent Type (Enumeration)

| Value | CLI Package | Auth Variable | Conventions File |
|-------|-------------|---------------|-----------------|
| `CLAUDE` | `@anthropic-ai/claude-code` | `CLAUDE_CODE_OAUTH_TOKEN` | `CLAUDE.md` (native) |
| `CODEX` | `@openai/codex` | `OPENAI_API_KEY` | `AGENTS.md` (generated) |

### Script Interface

**File**: `.github/scripts/run-agent.sh`

**Required Inputs** (positional arguments):
| Position | Name | Description | Example |
|----------|------|-------------|---------|
| 1 | `AGENT_TYPE` | Agent enum value | `CLAUDE`, `CODEX` |
| 2 | `COMMAND` | ai-board command identifier | `ai-board.specify`, `ai-board.plan` |
| 3+ | `ARGS` | Command arguments (remainder) | `"$payload"`, `"--continue"` |

**Required Environment Variables** (set by workflow):
| Variable | Used By | Purpose |
|----------|---------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | CLAUDE | Authentication |
| `OPENAI_API_KEY` | CODEX | Authentication |
| `ANTHROPIC_MODEL` | CLAUDE | Model selection |
| `CODEX_MODEL` | CODEX | Model selection (default: `o3`) |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | CLAUDE | Telemetry toggle |
| `OTEL_LOGS_EXPORTER` | CLAUDE | OTLP config |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | CLAUDE | OTLP config |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Both | OTLP endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | Both | OTLP auth |
| `OTEL_RESOURCE_ATTRIBUTES` | Both | OTLP metadata |

### Telemetry Configuration (Codex)

**File**: `~/.codex/config.toml` (generated at runtime)

```toml
[otel]
log_user_prompt = true
environment = "ci"

[otel.exporter."otlp-http"]
endpoint = "<OTEL_EXPORTER_OTLP_ENDPOINT>"
protocol = "binary"
headers = { "Authorization" = "Bearer <token>" }
```

### AGENTS.md (Generated File)

**Location**: Target repo working directory root
**Source**: `CLAUDE.md` from target repo
**Constraint**: Must be under 32KB (Codex limit)
**Lifecycle**: Generated before Codex command invocation; not committed to git

## State Transitions

```
run-agent.sh execution flow:
┌─────────────┐
│  Validate    │─── Missing secret ──→ EXIT(1) with error message
│  Auth        │
└──────┬──────┘
       │
┌──────▼──────┐
│  Install     │─── bun add fails ──→ EXIT(1) with install error
│  CLI         │
└──────┬──────┘
       │
┌──────▼──────┐
│  Setup       │─── CODEX: generate AGENTS.md, write config.toml
│  Environment │    CLAUDE: no-op (env vars sufficient)
└──────┬──────┘
       │
┌──────▼──────┐
│  Invoke      │─── CLAUDE: claude --dangerously-skip-permissions "/{cmd} {args}"
│  Command     │    CODEX: cat .md file + args | codex exec --full-auto -
└──────┬──────┘
       │
┌──────▼──────┐
│  Propagate   │─── Forward CLI exit code to caller
│  Exit Code   │
└─────────────┘
```
