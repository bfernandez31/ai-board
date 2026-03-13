#!/usr/bin/env bash
set -euo pipefail

# Unified agent runner script for GitHub workflows
# Abstracts CLI installation, authentication, telemetry, and command invocation
# across Claude Code and Codex CLI agents.

AGENT_TYPE="${1:?ERROR: AGENT_TYPE is required (CLAUDE or CODEX)}"
COMMAND="${2:?ERROR: COMMAND is required (e.g., ai-board.specify)}"
shift 2
ARGS="$*"

# --- Logging helpers ---

log_info() {
  echo "ℹ️  [run-agent] $*"
}

log_error() {
  echo "❌ [run-agent] ERROR: $*" >&2
}

# --- Validation ---

validate_auth() {
  case "$AGENT_TYPE" in
    CLAUDE)
      if [[ -z "${ANTHROPIC_API_KEY:-}" ]] && [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
        log_error "ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN is required for agent type CLAUDE"
        exit 1
      fi
      ;;
    CODEX)
      if [[ -z "${OPENAI_API_KEY:-}" ]] && [[ -z "${CODEX_AUTH_JSON:-}" ]]; then
        log_error "OPENAI_API_KEY or CODEX_AUTH_JSON is required for agent type CODEX"
        exit 1
      fi
      ;;
  esac
}

fetch_project_credentials() {
  if [[ -z "${APP_URL:-}" ]] || [[ -z "${WORKFLOW_API_TOKEN:-}" ]] || [[ -z "${PROJECT_ID:-}" ]]; then
    log_error "APP_URL, WORKFLOW_API_TOKEN, and PROJECT_ID are required to load project API keys"
    exit 1
  fi

  log_info "Fetching project-scoped API key for ${AGENT_TYPE}"

  local response
  response=$(curl -sS -w '\n%{http_code}' \
    "${APP_URL}/api/projects/${PROJECT_ID}/agent-credentials?agent=${AGENT_TYPE}" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}")

  local status
  status=$(echo "$response" | tail -n 1)
  local body
  body=$(echo "$response" | sed '$d')

  if [[ "$status" != "200" ]]; then
    local message
    message=$(BODY="$body" node -e "try { const data = JSON.parse(process.env.BODY || '{}'); process.stdout.write(data.error || 'Project API key not configured'); } catch { process.stdout.write('Project API key not configured'); }")
    log_error "$message"
    exit 1
  fi

  local api_key
  api_key=$(BODY="$body" node -e "const data = JSON.parse(process.env.BODY || '{}'); if (!data.apiKey) process.exit(1); process.stdout.write(data.apiKey)")

  case "$AGENT_TYPE" in
    CLAUDE)
      export ANTHROPIC_API_KEY="$api_key"
      unset CLAUDE_CODE_OAUTH_TOKEN
      ;;
    CODEX)
      export OPENAI_API_KEY="$api_key"
      unset CODEX_AUTH_JSON
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
  if ! bun add -g @anthropic-ai/claude-code; then
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
  if ! bun add -g @openai/codex; then
    log_error "Failed to install @openai/codex"
    exit 1
  fi
  if ! command -v codex &>/dev/null; then
    log_error "Failed to install @openai/codex — CLI binary not found after install"
    exit 1
  fi
  log_info "Codex CLI installed successfully"

  log_info "Authenticating Codex CLI..."
  if [[ -n "${CODEX_AUTH_JSON:-}" ]]; then
    # OAuth token flow: restore auth.json from base64-encoded secret
    mkdir -p ~/.codex
    echo "$CODEX_AUTH_JSON" | base64 -d > ~/.codex/auth.json
    chmod 600 ~/.codex/auth.json
    log_info "Codex authenticated via OAuth token (auth.json)"
  else
    # API key flow
    codex login --api-key "$OPENAI_API_KEY"
    log_info "Codex authenticated via API key"
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
  cat ~/.codex/config.toml
}

generate_agents_md() {
  if [[ ! -f "CLAUDE.md" ]]; then
    log_info "No CLAUDE.md found — skipping AGENTS.md generation"
    return 0
  fi

  log_info "Generating AGENTS.md from CLAUDE.md..."
  cp CLAUDE.md AGENTS.md

  local file_size
  file_size=$(wc -c < AGENTS.md)
  local max_size=32768  # 32KB

  if (( file_size > max_size )); then
    log_info "AGENTS.md is ${file_size} bytes (> 32KB) — truncating..."
    head -c "$max_size" AGENTS.md > AGENTS.md.tmp

    # Append truncation notice
    printf '\n\n<!-- TRUNCATED: Original file exceeded 32KB Codex limit -->\n' >> AGENTS.md.tmp
    mv AGENTS.md.tmp AGENTS.md
  fi

  log_info "AGENTS.md generated ($(wc -c < AGENTS.md) bytes)"
}

invoke_codex() {
  local command_file=".claude/commands/${COMMAND}.md"

  if [[ ! -f "$command_file" ]]; then
    log_error "Command file not found: $command_file"
    exit 1
  fi

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
  echo "$prompt" | codex exec --full-auto -m "$model" -c "reasoning_effort=\"$reasoning\"" -
}

# --- Main dispatch ---

case "$AGENT_TYPE" in
  CLAUDE)
    fetch_project_credentials
    validate_auth
    install_claude
    invoke_claude
    ;;
  CODEX)
    fetch_project_credentials
    validate_auth
    install_codex
    setup_codex_telemetry
    generate_agents_md
    invoke_codex
    ;;
  *)
    log_error "Unsupported agent type '$AGENT_TYPE'. Supported: CLAUDE, CODEX"
    exit 1
    ;;
esac
