#!/usr/bin/env bash
set -euo pipefail

# Phase 1: Deterministic stack detection script for project onboarding.
# Scans a target repository to detect language, framework, package manager,
# test framework, services, and commands. Produces config.yml + analysis.json.
#
# Usage: detect-stack.sh <path-to-repo-root>
# Exit codes: 0 = success, 1 = detection failure

REPO_DIR="${1:?ERROR: Repository path is required as first argument}"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "ERROR: Directory does not exist: $REPO_DIR" >&2
  exit 1
fi

if [[ ! -r "$REPO_DIR" ]]; then
  echo "ERROR: Cannot read directory: $REPO_DIR" >&2
  exit 1
fi

# Resolve to absolute path
REPO_DIR="$(cd "$REPO_DIR" && pwd)"

# ─── Detection Variables ────────────────────────────────────────────

LANGUAGE=""
FRAMEWORK=""
PACKAGE_MANAGER=""
TEST_FRAMEWORK=""
PROJECT_NAME=""
SERVICES_JSON="[]"
COMMANDS_JSON="{}"
MANIFESTS=()
LOCKFILES=()
CONFIG_FILES=()
RUNTIME_VERSIONS="{}"
SECONDARY_LANGUAGES=()

# ─── Project Name ───────────────────────────────────────────────────

detect_project_name() {
  # Try package.json name first
  if [[ -f "$REPO_DIR/package.json" ]]; then
    local name
    name=$(jq -r '.name // empty' "$REPO_DIR/package.json" 2>/dev/null || true)
    if [[ -n "$name" ]]; then
      PROJECT_NAME="$name"
      return
    fi
  fi

  # Try Cargo.toml
  if [[ -f "$REPO_DIR/Cargo.toml" ]]; then
    local name
    name=$(grep -m1 '^name\s*=' "$REPO_DIR/Cargo.toml" | sed 's/.*=\s*"\(.*\)".*/\1/' 2>/dev/null || true)
    if [[ -n "$name" ]]; then
      PROJECT_NAME="$name"
      return
    fi
  fi

  # Try pyproject.toml
  if [[ -f "$REPO_DIR/pyproject.toml" ]]; then
    local name
    name=$(grep -m1 '^name\s*=' "$REPO_DIR/pyproject.toml" | sed 's/.*=\s*"\(.*\)".*/\1/' 2>/dev/null || true)
    if [[ -n "$name" ]]; then
      PROJECT_NAME="$name"
      return
    fi
  fi

  # Try composer.json
  if [[ -f "$REPO_DIR/composer.json" ]]; then
    local name
    name=$(jq -r '.name // empty' "$REPO_DIR/composer.json" 2>/dev/null || true)
    if [[ -n "$name" ]]; then
      PROJECT_NAME="$name"
      return
    fi
  fi

  # Fallback to directory name
  PROJECT_NAME="$(basename "$REPO_DIR")"
}

# ─── Language Detection ─────────────────────────────────────────────

detect_language() {
  local all_langs=()

  # Priority order: package.json > Cargo.toml > go.mod > pyproject.toml > pom.xml/build.gradle > Gemfile > composer.json
  if [[ -f "$REPO_DIR/package.json" ]]; then
    MANIFESTS+=("package.json")

    # Check for TypeScript indicators
    if [[ -f "$REPO_DIR/tsconfig.json" ]] || jq -e '.devDependencies.typescript // .dependencies.typescript' "$REPO_DIR/package.json" >/dev/null 2>&1; then
      all_langs+=("typescript")
    else
      all_langs+=("javascript")
    fi
  fi

  if [[ -f "$REPO_DIR/Cargo.toml" ]]; then
    MANIFESTS+=("Cargo.toml")
    all_langs+=("rust")
  fi

  if [[ -f "$REPO_DIR/go.mod" ]]; then
    MANIFESTS+=("go.mod")
    all_langs+=("go")
  fi

  if [[ -f "$REPO_DIR/pyproject.toml" ]] || [[ -f "$REPO_DIR/requirements.txt" ]] || [[ -f "$REPO_DIR/setup.py" ]]; then
    [[ -f "$REPO_DIR/pyproject.toml" ]] && MANIFESTS+=("pyproject.toml")
    [[ -f "$REPO_DIR/requirements.txt" ]] && MANIFESTS+=("requirements.txt")
    [[ -f "$REPO_DIR/setup.py" ]] && MANIFESTS+=("setup.py")
    all_langs+=("python")
  fi

  if [[ -f "$REPO_DIR/pom.xml" ]]; then
    MANIFESTS+=("pom.xml")
    all_langs+=("java")
  elif [[ -f "$REPO_DIR/build.gradle" ]] || [[ -f "$REPO_DIR/build.gradle.kts" ]]; then
    [[ -f "$REPO_DIR/build.gradle" ]] && MANIFESTS+=("build.gradle")
    [[ -f "$REPO_DIR/build.gradle.kts" ]] && MANIFESTS+=("build.gradle.kts")
    # Check for Kotlin
    if [[ -f "$REPO_DIR/build.gradle.kts" ]] || grep -q "kotlin" "$REPO_DIR/build.gradle" 2>/dev/null; then
      all_langs+=("kotlin")
    else
      all_langs+=("java")
    fi
  fi

  if [[ -f "$REPO_DIR/Gemfile" ]]; then
    MANIFESTS+=("Gemfile")
    all_langs+=("ruby")
  fi

  if [[ -f "$REPO_DIR/composer.json" ]]; then
    MANIFESTS+=("composer.json")
    all_langs+=("php")
  fi

  # Set primary language (first detected) and secondary languages
  if [[ ${#all_langs[@]} -gt 0 ]]; then
    LANGUAGE="${all_langs[0]}"
    for lang in "${all_langs[@]:1}"; do
      SECONDARY_LANGUAGES+=("$lang")
    done
  fi
}

# ─── Package Manager Detection ──────────────────────────────────────

detect_package_manager() {
  # Node.js package managers (check lockfiles in priority order)
  if [[ -f "$REPO_DIR/bun.lockb" ]] || [[ -f "$REPO_DIR/bun.lock" ]]; then
    [[ -f "$REPO_DIR/bun.lockb" ]] && LOCKFILES+=("bun.lockb")
    [[ -f "$REPO_DIR/bun.lock" ]] && LOCKFILES+=("bun.lock")
    PACKAGE_MANAGER="bun"
  elif [[ -f "$REPO_DIR/yarn.lock" ]]; then
    LOCKFILES+=("yarn.lock")
    PACKAGE_MANAGER="yarn"
  elif [[ -f "$REPO_DIR/pnpm-lock.yaml" ]]; then
    LOCKFILES+=("pnpm-lock.yaml")
    PACKAGE_MANAGER="pnpm"
  elif [[ -f "$REPO_DIR/package-lock.json" ]]; then
    LOCKFILES+=("package-lock.json")
    PACKAGE_MANAGER="npm"
  elif [[ -f "$REPO_DIR/package.json" ]] && [[ -z "$PACKAGE_MANAGER" ]]; then
    # Default to npm if package.json exists but no lockfile
    PACKAGE_MANAGER="npm"
  fi

  # Rust
  if [[ -f "$REPO_DIR/Cargo.lock" ]]; then
    LOCKFILES+=("Cargo.lock")
    if [[ -z "$PACKAGE_MANAGER" ]] || [[ "$LANGUAGE" == "rust" ]]; then
      PACKAGE_MANAGER="cargo"
    fi
  elif [[ "$LANGUAGE" == "rust" ]]; then
    PACKAGE_MANAGER="cargo"
  fi

  # Python
  if [[ -f "$REPO_DIR/poetry.lock" ]]; then
    LOCKFILES+=("poetry.lock")
    if [[ -z "$PACKAGE_MANAGER" ]] || [[ "$LANGUAGE" == "python" ]]; then
      PACKAGE_MANAGER="poetry"
    fi
  elif [[ -f "$REPO_DIR/Pipfile.lock" ]]; then
    LOCKFILES+=("Pipfile.lock")
    if [[ -z "$PACKAGE_MANAGER" ]] || [[ "$LANGUAGE" == "python" ]]; then
      PACKAGE_MANAGER="pip"
    fi
  elif [[ "$LANGUAGE" == "python" ]] && [[ -z "$PACKAGE_MANAGER" ]]; then
    PACKAGE_MANAGER="pip"
  fi

  # Go
  if [[ -f "$REPO_DIR/go.sum" ]]; then
    LOCKFILES+=("go.sum")
  fi

  # Java/Kotlin — maven vs gradle
  if [[ "$LANGUAGE" == "java" ]] || [[ "$LANGUAGE" == "kotlin" ]]; then
    if [[ -f "$REPO_DIR/pom.xml" ]]; then
      PACKAGE_MANAGER="maven"
    elif [[ -f "$REPO_DIR/build.gradle" ]] || [[ -f "$REPO_DIR/build.gradle.kts" ]]; then
      PACKAGE_MANAGER="gradle"
    fi
  fi

  # Ruby
  if [[ -f "$REPO_DIR/Gemfile.lock" ]]; then
    LOCKFILES+=("Gemfile.lock")
    if [[ -z "$PACKAGE_MANAGER" ]] || [[ "$LANGUAGE" == "ruby" ]]; then
      PACKAGE_MANAGER="bundler"
    fi
  elif [[ "$LANGUAGE" == "ruby" ]] && [[ -z "$PACKAGE_MANAGER" ]]; then
    PACKAGE_MANAGER="bundler"
  fi

  # PHP
  if [[ -f "$REPO_DIR/composer.lock" ]]; then
    LOCKFILES+=("composer.lock")
    if [[ -z "$PACKAGE_MANAGER" ]] || [[ "$LANGUAGE" == "php" ]]; then
      PACKAGE_MANAGER="composer"
    fi
  elif [[ "$LANGUAGE" == "php" ]] && [[ -z "$PACKAGE_MANAGER" ]]; then
    PACKAGE_MANAGER="composer"
  fi
}

# ─── Framework Detection ────────────────────────────────────────────

detect_framework() {
  case "$LANGUAGE" in
    typescript|javascript)
      if [[ -f "$REPO_DIR/package.json" ]]; then
        local deps
        deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[]' "$REPO_DIR/package.json" 2>/dev/null || true)

        if echo "$deps" | grep -qx "next"; then
          FRAMEWORK="nextjs"
        elif echo "$deps" | grep -qx "express"; then
          FRAMEWORK="express"
        fi
      fi
      ;;
    python)
      local py_deps=""
      if [[ -f "$REPO_DIR/pyproject.toml" ]]; then
        py_deps=$(grep -iE '^\s*(django|fastapi|flask)\b' "$REPO_DIR/pyproject.toml" 2>/dev/null || true)
      fi
      if [[ -f "$REPO_DIR/requirements.txt" ]]; then
        py_deps="$py_deps $(grep -iE '^(django|fastapi|flask)\b' "$REPO_DIR/requirements.txt" 2>/dev/null || true)"
      fi

      if echo "$py_deps" | grep -qi "django"; then
        FRAMEWORK="django"
      elif echo "$py_deps" | grep -qi "fastapi"; then
        FRAMEWORK="fastapi"
      elif echo "$py_deps" | grep -qi "flask"; then
        FRAMEWORK="flask"
      fi
      ;;
    rust)
      if [[ -f "$REPO_DIR/Cargo.toml" ]]; then
        local cargo_deps
        cargo_deps=$(sed -n '/\[dependencies\]/,/^\[/p' "$REPO_DIR/Cargo.toml" 2>/dev/null || true)

        if echo "$cargo_deps" | grep -q "actix-web"; then
          FRAMEWORK="actix"
        elif echo "$cargo_deps" | grep -q "rocket"; then
          FRAMEWORK="rocket"
        fi
      fi
      ;;
    go)
      if [[ -f "$REPO_DIR/go.mod" ]]; then
        local go_deps
        go_deps=$(cat "$REPO_DIR/go.mod" 2>/dev/null || true)

        if echo "$go_deps" | grep -q "gin-gonic/gin"; then
          FRAMEWORK="gin"
        fi
      fi
      ;;
    java|kotlin)
      if [[ -f "$REPO_DIR/pom.xml" ]]; then
        if grep -q "spring-boot" "$REPO_DIR/pom.xml" 2>/dev/null; then
          FRAMEWORK="spring-boot"
        elif grep -q "quarkus" "$REPO_DIR/pom.xml" 2>/dev/null; then
          FRAMEWORK="quarkus"
        elif grep -q "micronaut" "$REPO_DIR/pom.xml" 2>/dev/null; then
          FRAMEWORK="micronaut"
        fi
      fi
      if [[ -f "$REPO_DIR/build.gradle" ]] || [[ -f "$REPO_DIR/build.gradle.kts" ]]; then
        local gradle_file=""
        if [[ -f "$REPO_DIR/build.gradle.kts" ]]; then
          gradle_file="$REPO_DIR/build.gradle.kts"
        elif [[ -f "$REPO_DIR/build.gradle" ]]; then
          gradle_file="$REPO_DIR/build.gradle"
        fi
        if [[ -n "$gradle_file" ]]; then
          if grep -q "spring-boot" "$gradle_file" 2>/dev/null; then
            FRAMEWORK="spring-boot"
          elif grep -q "quarkus" "$gradle_file" 2>/dev/null; then
            FRAMEWORK="quarkus"
          elif grep -q "micronaut" "$gradle_file" 2>/dev/null; then
            FRAMEWORK="micronaut"
          fi
        fi
      fi
      ;;
    ruby)
      if [[ -f "$REPO_DIR/Gemfile" ]]; then
        if grep -q "rails" "$REPO_DIR/Gemfile" 2>/dev/null; then
          FRAMEWORK="rails"
        fi
      fi
      ;;
    php)
      if [[ -f "$REPO_DIR/composer.json" ]]; then
        local php_deps
        php_deps=$(jq -r '(.require // {}) | keys[]' "$REPO_DIR/composer.json" 2>/dev/null || true)

        if echo "$php_deps" | grep -q "laravel/framework"; then
          FRAMEWORK="laravel"
        fi
      fi
      ;;
  esac
}

# ─── Test Framework Detection ───────────────────────────────────────

detect_test_framework() {
  case "$LANGUAGE" in
    typescript|javascript)
      if [[ -f "$REPO_DIR/package.json" ]]; then
        local deps
        deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[]' "$REPO_DIR/package.json" 2>/dev/null || true)

        if echo "$deps" | grep -qx "vitest"; then
          TEST_FRAMEWORK="vitest"
        elif echo "$deps" | grep -qx "jest"; then
          TEST_FRAMEWORK="jest"
        fi

        # Also check for Playwright
        if echo "$deps" | grep -q "@playwright/test"; then
          if [[ -z "$TEST_FRAMEWORK" ]]; then
            TEST_FRAMEWORK="playwright"
          fi
        fi
      fi

      # Check config files
      if [[ -f "$REPO_DIR/vitest.config.ts" ]] || [[ -f "$REPO_DIR/vitest.config.js" ]]; then
        CONFIG_FILES+=("vitest.config.ts")
        TEST_FRAMEWORK="vitest"
      fi
      if [[ -f "$REPO_DIR/jest.config.ts" ]] || [[ -f "$REPO_DIR/jest.config.js" ]]; then
        TEST_FRAMEWORK="${TEST_FRAMEWORK:-jest}"
      fi
      ;;
    python)
      local py_deps=""
      if [[ -f "$REPO_DIR/pyproject.toml" ]]; then
        py_deps=$(cat "$REPO_DIR/pyproject.toml" 2>/dev/null || true)
      fi
      if [[ -f "$REPO_DIR/requirements.txt" ]]; then
        py_deps="$py_deps $(cat "$REPO_DIR/requirements.txt" 2>/dev/null || true)"
      fi

      if echo "$py_deps" | grep -qi "pytest"; then
        TEST_FRAMEWORK="pytest"
      fi
      ;;
    rust)
      # Rust uses built-in cargo test
      TEST_FRAMEWORK="cargo-test"
      ;;
    go)
      # Go uses built-in go test
      TEST_FRAMEWORK="go-test"
      ;;
    ruby)
      if [[ -f "$REPO_DIR/Gemfile" ]]; then
        if grep -q "rspec" "$REPO_DIR/Gemfile" 2>/dev/null; then
          TEST_FRAMEWORK="rspec"
        fi
      fi
      ;;
    php)
      if [[ -f "$REPO_DIR/composer.json" ]]; then
        local php_dev_deps
        php_dev_deps=$(jq -r '(."require-dev" // {}) | keys[]' "$REPO_DIR/composer.json" 2>/dev/null || true)
        if echo "$php_dev_deps" | grep -q "phpunit"; then
          TEST_FRAMEWORK="phpunit"
        fi
      fi
      ;;
  esac
}

# ─── Services Detection ─────────────────────────────────────────────

detect_services() {
  local services=()

  # Docker Compose
  if [[ -f "$REPO_DIR/docker-compose.yml" ]] || [[ -f "$REPO_DIR/docker-compose.yaml" ]]; then
    local compose_file=""
    [[ -f "$REPO_DIR/docker-compose.yml" ]] && compose_file="$REPO_DIR/docker-compose.yml"
    [[ -f "$REPO_DIR/docker-compose.yaml" ]] && compose_file="$REPO_DIR/docker-compose.yaml"
    CONFIG_FILES+=("$(basename "$compose_file")")

    # Detect postgres
    if grep -q "postgres" "$compose_file" 2>/dev/null; then
      services+=('{"type":"postgres","source":"docker-compose"}')
    fi
    # Detect redis
    if grep -q "redis" "$compose_file" 2>/dev/null; then
      services+=('{"type":"redis","source":"docker-compose"}')
    fi
    # Detect mysql
    if grep -q "mysql" "$compose_file" 2>/dev/null; then
      services+=('{"type":"mysql","source":"docker-compose"}')
    fi
    # Detect mongo
    if grep -q "mongo" "$compose_file" 2>/dev/null; then
      services+=('{"type":"mongo","source":"docker-compose"}')
    fi
  fi

  # Prisma → postgres
  if [[ -d "$REPO_DIR/prisma" ]] && [[ -f "$REPO_DIR/prisma/schema.prisma" ]]; then
    CONFIG_FILES+=("prisma/schema.prisma")
    if grep -q "postgresql" "$REPO_DIR/prisma/schema.prisma" 2>/dev/null; then
      # Check if postgres not already detected
      local already_has_postgres=false
      for s in "${services[@]+"${services[@]}"}"; do
        if echo "$s" | grep -q '"postgres"'; then
          already_has_postgres=true
          break
        fi
      done
      if [[ "$already_has_postgres" == "false" ]]; then
        services+=('{"type":"postgres","source":"prisma"}')
      fi
    fi
  fi

  # Build JSON array
  if [[ ${#services[@]} -gt 0 ]]; then
    SERVICES_JSON=$(printf '%s\n' "${services[@]}" | jq -s '.')
  fi
}

# ─── Commands Detection ─────────────────────────────────────────────

detect_commands() {
  local cmds="{}"

  # package.json scripts
  if [[ -f "$REPO_DIR/package.json" ]]; then
    local pkg_scripts
    pkg_scripts=$(jq -r '.scripts // {}' "$REPO_DIR/package.json" 2>/dev/null || echo "{}")
    if [[ "$pkg_scripts" != "{}" ]]; then
      cmds="$pkg_scripts"
    fi
  fi

  # Makefile targets
  if [[ -f "$REPO_DIR/Makefile" ]]; then
    CONFIG_FILES+=("Makefile")
    local make_targets
    make_targets=$(grep -E '^[a-zA-Z_-]+:' "$REPO_DIR/Makefile" 2>/dev/null | sed 's/:.*//' | head -20 || true)
    if [[ -n "$make_targets" ]]; then
      local make_json="{}"
      while IFS= read -r target; do
        make_json=$(echo "$make_json" | jq --arg k "make:$target" --arg v "make $target" '. + {($k): $v}')
      done <<< "$make_targets"
      cmds=$(echo "$cmds" "$make_json" | jq -s '.[0] + .[1]')
    fi
  fi

  COMMANDS_JSON="$cmds"
}

# ─── Runtime Versions ───────────────────────────────────────────────

detect_runtime_versions() {
  local versions="{}"

  # Node version from .nvmrc or .node-version or package.json engines
  if [[ -f "$REPO_DIR/.nvmrc" ]]; then
    local node_ver
    node_ver=$(cat "$REPO_DIR/.nvmrc" | tr -d 'v \n' 2>/dev/null || true)
    if [[ -n "$node_ver" ]]; then
      versions=$(echo "$versions" | jq --arg v "$node_ver" '. + {node: $v}')
    fi
  elif [[ -f "$REPO_DIR/.node-version" ]]; then
    local node_ver
    node_ver=$(cat "$REPO_DIR/.node-version" | tr -d 'v \n' 2>/dev/null || true)
    if [[ -n "$node_ver" ]]; then
      versions=$(echo "$versions" | jq --arg v "$node_ver" '. + {node: $v}')
    fi
  elif [[ -f "$REPO_DIR/package.json" ]]; then
    local node_ver
    node_ver=$(jq -r '.engines.node // empty' "$REPO_DIR/package.json" 2>/dev/null || true)
    if [[ -n "$node_ver" ]]; then
      versions=$(echo "$versions" | jq --arg v "$node_ver" '. + {node: $v}')
    fi
  fi

  # Python version from .python-version
  if [[ -f "$REPO_DIR/.python-version" ]]; then
    local py_ver
    py_ver=$(cat "$REPO_DIR/.python-version" | tr -d ' \n' 2>/dev/null || true)
    if [[ -n "$py_ver" ]]; then
      versions=$(echo "$versions" | jq --arg v "$py_ver" '. + {python: $v}')
    fi
  fi

  # Rust version from rust-toolchain.toml
  if [[ -f "$REPO_DIR/rust-toolchain.toml" ]]; then
    local rust_ver
    rust_ver=$(grep -m1 'channel\s*=' "$REPO_DIR/rust-toolchain.toml" | sed 's/.*=\s*"\(.*\)".*/\1/' 2>/dev/null || true)
    if [[ -n "$rust_ver" ]]; then
      versions=$(echo "$versions" | jq --arg v "$rust_ver" '. + {rust: $v}')
    fi
  fi

  # Go version from go.mod
  if [[ -f "$REPO_DIR/go.mod" ]]; then
    local go_ver
    go_ver=$(grep -m1 '^go ' "$REPO_DIR/go.mod" | awk '{print $2}' 2>/dev/null || true)
    if [[ -n "$go_ver" ]]; then
      versions=$(echo "$versions" | jq --arg v "$go_ver" '. + {go: $v}')
    fi
  fi

  RUNTIME_VERSIONS="$versions"
}

# ─── Output Generation ──────────────────────────────────────────────

generate_config_yml() {
  mkdir -p "$REPO_DIR/.ai-board"

  local lang_val="${LANGUAGE:-null}"
  local fw_val="${FRAMEWORK:-none}"
  local pm_val="${PACKAGE_MANAGER:-npm}"

  cat > "$REPO_DIR/.ai-board/config.yml" <<EOF
version: 1
project:
  name: "${PROJECT_NAME}"
  language: ${lang_val}
  framework: ${fw_val}
runtime:
  manager: ${pm_val}
commands:
  install: "echo 'install not configured'"
EOF
}

generate_analysis_json() {
  local secondary_json="[]"
  if [[ ${#SECONDARY_LANGUAGES[@]} -gt 0 ]]; then
    secondary_json=$(printf '%s\n' "${SECONDARY_LANGUAGES[@]}" | jq -R . | jq -s .)
  fi

  local manifests_json="[]"
  if [[ ${#MANIFESTS[@]} -gt 0 ]]; then
    manifests_json=$(printf '%s\n' "${MANIFESTS[@]}" | jq -R . | jq -s .)
  fi

  local lockfiles_json="[]"
  if [[ ${#LOCKFILES[@]} -gt 0 ]]; then
    lockfiles_json=$(printf '%s\n' "${LOCKFILES[@]}" | jq -R . | jq -s .)
  fi

  local config_files_json="[]"
  if [[ ${#CONFIG_FILES[@]} -gt 0 ]]; then
    config_files_json=$(printf '%s\n' "${CONFIG_FILES[@]}" | jq -R . | jq -s .)
  fi

  jq -n \
    --arg language "${LANGUAGE:-}" \
    --arg framework "${FRAMEWORK:-}" \
    --arg packageManager "${PACKAGE_MANAGER:-}" \
    --arg testFramework "${TEST_FRAMEWORK:-}" \
    --arg projectName "$PROJECT_NAME" \
    --argjson services "$SERVICES_JSON" \
    --argjson commands "$COMMANDS_JSON" \
    --argjson manifests "$manifests_json" \
    --argjson lockfiles "$lockfiles_json" \
    --argjson configFiles "$config_files_json" \
    --argjson runtimeVersions "$RUNTIME_VERSIONS" \
    --argjson secondaryLanguages "$secondary_json" \
    '{
      language: (if $language == "" then null else $language end),
      framework: (if $framework == "" then null else $framework end),
      packageManager: (if $packageManager == "" then null else $packageManager end),
      testFramework: (if $testFramework == "" then null else $testFramework end),
      services: $services,
      commands: $commands,
      manifests: $manifests,
      lockfiles: $lockfiles,
      configFiles: $configFiles,
      projectName: $projectName,
      runtimeVersions: $runtimeVersions,
      secondaryLanguages: $secondaryLanguages
    }' > "$REPO_DIR/analysis.json"
}

# ─── Main ───────────────────────────────────────────────────────────

detect_project_name
detect_language
detect_package_manager
detect_framework
detect_test_framework
detect_services
detect_commands
detect_runtime_versions
generate_config_yml
generate_analysis_json

echo "Stack detection complete: ${LANGUAGE:-none}/${FRAMEWORK:-none} (${PACKAGE_MANAGER:-none})"
