#!/bin/bash

# Start worker from project root
cd worker

# Load environment variables
if [ -f "../.env.local" ]; then
  export $(cat ../.env.local | grep -v '^#' | xargs)
fi

# Set worker-specific environment variables
export REDIS_URL="redis://localhost:6379"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_board"
export API_URL="http://localhost:3000"
export WORKSPACES_DIR="./workspaces"
export WORKER_CONCURRENCY="1"

# Add Claude CLI to PATH (from NVM)
export PATH="$HOME/.nvm/versions/node/v20.11.0/bin:$PATH"

# Set Claude Code OAuth token
if [ -f "../.env.local" ]; then
  CLAUDE_TOKEN=$(grep CLAUDE_CODE_OAUTH_TOKEN ../.env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
  if [ -n "$CLAUDE_TOKEN" ]; then
    export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_TOKEN"
  fi
fi

# Verify token is set
if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "⚠️  WARNING: CLAUDE_CODE_OAUTH_TOKEN not set. Claude CLI may fail to authenticate."
  echo "Please add it to .env.local or run 'claude setup-token' to generate one."
else
  echo "✅ Claude Code OAuth token configured"
fi

# Create workspaces directory if it doesn't exist
mkdir -p ./workspaces

echo "🚀 Starting AI Board Worker (Local Mode)"
echo "📍 Redis: $REDIS_URL"
echo "📍 API: $API_URL"
echo "📍 Database: $DATABASE_URL"
echo "📂 Workspaces: $WORKSPACES_DIR"
echo ""

# Run the worker
bun run src/index.ts