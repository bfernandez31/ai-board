#!/bin/bash
# run-command.sh — Centralized command dispatch for ai-board workflows
# Reads .ai-board/config.yml from target repos, executes configured command or falls back to defaults.
# Usage: run-command.sh <target-dir> <command-key>

set -euo pipefail

# ─── Argument Validation ─────────────────────────────────────────────────────

if [[ $# -ne 2 ]]; then
  echo "Usage: run-command.sh <target-dir> <command-key>" >&2
  echo "  target-dir:   Absolute path to the target repository root" >&2
  echo "  command-key:  One of: install, build, lint, type_check, test_unit, test_integration, test_e2e" >&2
  exit 1
fi

TARGET_DIR="$1"
COMMAND_KEY="$2"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "ERROR: Target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

# Resolve to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# ─── Fallback Defaults ───────────────────────────────────────────────────────
# These match the current ai-board .ai-board/config.yml commands exactly.
# When a target repo has no config, these defaults preserve backward compatibility.

declare -A DEFAULTS=(
  [install]="bun install --frozen-lockfile"
  [build]="bun run build"
  [lint]="bun run lint"
  [type_check]="bun run type-check"
  [test_unit]="bun run test:unit"
  [test_integration]="bun run test:integration"
  [test_e2e]="bunx playwright test"
)

# ─── yq Bootstrap ─────────────────────────────────────────────────────────────

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

# ─── Config Resolution ───────────────────────────────────────────────────────

CONFIG_FILE="${TARGET_DIR}/.ai-board/config.yml"

if [[ ! -f "$CONFIG_FILE" ]]; then
  # No config — use fallback defaults
  if [[ -n "${DEFAULTS[$COMMAND_KEY]+_}" ]]; then
    echo "ℹ️  No .ai-board/config.yml found, using fallback default for '$COMMAND_KEY'" >&2
    cd "$TARGET_DIR" && eval "${DEFAULTS[$COMMAND_KEY]}"
    exit $?
  else
    # Unrecognized key with no config — silent skip
    exit 0
  fi
fi

# Config exists — validate and parse
ensure_yq

if ! yq eval '.' "$CONFIG_FILE" &>/dev/null; then
  echo "ERROR: Invalid YAML in config file: $CONFIG_FILE" >&2
  exit 2
fi

# Extract command value
COMMAND_VALUE=$(yq eval ".commands.${COMMAND_KEY}" "$CONFIG_FILE" 2>/dev/null)

# Handle missing key or empty/null value — silent skip
if [[ -z "$COMMAND_VALUE" || "$COMMAND_VALUE" == "null" ]]; then
  exit 0
fi

# Handle explicitly empty string value — silent skip
if [[ "$COMMAND_VALUE" == '""' || "$COMMAND_VALUE" == "''" ]]; then
  exit 0
fi

# Execute the configured command in target directory
cd "$TARGET_DIR" && eval "$COMMAND_VALUE"
