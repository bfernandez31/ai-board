#!/bin/bash
# Setup test environment file for CI/CD workflows
# Config-driven: reads commands.env_setup from .ai-board/config.yml if available,
# falls back to .env.test template approach, skips if neither exists.

set -e

echo "🔧 Setting up test environment..."

# 1. Config-driven: check if project defines a custom env_setup command
if [ -f ".ai-board/config.yml" ] && command -v yq &>/dev/null; then
  ENV_SETUP_CMD=$(yq eval '.commands.env_setup' .ai-board/config.yml 2>/dev/null)
  if [ -n "$ENV_SETUP_CMD" ] && [ "$ENV_SETUP_CMD" != "null" ]; then
    echo "▶️  Running config env_setup: $ENV_SETUP_CMD"
    eval "$ENV_SETUP_CMD"
    echo "✅ Custom env_setup completed"
    exit 0
  fi
fi

# 2. Fallback: .env.test template approach (ai-board default)
if [ ! -f ".env.test" ]; then
  echo "ℹ️  No .env.test template and no commands.env_setup in config — skipping"
  exit 0
fi

echo "🔧 Setting up test environment file from .env.test template..."

# Copy template to .env
cp .env.test .env

# Replace placeholder variables with actual GitHub Secrets
# Using sed with | delimiter to avoid issues with / in URLs
sed -i.bak \
  -e "s|\${GITHUB_TOKEN}|${GITHUB_TOKEN}|g" \
  -e "s|\${WORKFLOW_API_TOKEN}|${WORKFLOW_API_TOKEN}|g" \
  -e "s|\${CLOUDINARY_CLOUD_NAME}|${CLOUDINARY_CLOUD_NAME}|g" \
  -e "s|\${CLOUDINARY_API_KEY}|${CLOUDINARY_API_KEY}|g" \
  -e "s|\${CLOUDINARY_API_SECRET}|${CLOUDINARY_API_SECRET}|g" \
  .env

# Remove backup file created by sed
rm -f .env.bak

echo "✅ Test environment file created successfully"
echo "📋 Environment variables configured:"
echo "  - DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ai_board_test"
echo "  - NEXTAUTH_URL: http://localhost:3000"
echo "  - APP_URL: http://localhost:3000"
echo "  - GITHUB_TOKEN: ${GITHUB_TOKEN:0:10}... (${#GITHUB_TOKEN} chars)"
echo "  - WORKFLOW_API_TOKEN: ${WORKFLOW_API_TOKEN:0:10}... (${#WORKFLOW_API_TOKEN} chars)"
echo "  - CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}"
echo ""
