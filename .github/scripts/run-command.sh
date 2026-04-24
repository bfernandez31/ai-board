#!/bin/bash
# run-command.sh — Config-driven command executor for ai-board workflows
# Reads .ai-board/config.yml from target repos and executes the specified command key.
#
# Usage: run-command.sh <target-directory> <command-key>
#
# Exit codes:
#   0 — Command key not defined in config and no fallback default (silent skip)
#   N — Command executed and returned exit code N
#   1 — Invalid YAML syntax in config.yml
#   1 — Missing required arguments
#
# Supported command keys: install, build, lint, type_check, test_unit, test_integration, test_e2e, db_setup, db_seed
#
# Design: When .ai-board/config.yml is absent, the script falls back to hardcoded
# defaults (matching ai-board's own commands). This ensures backward compatibility
# for repos that haven't onboarded yet. If a key has no config AND no default,
# it exits 0 silently.

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

# ─── Fallback Defaults ───────────────────────────────────────────────────────
# When a target repo has no .ai-board/config.yml, these defaults preserve
# backward compatibility for ai-board itself and any repo not yet onboarded.
#
# Implemented as a case statement rather than an associative array so the
# script runs on bash 3.2 (the system bash on macOS). `declare -A` requires
# bash 4+, and combined with `set -u` it fails with "unbound variable" at
# load time on older bash.

lookup_default() {
  case "$1" in
    install) echo "bun install --frozen-lockfile" ;;
    build) echo "bun run build" ;;
    lint) echo "bun run lint" ;;
    type_check) echo "bun run type-check" ;;
    test_unit) echo "bun run test:unit" ;;
    test_integration) echo "bun run test:integration" ;;
    test_e2e) echo "bun run test:e2e" ;;
    db_setup) echo "bunx prisma generate && if [ -n \"\${DATABASE_URL:-}\" ]; then bunx prisma migrate deploy; fi" ;;
    db_seed) echo "npx tsx tests/global-setup.ts" ;;
    *) return 1 ;;
  esac
}

# ─── Missing Config = Use Fallback Defaults ──────────────────────────────────

if [[ ! -f "$CONFIG" ]]; then
  if DEFAULT_CMD=$(lookup_default "$COMMAND_KEY"); then
    echo "ℹ️  No .ai-board/config.yml found, using fallback default for '$COMMAND_KEY'" >&2
    cd "$TARGET_DIR" && eval "$DEFAULT_CMD"
    exit $?
  fi
  # No config and no default for this key — silent skip
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
