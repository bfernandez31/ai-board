#!/bin/bash
# setup-environment.sh — Centralized environment setup for ai-board workflows
# Reads .ai-board/config.yml from target repos and handles all setup automatically.
# Usage: setup-environment.sh <target-directory> [--phase <lightweight|full>]
#
# Phase parameter controls execution tier:
#   lightweight — yq bootstrap, config validation, package manager install, symlinks, partial validation
#   full (default) — all lightweight steps PLUS dependency install, agent CLI, env export, Prisma, Playwright

set -euo pipefail

# ─── Logging Helpers ───────────────────────────────────────────────────────────

info()    { echo "ℹ️  $*"; }
success() { echo "✅ $*"; }
error()   { echo "❌ ERROR: $*" >&2; }

# Export a variable and persist it to GITHUB_ENV when running in Actions
set_env() {
  local key="$1" val="$2"
  export "$key=$val"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "$key=$val" >> "$GITHUB_ENV"
  fi
}

# ─── Argument Parsing ─────────────────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
  echo "Usage: setup-environment.sh <target-directory> [--phase <lightweight|full>]"
  echo "  Reads .ai-board/config.yml from the target directory and configures the environment."
  exit 1
fi

TARGET_DIR="$1"
shift

# Parse optional --phase parameter (default: full)
PHASE="full"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)
      if [[ $# -lt 2 ]]; then
        error "Missing value for --phase parameter"
        exit 1
      fi
      PHASE="$2"
      shift 2
      ;;
    *)
      error "Unrecognized argument: $1"
      exit 1
      ;;
  esac
done

# Validate phase value
if [[ "$PHASE" != "lightweight" && "$PHASE" != "full" ]]; then
  error "Unrecognized phase: '$PHASE'. Must be 'lightweight' or 'full'."
  exit 1
fi

info "Phase: $PHASE"

if [[ ! -d "$TARGET_DIR" ]]; then
  error "Target directory does not exist: $TARGET_DIR"
  exit 1
fi

# Resolve to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

CONFIG_FILE="${TARGET_DIR}/.ai-board/config.yml"

# ─── yq Bootstrap ─────────────────────────────────────────────────────────────

ensure_yq() {
  if command -v yq &>/dev/null; then
    return 0
  fi
  info "Installing yq..."
  local YQ_VERSION="v4.44.1"
  sudo wget -qO /usr/local/bin/yq \
    "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64"
  sudo chmod +x /usr/local/bin/yq
  success "yq installed"
}

ensure_yq

# ─── Config File Validation ───────────────────────────────────────────────────

if [[ ! -f "$CONFIG_FILE" ]]; then
  error "Config file not found: $CONFIG_FILE"
  exit 1
fi

info "Parsing .ai-board/config.yml..."

# Validate YAML is parseable
if ! yq eval '.' "$CONFIG_FILE" &>/dev/null; then
  error "Config file parse error: $CONFIG_FILE is not valid YAML"
  exit 1
fi

# Schema version check
CONFIG_VERSION=$(yq eval '.version' "$CONFIG_FILE")
if [[ "$CONFIG_VERSION" != "1" ]]; then
  error "Unsupported config version: $CONFIG_VERSION. Only version 1 is supported."
  exit 1
fi

# Required field validation
MISSING_FIELDS=()
for field in ".project.name" ".project.language" ".runtime.manager" ".commands.install" ".agent.cli"; do
  val=$(yq eval "$field" "$CONFIG_FILE")
  if [[ "$val" == "null" || -z "$val" ]]; then
    MISSING_FIELDS+=("${field#.}")
  fi
done

if [[ ${#MISSING_FIELDS[@]} -gt 0 ]]; then
  error "Missing required fields: ${MISSING_FIELDS[*]}"
  exit 1
fi

# ─── Load Config Values ──────────────────────────────────────────────────────

MANAGER=$(yq eval '.runtime.manager' "$CONFIG_FILE")
MANAGER_VERSION=$(yq eval '.runtime.manager_version // ""' "$CONFIG_FILE")
INSTALL_CMD=$(yq eval '.commands.install' "$CONFIG_FILE")
AGENT_CLI=$(yq eval '.agent.cli' "$CONFIG_FILE")

success "Config loaded: manager=$MANAGER, agent=$AGENT_CLI"

# ─── Package Manager Installation ────────────────────────────────────────────

install_package_manager() {
  case "$MANAGER" in
    bun)
      if ! command -v bun &>/dev/null; then
        info "Installing bun..."
        export BUN_INSTALL="${HOME}/.bun"
        if [[ -n "$MANAGER_VERSION" ]]; then
          curl -fsSL https://bun.sh/install | bash -s "bun-v${MANAGER_VERSION}"
        else
          curl -fsSL https://bun.sh/install | bash
        fi
        export PATH="${HOME}/.bun/bin:${PATH}"
        success "bun installed: $(bun --version)"
      else
        success "bun already available: $(bun --version)"
      fi
      ;;
    npm)
      if ! command -v npm &>/dev/null; then
        error "npm not found. Ensure Node.js is installed (via actions/setup-node)."
        exit 1
      fi
      success "npm already available: $(npm --version)"
      ;;
    yarn)
      info "Activating yarn via corepack..."
      corepack enable
      if [[ -n "$MANAGER_VERSION" ]]; then
        corepack prepare "yarn@${MANAGER_VERSION}" --activate
      else
        corepack prepare yarn@stable --activate
      fi
      success "yarn activated: $(yarn --version)"
      ;;
    pnpm)
      info "Activating pnpm via corepack..."
      corepack enable
      if [[ -n "$MANAGER_VERSION" ]]; then
        corepack prepare "pnpm@${MANAGER_VERSION}" --activate
      else
        corepack prepare pnpm@latest --activate
      fi
      success "pnpm activated: $(pnpm --version)"
      ;;
    *)
      error "Unsupported package manager: $MANAGER. Supported: bun, npm, yarn, pnpm"
      exit 1
      ;;
  esac
}

install_package_manager

# ─── Plugin Symlink Creation ─────────────────────────────────────────────────

info "Creating plugin symlinks..."
mkdir -p "${TARGET_DIR}/.claude"
ln -sf "../../ai-board/.claude-plugin/commands" "${TARGET_DIR}/.claude/commands"
ln -sf "../../ai-board/.claude-plugin/skills" "${TARGET_DIR}/.claude/skills"
success "ai-board commands linked to ${TARGET_DIR}/.claude/commands"
success "ai-board skills linked to ${TARGET_DIR}/.claude/skills"

# ─── Full Phase: Dependency installation is handled by workflows via run-command.sh ──

# ─── Full Phase: Agent CLI Installation ──────────────────────────────────────

install_agent_cli() {
  case "$AGENT_CLI" in
    claude-code)
      if ! command -v claude &>/dev/null; then
        info "Installing agent CLI: claude-code..."
        npm install -g @anthropic-ai/claude-code
        success "claude-code installed"
      else
        success "claude-code already available"
      fi
      ;;
    codex)
      if ! command -v codex &>/dev/null; then
        info "Installing agent CLI: codex..."
        npm install -g @openai/codex
        success "codex installed"
      else
        success "codex already available"
      fi
      ;;
    *)
      error "Unsupported agent CLI: $AGENT_CLI. Supported: claude-code, codex"
      exit 1
      ;;
  esac
}

if [[ "$PHASE" == "full" ]]; then
  install_agent_cli
fi

# ─── Full Phase: Environment Variable Export ─────────────────────────────────

if [[ "$PHASE" == "full" ]]; then
  info "Exporting environment variables..."
  ENV_COUNT=0
  while IFS= read -r key; do
    if [[ -n "$key" && "$key" != "null" ]]; then
      val=$(yq eval ".env.${key}" "$CONFIG_FILE")
      # Preserve existing values (workflow secrets take precedence)
      if [[ -z "${!key:-}" ]]; then
        set_env "$key" "$val"
        ENV_COUNT=$((ENV_COUNT + 1))
      fi
    fi
  done < <(yq eval '.env | keys | .[]' "$CONFIG_FILE" 2>/dev/null || true)
  success "Exported $ENV_COUNT environment variables"
fi

# ─── Full Phase: Project Dependency Detection ────────────────────────────────

if [[ "$PHASE" == "full" ]]; then
  info "Detecting project dependencies..."

  # Prisma detection (generate runs AFTER dependency install — see workflow steps)
  if [[ -f "${TARGET_DIR}/prisma/schema.prisma" ]] || \
     ( [[ -f "${TARGET_DIR}/package.json" ]] && grep -q '"prisma"' "${TARGET_DIR}/package.json" 2>/dev/null ); then
    set_env HAS_PRISMA true
    success "Prisma detected (generate deferred until after dependency install)"
  else
    set_env HAS_PRISMA false
    info "Prisma not detected — skipping database setup"
  fi

  # Playwright detection
  if [[ -f "${TARGET_DIR}/playwright.config.ts" ]] || \
     [[ -f "${TARGET_DIR}/playwright.config.js" ]] || \
     ( [[ -f "${TARGET_DIR}/package.json" ]] && grep -q '"@playwright/test"' "${TARGET_DIR}/package.json" 2>/dev/null ); then
    set_env HAS_PLAYWRIGHT true
    success "Playwright detected"
  else
    set_env HAS_PLAYWRIGHT false
    info "Playwright not detected — skipping E2E setup"
  fi
fi

# ─── Full Phase: ORM Setup (post-install) ───────────────────────────────────

run_orm_setup() {
  if [[ "${HAS_PRISMA:-false}" != "true" ]]; then
    info "No ORM detected — skipping ORM setup"
    return 0
  fi

  info "Running Prisma ORM setup..."

  # Determine the correct package runner for npx-equivalent commands
  local runner="npx"
  case "$MANAGER" in
    bun)  runner="bunx" ;;
    pnpm) runner="pnpm exec" ;;
    yarn) runner="yarn" ;;
  esac

  # Generate Prisma Client
  info "Generating Prisma client..."
  (cd "$TARGET_DIR" && $runner prisma generate)
  success "Prisma client generated"

  # Apply database migrations (deploy mode — no prompts)
  if [[ -n "${DATABASE_URL:-}" ]]; then
    info "Applying database migrations..."
    (cd "$TARGET_DIR" && $runner prisma migrate deploy)
    success "Database migrations applied"
  else
    info "DATABASE_URL not set — skipping migrations (generate-only mode)"
  fi
}

if [[ "$PHASE" == "full" ]]; then
  run_orm_setup
fi

# ─── Final Validation ────────────────────────────────────────────────────────

info "Running final validation ($PHASE)..."
VALIDATION_FAILED=false

# Check package manager on PATH (both phases)
if ! command -v "$MANAGER" &>/dev/null; then
  error "Validation failed: $MANAGER not found on PATH"
  VALIDATION_FAILED=true
fi

# Check symlinks exist and targets are readable (both phases)
for link in "commands" "skills"; do
  link_path="${TARGET_DIR}/.claude/${link}"
  if [[ ! -L "$link_path" ]]; then
    error "Validation failed: symlink not found: $link_path"
    VALIDATION_FAILED=true
  elif [[ ! -d "$link_path" ]]; then
    error "Validation failed: symlink target not readable: $link_path -> $(readlink "$link_path")"
    VALIDATION_FAILED=true
  fi
done

# Full phase only: Check agent CLI (node_modules checked by workflow after install)
if [[ "$PHASE" == "full" ]]; then
  # Check agent CLI on PATH
  case "$AGENT_CLI" in
    claude-code)
      if ! command -v claude &>/dev/null; then
        error "Validation failed: claude-code CLI not found on PATH"
        VALIDATION_FAILED=true
      fi
      ;;
    codex)
      if ! command -v codex &>/dev/null; then
        error "Validation failed: codex CLI not found on PATH"
        VALIDATION_FAILED=true
      fi
      ;;
  esac
fi

if [[ "$VALIDATION_FAILED" == "true" ]]; then
  error "Environment setup validation failed. See errors above."
  exit 1
fi

success "Environment setup complete ($PHASE). Validation passed."
