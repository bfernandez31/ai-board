#!/usr/bin/env bash
# detect-stack.sh — Deterministic stack detection for project onboarding (Phase 1)
#
# Scans the current directory for manifest files and lockfiles to detect:
#   - Language (typescript, javascript, python, go, rust, java, kotlin, ruby, php)
#   - Framework (nextjs, express, fastapi, django, flask, gin, rails, laravel, etc.)
#   - Package manager (bun, npm, yarn, pnpm, pip, poetry, cargo, maven, gradle, bundler, composer)
#   - Services (postgres, redis, mysql, mongo)
#   - Test framework
#
# Outputs:
#   .ai-board/config.yml   — validated project configuration
#   .ai-board/analysis.json — raw detection data for Phase 2 LLM
set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────
LANGUAGE="javascript"
FRAMEWORK="none"
PACKAGE_MANAGER="npm"
SERVICES=()
TEST_FRAMEWORK=""
PROJECT_NAME=""
INSTALL_CMD=""
BUILD_CMD=""
LINT_CMD=""
TYPE_CHECK_CMD=""
TEST_UNIT_CMD=""

# ── Detect project name ──────────────────────────────────────
if [ -f "package.json" ]; then
  PROJECT_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | head -1 | sed 's/.*: *"//;s/"//')
elif [ -f "Cargo.toml" ]; then
  PROJECT_NAME=$(grep '^name' Cargo.toml | head -1 | sed 's/.*= *"//;s/"//')
elif [ -f "pyproject.toml" ]; then
  PROJECT_NAME=$(grep '^name' pyproject.toml | head -1 | sed 's/.*= *"//;s/"//')
elif [ -f "go.mod" ]; then
  PROJECT_NAME=$(head -1 go.mod | sed 's/module //' | xargs basename 2>/dev/null || echo "go-project")
elif [ -f "composer.json" ]; then
  PROJECT_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' composer.json | head -1 | sed 's/.*: *"//;s/"//;s|.*/||')
elif [ -f "Gemfile" ]; then
  PROJECT_NAME=$(basename "$(pwd)")
else
  PROJECT_NAME=$(basename "$(pwd)")
fi

# ── Detect language and package manager ───────────────────────
if [ -f "Cargo.toml" ]; then
  LANGUAGE="rust"
  PACKAGE_MANAGER="cargo"
  INSTALL_CMD="cargo build"
  BUILD_CMD="cargo build --release"
  TEST_UNIT_CMD="cargo test"

  # Detect Rust frameworks
  if grep -q "actix" Cargo.toml 2>/dev/null; then
    FRAMEWORK="none"
  fi

elif [ -f "go.mod" ]; then
  LANGUAGE="go"
  PACKAGE_MANAGER="npm"  # Go doesn't have a separate manager in our enum; fallback
  INSTALL_CMD="go mod download"
  BUILD_CMD="go build ./..."
  TEST_UNIT_CMD="go test ./..."

  if grep -q "gin-gonic" go.mod 2>/dev/null; then
    FRAMEWORK="gin"
  fi
  # Override manager to closest match
  PACKAGE_MANAGER="npm"

elif [ -f "Gemfile" ]; then
  LANGUAGE="ruby"
  PACKAGE_MANAGER="bundler"
  INSTALL_CMD="bundle install"

  if grep -q "rails" Gemfile 2>/dev/null; then
    FRAMEWORK="rails"
    BUILD_CMD=""
    TEST_UNIT_CMD="bundle exec rails test"
  fi

elif [ -f "composer.json" ]; then
  LANGUAGE="php"
  PACKAGE_MANAGER="composer"
  INSTALL_CMD="composer install"

  if grep -q "laravel" composer.json 2>/dev/null; then
    FRAMEWORK="laravel"
    TEST_UNIT_CMD="php artisan test"
  fi

elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ] || [ -f "setup.py" ]; then
  LANGUAGE="python"

  if [ -f "poetry.lock" ]; then
    PACKAGE_MANAGER="poetry"
    INSTALL_CMD="poetry install"
  else
    PACKAGE_MANAGER="pip"
    INSTALL_CMD="pip install -r requirements.txt"
  fi

  # Detect Python frameworks
  PYFILES=$(cat pyproject.toml requirements.txt setup.py 2>/dev/null || true)
  if echo "$PYFILES" | grep -qi "fastapi"; then
    FRAMEWORK="fastapi"
  elif echo "$PYFILES" | grep -qi "django"; then
    FRAMEWORK="django"
  elif echo "$PYFILES" | grep -qi "flask"; then
    FRAMEWORK="flask"
  fi

  if echo "$PYFILES" | grep -qi "pytest"; then
    TEST_FRAMEWORK="pytest"
    TEST_UNIT_CMD="pytest"
  fi

elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  # Check for Kotlin
  if [ -f "build.gradle.kts" ] || find . -maxdepth 3 -name "*.kt" -print -quit 2>/dev/null | grep -q .; then
    LANGUAGE="kotlin"
  else
    LANGUAGE="java"
  fi
  PACKAGE_MANAGER="gradle"
  INSTALL_CMD="./gradlew build"
  BUILD_CMD="./gradlew build"
  TEST_UNIT_CMD="./gradlew test"

  # Detect Spring Boot
  if grep -q "spring-boot" build.gradle build.gradle.kts 2>/dev/null; then
    FRAMEWORK="spring-boot"
  fi

elif [ -f "pom.xml" ]; then
  LANGUAGE="java"
  PACKAGE_MANAGER="maven"
  INSTALL_CMD="mvn install"
  BUILD_CMD="mvn package"
  TEST_UNIT_CMD="mvn test"

  if grep -q "spring-boot" pom.xml 2>/dev/null; then
    FRAMEWORK="spring-boot"
  fi

elif [ -f "package.json" ]; then
  # JavaScript/TypeScript ecosystem
  if [ -f "tsconfig.json" ] || grep -q '"typescript"' package.json 2>/dev/null; then
    LANGUAGE="typescript"
  else
    LANGUAGE="javascript"
  fi

  # Detect package manager
  if [ -f "bun.lock" ] || [ -f "bun.lockb" ]; then
    PACKAGE_MANAGER="bun"
    INSTALL_CMD="bun install"
  elif [ -f "pnpm-lock.yaml" ]; then
    PACKAGE_MANAGER="pnpm"
    INSTALL_CMD="pnpm install"
  elif [ -f "yarn.lock" ]; then
    PACKAGE_MANAGER="yarn"
    INSTALL_CMD="yarn install"
  else
    PACKAGE_MANAGER="npm"
    INSTALL_CMD="npm install"
  fi

  # Detect JS/TS frameworks from package.json
  PKG_CONTENT=$(cat package.json 2>/dev/null || echo "{}")
  if echo "$PKG_CONTENT" | grep -q '"next"'; then
    FRAMEWORK="nextjs"
    BUILD_CMD="${PACKAGE_MANAGER} run build"
    TYPE_CHECK_CMD="${PACKAGE_MANAGER} run type-check"
  elif echo "$PKG_CONTENT" | grep -q '"express"'; then
    FRAMEWORK="express"
  fi

  # Detect test framework
  if echo "$PKG_CONTENT" | grep -q '"vitest"'; then
    TEST_FRAMEWORK="vitest"
    TEST_UNIT_CMD="${PACKAGE_MANAGER} run test"
  elif echo "$PKG_CONTENT" | grep -q '"jest"'; then
    TEST_FRAMEWORK="jest"
    TEST_UNIT_CMD="${PACKAGE_MANAGER} run test"
  fi

  # Detect lint
  if echo "$PKG_CONTENT" | grep -q '"eslint"'; then
    LINT_CMD="${PACKAGE_MANAGER} run lint"
  fi
fi

# ── Detect services ──────────────────────────────────────────
# Check docker-compose, env files, and config for service hints
ALL_FILES=$(cat docker-compose.yml docker-compose.yaml .env .env.example 2>/dev/null || true)
if echo "$ALL_FILES" | grep -qi "postgres\|POSTGRES\|postgresql"; then
  SERVICES+=("postgres")
fi
if echo "$ALL_FILES" | grep -qi "redis\|REDIS"; then
  SERVICES+=("redis")
fi
if echo "$ALL_FILES" | grep -qi "mysql\|MYSQL"; then
  SERVICES+=("mysql")
fi
if echo "$ALL_FILES" | grep -qi "mongo\|MONGO"; then
  SERVICES+=("mongo")
fi

# ── Generate config.yml ──────────────────────────────────────
mkdir -p .ai-board

cat > .ai-board/config.yml <<YAML
version: 1

project:
  name: ${PROJECT_NAME}
  language: ${LANGUAGE}
  framework: ${FRAMEWORK}

runtime:
  manager: ${PACKAGE_MANAGER}

services: []

commands:
  install: "${INSTALL_CMD}"
YAML

# Add optional commands
if [ -n "$BUILD_CMD" ]; then
  echo "  build: \"${BUILD_CMD}\"" >> .ai-board/config.yml
fi
if [ -n "$LINT_CMD" ]; then
  echo "  lint: \"${LINT_CMD}\"" >> .ai-board/config.yml
fi
if [ -n "$TYPE_CHECK_CMD" ]; then
  echo "  type_check: \"${TYPE_CHECK_CMD}\"" >> .ai-board/config.yml
fi
if [ -n "$TEST_UNIT_CMD" ]; then
  echo "  test_unit: \"${TEST_UNIT_CMD}\"" >> .ai-board/config.yml
fi

# Add services if detected
if [ ${#SERVICES[@]} -gt 0 ]; then
  # Overwrite the empty services array
  sed -i 's/^services: \[\]/services:/' .ai-board/config.yml
  for svc in "${SERVICES[@]}"; do
    echo "  - type: ${svc}" >> .ai-board/config.yml
    echo "    version: \"latest\"" >> .ai-board/config.yml
  done
fi

cat >> .ai-board/config.yml <<YAML

agent:
  cli: claude-code
YAML

# ── Generate analysis.json ────────────────────────────────────
SERVICES_JSON="[]"
if [ ${#SERVICES[@]} -gt 0 ]; then
  SERVICES_JSON=$(printf '"%s",' "${SERVICES[@]}" | sed 's/,$//')
  SERVICES_JSON="[${SERVICES_JSON}]"
fi

cat > .ai-board/analysis.json <<JSON
{
  "language": "${LANGUAGE}",
  "framework": "${FRAMEWORK}",
  "packageManager": "${PACKAGE_MANAGER}",
  "testFramework": "${TEST_FRAMEWORK}",
  "services": ${SERVICES_JSON},
  "projectName": "${PROJECT_NAME}",
  "detectedFiles": {
    "packageJson": $([ -f "package.json" ] && echo "true" || echo "false"),
    "cargoToml": $([ -f "Cargo.toml" ] && echo "true" || echo "false"),
    "pyprojectToml": $([ -f "pyproject.toml" ] && echo "true" || echo "false"),
    "goMod": $([ -f "go.mod" ] && echo "true" || echo "false"),
    "gemfile": $([ -f "Gemfile" ] && echo "true" || echo "false"),
    "composerJson": $([ -f "composer.json" ] && echo "true" || echo "false"),
    "buildGradle": $([ -f "build.gradle" ] || [ -f "build.gradle.kts" ] && echo "true" || echo "false"),
    "pomXml": $([ -f "pom.xml" ] && echo "true" || echo "false"),
    "tsconfig": $([ -f "tsconfig.json" ] && echo "true" || echo "false"),
    "dockerfile": $([ -f "Dockerfile" ] && echo "true" || echo "false"),
    "dockerCompose": $([ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ] && echo "true" || echo "false")
  }
}
JSON

echo "✓ Stack detection complete: ${LANGUAGE}/${FRAMEWORK}/${PACKAGE_MANAGER}"
echo "  Config: .ai-board/config.yml"
echo "  Analysis: .ai-board/analysis.json"
