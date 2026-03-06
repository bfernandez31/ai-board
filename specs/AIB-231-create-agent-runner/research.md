# Research: Agent Runner Script

**Feature Branch**: `AIB-231-create-agent-runner`
**Date**: 2026-03-06

## R-001: Current Workflow Patterns

**Decision**: All 6 workflows follow identical patterns for CLI installation, telemetry, and symlink setup
**Rationale**: Confirmed by inspecting all workflow YAML files — patterns are uniform across speckit.yml, quick-impl.yml, verify.yml, cleanup.yml, ai-board-assist.yml, and iterate.yml

### Installation Pattern (all workflows)
```bash
bun add -g @anthropic-ai/claude-code
```

### Invocation Pattern (all workflows)
```bash
claude --dangerously-skip-permissions "/ai-board.{command} [payload]"
```

### Telemetry Environment Variables (all workflows)
```yaml
CLAUDE_CODE_ENABLE_TELEMETRY: "1"
OTEL_LOGS_EXPORTER: "otlp"
OTEL_EXPORTER_OTLP_PROTOCOL: "http/json"
OTEL_EXPORTER_OTLP_ENDPOINT: "${{ vars.APP_URL }}/api/telemetry"
OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer ${{ secrets.WORKFLOW_API_TOKEN }}"
OTEL_RESOURCE_ATTRIBUTES: "job_id=${{ inputs.job_id }}"
```

### Symlink Setup (all workflows)
```bash
mkdir -p target/.claude
ln -sf ../../ai-board/.claude-plugin/commands target/.claude/commands
ln -sf ../../ai-board/.claude-plugin/skills target/.claude/skills
```

### Agent Input Status
| Workflow | Has `agent` input | Default | Used in invocations? |
|----------|------------------|---------|---------------------|
| speckit.yml | Yes | `'CLAUDE'` | No |
| quick-impl.yml | **No** | — | — |
| verify.yml | Yes | required | No |
| cleanup.yml | Yes | required | No |
| ai-board-assist.yml | Yes | required | Only forwards to iterate.yml |
| iterate.yml | Yes | required | No |

**Key Finding**: `agent` input exists but is unused in actual CLI invocations. quick-impl.yml is missing it entirely.

---

## R-002: Codex CLI (@openai/codex) Capabilities

**Decision**: Use `@openai/codex` package with `codex exec --full-auto` for CI/CD execution
**Rationale**: Confirmed via npm registry and official documentation

### Package & Installation
- Package: `@openai/codex` (npm)
- Install: `npm i -g @openai/codex` (or `bun add -g @openai/codex`)

### Authentication
```bash
codex login --api-key "$OPENAI_API_KEY"
```
Or pipe via stdin: `printenv OPENAI_API_KEY | codex login --with-api-key`

### Execution Flags
- `--full-auto`: Sets approval to `on-request`, sandbox to `workspace-write`
- `-m` / `--model`: Override model per run (e.g., `-m o3`)
- Prompt via stdin: `codex exec --full-auto - < prompt.txt`

### AGENTS.md Auto-Discovery
- Codex reads `AGENTS.md` from project root automatically
- Walks directory tree root-down, one file per directory
- Combined size capped at 32KB (`project_doc_max_bytes`)
- Fallback filenames configurable in `config.toml`

### Telemetry Configuration
File: `~/.codex/config.toml`
```toml
[otel]
log_user_prompt = true
environment = "ci"

[otel.exporter."otlp-http"]
endpoint = "https://example.com/v1/logs"
protocol = "binary"
headers = { "Authorization" = "Bearer token" }
```

**Limitation**: `codex exec` supports traces and logs but not metrics.

### Prompt Delivery for Long Content
- Direct argument: `codex exec "prompt text"`
- Stdin: `codex exec --full-auto - < prompt.txt`
- Stdin is preferred for long .md file content to avoid shell argument limits

---

## R-003: AGENTS.md Generation Strategy

**Decision**: Generate AGENTS.md by copying CLAUDE.md content with size enforcement
**Rationale**: Codex reads AGENTS.md automatically; content must stay under 32KB
**Alternatives Considered**:
1. Symlink CLAUDE.md → AGENTS.md — rejected: fragile in CI, Codex may not follow symlinks
2. Subset extraction — rejected: over-engineering; CLAUDE.md is already concise and likely under 32KB

### Implementation
- Copy CLAUDE.md content to AGENTS.md in target repo root
- Check size; if >32KB, truncate with a "truncated" notice
- Only generate for `agent=CODEX`; skip for `agent=CLAUDE`

---

## R-004: Script Location and Structure

**Decision**: Place `run-agent.sh` in `.github/scripts/` directory (ai-board repo)
**Rationale**: Aligns with existing `.github/scripts/` convention; all workflows already sparse-checkout this directory
**Alternatives Considered**:
1. Place in target repos — rejected: violates centralized multi-repo architecture
2. Place in `.claude-plugin/` — rejected: not a Claude-specific artifact; it's workflow infrastructure

### Existing Scripts
- `.github/scripts/fetch-telemetry.sh` — telemetry retrieval
- `.github/scripts/setup-test-env.sh` — environment setup

---

## R-005: Command Invocation Mapping (Claude vs Codex)

**Decision**: Claude uses slash commands; Codex reads .md file content as prompt
**Rationale**: Each CLI has a native command execution paradigm

### Claude Invocation
```bash
claude --dangerously-skip-permissions "/ai-board.{command} $ARGS"
```

### Codex Invocation
```bash
# Read command .md file, concatenate with args, pipe to codex
COMMAND_FILE=".claude/commands/ai-board.{command}.md"
PROMPT="$(cat "$COMMAND_FILE")\n\n$ARGS"
echo "$PROMPT" | codex exec --full-auto -m "$CODEX_MODEL" -
```

### Key Differences
| Aspect | Claude | Codex |
|--------|--------|-------|
| Permission bypass | `--dangerously-skip-permissions` | `--full-auto` |
| Command routing | Slash commands (native) | .md file content as prompt |
| Auth env var | `CLAUDE_CODE_OAUTH_TOKEN` | `OPENAI_API_KEY` |
| Project conventions | Reads CLAUDE.md | Reads AGENTS.md |
| Telemetry | Environment variables | `~/.codex/config.toml` |
| Model override | `ANTHROPIC_MODEL` env var | `--model` flag |

---

## R-006: Model Configuration

**Decision**: Default Codex model is `o3`; configurable via `CODEX_MODEL` env var
**Rationale**: `o3` is OpenAI's capable code model; env var override allows future flexibility without script changes
**Alternatives Considered**:
1. Hardcode model — rejected: inflexible as OpenAI releases new models
2. Workflow input — rejected: adds complexity; env var is simpler for CI
