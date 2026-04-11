#!/bin/bash
# Generic Test Runner with JSON Reports
#
# Config-driven test runner that reads testing framework and commands from a
# project's config.yml. Replaces the hardcoded vitest/Playwright runner with
# a generic runner that works on any project.
#
# Usage: run-tests-with-reports.sh <config_yml_path> <target_dir>
# Outputs: /tmp/test-report-summary.json (same schema as existing runner)
#
# Always exits 0 — consumer reads summary.json for results.
#
# ── Supported Frameworks (T034) ─────────────────────────────────────
#
# Framework      | Reporter Flag Injection           | Parser Strategy
# -------------- | --------------------------------- | -------------------------
# vitest         | --reporter=json --outputFile=FILE | jq .testResults[].assertionResults[]
# jest           | --json --outputFile=FILE          | jq .testResults[].assertionResults[] (same as vitest)
# pytest         | --tb=short -q (capture stdout)    | grep passed/failed counts from text
# cargo-test     | (capture stdout)                  | grep test result: line
# go-test        | -json > FILE                      | count Action:pass/fail with Test field
# rspec          | --format json --out FILE          | jq .examples[] status
# phpunit        | --log-junit FILE                  | xmllint JUnit XML (tests - failures)
# playwright     | --reporter=json > FILE            | jq recursive .specs[].tests[] status
# (unknown)      | (none)                            | exit-code fallback (0=pass, else fail)
#
# ── Parser Selection Logic ──────────────────────────────────────────
#
# For unit/integration tests: uses the framework from testing.framework
# For e2e tests: uses testing.e2e_framework (falls back to testing.framework)
# If parsed counts are all zero and the report file is missing or empty,
# the exit-code fallback parser is used as a safety net.
#
# ── Mode Selection ──────────────────────────────────────────────────
#
# Granular mode: if ANY of test_unit, test_integration, test_e2e commands exist
# Single mode:   falls back to commands.test; results go into the "unit" bucket

set +e

CONFIG_YML="${1:?ERROR: config.yml path required as first argument}"
TARGET_DIR="${2:?ERROR: target directory required as second argument}"

# ── JSON-escape a string (backslash, quotes, tabs, newlines) ─────────
json_escape() {
  printf '%s' "$1" | sed ':a;N;$!ba;s/\\/\\\\/g;s/"/\\"/g;s/\t/\\t/g;s/\r/\\r/g;s/\n/\\n/g'
}

# ── Default summary writer (used on early exit) ─────────────────────
write_default_summary() {
  local msg="${1:-}"
  local has_errors="false"
  local error_json="null"

  if [ -n "$msg" ]; then
    has_errors="true"
    error_json="\"$(json_escape "$msg")\""
  fi

  cat > "$SUMMARY_REPORT" <<ENDJSON
{
  "totalPassed": 0,
  "totalFailed": 0,
  "totalTests": 0,
  "hasErrors": $has_errors,
  "unit": { "passed": 0, "failed": 0, "total": 0, "ran": false, "error": $error_json },
  "integration": { "passed": 0, "failed": 0, "total": 0, "ran": false, "error": null },
  "e2e": { "passed": 0, "failed": 0, "total": 0, "ran": false, "error": null }
}
ENDJSON
}

REPORT_DIR="${TEST_REPORT_DIR:-/tmp}"
SUMMARY_REPORT="$REPORT_DIR/test-report-summary.json"

# ── Validate inputs ─────────────────────────────────────────────────
if [[ ! -f "$CONFIG_YML" ]]; then
  echo "WARNING: Config file not found: $CONFIG_YML"
  write_default_summary "Config file not found: $CONFIG_YML"
  exit 0
fi

if ! command -v yq &>/dev/null; then
  echo "WARNING: yq not installed — cannot parse config.yml"
  write_default_summary "yq not installed"
  exit 0
fi

if ! command -v jq &>/dev/null; then
  echo "WARNING: jq not installed — cannot generate test summaries"
  write_default_summary "jq not installed"
  exit 0
fi

# Resolve absolute paths
CONFIG_YML="$(cd "$(dirname "$CONFIG_YML")" && pwd)/$(basename "$CONFIG_YML")"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

UNIT_REPORT="$REPORT_DIR/test-report-unit.json"
INTEGRATION_REPORT="$REPORT_DIR/test-report-integration.json"
E2E_REPORT="$REPORT_DIR/test-report-e2e.json"

# Initialize report files
echo '{}' > "$UNIT_REPORT"
echo '{}' > "$INTEGRATION_REPORT"
echo '{}' > "$E2E_REPORT"

# Track results
UNIT_PASSED=0; UNIT_FAILED=0; UNIT_TOTAL=0; UNIT_RAN=false; UNIT_ERROR=""
INT_PASSED=0; INT_FAILED=0; INT_TOTAL=0; INT_RAN=false; INT_ERROR=""
E2E_PASSED=0; E2E_FAILED=0; E2E_TOTAL=0; E2E_RAN=false; E2E_ERROR=""

SERVER_PID=""
PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"
MAX_WAIT=60

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Stopping dev server (PID: $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Read config helper ──────────────────────────────────────────────
read_config() {
  local key="$1"
  local default="${2:-}"
  local val
  val=$(yq -r "$key // \"\"" "$CONFIG_YML" 2>/dev/null || echo "")
  if [[ -z "$val" || "$val" == "null" ]]; then
    echo "$default"
  else
    echo "$val"
  fi
}

FRAMEWORK=$(read_config '.testing.framework')
E2E_ENABLED=$(read_config '.testing.e2e' 'false')
E2E_FRAMEWORK=$(read_config '.testing.e2e_framework')

CMD_TEST=$(read_config '.commands.test')
CMD_TEST_UNIT=$(read_config '.commands.test_unit')
CMD_TEST_INT=$(read_config '.commands.test_integration')
CMD_TEST_E2E=$(read_config '.commands.test_e2e')
CMD_DEV_SERVER=$(read_config '.commands.dev_server')

# Determine mode: granular vs single
GRANULAR=false
if [[ -n "$CMD_TEST_UNIT" || -n "$CMD_TEST_INT" || -n "$CMD_TEST_E2E" ]]; then
  GRANULAR=true
fi

# ── Parsers ─────────────────────────────────────────────────────────
# Each parser returns: "<passed> <failed> <total>" (space-separated).
# Returns "0 0 0" on parse failure.

# vitest/jest: jq .testResults[].assertionResults[] with status passed/failed
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

# playwright: recursive descent into .specs[].tests[] with expected/unexpected
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

# pytest: grep "N passed" and "N failed" from text output
parse_pytest_report() {
  local output="$1"
  local passed=0 failed=0 total
  passed=$(echo "$output" | grep -oP '\d+(?= passed)' | tail -1 || echo 0)
  failed=$(echo "$output" | grep -oP '\d+(?= failed)' | tail -1 || echo 0)
  [ -z "$passed" ] && passed=0
  [ -z "$failed" ] && failed=0
  total=$((passed + failed))
  echo "$passed $failed $total"
}

# cargo-test: grep "test result:" line for passed/failed counts
parse_cargo_report() {
  local output="$1"
  local passed=0 failed=0 total
  local result_line
  result_line=$(echo "$output" | grep 'test result:' | tail -1)
  if [ -n "$result_line" ]; then
    passed=$(echo "$result_line" | grep -oP '\d+(?= passed)' || echo 0)
    failed=$(echo "$result_line" | grep -oP '\d+(?= failed)' || echo 0)
    [ -z "$passed" ] && passed=0
    [ -z "$failed" ] && failed=0
  fi
  total=$((passed + failed))
  echo "$passed $failed $total"
}

# go-test: count Action:pass/fail lines that have a "Test" field (not package-level)
parse_go_report() {
  local report_file="$1"
  if [ -f "$report_file" ]; then
    local passed failed total passed2 failed2
    # grep -c outputs "0" and exits 1 on no match — use || true to avoid double output
    passed=$(grep -c '"Action":"pass".*"Test":' "$report_file" 2>/dev/null) || true
    failed=$(grep -c '"Action":"fail".*"Test":' "$report_file" 2>/dev/null) || true
    passed2=$(grep -c '"Test":.*"Action":"pass"' "$report_file" 2>/dev/null) || true
    failed2=$(grep -c '"Test":.*"Action":"fail"' "$report_file" 2>/dev/null) || true
    passed=${passed:-0}; failed=${failed:-0}; passed2=${passed2:-0}; failed2=${failed2:-0}
    # Use max of both orderings to handle any JSON key order
    [ "$passed2" -gt "$passed" ] 2>/dev/null && passed=$passed2
    [ "$failed2" -gt "$failed" ] 2>/dev/null && failed=$failed2
    total=$((passed + failed))
    echo "$passed $failed $total"
  else
    echo "0 0 0"
  fi
}

# rspec: jq .examples[] with status passed/failed
parse_rspec_report() {
  local report_file="$1"
  if [ -f "$report_file" ] && jq empty "$report_file" 2>/dev/null; then
    local passed failed total
    passed=$(jq '[.examples[]? | select(.status == "passed")] | length' "$report_file" 2>/dev/null || echo 0)
    failed=$(jq '[.examples[]? | select(.status == "failed")] | length' "$report_file" 2>/dev/null || echo 0)
    total=$((passed + failed))
    echo "$passed $failed $total"
  else
    echo "0 0 0"
  fi
}

# phpunit: parse JUnit XML with xmllint (tests attribute - failures attribute = passed)
parse_phpunit_report() {
  local report_file="$1"
  if [ -f "$report_file" ] && command -v xmllint &>/dev/null; then
    local tests failures passed total
    tests=$(xmllint --xpath 'string(//testsuite/@tests)' "$report_file" 2>/dev/null || echo 0)
    failures=$(xmllint --xpath 'string(//testsuite/@failures)' "$report_file" 2>/dev/null || echo 0)
    [ -z "$tests" ] && tests=0
    [ -z "$failures" ] && failures=0
    passed=$((tests - failures))
    [ "$passed" -lt 0 ] && passed=0
    total=$tests
    echo "$passed $failures $total"
  else
    echo "0 0 0"
  fi
}

# exit-code fallback: 0 exit = 1 passed, non-zero = 1 failed
parse_exitcode_report() {
  local exit_code="$1"
  if [ "$exit_code" -eq 0 ]; then
    echo "1 0 1"
  else
    echo "0 1 1"
  fi
}

# ── Determine effective parser framework for a test type ────────────
# For e2e tests, prefer e2e_framework; otherwise use the main framework.
get_parser_framework() {
  local test_type="$1"
  if [[ "$test_type" == "e2e" && -n "$E2E_FRAMEWORK" ]]; then
    echo "$E2E_FRAMEWORK"
  else
    echo "$FRAMEWORK"
  fi
}

# ── Run a test command ──────────────────────────────────────────────
# $1 = command, $2 = report file, $3 = type (unit|integration|e2e)
# Prints: "<passed> <failed> <total>" to stdout
# Errors go to stderr / report file as appropriate
run_test_cmd() {
  local cmd="$1"
  local report_file="$2"
  local test_type="$3"
  local fw
  fw=$(get_parser_framework "$test_type")

  # Inject reporter flags based on framework
  # npm requires a -- delimiter to pass flags through to the underlying script
  local sep=""
  if [[ "$cmd" == "npm "* ]] && [[ "$cmd" != *" -- "* ]]; then
    sep=" --"
  fi

  local full_cmd="$cmd"
  case "$fw" in
    vitest)
      full_cmd="$cmd${sep} --reporter=json --outputFile=$report_file"
      ;;
    jest)
      full_cmd="$cmd${sep} --json --outputFile=$report_file"
      ;;
    pytest)
      full_cmd="$cmd --tb=short -q"
      ;;
    cargo-test)
      # No special flags; capture stdout
      ;;
    go-test)
      full_cmd="$cmd -json"
      ;;
    rspec)
      full_cmd="$cmd --format json --out $report_file"
      ;;
    phpunit)
      full_cmd="$cmd --log-junit $report_file"
      ;;
    playwright)
      full_cmd="$cmd${sep} --reporter=json"
      ;;
  esac

  echo "  Running: $full_cmd" >&2
  local output="" exit_code=0

  # For go-test, redirect JSON output to the report file
  if [[ "$fw" == "go-test" ]]; then
    (cd "$TARGET_DIR" && eval "$full_cmd") > "$report_file" 2>&1
    exit_code=$?
  # For playwright, capture JSON stdout to the report file.
  # Export PLAYWRIGHT_REUSE_SERVER=1 so Playwright reuses the server we already
  # started (via start_server_if_needed) instead of trying to start its own,
  # which would fail with a port conflict in CI where process.env.CI is set.
  elif [[ "$fw" == "playwright" ]]; then
    export PLAYWRIGHT_REUSE_SERVER=1
    (cd "$TARGET_DIR" && eval "$full_cmd") > "$report_file" 2>/tmp/test-${test_type}-stderr.txt
    exit_code=$?
  else
    output=$(cd "$TARGET_DIR" && eval "$full_cmd" 2>&1)
    exit_code=$?
  fi

  # Parse results based on framework
  local parsed
  case "$fw" in
    vitest|jest)     parsed=$(parse_vitest_report "$report_file") ;;
    playwright)      parsed=$(parse_playwright_report "$report_file") ;;
    pytest)          parsed=$(parse_pytest_report "$output") ;;
    cargo-test)      parsed=$(parse_cargo_report "$output") ;;
    go-test)         parsed=$(parse_go_report "$report_file") ;;
    rspec)           parsed=$(parse_rspec_report "$report_file") ;;
    phpunit)         parsed=$(parse_phpunit_report "$report_file") ;;
    *)               parsed=$(parse_exitcode_report "$exit_code") ;;
  esac

  # Safety net: if parsed returned all zeros and there was a non-zero exit,
  # fall back to exit-code parser so we at least report a failure.
  local p_passed p_failed p_total
  read p_passed p_failed p_total <<< "$parsed"
  if [[ "$p_total" -eq 0 && "$exit_code" -ne 0 ]]; then
    parsed=$(parse_exitcode_report "$exit_code")
  fi

  echo "$parsed"
}

# ── Server startup ──────────────────────────────────────────────────
start_server_if_needed() {
  # Skip if no dev_server command configured
  if [[ -z "$CMD_DEV_SERVER" ]]; then
    return 0
  fi

  # Skip if server is already running
  if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "Dev server already running at $BASE_URL"
    return 0
  fi

  echo "Starting dev server..."

  # Export env vars from config.yml env: section
  local env_keys
  env_keys=$(yq -r '.env // {} | keys | .[]' "$CONFIG_YML" 2>/dev/null || echo "")
  if [[ -n "$env_keys" ]]; then
    while IFS= read -r key; do
      local val
      val=$(yq -r ".env.\"$key\" // \"\"" "$CONFIG_YML" 2>/dev/null || echo "")
      if [[ -n "$val" && "$val" != "null" ]]; then
        export "$key=$val"
        echo "  Exported env: $key"
      fi
    done <<< "$env_keys"
  fi

  # Start the dev server in background
  (cd "$TARGET_DIR" && eval "$CMD_DEV_SERVER") > /tmp/dev-server.log 2>&1 &
  SERVER_PID=$!

  echo -n "Waiting for server at $BASE_URL"
  local waited=0
  while ! curl -s "$BASE_URL" > /dev/null 2>&1; do
    if [ $waited -ge $MAX_WAIT ]; then
      echo ""
      echo "Server failed to start within ${MAX_WAIT}s"
      INT_ERROR="Server failed to start within ${MAX_WAIT}s"
      E2E_ERROR="Server not available (failed to start)"
      return 1
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo ""
      echo "Server process died"
      INT_ERROR="Server process died during startup"
      E2E_ERROR="Server not available (process died)"
      return 1
    fi
    echo -n "."
    sleep 1
    waited=$((waited + 1))
  done
  echo " ready!"
  return 0
}

# ── Main execution ──────────────────────────────────────────────────

echo "========================================"
echo "  Running Tests with JSON Reports"
echo "  Framework: ${FRAMEWORK:-auto}"
echo "  E2E Framework: ${E2E_FRAMEWORK:-same as framework}"
echo "  Mode: $(if $GRANULAR; then echo granular; else echo single; fi)"
echo "========================================"
echo ""

if $GRANULAR; then
  # ── Unit tests (no server needed) ───────────────────────────────
  if [[ -n "$CMD_TEST_UNIT" ]]; then
    echo "[1/3] Running unit tests..."
    UNIT_RAN=true
    read UNIT_PASSED UNIT_FAILED UNIT_TOTAL <<< "$(run_test_cmd "$CMD_TEST_UNIT" "$UNIT_REPORT" "unit")"
    if [[ "$UNIT_TOTAL" -eq 0 && ! -s "$UNIT_REPORT" ]]; then
      UNIT_ERROR="Unit tests produced no results"
    fi
    echo "  Unit tests: $UNIT_PASSED passed, $UNIT_FAILED failed (total: $UNIT_TOTAL)"
    echo ""
  fi

  # ── Start server for integration/e2e ────────────────────────────
  if [[ -n "$CMD_TEST_INT" || -n "$CMD_TEST_E2E" ]]; then
    start_server_if_needed
  fi

  # ── Integration tests ──────────────────────────────────────────
  if [[ -n "$CMD_TEST_INT" ]]; then
    if [[ -z "$INT_ERROR" ]]; then
      echo "[2/3] Running integration tests..."
      INT_RAN=true
      read INT_PASSED INT_FAILED INT_TOTAL <<< "$(run_test_cmd "$CMD_TEST_INT" "$INTEGRATION_REPORT" "integration")"
      if [[ "$INT_TOTAL" -eq 0 && ! -s "$INTEGRATION_REPORT" ]]; then
        INT_ERROR="Integration tests produced no results"
      fi
      echo "  Integration tests: $INT_PASSED passed, $INT_FAILED failed (total: $INT_TOTAL)"
    else
      echo "[2/3] Skipping integration tests: $INT_ERROR"
    fi
    echo ""
  fi

  # ── E2E tests ──────────────────────────────────────────────────
  if [[ -n "$CMD_TEST_E2E" ]]; then
    if [[ -z "$E2E_ERROR" ]]; then
      echo "[3/3] Running E2E tests..."
      E2E_RAN=true
      read E2E_PASSED E2E_FAILED E2E_TOTAL <<< "$(run_test_cmd "$CMD_TEST_E2E" "$E2E_REPORT" "e2e")"
      if [[ "$E2E_TOTAL" -eq 0 && ! -s "$E2E_REPORT" ]]; then
        E2E_ERROR="E2E tests produced no results"
      fi
      echo "  E2E tests: $E2E_PASSED passed, $E2E_FAILED failed (total: $E2E_TOTAL)"
    else
      echo "[3/3] Skipping E2E tests: $E2E_ERROR"
    fi
    echo ""
  fi

else
  # ── Single-command mode — results go into unit bucket ───────────
  if [[ -n "$CMD_TEST" ]]; then
    # Start server if configured (some single-command suites need it)
    start_server_if_needed

    echo "[1/1] Running tests..."
    UNIT_RAN=true
    read UNIT_PASSED UNIT_FAILED UNIT_TOTAL <<< "$(run_test_cmd "$CMD_TEST" "$UNIT_REPORT" "unit")"
    if [[ "$UNIT_TOTAL" -eq 0 && ! -s "$UNIT_REPORT" ]]; then
      UNIT_ERROR="Tests produced no results"
    fi
    echo "  Tests: $UNIT_PASSED passed, $UNIT_FAILED failed (total: $UNIT_TOTAL)"
    echo ""
  else
    echo "WARNING: No test commands found in config.yml"
    UNIT_ERROR="No test commands configured"
  fi
fi

# ── Write Summary ──────────────────────────────────────────────────
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
