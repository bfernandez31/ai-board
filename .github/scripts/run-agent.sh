#!/usr/bin/env bash
set -euo pipefail

# Unified agent runner script for GitHub workflows
# Abstracts CLI installation, authentication, telemetry, and command invocation
# across Claude Code, Codex, Mistral, and Gemini CLI agents.

AGENT_TYPE="${1:?ERROR: AGENT_TYPE is required (CLAUDE, CODEX, MISTRAL, or GEMINI)}"
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
    GEMINI)
      if [[ -z "${GEMINI_API_KEY:-}" ]] && [[ -z "${GEMINI_OAUTH_JSON:-}" ]]; then
        log_error "GEMINI_API_KEY or GEMINI_OAUTH_JSON is required for agent type GEMINI"
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
  # Use npm (not bun) — bun 1.3.12+ doesn't add global bin to PATH automatically
  if ! npm install -g @anthropic-ai/claude-code@2.1.87 >&2; then
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
  # Disable Mistral datalake telemetry (data governance)
  export VIBE_TELEMETRY=false
  log_info "Mistral datalake telemetry disabled"
}

collect_mistral_telemetry() {
  # Post-execution: scrape vibe session logs and send batch to telemetry endpoint.
  # Fire-and-forget — never fails the job.

  if [[ -z "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]] || [[ -z "${JOB_ID:-}" ]]; then
    log_info "Skipping telemetry collection (no endpoint or job_id)"
    return 0
  fi

  local vibe_home="${VIBE_HOME:-${HOME}/.vibe}"
  local sessions_dir="${vibe_home}/sessions"

  if [[ ! -d "$sessions_dir" ]]; then
    log_info "No vibe sessions directory found — skipping telemetry"
    return 0
  fi

  # Find the most recent session directory
  local session_dir
  session_dir=$(find "$sessions_dir" -maxdepth 1 -mindepth 1 -type d | sort | tail -1)

  if [[ -z "$session_dir" ]]; then
    log_info "No session directories found — skipping telemetry"
    return 0
  fi

  local metadata_file="${session_dir}/metadata.json"
  if [[ ! -f "$metadata_file" ]]; then
    log_info "No metadata.json in session — skipping telemetry"
    return 0
  fi

  log_info "Collecting telemetry from: $session_dir"

  # Extract token counts from metadata.json stats
  local input_tokens output_tokens model
  input_tokens=$(jq -r '.stats.session_prompt_tokens // 0' "$metadata_file" 2>/dev/null || echo "0")
  output_tokens=$(jq -r '.stats.session_completion_tokens // 0' "$metadata_file" 2>/dev/null || echo "0")
  model=$(jq -r '.config.active_model // empty' "$metadata_file" 2>/dev/null || echo "")

  if [[ -z "$model" ]]; then
    model="${MISTRAL_MODEL:-devstral-medium-latest}"
  fi

  # Extract unique tool names from messages.jsonl (tool_call entries)
  local tools_json="[]"
  local messages_file="${session_dir}/messages.jsonl"
  if [[ -f "$messages_file" ]]; then
    tools_json=$(jq -s '[.[].content? // [] | .[]? | select(.type == "tool_use" or .type == "tool_call") | (.name // .function.name // empty)] | unique' "$messages_file" 2>/dev/null || echo "[]")
    if [[ "$tools_json" == "null" ]] || [[ -z "$tools_json" ]]; then
      tools_json="[]"
    fi
  fi

  # Build and send batch payload
  local payload
  payload=$(jq -n \
    --argjson jobId "$JOB_ID" \
    --argjson inputTokens "$input_tokens" \
    --argjson outputTokens "$output_tokens" \
    --arg model "$model" \
    --argjson toolsUsed "$tools_json" \
    '{jobId: $jobId, inputTokens: $inputTokens, outputTokens: $outputTokens, model: $model, toolsUsed: $toolsUsed}')

  log_info "Sending batch telemetry: inputTokens=$input_tokens, outputTokens=$output_tokens, model=$model, tools=$(echo "$tools_json" | jq -r 'length') tools"

  local auth_header=""
  if [[ -n "${OTEL_EXPORTER_OTLP_HEADERS:-}" ]]; then
    auth_header="${OTEL_EXPORTER_OTLP_HEADERS#Authorization=}"
  fi

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs" \
    -H "Authorization: ${auth_header}" \
    -H "Content-Type: application/json" \
    --data-raw "$payload" \
    --max-time 10) || true

  if [[ "$http_code" == "200" ]]; then
    log_info "Batch telemetry sent successfully"
  else
    log_info "Batch telemetry failed (HTTP $http_code) — non-blocking"
  fi
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

  # Write args to a temp file so vibe can `cat` it instead of
  # wrestling with inline JSON escaping in bash heredocs
  if [[ -n "$ARGS" ]]; then
    local args_file="/tmp/vibe-args.json"
    printf '%s' "$ARGS" > "$args_file"
    prompt="${prompt}

The arguments for this command have been written to ${args_file}. Read them with: cat ${args_file}
Do NOT try to parse the JSON inline in bash — always read from the file."
    log_info "Args written to $args_file ($(wc -c < "$args_file") bytes)"
  fi

  # Write prompt to temp file for safe delivery via $(cat)
  local prompt_file
  prompt_file="$(mktemp /tmp/vibe-prompt-XXXXXX.md)"
  printf '%s' "$prompt" > "$prompt_file"

  log_info "Model: $model | Prompt file: $prompt_file ($(wc -c < "$prompt_file") bytes)"
  log_info "Working directory: $(pwd)"
  # Prefix with explicit execution instruction — vibe's system prompt
  # tells it to "propose a plan and wait for confirmation", which in
  # headless mode means it never executes. This override forces action.
  local exec_prefix="IMPORTANT: You are running in CI/CD headless mode. Do NOT just describe a plan — you MUST execute every step using your tools (bash, write_file, read_file, etc.). Do NOT wait for user confirmation. Act immediately and completely. When a step fails, try a different approach — do NOT retry the same command more than twice."
  vibe --prompt "${exec_prefix}

$(cat "$prompt_file")" --agent auto-approve
  local exit_code=$?

  rm -f "$prompt_file"
  return $exit_code
}

# --- Gemini functions ---

install_gemini() {
  if command -v gemini &>/dev/null; then
    log_info "Gemini CLI already installed — skipping"
    return 0
  fi
  log_info "Installing Gemini CLI..."
  if ! npm install -g @google/gemini-cli >&2; then
    log_error "Failed to install @google/gemini-cli"
    exit 1
  fi
  if ! command -v gemini &>/dev/null; then
    log_error "Failed to install @google/gemini-cli — CLI binary not found after install"
    exit 1
  fi
  log_info "Gemini CLI installed successfully"
}

auth_gemini() {
  mkdir -p ~/.gemini
  if [[ -n "${GEMINI_OAUTH_JSON:-}" ]]; then
    printf '%s' "$GEMINI_OAUTH_JSON" > ~/.gemini/oauth.json
    chmod 600 ~/.gemini/oauth.json
    log_info "Gemini authenticated via cached OAuth bundle"
  else
    log_info "Gemini authenticated via API key"
  fi
}

invoke_gemini() {
  local command_file
  command_file=$(resolve_command_file "$COMMAND") || exit 1

  local prompt
  prompt="$(cat "$command_file")"

  if [[ -n "$ARGS" ]]; then
    local args_file="/tmp/gemini-args.json"
    printf '%s' "$ARGS" > "$args_file"
    prompt="${prompt}

The arguments for this command have been written to ${args_file}. Read them with: cat ${args_file}
Do NOT try to parse the JSON inline in bash — always read from the file."
    log_info "Args written to $args_file ($(wc -c < "$args_file") bytes)"
  fi

  local prompt_file
  prompt_file="$(mktemp /tmp/gemini-prompt-XXXXXX.md)"
  printf '%s' "$prompt" > "$prompt_file"

  local output_file
  output_file="$(mktemp /tmp/gemini-stream-XXXX.jsonl)"
  log_info "Invoking Gemini with command file: $command_file"
  log_info "Prompt file: $prompt_file ($(wc -c < "$prompt_file") bytes)"
  # Use --prompt=<value> (= form) so yargs never confuses the value with a flag
  # when the prompt content starts with '-' (e.g. YAML frontmatter '---\n...').
  # The plain `-p "..."` form fails with "Not enough arguments following: p"
  # whenever the value's first character is '-'.
  gemini "--prompt=$(cat "$prompt_file")" --output-format stream-json 2>&1 | tee "$output_file" || true
  local exit_code=${PIPESTATUS[0]}
  export GEMINI_STREAM_FILE="$output_file"

  rm -f "$prompt_file"
  return $exit_code
}

collect_gemini_telemetry() {
  if [[ -z "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]] || [[ -z "${JOB_ID:-}" ]] || [[ -z "${GEMINI_STREAM_FILE:-}" ]] || [[ ! -f "${GEMINI_STREAM_FILE}" ]]; then
    return 0
  fi

  local tools_json model input_tokens output_tokens thinking_tokens cache_read_tokens cache_creation_tokens duration_ms cost_status
  tools_json=$(jq -rs '[.. | objects | select(((.type? // .event? // .kind? // "") | tostring) | test("tool_use|tool_call|tool_result")) | (.name // .tool // .toolName // .function?.name // empty) | select(type == "string" and length > 0)] | unique' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "[]")
  model=$(jq -rs '[.. | objects | (.model? // .metadata?.model? // .response?.model? // empty) | select(type == "string" and length > 0)] | last // empty' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "")
  input_tokens=$(jq -rs '[.. | objects | .usage? // .usageMetadata? // empty | (.inputTokens // .input_tokens // .promptTokenCount // .prompt_token_count // empty) | tonumber?] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
  output_tokens=$(jq -rs '[.. | objects | .usage? // .usageMetadata? // empty | (.outputTokens // .output_tokens // .candidatesTokenCount // .candidates_token_count // empty) | tonumber?] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
  thinking_tokens=$(jq -rs '[.. | objects | .usage? // .usageMetadata? // empty | (.thinkingTokens // .thinking_token_count // .thoughtsTokenCount // .thoughts_token_count // .thoughtTokenCount // empty) | tonumber?] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
  cache_read_tokens=$(jq -rs '[.. | objects | .usage? // .usageMetadata? // empty | (.cacheReadTokens // .cache_read_tokens // .cachedContentTokenCount // .cached_content_token_count // .cachedTokenCount // .cached_token_count // empty) | tonumber?] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
  cache_creation_tokens=$(jq -rs '[.. | objects | .usage? // .usageMetadata? // empty | (.cacheCreationTokens // .cache_creation_tokens // .cacheWriteTokens // .cache_write_tokens // empty) | tonumber?] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
  duration_ms=$(jq -rs '[.. | objects | (.durationMs? // .duration_ms? // .timing?.durationMs? // .timing?.duration_ms? // empty) | tonumber?] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")

  if [[ -z "$model" && -n "${GEMINI_MODEL:-}" ]]; then
    model="$GEMINI_MODEL"
  fi

  case "$model" in
    *gemini-2.5-pro*|*gemini-2.5-flash*|*gemini-2.0-flash*)
      cost_status="ESTIMATED"
      ;;
    *)
      cost_status="UNAVAILABLE"
      ;;
  esac

  local payload
  payload=$(jq -n \
    --argjson jobId "$JOB_ID" \
    --arg agent "GEMINI" \
    --arg model "$model" \
    --argjson inputTokens "$input_tokens" \
    --argjson outputTokens "$output_tokens" \
    --argjson thinkingTokens "$thinking_tokens" \
    --argjson cacheReadTokens "$cache_read_tokens" \
    --argjson cacheCreationTokens "$cache_creation_tokens" \
    --argjson durationMs "$duration_ms" \
    --argjson toolsUsed "$tools_json" \
    --arg costStatus "$cost_status" \
    --arg usageSnapshotMode "CUMULATIVE" \
    '{jobId: $jobId, agent: $agent, model: $model, inputTokens: $inputTokens, outputTokens: $outputTokens, thinkingTokens: $thinkingTokens, cacheReadTokens: $cacheReadTokens, cacheCreationTokens: $cacheCreationTokens, durationMs: $durationMs, toolsUsed: $toolsUsed, costStatus: $costStatus, usageSnapshotMode: $usageSnapshotMode}')

  local auth_header=""
  if [[ -n "${OTEL_EXPORTER_OTLP_HEADERS:-}" ]]; then
    auth_header="${OTEL_EXPORTER_OTLP_HEADERS#Authorization=}"
  fi

  if [[ -z "$auth_header" ]]; then
    log_info "Skipping Gemini telemetry — no auth header available"
    return 0
  fi

  log_info "Sending Gemini telemetry: input=$input_tokens output=$output_tokens thinking=$thinking_tokens cacheRead=$cache_read_tokens cacheCreate=$cache_creation_tokens model=${model:-unknown} tools=$(echo "$tools_json" | jq -r 'length') costStatus=$cost_status"

  curl -s -o /dev/null \
    -X POST "${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs" \
    -H "Authorization: ${auth_header}" \
    -H "Content-Type: application/json" \
    --data-raw "$payload" \
    --max-time 10 || true
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
    collect_mistral_telemetry
    ;;
  GEMINI)
    validate_auth
    install_gemini
    auth_gemini
    gemini_exit=0
    invoke_gemini || gemini_exit=$?
    collect_gemini_telemetry
    exit $gemini_exit
    ;;
  *)
    log_error "Unsupported agent type '$AGENT_TYPE'. Supported: CLAUDE, CODEX, MISTRAL, GEMINI"
    exit 1
    ;;
esac
