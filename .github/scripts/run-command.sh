#!/bin/bash
# run-command.sh — Config-driven command executor for ai-board workflows
# Reads .ai-board/config.yml from target repos and executes the specified command key.
#
# Usage: run-command.sh <target-directory> <command-key>
#
# Exit codes:
#   0 — Config file missing (silent skip, no output)
#   0 — Command key not defined in config (silent skip)
#   N — Command executed and returned exit code N
#   1 — Invalid YAML syntax in config.yml
#   1 — Missing required arguments
#
# Supported command keys: install, build, lint, type_check, test_unit, test_integration, test_e2e
#
# Design: When .ai-board/config.yml is absent, the script exits 0 silently.
# This ensures backward compatibility for repos that haven't onboarded yet.
# This is intentionally different from setup-environment.sh, which requires config
# (since setup is only called for onboarded projects).

set -euo pipefail

# ─── Argument Validation ─────────────────────────────────────────────────────

if [[ $# -lt 2 ]]; then
  echo "Usage: run-command.sh <target-directory> <command-key>" >&2
  echo "  Reads .ai-board/config.yml and executes the command mapped to <command-key>." >&2
  exit 1
fi

TARGET_DIR="$1"
COMMAND_KEY="$2"
CONFIG="${TARGET_DIR}/.ai-board/config.yml"

# ─── Missing Config = Silent Skip ────────────────────────────────────────────

if [[ ! -f "$CONFIG" ]]; then
  exit 0
fi

# ─── yq Bootstrap ────────────────────────────────────────────────────────────

ensure_yq() {
  if command -v yq &>/dev/null; then
    return 0
  fi
  echo "ℹ️  Installing yq..." >&2
  local YQ_VERSION="v4.44.1"
  sudo wget -qO /usr/local/bin/yq \
    "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64"
  sudo chmod +x /usr/local/bin/yq
  echo "✅ yq installed" >&2
}

ensure_yq

# ─── Validate YAML ───────────────────────────────────────────────────────────

if ! yq eval '.' "$CONFIG" &>/dev/null; then
  echo "❌ ERROR: Invalid YAML in $CONFIG" >&2
  exit 1
fi

# ─── Read Command ────────────────────────────────────────────────────────────

CMD=$(yq eval ".commands.${COMMAND_KEY}" "$CONFIG")

if [[ "$CMD" == "null" || -z "$CMD" ]]; then
  echo "ℹ️  Command key '${COMMAND_KEY}' not defined in config — skipping" >&2
  exit 0
fi

# ─── Execute Command ─────────────────────────────────────────────────────────

echo "▶️  Executing: $CMD (key: ${COMMAND_KEY})" >&2
(cd "$TARGET_DIR" && eval "$CMD")
