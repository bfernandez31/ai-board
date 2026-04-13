#!/bin/bash
# Run All Tests with JSON Reports
#
# Produces structured JSON reports for each test type:
#   /tmp/test-report-unit.json
#   /tmp/test-report-integration.json
#   /tmp/test-report-e2e.json
#   /tmp/test-report-summary.json
#
# Designed for automated consumption — never exits non-zero due to test failures.
# Check /tmp/test-report-summary.json for results.

# Don't set -e: we want to capture failures, not abort on them
set +e

PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"
MAX_WAIT=60
SERVER_PID=""

REPORT_DIR="/tmp"
UNIT_REPORT="$REPORT_DIR/test-report-unit.json"
INTEGRATION_REPORT="$REPORT_DIR/test-report-integration.json"
E2E_REPORT="$REPORT_DIR/test-report-e2e.json"
SUMMARY_REPORT="$REPORT_DIR/test-report-summary.json"

# Initialize report files
echo '{}' > "$UNIT_REPORT"
echo '{}' > "$INTEGRATION_REPORT"
echo '{}' > "$E2E_REPORT"

# Track results
UNIT_PASSED=0; UNIT_FAILED=0; UNIT_TOTAL=0; UNIT_RAN=false; UNIT_ERROR=""
INT_PASSED=0; INT_FAILED=0; INT_TOTAL=0; INT_RAN=false; INT_ERROR=""
E2E_PASSED=0; E2E_FAILED=0; E2E_TOTAL=0; E2E_RAN=false; E2E_ERROR=""

cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "Stopping dev server (PID: $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Parse vitest JSON report and extract counts
parse_vitest_report() {
    local report_file="$1"
    if [ -f "$report_file" ] && jq empty "$report_file" 2>/dev/null; then
        local passed failed total
        passed=$(jq '[.testResults[]?.assertionResults[]? | select(.status == "passed")] | length' "$report_file" 2>/dev/null || echo 0)
        failed=$(jq '[.testResults[]?.assertionResults[]? | select(.status == "failed")] | length' "$report_file" 2>/dev/null || echo 0)
        total=$((passed + failed))
        echo "$passed $failed $total"
    else
        echo "0 0 0"
    fi
}

# Parse Playwright JSON report and extract counts
# Playwright nests suites recursively (e.g. auth/, board/ subdirectories),
# so we must recurse into all .suites[] at every depth level.
parse_playwright_report() {
    local report_file="$1"
    if [ -f "$report_file" ] && jq empty "$report_file" 2>/dev/null; then
        local passed failed total
        passed=$(jq '[.. | .specs? // empty | .[]? | .tests[]? | select(.status == "expected")] | length' "$report_file" 2>/dev/null || echo 0)
        failed=$(jq '[.. | .specs? // empty | .[]? | .tests[]? | select(.status == "unexpected")] | length' "$report_file" 2>/dev/null || echo 0)
        total=$((passed + failed))
        echo "$passed $failed $total"
    else
        echo "0 0 0"
    fi
}

echo "========================================"
echo "  Running Tests with JSON Reports"
echo "========================================"
echo ""

# ── Step 1: Unit Tests ──────────────────────────────────────────────
echo "[1/3] Running unit tests..."
bun vitest run --reporter=json --outputFile="$UNIT_REPORT" 2>/tmp/test-unit-stderr.txt
UNIT_EXIT=$?
UNIT_RAN=true

if [ $UNIT_EXIT -ne 0 ] && [ ! -s "$UNIT_REPORT" ]; then
    UNIT_ERROR=$(cat /tmp/test-unit-stderr.txt 2>/dev/null | tail -c 2000)
    echo "Unit tests failed to produce report (exit: $UNIT_EXIT)"
else
    read UNIT_PASSED UNIT_FAILED UNIT_TOTAL <<< "$(parse_vitest_report "$UNIT_REPORT")"
    echo "Unit tests: $UNIT_PASSED passed, $UNIT_FAILED failed (total: $UNIT_TOTAL)"
fi
echo ""

# ── Step 2: Start server for integration + e2e ─────────────────────
# Always start a fresh server with the correct test env vars (WORKFLOW_API_TOKEN etc.).
# If a server is already running on the port (e.g. started by a prior workflow step with
# a different token), kill it first so integration tests get the right configuration.
EXTERNAL_SERVER=false
if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "Existing server detected on port $PORT — stopping it to ensure correct test env vars..."
    lsof -ti ":${PORT}" 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    WAIT_STOP=0
    while curl -s "$BASE_URL" > /dev/null 2>&1 && [ $WAIT_STOP -lt 15 ]; do
        sleep 1
        WAIT_STOP=$((WAIT_STOP + 1))
    done
    # Force kill if still alive after graceful period
    if curl -s "$BASE_URL" > /dev/null 2>&1; then
        lsof -ti ":${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

echo "[2/3] Starting dev server..."
TEST_MODE=true \
WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only \
TEST_WORKFLOW_TOKEN=test-workflow-token-for-e2e-tests-only \
NODE_ENV=test \
VERCEL_ENV=preview \
DEV_LOGIN_ENABLED=true \
DEV_LOGIN_SECRET=shared-preview-secret \
CREDENTIAL_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
bun run dev > /tmp/dev-server.log 2>&1 &
SERVER_PID=$!

echo -n "Waiting for server"
WAITED=0
while ! curl -s "$BASE_URL" > /dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo ""
        echo "Server failed to start within ${MAX_WAIT}s"
        INT_ERROR="Server failed to start within ${MAX_WAIT}s"
        E2E_ERROR="Server not available (failed to start)"
        # Write summary and exit — can't run int/e2e without server
        break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo ""
        echo "Server process died"
        INT_ERROR="Server process died during startup"
        E2E_ERROR="Server not available (process died)"
        break
    fi
    echo -n "."
    sleep 1
    WAITED=$((WAITED + 1))
done
if [ -z "$INT_ERROR" ]; then
    echo " ready!"
fi

# ── Step 3: Integration Tests ──────────────────────────────────────
if [ -z "$INT_ERROR" ]; then
    echo "[2/3] Running integration tests..."
    # Override WORKFLOW_API_TOKEN so tests use the same token as the server we started
    VITEST_INTEGRATION=1 \
    WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only \
    bun vitest run --reporter=json --outputFile="$INTEGRATION_REPORT" 2>/tmp/test-int-stderr.txt
    INT_EXIT=$?
    INT_RAN=true

    if [ $INT_EXIT -ne 0 ] && [ ! -s "$INTEGRATION_REPORT" ]; then
        INT_ERROR=$(cat /tmp/test-int-stderr.txt 2>/dev/null | tail -c 2000)
        echo "Integration tests failed to produce report (exit: $INT_EXIT)"
    else
        read INT_PASSED INT_FAILED INT_TOTAL <<< "$(parse_vitest_report "$INTEGRATION_REPORT")"
        echo "Integration tests: $INT_PASSED passed, $INT_FAILED failed (total: $INT_TOTAL)"
        # Log failed test names for CI debugging
        if [ "$INT_FAILED" -gt 0 ] && [ -f "$INTEGRATION_REPORT" ]; then
            echo "Failed integration tests:"
            jq -r '.testResults[] | select(.status == "failed") | .assertionResults[] | select(.status == "failed") | "  ✗ \(.ancestorTitles | join(" > ")) > \(.title)\n    \(.failureMessages[0] | split("\n")[0] // "no message")"' "$INTEGRATION_REPORT" 2>/dev/null || true
        fi
    fi
    echo ""
fi

# ── Step 4: E2E Tests ──────────────────────────────────────────────
if [ -z "$E2E_ERROR" ]; then
    echo "[3/3] Running E2E tests..."
    # Unset CI so Playwright reuses the server we already started
    # (playwright.config.ts: reuseExistingServer: !process.env.CI)
    CI= bun playwright test --reporter=json > "$E2E_REPORT" 2>/tmp/test-e2e-stderr.txt
    E2E_EXIT=$?
    E2E_RAN=true

    if [ $E2E_EXIT -ne 0 ] && [ ! -s "$E2E_REPORT" ]; then
        E2E_ERROR=$(cat /tmp/test-e2e-stderr.txt 2>/dev/null | tail -c 2000)
        echo "E2E tests failed to produce report (exit: $E2E_EXIT)"
    else
        read E2E_PASSED E2E_FAILED E2E_TOTAL <<< "$(parse_playwright_report "$E2E_REPORT")"
        echo "E2E tests: $E2E_PASSED passed, $E2E_FAILED failed (total: $E2E_TOTAL)"
        # Log failed test names for CI debugging
        if [ "$E2E_FAILED" -gt 0 ] && [ -f "$E2E_REPORT" ]; then
            echo "Failed E2E tests:"
            jq -r '[.. | .specs? // empty | .[]? | select(.tests[]?.status == "unexpected") | "  ✗ \(.file): \(.title)"] | .[]' "$E2E_REPORT" 2>/dev/null || true
        fi
    fi
    echo ""
fi

# ── Step 5: Write Summary ──────────────────────────────────────────
TOTAL_PASSED=$((UNIT_PASSED + INT_PASSED + E2E_PASSED))
TOTAL_FAILED=$((UNIT_FAILED + INT_FAILED + E2E_FAILED))
TOTAL_TESTS=$((TOTAL_PASSED + TOTAL_FAILED))
HAS_ERRORS=false
if [ $TOTAL_FAILED -gt 0 ] || [ -n "$UNIT_ERROR" ] || [ -n "$INT_ERROR" ] || [ -n "$E2E_ERROR" ]; then
    HAS_ERRORS=true
fi

jq -n \
    --argjson totalPassed "$TOTAL_PASSED" \
    --argjson totalFailed "$TOTAL_FAILED" \
    --argjson totalTests "$TOTAL_TESTS" \
    --argjson hasErrors "$HAS_ERRORS" \
    --argjson unitPassed "$UNIT_PASSED" \
    --argjson unitFailed "$UNIT_FAILED" \
    --argjson unitTotal "$UNIT_TOTAL" \
    --argjson unitRan "$UNIT_RAN" \
    --arg unitError "$UNIT_ERROR" \
    --argjson intPassed "$INT_PASSED" \
    --argjson intFailed "$INT_FAILED" \
    --argjson intTotal "$INT_TOTAL" \
    --argjson intRan "$INT_RAN" \
    --arg intError "$INT_ERROR" \
    --argjson e2ePassed "$E2E_PASSED" \
    --argjson e2eFailed "$E2E_FAILED" \
    --argjson e2eTotal "$E2E_TOTAL" \
    --argjson e2eRan "$E2E_RAN" \
    --arg e2eError "$E2E_ERROR" \
    '{
        totalPassed: $totalPassed,
        totalFailed: $totalFailed,
        totalTests: $totalTests,
        hasErrors: $hasErrors,
        unit: { passed: $unitPassed, failed: $unitFailed, total: $unitTotal, ran: $unitRan, error: (if $unitError == "" then null else $unitError end) },
        integration: { passed: $intPassed, failed: $intFailed, total: $intTotal, ran: $intRan, error: (if $intError == "" then null else $intError end) },
        e2e: { passed: $e2ePassed, failed: $e2eFailed, total: $e2eTotal, ran: $e2eRan, error: (if $e2eError == "" then null else $e2eError end) }
    }' > "$SUMMARY_REPORT"

echo "========================================"
echo "  Summary: $TOTAL_PASSED passed, $TOTAL_FAILED failed"
echo "  Reports: $REPORT_DIR/test-report-*.json"
echo "========================================"

# Always exit 0 — consumer reads summary.json for results
exit 0
