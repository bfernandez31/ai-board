#!/usr/bin/env bash
set -euo pipefail

# Unified agent runner script for GitHub workflows
# Abstracts CLI installation, authentication, telemetry, and command invocation
# across Claude Code and Codex CLI agents.

AGENT_TYPE="${1:?ERROR: AGENT_TYPE is required (CLAUDE, CODEX, or MISTRAL)}"
COMMAND="${2:?ERROR: COMMAND is required (e.g., ai-board.specify)}"
shift 2
ARGS="$*"

# --- Logging helpers ---

log_info() {
  echo "ℹ️  [run-agent] $*" >&2
}

log_error() {
  echo "❌ [run-agent] ERROR: $*" >&2
}

# --- Command file resolution ---
# .claude/ is gitignored so .claude/commands/ won't exist in CI checkouts.
# Search tracked locations: the current repo's .claude-plugin/commands/ first,
# then the ai-board sparse checkout at ../ai-board/.claude-plugin/commands/.

resolve_command_file() {
  local cmd="$1"
  local candidates=(
    ".claude-plugin/commands/${cmd}.md"
    ".claude/commands/${cmd}.md"
    "../ai-board/.claude-plugin/commands/${cmd}.md"
  )
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then
      echo "$f"
      return 0
    fi
  done
  log_error "Command file not found for '${cmd}'. Searched: ${candidates[*]}"
  return 1
}

# --- Validation ---

validate_auth() {
  case "$AGENT_TYPE" in
    CLAUDE)
      if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
        log_error "CLAUDE_CODE_OAUTH_TOKEN is required for agent type CLAUDE"
        exit 1
      fi
      ;;
    CODEX)
      if [[ -z "${OPENAI_API_KEY:-}" ]] && [[ -z "${CODEX_OAUTH_JSON:-}" ]]; then
        log_error "OPENAI_API_KEY or CODEX_OAUTH_JSON is required for agent type CODEX"
        exit 1
      fi
      ;;
    MISTRAL)
      if [[ -z "${MISTRAL_API_KEY:-}" ]]; then
        log_error "MISTRAL_API_KEY is required for agent type MISTRAL"
        exit 1
      fi
      ;;
  esac
}

# --- Claude functions ---

install_claude() {
  if command -v claude &>/dev/null; then
    log_info "Claude Code CLI already installed — skipping"
    return 0
  fi
  log_info "Installing Claude Code CLI..."
  if ! bun add -g @anthropic-ai/claude-code@2.1.87 >&2; then
    log_error "Failed to install @anthropic-ai/claude-code"
    exit 1
  fi
  if ! command -v claude &>/dev/null; then
    log_error "Failed to install @anthropic-ai/claude-code — CLI binary not found after install"
    exit 1
  fi
  log_info "Claude Code CLI installed successfully"
}

invoke_claude() {
  log_info "Invoking Claude: /$COMMAND $ARGS"
  claude --dangerously-skip-permissions "/$COMMAND $ARGS"
}

# --- Codex functions ---

install_codex() {
  if command -v codex &>/dev/null; then
    log_info "Codex CLI already installed — skipping"
    return 0
  fi
  log_info "Installing Codex CLI..."
  if ! bun add -g @openai/codex >&2; then
    log_error "Failed to install @openai/codex"
    exit 1
  fi
  if ! command -v codex &>/dev/null; then
    log_error "Failed to install @openai/codex — CLI binary not found after install"
    exit 1
  fi
  log_info "Codex CLI installed successfully"
}

auth_codex() {
  mkdir -p ~/.codex
  if [[ -n "${CODEX_OAUTH_JSON:-}" ]]; then
    # BYOK credential: raw auth.json content from the credential system
    echo "$CODEX_OAUTH_JSON" > ~/.codex/auth.json
    chmod 600 ~/.codex/auth.json
    log_info "Codex authenticated via OAuth token (BYOK credential)"
  else
    codex login --api-key "$OPENAI_API_KEY" >&2
    log_info "Codex authenticated via API key"
  fi
}

persist_codex_token() {
  # Only persist if we used OAuth (BYOK) and the API is reachable
  if [[ -z "${CODEX_OAUTH_JSON:-}" ]] || [[ -z "${APP_URL:-}" ]] || [[ -z "${WORKFLOW_API_TOKEN:-}" ]]; then
    return 0
  fi

  if [[ ! -f ~/.codex/auth.json ]]; then
    log_info "No auth.json found after Codex run — skipping token persist"
    return 0
  fi

  # Base64-encode the refreshed token (never log the raw value)
  local UPDATED_TOKEN_B64
  UPDATED_TOKEN_B64=$(base64 < ~/.codex/auth.json | tr -d '\n')

  local HTTP_CODE
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "${APP_URL}/api/internal/credentials" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-raw "{\"projectId\":${PROJECT_ID},\"provider\":\"OPENAI\",\"value\":\"${UPDATED_TOKEN_B64}\",\"encoding\":\"base64\"}")

  if [ "$HTTP_CODE" = "200" ]; then
    log_info "Codex OAuth token persisted back to credential store"
  else
    log_info "Failed to persist Codex OAuth token (HTTP $HTTP_CODE) — next run may need re-auth"
  fi
}

setup_codex_telemetry() {
  if [[ -z "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
    log_info "No OTEL_EXPORTER_OTLP_ENDPOINT set — skipping Codex telemetry config"
    return 0
  fi

  log_info "Configuring Codex telemetry in ~/.codex/config.toml..."
  mkdir -p ~/.codex

  # Parse Authorization header from OTEL_EXPORTER_OTLP_HEADERS
  local auth_header=""
  if [[ -n "${OTEL_EXPORTER_OTLP_HEADERS:-}" ]]; then
    auth_header="${OTEL_EXPORTER_OTLP_HEADERS#Authorization=}"
  fi

  # Build OTEL exporter config (matching Codex schema: exporter = { otlp-http = { ... } })
  local otel_config
  otel_config=$(cat <<TOML

[otel]
log_user_prompt = true
environment = "ci"
exporter = { otlp-http = { endpoint = "${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs", protocol = "json", headers = { "Authorization" = "${auth_header}" } } }
trace_exporter = "none"
metrics_exporter = "none"
TOML
  )

  # Append to existing config.toml (preserves model, auth, trust_level, etc.)
  if [[ -f ~/.codex/config.toml ]]; then
    # Remove any existing [otel] section before appending
    sed -i '/^\[otel\]/,/^\[/{ /^\[otel\]/d; /^\[/!d; }' ~/.codex/config.toml
    echo "$otel_config" >> ~/.codex/config.toml
  else
    echo "$otel_config" > ~/.codex/config.toml
  fi

  log_info "Codex telemetry config appended"
  log_info "Config contents:"
  cat ~/.codex/config.toml >&2
}

invoke_codex() {
  local command_file
  command_file=$(resolve_command_file "$COMMAND") || exit 1

  # Reduce OTLP batch export frequency for Vercel cost control.
  # schedule_delay alone isn't enough — the batch processor exports early
  # when max_export_batch_size is reached, so we raise it too.
  export OTEL_BLRP_SCHEDULE_DELAY=60000
  export OTEL_BLRP_MAX_EXPORT_BATCH_SIZE=2048
  export OTEL_BLRP_MAX_QUEUE_SIZE=4096
  log_info "Invoking Codex with command file: $command_file"

  local model="${CODEX_MODEL:-gpt-5.4}"
  local reasoning="${CODEX_REASONING:-high}"
  local prompt
  prompt="$(cat "$command_file")"

  if [[ -n "$ARGS" ]]; then
    prompt="${prompt}

${ARGS}"
  fi

  log_info "Model: $model | Reasoning: $reasoning"
  echo "$prompt" | codex exec --dangerously-bypass-approvals-and-sandbox -m "$model" -c "reasoning_effort=\"$reasoning\"" -
}

# --- Mistral functions ---

install_mistral() {
  if command -v vibe &>/dev/null; then
    log_info "vibe CLI already installed — skipping"
    return 0
  fi
  log_info "Installing vibe CLI..."
  if ! curl -LsSf https://mistral.ai/vibe/install.sh | bash >&2; then
    log_error "Failed to install mistral-vibe"
    exit 1
  fi
  export PATH="${HOME}/.local/bin:${PATH}"
  if ! command -v vibe &>/dev/null; then
    log_error "Failed to install vibe-cli — CLI binary not found after install"
    exit 1
  fi
  log_info "vibe CLI installed successfully"
}

setup_mistral_telemetry() {
  # Disable Mistral datalake telemetry
  export VIBE_TELEMETRY=false

  if [[ -z "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
    log_info "No OTEL_EXPORTER_OTLP_ENDPOINT set — skipping Mistral telemetry config"
    return 0
  fi

  # Configure OTLP trace export for vibe
  # Route traces to /v1/logs (the only implemented telemetry endpoint)
  export OTEL_TRACES_EXPORTER=otlp
  export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs"
  export OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json
  export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
  log_info "Mistral telemetry configured: VIBE_TELEMETRY=false, OTEL traces enabled"
}

configure_mistral_model() {
  local model="$1"
  local vibe_home="${VIBE_HOME:-${HOME}/.vibe}"
  mkdir -p "$vibe_home"

  cat > "$vibe_home/config.toml" <<TOML
active_model = "${model}"

[[models]]
name = "${model}"
provider = "mistral"
alias = "${model}"
TOML

  log_info "Configured vibe model: $model (config: $vibe_home/config.toml)"
}

invoke_mistral() {
  local command_file
  command_file=$(resolve_command_file "$COMMAND") || exit 1

  log_info "Invoking vibe with command file: $command_file"

  local model="${MISTRAL_MODEL:-devstral-medium-latest}"
  configure_mistral_model "$model"

  local prompt
  prompt="$(cat "$command_file")"

  if [[ -n "$ARGS" ]]; then
    prompt="${prompt}

${ARGS}"
  fi

  # Write prompt to temp file, then read back via $(cat) to avoid
  # shell expansion issues with special chars in the markdown
  local prompt_file
  prompt_file="$(mktemp /tmp/vibe-prompt-XXXXXX.md)"
  printf '%s' "$prompt" > "$prompt_file"

  log_info "Model: $model | Prompt file: $prompt_file ($(wc -c < "$prompt_file") bytes)"
  vibe --prompt "$(cat "$prompt_file")" --agent auto-approve
  local exit_code=$?

  rm -f "$prompt_file"
  return $exit_code
}

# --- Main dispatch ---

case "$AGENT_TYPE" in
  CLAUDE)
    validate_auth
    install_claude
    invoke_claude
    ;;
  CODEX)
    validate_auth
    install_codex
    auth_codex
    setup_codex_telemetry
    invoke_codex
    persist_codex_token
    ;;
  MISTRAL)
    validate_auth
    install_mistral
    setup_mistral_telemetry
    invoke_mistral
    ;;
  *)
    log_error "Unsupported agent type '$AGENT_TYPE'. Supported: CLAUDE, CODEX, MISTRAL"
    exit 1
    ;;
esac
