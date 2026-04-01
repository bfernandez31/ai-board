#!/usr/bin/env bash
set -euo pipefail

# setup-environment.sh — Centralized environment setup for ai-board workflows.
# Reads .ai-board/config.yml from a target repository and performs all setup:
#   Node.js verification, package manager install, dependency install,
#   agent CLI install, env var export, and plugin symlink creation.
#
# Exit codes:
#   0 — Success
#   1 — Configuration error (missing config, invalid fields, unsupported values)
#   2 — Installation error (package manager or CLI install failed)
#   3 — Filesystem error (symlink conflict with real directory)
#
# Env var merge precedence: secrets (GitHub Actions) > config env vars.

# ---------------------------------------------------------------------------
# Logging helpers (GitHub Actions workflow commands with local fallback)
# ---------------------------------------------------------------------------

log_step() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::group::$1"
  else
    echo "--- $1 ---"
  fi
}

end_step() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::endgroup::"
  fi
}

log_error() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error::$1"
  else
    echo "ERROR: $1" >&2
  fi
}

log_warn() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::warning::$1"
  else
    echo "WARNING: $1" >&2
  fi
}

log_info() {
  echo "  $1"
}

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

usage() {
  echo "Usage: setup-environment.sh <target-dir>"
  echo ""
  echo "  target-dir  Path to the root of the target repository"
  echo ""
  echo "Reads .ai-board/config.yml from target-dir and sets up the environment."
  exit 1
}

# ---------------------------------------------------------------------------
# Symlink helper (idempotent, detects real directory conflicts)
# ---------------------------------------------------------------------------

create_symlink() {
  local target="$1" link="$2"
  if [ -d "$link" ] && [ ! -L "$link" ]; then
    log_error "Real directory exists at $link — remove or rename it before running setup"
    exit 3
  fi
  ln -sfn "$target" "$link"
}

# ---------------------------------------------------------------------------
# Argument parsing (T009)
# ---------------------------------------------------------------------------

if [ $# -ne 1 ]; then
  log_error "Expected exactly one argument: <target-dir>"
  usage
fi

TARGET_DIR="$1"

if [ ! -d "$TARGET_DIR" ]; then
  log_error "Target directory does not exist: $TARGET_DIR"
  exit 1
fi

# Resolve to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# ---------------------------------------------------------------------------
# Step 1: Parse config (T011)
# ---------------------------------------------------------------------------

log_step "Step 1: Parsing .ai-board/config.yml"

# Check yq availability
if ! command -v yq &>/dev/null; then
  log_error "yq is required but not installed. Install via: brew install yq (macOS) or snap install yq (Linux)"
  exit 1
fi

CONFIG_FILE="$TARGET_DIR/.ai-board/config.yml"

if [ ! -f "$CONFIG_FILE" ]; then
  log_error "Missing .ai-board/config.yml in $TARGET_DIR"
  end_step
  exit 1
fi

# Load config fields via yq
config_version=$(yq '.version // ""' "$CONFIG_FILE")
runtime_manager=$(yq '.runtime.manager // ""' "$CONFIG_FILE")
runtime_node=$(yq '.runtime.node // "22"' "$CONFIG_FILE")
runtime_manager_version=$(yq '.runtime.manager_version // ""' "$CONFIG_FILE")
commands_install=$(yq '.commands.install // ""' "$CONFIG_FILE")
agent_cli=$(yq '.agent.cli // ""' "$CONFIG_FILE")

log_info "Config loaded: runtime.manager=$runtime_manager, agent.cli=$agent_cli"
end_step

# ---------------------------------------------------------------------------
# Step 2: Validate config (T012, T013, T026)
# ---------------------------------------------------------------------------

log_step "Step 2: Validating configuration"

# Version validation (T026)
if [ -n "$config_version" ] && [ "$config_version" != "1" ] && [ "$config_version" != "null" ]; then
  log_error "Unsupported config version: $config_version. Expected: 1"
  end_step
  exit 1
fi

# Required field: runtime.manager
if [ -z "$runtime_manager" ] || [ "$runtime_manager" = "null" ]; then
  log_error "Missing required field: runtime.manager. Expected: one of bun, npm, yarn, pnpm"
  end_step
  exit 1
fi

# Required field: commands.install
if [ -z "$commands_install" ] || [ "$commands_install" = "null" ]; then
  log_error "Missing required field: commands.install. Expected: a shell command (e.g., \"bun install\")"
  end_step
  exit 1
fi

# Required field: agent.cli
if [ -z "$agent_cli" ] || [ "$agent_cli" = "null" ]; then
  log_error "Missing required field: agent.cli. Expected: one of claude-code, codex"
  end_step
  exit 1
fi

# Supported runtime.manager values (T013)
case "$runtime_manager" in
  bun|npm|yarn|pnpm)
    log_info "Package manager '$runtime_manager' is supported"
    ;;
  pip|poetry|cargo)
    log_warn "Package manager '$runtime_manager' is not yet supported. Python/Go/Rust support coming soon."
    log_error "Unsupported package manager: '$runtime_manager'. Supported: bun, npm, yarn, pnpm"
    end_step
    exit 1
    ;;
  *)
    log_error "Unsupported package manager: '$runtime_manager'. Supported: bun, npm, yarn, pnpm"
    end_step
    exit 1
    ;;
esac

# Supported agent.cli values
case "$agent_cli" in
  claude-code|codex)
    log_info "Agent CLI '$agent_cli' is supported"
    ;;
  *)
    log_error "Unsupported agent CLI: '$agent_cli'. Supported: claude-code, codex"
    end_step
    exit 1
    ;;
esac

log_info "All validations passed"
end_step

# ---------------------------------------------------------------------------
# Step 3: Verify Node.js (T014)
# ---------------------------------------------------------------------------

log_step "Step 3: Verifying Node.js"

if command -v node &>/dev/null; then
  node_version_full=$(node --version)
  node_major=$(echo "$node_version_full" | sed 's/^v//' | cut -d. -f1)
  if [ "$node_major" = "$runtime_node" ]; then
    log_info "Node.js $node_version_full detected (config requires: $runtime_node) ✓"
  else
    log_warn "Node.js version mismatch: installed $node_version_full, config requires $runtime_node"
  fi
else
  log_warn "Node.js is not installed. Expected version: $runtime_node"
fi

end_step

# ---------------------------------------------------------------------------
# Step 4: Install package manager (T015, T016, T031, T032)
# ---------------------------------------------------------------------------

log_step "Step 4: Installing package manager ($runtime_manager${runtime_manager_version:+@$runtime_manager_version})"

case "$runtime_manager" in
  bun)
    if [ -n "$runtime_manager_version" ] && [ "$runtime_manager_version" != "null" ]; then
      curl -fsSL https://bun.sh/install | bash -s "bun-v${runtime_manager_version}" 2>&1 || {
        log_error "Failed to install bun@$runtime_manager_version"
        end_step
        exit 2
      }
    else
      curl -fsSL https://bun.sh/install | bash 2>&1 || {
        log_error "Failed to install bun"
        end_step
        exit 2
      }
    fi
    # Add bun to PATH for current session
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
    if command -v bun &>/dev/null; then
      log_info "bun $(bun --version) installed ✓"
    else
      log_error "bun installation succeeded but binary not found on PATH"
      end_step
      exit 2
    fi
    ;;
  npm)
    if [ -n "$runtime_manager_version" ] && [ "$runtime_manager_version" != "null" ]; then
      npm install -g "npm@${runtime_manager_version}" 2>&1 || {
        log_error "Failed to upgrade npm to version $runtime_manager_version"
        end_step
        exit 2
      }
      log_info "npm $(npm --version) installed ✓"
    else
      log_info "npm $(npm --version) (bundled with Node.js) ✓"
    fi
    ;;
  yarn)
    corepack enable 2>&1 || {
      log_error "Failed to enable corepack for yarn"
      end_step
      exit 2
    }
    if [ -n "$runtime_manager_version" ] && [ "$runtime_manager_version" != "null" ]; then
      corepack prepare "yarn@${runtime_manager_version}" --activate 2>&1 || {
        log_error "Failed to install yarn@$runtime_manager_version via corepack"
        end_step
        exit 2
      }
    else
      corepack prepare yarn@stable --activate 2>&1 || {
        log_error "Failed to install yarn via corepack"
        end_step
        exit 2
      }
    fi
    if command -v yarn &>/dev/null; then
      log_info "yarn $(yarn --version) installed ✓"
    else
      log_error "yarn installation succeeded but binary not found on PATH"
      end_step
      exit 2
    fi
    ;;
  pnpm)
    corepack enable 2>&1 || {
      log_error "Failed to enable corepack for pnpm"
      end_step
      exit 2
    }
    if [ -n "$runtime_manager_version" ] && [ "$runtime_manager_version" != "null" ]; then
      corepack prepare "pnpm@${runtime_manager_version}" --activate 2>&1 || {
        log_error "Failed to install pnpm@$runtime_manager_version via corepack"
        end_step
        exit 2
      }
    else
      corepack prepare pnpm@latest --activate 2>&1 || {
        log_error "Failed to install pnpm via corepack"
        end_step
        exit 2
      }
    fi
    if command -v pnpm &>/dev/null; then
      log_info "pnpm $(pnpm --version) installed ✓"
    else
      log_error "pnpm installation succeeded but binary not found on PATH"
      end_step
      exit 2
    fi
    ;;
esac

end_step

# ---------------------------------------------------------------------------
# Step 5: Install dependencies (T017)
# ---------------------------------------------------------------------------

log_step "Step 5: Installing dependencies"
log_info "Running: $commands_install"

(cd "$TARGET_DIR" && eval "$commands_install") || {
  log_error "Dependency installation failed: $commands_install"
  end_step
  exit 2
}

log_info "Dependencies installed ✓"
end_step

# ---------------------------------------------------------------------------
# Step 6: Install agent CLI (T018, T035)
# ---------------------------------------------------------------------------

log_step "Step 6: Installing agent CLI ($agent_cli)"

case "$agent_cli" in
  claude-code)
    npm install -g @anthropic-ai/claude-code 2>&1 || {
      log_error "Failed to install @anthropic-ai/claude-code"
      end_step
      exit 2
    }
    if command -v claude &>/dev/null; then
      log_info "@anthropic-ai/claude-code installed ✓"
    else
      log_error "claude-code installation succeeded but 'claude' binary not found on PATH"
      end_step
      exit 2
    fi
    ;;
  codex)
    npm install -g @openai/codex 2>&1 || {
      log_error "Failed to install @openai/codex"
      end_step
      exit 2
    }
    if command -v codex &>/dev/null; then
      log_info "@openai/codex installed ✓"
    else
      log_error "codex installation succeeded but 'codex' binary not found on PATH"
      end_step
      exit 2
    fi
    ;;
esac

end_step

# ---------------------------------------------------------------------------
# Step 7: Export environment variables (T019)
# ---------------------------------------------------------------------------

log_step "Step 7: Exporting environment variables"

env_count=0
# Read env keys from config
env_keys=$(yq '.env // {} | keys | .[]' "$CONFIG_FILE" 2>/dev/null || true)

if [ -n "$env_keys" ]; then
  while IFS= read -r key; do
    value=$(yq ".env.\"$key\"" "$CONFIG_FILE")
    # Only export if the variable is not already set (secrets take precedence)
    if [ -z "${!key+x}" ]; then
      if [ -n "${GITHUB_ENV:-}" ]; then
        echo "$key=$value" >> "$GITHUB_ENV"
      else
        export "$key=$value"
      fi
      env_count=$((env_count + 1))
    else
      log_info "Skipping $key (already set, secrets take precedence)"
    fi
  done <<< "$env_keys"
fi

log_info "Exported $env_count variables from config"
end_step

# ---------------------------------------------------------------------------
# Step 8: Create plugin symlinks (T020, T038)
# ---------------------------------------------------------------------------

log_step "Step 8: Creating plugin symlinks"

# Determine ai-board root relative to target dir
# In workflow context: target is at workspace/target/, ai-board is at workspace/ai-board/
# The symlinks point from <target>/.claude/{commands,skills} to ../../ai-board/.claude-plugin/{commands,skills}
CLAUDE_DIR="$TARGET_DIR/.claude"
mkdir -p "$CLAUDE_DIR"

# Supported managers: bun, npm, yarn, pnpm
# Symlink path conventions: relative from target/.claude/ to ai-board/.claude-plugin/
COMMANDS_TARGET="../../ai-board/.claude-plugin/commands"
SKILLS_TARGET="../../ai-board/.claude-plugin/skills"

create_symlink "$COMMANDS_TARGET" "$CLAUDE_DIR/commands"
log_info ".claude/commands → $COMMANDS_TARGET ✓"

create_symlink "$SKILLS_TARGET" "$CLAUDE_DIR/skills"
log_info ".claude/skills → $SKILLS_TARGET ✓"

end_step

# ---------------------------------------------------------------------------
# Step 9: Validation summary (T021)
# ---------------------------------------------------------------------------

echo ""
echo "✅ Environment setup complete"

# Verify key tools are available
tools_ok=true
if ! command -v node &>/dev/null; then
  log_warn "node not found on PATH"
  tools_ok=false
fi
if ! command -v "$runtime_manager" &>/dev/null && [ "$runtime_manager" != "npm" ]; then
  log_warn "$runtime_manager not found on PATH"
  tools_ok=false
fi

# Verify symlinks exist
if [ -L "$CLAUDE_DIR/commands" ] && [ -L "$CLAUDE_DIR/skills" ]; then
  log_info "Plugin symlinks verified ✓"
else
  log_warn "Plugin symlinks may not be correctly configured"
  tools_ok=false
fi

if [ "$tools_ok" = true ]; then
  log_info "All tools and symlinks verified ✓"
fi
