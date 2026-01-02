#!/bin/bash
# Run All Tests (Unit + Integration + E2E) with Automatic Server Management
#
# This script:
# 1. Runs unit tests (no server needed)
# 2. Starts the dev server with test configuration
# 3. Runs integration tests
# 4. Runs E2E tests
# 5. Cleans up the server process

set -e

# Configuration
PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"
MAX_WAIT=60
SERVER_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo -e "${YELLOW}Stopping dev server (PID: $SERVER_PID)...${NC}"
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Running All Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Unit Tests (no server needed)
echo -e "${GREEN}[1/3] Running unit tests...${NC}"
bun vitest run
echo -e "${GREEN}Unit tests passed!${NC}"
echo ""

# Step 2: Start server if needed
EXTERNAL_SERVER=false
if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${YELLOW}Dev server already running at $BASE_URL${NC}"
    EXTERNAL_SERVER=true
else
    echo -e "${GREEN}[2/3] Starting dev server...${NC}"
    TEST_MODE=true \
    WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only \
    NODE_ENV=test \
    bun run dev > /tmp/dev-server.log 2>&1 &
    SERVER_PID=$!

    # Wait for server
    echo -n "Waiting for server"
    WAITED=0
    while ! curl -s "$BASE_URL" > /dev/null 2>&1; do
        if [ $WAITED -ge $MAX_WAIT ]; then
            echo -e "\n${RED}Server failed to start within ${MAX_WAIT}s${NC}"
            cat /tmp/dev-server.log
            exit 1
        fi
        if ! kill -0 "$SERVER_PID" 2>/dev/null; then
            echo -e "\n${RED}Server process died${NC}"
            cat /tmp/dev-server.log
            exit 1
        fi
        echo -n "."
        sleep 1
        WAITED=$((WAITED + 1))
    done
    echo -e " ${GREEN}ready!${NC}"
fi

# Step 3: Integration Tests
echo -e "${GREEN}[2/3] Running integration tests...${NC}"
VITEST_INTEGRATION=1 bun vitest run
echo -e "${GREEN}Integration tests passed!${NC}"
echo ""

# Step 4: E2E Tests
echo -e "${GREEN}[3/3] Running E2E tests...${NC}"
bun playwright test
echo -e "${GREEN}E2E tests passed!${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  All tests passed!${NC}"
echo -e "${BLUE}========================================${NC}"
