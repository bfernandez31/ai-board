#!/bin/bash
# Run Integration Tests with Automatic Server Management
#
# This script:
# 1. Starts the dev server with test configuration
# 2. Waits for it to be ready
# 3. Runs integration tests
# 4. Cleans up the server process

set -e

# Configuration
PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"
MAX_WAIT=60  # Maximum seconds to wait for server
SERVER_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo -e "${YELLOW}Stopping dev server (PID: $SERVER_PID)...${NC}"
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

echo -e "${GREEN}Starting integration tests...${NC}"

# Check if server is already running
if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${YELLOW}Dev server already running at $BASE_URL${NC}"
    echo -e "${GREEN}Running integration tests...${NC}"
    VITEST_INTEGRATION=1 bun vitest run
    exit $?
fi

# Start the dev server in background with test environment
echo -e "${GREEN}Starting dev server with test configuration...${NC}"
TEST_MODE=true \
WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only \
NODE_ENV=test \
bun run dev > /tmp/dev-server.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"

# Wait for server to be ready
echo -n "Waiting for server to be ready"
WAITED=0
while ! curl -s "$BASE_URL" > /dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo -e "\n${RED}Server failed to start within ${MAX_WAIT}s${NC}"
        echo "Server logs:"
        cat /tmp/dev-server.log
        exit 1
    fi

    # Check if server process is still running
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo -e "\n${RED}Server process died unexpectedly${NC}"
        echo "Server logs:"
        cat /tmp/dev-server.log
        exit 1
    fi

    echo -n "."
    sleep 1
    WAITED=$((WAITED + 1))
done

echo -e "\n${GREEN}Server ready! (took ${WAITED}s)${NC}"

# Run integration tests
echo -e "${GREEN}Running integration tests...${NC}"
VITEST_INTEGRATION=1 bun vitest run

TEST_EXIT_CODE=$?

echo -e "${GREEN}Integration tests completed with exit code: $TEST_EXIT_CODE${NC}"
exit $TEST_EXIT_CODE
