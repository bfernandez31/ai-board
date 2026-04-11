# Workflow: Gemini CLI Execution in run-agent.sh

## Overview

New `GEMINI` case in `.github/scripts/run-agent.sh` following the existing agent pattern.

## Functions

### `validate_auth()` — GEMINI case

```bash
GEMINI)
  if [[ -z "${GEMINI_API_KEY:-}" ]] && [[ -z "${GEMINI_OAUTH_TOKEN:-}" ]]; then
    log_error "GEMINI_API_KEY or GEMINI_OAUTH_TOKEN is required for agent type GEMINI"
    exit 1
  fi
  ;;
```

### `install_gemini()`

1. Check `command -v gemini` — skip if already installed
2. Install: `npm install -g @anthropic-ai/gemini-cli` (or official installer — confirm at implementation)
3. Verify: `command -v gemini` — fatal error if not found

### `setup_gemini_telemetry()`

Configure native OTLP export:
```bash
export GEMINI_TELEMETRY_ENABLED=1
# OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_PROTOCOL
# are already set by the workflow environment
```

### `invoke_gemini()`

1. Resolve command file via `resolve_command_file()`
2. Read prompt from command file + append ARGS
3. Set model: `GEMINI_MODEL:-gemini-2.5-pro`
4. Invoke: `gemini --headless --prompt "$(cat $prompt_file)"` (exact CLI flags TBD at implementation)

### Main Dispatch

```bash
GEMINI)
  validate_auth
  install_gemini
  setup_gemini_telemetry
  invoke_gemini
  ;;
```

Note: Unlike Mistral, no post-execution telemetry collection needed — Gemini uses native OTLP streaming.

## Workflow YAML Changes

### Credential Fetch (speckit.yml, quick-impl.yml, iterate.yml)

Add to the agent→provider case statement:
```bash
GEMINI) PROVIDER="GOOGLE" ;;
```

No other workflow YAML changes needed — the `agent` input is already passed through to `run-agent.sh`.
