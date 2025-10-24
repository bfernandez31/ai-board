#!/bin/bash

# Load environment variables from parent .env.local
if [ -f "../.env.local" ]; then
  export $(cat ../.env.local | grep -v '^#' | xargs)
fi

# Set worker-specific environment variables
export REDIS_URL="redis://localhost:6379"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_board"
export API_URL="http://localhost:3000"
export WORKSPACES_DIR="./workspaces"
export WORKER_CONCURRENCY="1"

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