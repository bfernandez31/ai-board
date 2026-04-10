# Workflow Artifact: Mistral (vibe CLI) Execution

**Branch**: `AIB-593-add-mistral-vibe`

## Overview

Defines how the `run-agent.sh` script handles the MISTRAL agent type for all workflow stages (specify, plan, implement, quick-impl, verify, iterate, assist).

## run-agent.sh Extensions

### New Functions

#### `validate_auth` (MISTRAL case)
```bash
MISTRAL)
  if [[ -z "${MISTRAL_API_KEY:-}" ]]; then
    log_error "MISTRAL_API_KEY is required for agent type MISTRAL"
    exit 1
  fi
  ;;
```

#### `install_mistral`
```bash
install_mistral() {
  if command -v vibe &>/dev/null; then
    log_info "vibe CLI already installed — skipping"
    return 0
  fi
  log_info "Installing vibe CLI..."
  if ! pip install vibe-cli >&2; then
    log_error "Failed to install vibe-cli"
    exit 1
  fi
  if ! command -v vibe &>/dev/null; then
    log_error "Failed to install vibe-cli — CLI binary not found after install"
    exit 1
  fi
  log_info "vibe CLI installed successfully"
}
```

#### `setup_mistral_telemetry`
```bash
setup_mistral_telemetry() {
  # Disable Mistral's built-in datalake telemetry (data governance requirement)
  export VIBE_TELEMETRY=false

  if [[ -z "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
    log_info "No OTEL_EXPORTER_OTLP_ENDPOINT set — skipping Mistral telemetry config"
    return 0
  fi

  # Enable OTLP trace export to platform endpoint
  export OTEL_TRACES_EXPORTER=otlp
  export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs"
  export OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json

  log_info "Mistral telemetry configured: datalake=disabled, OTLP traces=enabled"
}
```

#### `invoke_mistral`
```bash
invoke_mistral() {
  local command_file
  command_file=$(resolve_command_file "$COMMAND") || exit 1

  local model="${MISTRAL_MODEL:-mistral-large-latest}"
  local prompt
  prompt="$(cat "$command_file")"

  if [[ -n "$ARGS" ]]; then
    prompt="${prompt}

${ARGS}"
  fi

  log_info "Invoking vibe: model=$model, command=$command_file"
  echo "$prompt" | vibe --profile agent -m "$model" -
}
```

### Main Dispatch Extension

```bash
case "$AGENT_TYPE" in
  CLAUDE)
    validate_auth; install_claude; invoke_claude ;;
  CODEX)
    validate_auth; install_codex; auth_codex; setup_codex_telemetry; invoke_codex; persist_codex_token ;;
  MISTRAL)
    validate_auth; install_mistral; setup_mistral_telemetry; invoke_mistral ;;
  *)
    log_error "Unsupported agent type '$AGENT_TYPE'. Supported: CLAUDE, CODEX, MISTRAL"
    exit 1 ;;
esac
```

## Workflow YAML Extensions

### Environment Variables (all workflow files)

Add to the `env:` block of agent execution steps:

```yaml
env:
  # ... existing vars ...
  MISTRAL_API_KEY: ${{ secrets.MISTRAL_API_KEY }}  # Fallback; overridden by credential system
```

The credential injection step (already in speckit.yml:221-252) handles Mistral automatically because:
1. The `agent` input is passed to the workflow
2. `AGENT_PROVIDER_MAP[MISTRAL]` resolves to `MISTRAL` provider
3. The internal credentials API returns `{ envVar: "MISTRAL_API_KEY", ... }`
4. The value is exported to `$GITHUB_ENV` as `MISTRAL_API_KEY`

### OTEL Resource Attributes

Already configured in workflows:
```yaml
OTEL_RESOURCE_ATTRIBUTES: "job_id=${{ inputs.job_id }}"
```
No changes needed — vibe reads standard OTEL environment variables.

## Execution Flow

```
1. Workflow dispatched with agent=MISTRAL
2. Credential fetched from /api/internal/credentials?provider=MISTRAL
3. MISTRAL_API_KEY exported to environment
4. run-agent.sh MISTRAL <command> [args]
   a. validate_auth → check MISTRAL_API_KEY present
   b. install_mistral → pip install vibe-cli (if not cached)
   c. setup_mistral_telemetry → disable datalake, enable OTLP traces
   d. invoke_mistral → pipe command file to vibe --profile agent
5. vibe executes, emits OTLP traces to /api/telemetry/v1/logs
6. Job status updated to COMPLETED or FAILED
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing MISTRAL_API_KEY | Exit 1 with clear error message |
| pip install fails | Exit 1 with install error |
| vibe binary not found after install | Exit 1 with not-found error |
| Python 3.12+ not available | pip install fails (vibe requires 3.12+) — captured in install error |
| vibe non-zero exit | Job marked FAILED, output captured in logs |
| API rate limit during execution | vibe handles retries internally; if ultimate failure, non-zero exit |
| API key revoked mid-execution | vibe fails on next API call; non-zero exit |
