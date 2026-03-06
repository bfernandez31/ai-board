# Contract: run-agent.sh Interface

## Synopsis

```bash
run-agent.sh <AGENT_TYPE> <COMMAND> [ARGS...]
```

## Arguments

| Argument | Required | Values | Description |
|----------|----------|--------|-------------|
| `AGENT_TYPE` | Yes | `CLAUDE`, `CODEX` | Selects which AI agent CLI to use |
| `COMMAND` | Yes | `ai-board.*` | Command identifier (maps to slash command or .md file) |
| `ARGS` | No | any string | Additional arguments passed to the command |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Command executed successfully |
| 1 | Validation error (missing secret, unsupported agent, missing .md file) |
| * | Propagated from underlying CLI tool |

## Environment Variables

### Required (per agent)

**CLAUDE**:
- `CLAUDE_CODE_OAUTH_TOKEN` — OAuth token for Claude Code authentication

**CODEX**:
- `OPENAI_API_KEY` — API key for OpenAI Codex authentication

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEX_MODEL` | `o3` | Model for Codex CLI |
| `ANTHROPIC_MODEL` | (none) | Model for Claude CLI (set in workflow env) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (none) | OTLP endpoint for telemetry |
| `OTEL_EXPORTER_OTLP_HEADERS` | (none) | OTLP auth headers |
| `OTEL_RESOURCE_ATTRIBUTES` | (none) | OTLP resource attributes |

## Behavior by Agent Type

### CLAUDE

1. Validates `CLAUDE_CODE_OAUTH_TOKEN` is set
2. Installs `@anthropic-ai/claude-code` via `bun add -g`
3. Invokes: `claude --dangerously-skip-permissions "/$COMMAND $ARGS"`
4. Propagates exit code

### CODEX

1. Validates `OPENAI_API_KEY` is set
2. Installs `@openai/codex` via `bun add -g`
3. Authenticates: `codex login --api-key "$OPENAI_API_KEY"`
4. Generates `AGENTS.md` from `CLAUDE.md` (if exists, enforces 32KB limit)
5. Writes `~/.codex/config.toml` for telemetry (if OTEL endpoint configured)
6. Reads `.claude/commands/${COMMAND}.md`, concatenates with `$ARGS`
7. Pipes prompt to: `codex exec --full-auto -m "$CODEX_MODEL" -`
8. Propagates exit code

## Error Messages

| Condition | Message |
|-----------|---------|
| Missing `CLAUDE_CODE_OAUTH_TOKEN` for CLAUDE | `ERROR: CLAUDE_CODE_OAUTH_TOKEN is required for agent type CLAUDE` |
| Missing `OPENAI_API_KEY` for CODEX | `ERROR: OPENAI_API_KEY is required for agent type CODEX` |
| Unsupported agent type | `ERROR: Unsupported agent type '{type}'. Supported: CLAUDE, CODEX` |
| Missing command .md file (CODEX) | `ERROR: Command file not found: .claude/commands/{command}.md` |
| CLI installation failure | `ERROR: Failed to install {package}` |

## Workflow Integration

### Before (current)
```yaml
- name: Install Claude Code CLI
  run: bun add -g @anthropic-ai/claude-code
- name: Run command
  run: claude --dangerously-skip-permissions "/ai-board.specify $payload"
```

### After (with run-agent.sh)
```yaml
- name: Run agent command
  run: .github/scripts/run-agent.sh "${{ inputs.agent }}" "ai-board.specify" "$payload"
```
