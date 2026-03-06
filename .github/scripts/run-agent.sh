#!/usr/bin/env bash
# run-agent.sh - Unified agent runner for GitHub workflows
# Supports CLAUDE and CODEX agents with transparent CLI switching
#
# Usage:
#   run-agent.sh install                          Install agent CLI
#   run-agent.sh setup                            Setup telemetry + AGENTS.md
#   run-agent.sh exec <command> [args] [images]   Execute a slash command
#
# Environment variables:
#   AGENT                 - Agent type: CLAUDE (default) or CODEX
#   OPENAI_API_KEY        - Required for CODEX agent
#   CLAUDE_CODE_OAUTH_TOKEN - Required for CLAUDE agent
#   ANTHROPIC_MODEL       - Model for CLAUDE agent
#   CODEX_MODEL           - Model for CODEX agent (default: o3)
#   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP endpoint for telemetry
#   OTEL_EXPORTER_OTLP_HEADERS  - OTLP auth headers
#   OTEL_RESOURCE_ATTRIBUTES    - OTLP resource attributes

set -euo pipefail

AGENT="${AGENT:-CLAUDE}"
CODEX_MODEL="${CODEX_MODEL:-o3}"

# --- Sub-commands ---

cmd_install() {
  echo "📦 Installing ${AGENT} CLI..."
  case "$AGENT" in
    CLAUDE)
      bun add -g @anthropic-ai/claude-code
      ;;
    CODEX)
      bun add -g @openai/codex
      ;;
    *)
      echo "❌ Unknown agent: $AGENT"
      exit 1
      ;;
  esac
  echo "✅ ${AGENT} CLI installed"
}

cmd_setup() {
  echo "🔧 Setting up ${AGENT} agent environment..."

  case "$AGENT" in
    CLAUDE)
      # Claude telemetry is configured via env vars (CLAUDE_CODE_ENABLE_TELEMETRY, OTEL_*)
      # Nothing extra to do here
      echo "✅ Claude telemetry configured via environment variables"
      ;;
    CODEX)
      # Write Codex telemetry config
      if [ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]; then
        mkdir -p ~/.codex
        cat > ~/.codex/config.toml <<TOML
[otel]
endpoint = "${OTEL_EXPORTER_OTLP_ENDPOINT}"
headers = "${OTEL_EXPORTER_OTLP_HEADERS:-}"
resource_attributes = "${OTEL_RESOURCE_ATTRIBUTES:-}"
TOML
        echo "✅ Codex telemetry config written to ~/.codex/config.toml"
      else
        echo "ℹ️ No OTLP endpoint configured, skipping Codex telemetry setup"
      fi

      # Create AGENTS.md from CLAUDE.md if it exists (Codex reads AGENTS.md automatically)
      if [ -f "CLAUDE.md" ] && [ ! -f "AGENTS.md" ]; then
        cp CLAUDE.md AGENTS.md
        echo "✅ AGENTS.md created from CLAUDE.md"
      elif [ -f "AGENTS.md" ]; then
        echo "✅ AGENTS.md already exists"
      else
        echo "⚠️ No CLAUDE.md found, AGENTS.md not created"
      fi
      ;;
  esac
}

cmd_exec() {
  if [ $# -lt 1 ]; then
    echo "❌ Usage: run-agent.sh exec <command> [args] [-- image1 image2 ...]"
    exit 1
  fi

  local command="$1"
  shift

  # Separate args from image paths (delimiter: --)
  local args=""
  local image_paths=""
  local found_delimiter=false

  for arg in "$@"; do
    if [ "$arg" = "--" ]; then
      found_delimiter=true
      continue
    fi
    if $found_delimiter; then
      image_paths="$image_paths $arg"
    else
      if [ -n "$args" ]; then
        args="$args $arg"
      else
        args="$arg"
      fi
    fi
  done

  echo "🚀 Executing command via ${AGENT}..."
  echo "   Command: $command"
  if [ -n "$args" ]; then
    echo "   Args: (provided)"
  fi
  if [ -n "$image_paths" ]; then
    echo "   Images: $image_paths"
  fi

  case "$AGENT" in
    CLAUDE)
      if [ -n "$args" ]; then
        # shellcheck disable=SC2086
        claude --dangerously-skip-permissions "$command $args" $image_paths
      else
        # shellcheck disable=SC2086
        claude --dangerously-skip-permissions "$command" $image_paths
      fi
      ;;
    CODEX)
      # Codex does NOT support slash commands - must inject .md file content as prompt
      # Extract command name from slash command (e.g., /ai-board.specify -> ai-board.specify)
      local cmd_name="${command#/}"
      local cmd_file=".claude/commands/${cmd_name}.md"

      if [ ! -f "$cmd_file" ]; then
        echo "❌ Command file not found: $cmd_file"
        exit 1
      fi

      # Read the command .md content and append args as the prompt
      local prompt
      prompt=$(cat "$cmd_file")

      if [ -n "$args" ]; then
        prompt="$prompt

$args"
      fi

      # Note: Codex exec doesn't support image paths natively
      if [ -n "$image_paths" ]; then
        echo "⚠️ Codex does not support image file arguments, skipping image paths"
      fi

      codex exec "$prompt" --model "$CODEX_MODEL" --full-auto
      ;;
    *)
      echo "❌ Unknown agent: $AGENT"
      exit 1
      ;;
  esac
}

# --- Main ---

action="${1:-}"
shift || true

case "$action" in
  install)
    cmd_install
    ;;
  setup)
    cmd_setup
    ;;
  exec)
    cmd_exec "$@"
    ;;
  *)
    echo "❌ Usage: run-agent.sh <install|setup|exec> [args...]"
    echo ""
    echo "Actions:"
    echo "  install           Install the agent CLI (CLAUDE or CODEX)"
    echo "  setup             Configure telemetry and AGENTS.md"
    echo "  exec <cmd> [args] Execute a slash command via the agent"
    exit 1
    ;;
esac
