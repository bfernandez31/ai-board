#!/usr/bin/env bash
set -euo pipefail

# Unified agent runner script for GitHub workflows
# Abstracts CLI installation, authentication, telemetry, and command invocation
# across Claude Code, Codex, Mistral, and Gemini CLI agents.

AGENT_TYPE="${1:?ERROR: AGENT_TYPE is required (CLAUDE, CODEX, MISTRAL, or GEMINI)}"
COMMAND="${2:?ERROR: COMMAND is required (e.g., ai-board.specify)}"
shift 2
ORIGINAL_ARGS=("$@")

STRUCTURED_INPUT_FILE=""
STRUCTURED_EXTRA_FILES=()
STRUCTURED_NOTES=()
RAW_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input-file)
      shift
      STRUCTURED_INPUT_FILE="${1:-}"
      ;;
    --extra-file)
      shift
      STRUCTURED_EXTRA_FILES+=("${1:-}")
      ;;
    --note)
      shift
      STRUCTURED_NOTES+=("${1:-}")
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        RAW_ARGS+=("$1")
        shift
      done
      break
      ;;
    *)
      RAW_ARGS+=("$1")
      ;;
  esac
  shift || true
done

ARGS="${RAW_ARGS[*]}"
ORIGINAL_ARGS_STRING="${ORIGINAL_ARGS[*]}"

# --- Logging helpers ---

log_info() {
  echo "ℹ️  [run-agent] $*" >&2
}

log_error() {
  echo "❌ [run-agent] ERROR: $*" >&2
}

json_array_from_args() {
  if [[ ${#RAW_ARGS[@]} -eq 0 ]]; then
    echo "[]"
    return 0
  fi

  printf '%s\n' "${RAW_ARGS[@]}" | jq -R . | jq -s .
}

json_array_from_values() {
  if [[ $# -eq 0 ]]; then
    echo "[]"
    return 0
  fi

  printf '%s\n' "$@" | jq -R . | jq -s .
}

extract_json_prefix() {
  local value="$1"
  python3 - "$value" <<'PY'
import json
import sys

value = sys.argv[1]
decoder = json.JSONDecoder()

try:
    parsed, end = decoder.raw_decode(value)
except Exception:
    print(json.dumps({"parsed": False}))
    sys.exit(0)

rest = value[end:].strip()
print(json.dumps({
    "parsed": True,
    "json": parsed,
    "rest": rest,
}))
PY
}

write_agent_input_file() {
  local prefix="$1"
  local content="$2"
  local dir=".ai-board/agent-inputs"
  mkdir -p "$dir"
  local file
  file="$(mktemp "${dir}/${prefix}-XXXXXX.txt")"
  printf '%s' "$content" > "$file"
  printf '%s' "$file"
}

build_non_claude_prompt() {
  local command_file="$1"
  local prompt
  prompt="$(cat "$command_file")"

  if [[ ${#RAW_ARGS[@]} -eq 0 && -z "$STRUCTURED_INPUT_FILE" && ${#STRUCTURED_EXTRA_FILES[@]} -eq 0 && ${#STRUCTURED_NOTES[@]} -eq 0 ]]; then
    printf '%s' "$prompt"
    return 0
  fi

  prompt="${prompt}

## Invocation Context"

  if [[ ${#RAW_ARGS[@]} -gt 0 ]]; then
    local args_json
    args_json="$(json_array_from_args)"
    prompt="${prompt}

### Legacy Argument Tokens
The workflow passed the following exact argument tokens after the command name.
Treat this JSON array as the source of truth for token boundaries and ordering.

\`\`\`json
${args_json}
\`\`\`"
  fi

  if [[ -n "$STRUCTURED_INPUT_FILE" ]]; then
    prompt="${prompt}

### Structured Primary Input File
\`${STRUCTURED_INPUT_FILE}\`

Read this file directly from the workspace before proceeding."
  fi

  if [[ ${#STRUCTURED_EXTRA_FILES[@]} -gt 0 ]]; then
    local structured_extra_files_json
    structured_extra_files_json="$(json_array_from_values "${STRUCTURED_EXTRA_FILES[@]}")"
    prompt="${prompt}

### Structured Extra Files
\`\`\`json
${structured_extra_files_json}
\`\`\`"
  fi

  if [[ ${#STRUCTURED_NOTES[@]} -gt 0 ]]; then
    local structured_notes_json
    structured_notes_json="$(json_array_from_values "${STRUCTURED_NOTES[@]}")"
    prompt="${prompt}

### Structured Runtime Notes
\`\`\`json
${structured_notes_json}
\`\`\`"
  fi

  case "$COMMAND" in
    ai-board.specify)
      prompt="${prompt}

### Parsed Hint
- The primary feature payload must be read from the structured input file when present.
- If no structured input file is present, token 0 is the primary feature payload.
- Any remaining file tokens are attached image paths prepared by the workflow."

      if [[ -z "$STRUCTURED_INPUT_FILE" && ${#RAW_ARGS[@]} -gt 0 ]]; then
        local primary_input="${RAW_ARGS[0]}"
        local primary_input_file
        primary_input_file="$(write_agent_input_file "specify-input" "$primary_input")"
        prompt="${prompt}

#### Fallback Primary Command Input File
\`${primary_input_file}\`"

        if [[ -n "$primary_input" ]]; then
          prompt="${prompt}

#### Token 0 Preview
\`\`\`
${primary_input:0:1200}
\`\`\`"
        fi
      fi

      if [[ ${#RAW_ARGS[@]} -gt 1 ]]; then
        local extra_files_json
        extra_files_json="$(json_array_from_values "${RAW_ARGS[@]:1}")"
        prompt="${prompt}

#### Legacy Attached File Tokens
\`\`\`json
${extra_files_json}
\`\`\`"
      fi
      ;;
    ai-board.quick-impl)
      prompt="${prompt}

### Parsed Hint
- The primary quick-impl payload must be read from the structured input file when present.
- Structured runtime notes override any legacy concatenated guidance.
- If no structured input file is present, token 0 may contain a JSON payload followed by runtime guidance."

      if [[ -z "$STRUCTURED_INPUT_FILE" && ${#RAW_ARGS[@]} -gt 0 ]]; then
        local first_token="${RAW_ARGS[0]}"
        local first_token_file
        first_token_file="$(write_agent_input_file "quick-impl-input" "$first_token")"
        local parsed_json
        parsed_json="$(extract_json_prefix "$first_token")"

        prompt="${prompt}

#### Fallback Primary Command Input File
\`${first_token_file}\`"

        if [[ "$(echo "$parsed_json" | jq -r '.parsed')" == "true" ]]; then
          local payload_json
          local trailing_notes
          payload_json="$(echo "$parsed_json" | jq '.json')"
          trailing_notes="$(echo "$parsed_json" | jq -r '.rest')"

          local payload_file
          payload_file="$(write_agent_input_file "quick-impl-payload" "$(echo "$payload_json" | jq -c .)")"

          prompt="${prompt}

#### Parsed Payload File
\`${payload_file}\`

#### Parsed Payload Prefix
\`\`\`json
${payload_json}
\`\`\`"

          if [[ -n "$trailing_notes" ]]; then
            prompt="${prompt}

#### Runtime Notes Extracted From Token 0
\`\`\`
${trailing_notes}
\`\`\`"
          fi
        fi
      fi

      if [[ ${#RAW_ARGS[@]} -gt 1 ]]; then
        local quick_impl_files_json
        quick_impl_files_json="$(json_array_from_values "${RAW_ARGS[@]:1}")"
        prompt="${prompt}

#### Legacy Attached File Tokens
\`\`\`json
${quick_impl_files_json}
\`\`\`"
      fi
      ;;
    ai-board.implement)
      prompt="${prompt}

### Parsed Hint
- If token 0 starts with \`--continue\`, treat it as a continuation flag plus workflow runtime guidance."

      if [[ "${RAW_ARGS[0]}" == --continue* ]]; then
        local continue_notes="${RAW_ARGS[0]#--continue}"
        continue_notes="${continue_notes# }"
        prompt="${prompt}

#### Continuation Mode
\`--continue\`"

        if [[ -n "$continue_notes" ]]; then
          prompt="${prompt}

#### Runtime Notes
\`\`\`
${continue_notes}
\`\`\`"
        fi
      fi
      ;;
    ai-board.verify)
      prompt="${prompt}

### Runtime Notes
\`\`\`
${ARGS}
\`\`\`"
      ;;
  esac

  printf '%s' "$prompt"
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

# --- Runtime version capture (AIB-779) ---
#
# Captures the AI-Board plugin version and the agent CLI version, then reports
# them to the job-status PATCH endpoint. Best-effort: any failure is logged and
# swallowed so the agent run continues unannotated.

resolve_plugin_version() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local candidates=(
    ".claude-plugin/plugin.json"
    "../ai-board/.claude-plugin/plugin.json"
    "${script_dir}/../../.claude-plugin/plugin.json"
  )
  for path in "${candidates[@]}"; do
    if [[ -f "$path" ]]; then
      local version
      version="$(jq -r '.version // empty' "$path" 2>/dev/null)" || continue
      if [[ -n "$version" ]]; then
        # Cap to the Zod validator limit (pluginVersion ≤ 50 chars).
        printf '%s' "${version:0:50}"
        return 0
      fi
    fi
  done
  return 1
}

resolve_agent_cli_version() {
  local cli="$1"
  if ! command -v "$cli" &>/dev/null; then
    return 1
  fi
  # `<cli> --version` output varies (e.g. "claude 1.2.3", "codex v0.4.0", multi-line).
  # Take the first non-empty line and strip leading binary name + leading 'v'.
  # Capture full output first to avoid SIGPIPE under `pipefail` when head exits
  # after the first line and the CLI is still writing subsequent lines.
  local raw version_out
  version_out="$("$cli" --version 2>/dev/null)" || return 1
  raw="$(printf '%s\n' "$version_out" | head -n 1 | tr -d '\r')"
  [[ -z "$raw" ]] && return 1
  # Strip common prefixes like "claude " or "codex v" — keep the rest verbatim.
  raw="${raw#"$cli" }"
  raw="${raw#v}"
  # Cap to the Zod validator limit (agentCliVersion ≤ 100 chars) so CLIs that
  # emit build metadata in their first line don't trigger a 400 that silently
  # drops the whole capture. Mirrors job-update-validator.ts.
  printf '%s' "${raw:0:100}"
}

report_runtime_versions() {
  local cli="$1"
  if [[ -z "${JOB_ID:-}" || -z "${APP_URL:-}" || -z "${WORKFLOW_API_TOKEN:-}" ]]; then
    log_info "Runtime version capture skipped — JOB_ID/APP_URL/WORKFLOW_API_TOKEN unset"
    return 0
  fi

  local plugin_version=""
  local cli_version=""
  plugin_version="$(resolve_plugin_version 2>/dev/null || true)"
  cli_version="$(resolve_agent_cli_version "$cli" 2>/dev/null || true)"

  if [[ -z "$plugin_version" && -z "$cli_version" ]]; then
    log_info "Runtime version capture: nothing to report"
    return 0
  fi

  local payload
  payload="$(jq -n \
    --arg pv "$plugin_version" \
    --arg cv "$cli_version" \
    '{status: "RUNNING"}
      + (if $pv != "" then {pluginVersion: $pv} else {} end)
      + (if $cv != "" then {agentCliVersion: $cv} else {} end)')" || {
    log_info "Runtime version capture: failed to build payload"
    return 0
  }

  log_info "Reporting runtime versions: plugin='${plugin_version}' cli='${cli_version}'"
  local http_code
  http_code="$(curl -X PATCH "${APP_URL}/api/jobs/${JOB_ID}/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
    -d "$payload" \
    -s -o /dev/null -w '%{http_code}' --max-time 10)" || {
    log_info "Runtime version PATCH failed: curl error (non-fatal)"
    return 0
  }
  if [[ "$http_code" != 2* ]]; then
    log_info "Runtime version PATCH failed: HTTP ${http_code} (non-fatal)"
  fi
  return 0
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
  if ! npm install -g @anthropic-ai/claude-code >&2; then
    log_error "Failed to install @anthropic-ai/claude-code"
    exit 1
  fi
  if ! command -v claude &>/dev/null; then
    log_error "Failed to install @anthropic-ai/claude-code — CLI binary not found after install"
    exit 1
  fi
  log_info "Claude Code CLI installed successfully"
}

ensure_claude_commands() {
  # Claude Code resolves /ai-board.* slash commands from .claude/commands in
  # the cwd. Workflows that clone a target repo get that symlink from
  # setup-environment.sh (or an inline ln -sf in onboard/retro-spec); workflows
  # without a target clone (e.g. inbox-analysis) run from the workspace root
  # where no link exists — the CLI then reports the command as an unknown
  # skill. Idempotent: no-op when commands are already discoverable.
  if [[ -e .claude/commands ]]; then
    return 0
  fi
  # The plugin always lives relative to this script in the ai-board checkout
  # (same resolution as resolve_plugin_version), regardless of cwd.
  local plugin_commands="${SCRIPT_DIR}/../../.claude-plugin/commands"
  if [[ -d "$plugin_commands" ]]; then
    mkdir -p .claude
    ln -sf "$(cd "$plugin_commands" && pwd)" .claude/commands
    log_info "Linked Claude commands → .claude/commands"
  else
    log_info "Plugin commands dir not found at ${plugin_commands} — relying on native discovery"
  fi
}

activate_token_saving() {
  if [[ "${TOKEN_SAVING:-false}" != "true" ]]; then
    report_token_saving_status "inactive"
    return 0
  fi
  if [[ "$AGENT_TYPE" != "CLAUDE" ]]; then
    report_token_saving_status "n/a"
    return 0
  fi
  log_info "Token saving enabled — installing RTK..."
  if npm install -g @anthropic-ai/rtk 2>/dev/null && command -v rtk &>/dev/null; then
    export CLAUDE_CODE_PRETOOLS_HOOK="rtk compress"
    log_info "RTK activated as PreToolUse hook"
    report_token_saving_status "active"
  else
    log_warn "RTK installation failed — proceeding without token saving"
    report_token_saving_status "fallback"
  fi
}

report_token_saving_status() {
  local status="$1"
  if [[ -n "${JOB_ID:-}" && -n "${APP_URL:-}" && -n "${WORKFLOW_API_TOKEN:-}" ]]; then
    curl -sS -X PATCH "${APP_URL}/api/jobs/${JOB_ID}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d "{\"status\":\"RUNNING\",\"tokenSavingStatus\":\"${status}\"}" \
      > /dev/null 2>&1 || true
  fi
}

invoke_claude() {
  log_info "Invoking Claude: /$COMMAND $ORIGINAL_ARGS_STRING"
  claude --dangerously-skip-permissions "/$COMMAND $ORIGINAL_ARGS_STRING"
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
  prompt="$(build_non_claude_prompt "$command_file")"

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
  prompt="$(build_non_claude_prompt "$command_file")"

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

setup_gemini_telemetry() {
  if [[ -z "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
    log_info "No OTEL_EXPORTER_OTLP_ENDPOINT set — skipping Gemini telemetry config"
    return 0
  fi

  export OTEL_LOGS_EXPORTER=otlp
  export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
  export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=http/json
  export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs"
  export OTEL_BLRP_SCHEDULE_DELAY="${OTEL_BLRP_SCHEDULE_DELAY:-60000}"
  export OTEL_BLRP_MAX_EXPORT_BATCH_SIZE="${OTEL_BLRP_MAX_EXPORT_BATCH_SIZE:-2048}"
  export OTEL_BLRP_MAX_QUEUE_SIZE="${OTEL_BLRP_MAX_QUEUE_SIZE:-4096}"

  log_info "Configured Gemini native OTLP telemetry"
}

invoke_gemini() {
  local command_file
  command_file=$(resolve_command_file "$COMMAND") || exit 1

  local prompt
  prompt="$(build_non_claude_prompt "$command_file")"

  local prompt_file
  prompt_file="$(mktemp /tmp/gemini-prompt-XXXXXX.md)"
  printf '%s' "$prompt" > "$prompt_file"

  log_info "Invoking Gemini with command file: $command_file"
  log_info "Prompt file: $prompt_file ($(wc -c < "$prompt_file") bytes)"
  # Use --prompt=<value> (= form) so yargs never confuses the value with a flag
  # when the prompt content starts with '-' (e.g. YAML frontmatter '---\n...').
  # The plain `-p "..."` form fails with "Not enough arguments following: p"
  # whenever the value's first character is '-'.
  gemini "--prompt=$(cat "$prompt_file")" --approval-mode=yolo
  local exit_code=$?

  rm -f "$prompt_file"
  return $exit_code
}

# --- Agent stdout capture (AIB-715) ---
#
# Tees the agent's stdout into $RUNNER_TEMP/agent-raw-<jobId>.log so the
# capture-agent-logs.sh step (run via `if: always()` in each workflow) can
# normalize, redact, and upload the transcript. The tee is best-effort: if
# JOB_ID is unavailable we skip silently so existing workflows are unaffected.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_RAW_LOG=""
if [[ -n "${JOB_ID:-}" && -n "${RUNNER_TEMP:-}" ]]; then
  AGENT_RAW_LOG="${RUNNER_TEMP}/agent-raw-${JOB_ID}.log"
  touch "${AGENT_RAW_LOG}" 2>/dev/null || AGENT_RAW_LOG=""
fi

_capture_agent_end_kind="completed"

dispatch_agent() {
  case "$AGENT_TYPE" in
    CLAUDE)
      validate_auth
      install_claude
      ensure_claude_commands
      activate_token_saving
      report_runtime_versions claude
      invoke_claude
      ;;
    CODEX)
      validate_auth
      install_codex
      auth_codex
      setup_codex_telemetry
      report_runtime_versions codex
      invoke_codex
      persist_codex_token
      ;;
    MISTRAL)
      validate_auth
      install_mistral
      setup_mistral_telemetry
      report_runtime_versions vibe
      invoke_mistral
      collect_mistral_telemetry
      ;;
    GEMINI)
      validate_auth
      install_gemini
      auth_gemini
      setup_gemini_telemetry
      report_runtime_versions gemini
      local gemini_exit=0
      invoke_gemini || gemini_exit=$?
      return $gemini_exit
      ;;
    *)
      log_error "Unsupported agent type '$AGENT_TYPE'. Supported: CLAUDE, CODEX, MISTRAL, GEMINI"
      return 1
      ;;
  esac
}

if [[ -n "${AGENT_RAW_LOG}" ]]; then
  # Append agent stdout to the raw log (stderr unchanged — passes through).
  dispatch_agent | tee -a "${AGENT_RAW_LOG}"
  dispatch_exit="${PIPESTATUS[0]}"
else
  set +e
  dispatch_agent
  dispatch_exit=$?
  set -e
fi

if [[ "${dispatch_exit}" -ne 0 ]]; then
  # SIGINT (130) and SIGTERM (143) indicate external cancellation of the agent
  # process. Classify as cancelled so the log capture produces a CANCELLED
  # preview instead of an upstream_error one.
  case "${dispatch_exit}" in
    130|143) _capture_agent_end_kind="cancelled" ;;
    *) _capture_agent_end_kind="upstream_error" ;;
  esac
fi

export CAPTURE_END_KIND="${_capture_agent_end_kind}"
# Persist across step boundaries so the capture step (a fresh shell) can read
# it from the workflow environment — `export` alone does not cross steps.
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "CAPTURE_END_KIND=${_capture_agent_end_kind}" >> "${GITHUB_ENV}"
fi

exit "${dispatch_exit}"
