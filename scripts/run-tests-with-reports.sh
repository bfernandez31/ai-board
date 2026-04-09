#!/bin/bash
# Run configured test suites against an explicit target repository and emit a
# stable summary JSON for the TESTS health scan orchestrator.

set +e

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/run-tests-with-reports.sh <target-repo-dir>" >&2
  exit 1
fi

TARGET_DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_COMMAND_SCRIPT="${AI_BOARD_RUN_COMMAND_SCRIPT:-$REPO_DIR/.github/scripts/run-command.sh}"

REPORT_DIR="/tmp"
UNIT_REPORT="$REPORT_DIR/test-report-unit.json"
INTEGRATION_REPORT="$REPORT_DIR/test-report-integration.json"
E2E_REPORT="$REPORT_DIR/test-report-e2e.json"
SUMMARY_REPORT="$REPORT_DIR/test-report-summary.json"
UNIT_STDERR="/tmp/test-unit-stderr.txt"
INTEGRATION_STDERR="/tmp/test-int-stderr.txt"
E2E_STDERR="/tmp/test-e2e-stderr.txt"

write_suite_report() {
  local report_file="$1"
  local suite="$2"
  local ran="$3"
  local passed="$4"
  local failed="$5"
  local error_message="$6"

  jq -n \
    --arg suite "$suite" \
    --argjson ran "$ran" \
    --argjson passed "$passed" \
    --argjson failed "$failed" \
    --argjson total "$((passed + failed))" \
    --arg error "$error_message" \
    '{
      suite: $suite,
      ran: $ran,
      passed: $passed,
      failed: $failed,
      total: $total,
      error: (if $error == "" then null else $error end)
    }' > "$report_file"
}

run_suite() {
  local suite="$1"
  local command_key="$2"
  local report_file="$3"
  local stderr_file="$4"

  "$RUN_COMMAND_SCRIPT" "$TARGET_DIR" "$command_key" > /dev/null 2> "$stderr_file"
  local exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    if grep -q "skipping" "$stderr_file" 2>/dev/null; then
      write_suite_report "$report_file" "$suite" false 0 0 ""
      echo "0 0 0"
      return
    fi

    write_suite_report "$report_file" "$suite" true 1 0 ""
    echo "1 0 1"
    return
  fi

  local error_message
  error_message=$(tail -c 2000 "$stderr_file" 2>/dev/null)
  write_suite_report "$report_file" "$suite" true 0 1 "$error_message"
  echo "0 1 1"
}

run_and_log_suite() {
  local step="$1"
  local label="$2"
  local suite="$3"
  local command_key="$4"
  local report_file="$5"
  local stderr_file="$6"

  echo "[$step] Running $label tests..."
  read SUITE_PASSED SUITE_FAILED SUITE_TOTAL <<< "$(run_suite "$suite" "$command_key" "$report_file" "$stderr_file")"
  echo "$label tests: $SUITE_PASSED passed, $SUITE_FAILED failed (total: $SUITE_TOTAL)"
  echo ""
}

echo '{}' > "$UNIT_REPORT"
echo '{}' > "$INTEGRATION_REPORT"
echo '{}' > "$E2E_REPORT"

echo "========================================"
echo "  Running Tests with JSON Reports"
echo "========================================"
echo "Target: $TARGET_DIR"
echo ""

run_and_log_suite "1/3" "Unit" "unit" "test_unit" "$UNIT_REPORT" "$UNIT_STDERR"
UNIT_PASSED="$SUITE_PASSED"
UNIT_FAILED="$SUITE_FAILED"
UNIT_TOTAL="$SUITE_TOTAL"

run_and_log_suite "2/3" "Integration" "integration" "test_integration" "$INTEGRATION_REPORT" "$INTEGRATION_STDERR"
INT_PASSED="$SUITE_PASSED"
INT_FAILED="$SUITE_FAILED"
INT_TOTAL="$SUITE_TOTAL"

run_and_log_suite "3/3" "E2E" "e2e" "test_e2e" "$E2E_REPORT" "$E2E_STDERR"
E2E_PASSED="$SUITE_PASSED"
E2E_FAILED="$SUITE_FAILED"
E2E_TOTAL="$SUITE_TOTAL"

TOTAL_PASSED=$((UNIT_PASSED + INT_PASSED + E2E_PASSED))
TOTAL_FAILED=$((UNIT_FAILED + INT_FAILED + E2E_FAILED))
TOTAL_TESTS=$((TOTAL_PASSED + TOTAL_FAILED))
HAS_ERRORS=false
if [[ $TOTAL_FAILED -gt 0 ]]; then
  HAS_ERRORS=true
fi

jq -n \
  --argjson totalPassed "$TOTAL_PASSED" \
  --argjson totalFailed "$TOTAL_FAILED" \
  --argjson totalTests "$TOTAL_TESTS" \
  --argjson hasErrors "$HAS_ERRORS" \
  --slurpfile unit "$UNIT_REPORT" \
  --slurpfile integration "$INTEGRATION_REPORT" \
  --slurpfile e2e "$E2E_REPORT" \
  '{
    totalPassed: $totalPassed,
    totalFailed: $totalFailed,
    totalTests: $totalTests,
    hasErrors: $hasErrors,
    unit: ($unit[0] // {}),
    integration: ($integration[0] // {}),
    e2e: ($e2e[0] // {})
  }' > "$SUMMARY_REPORT"

echo "========================================"
echo "  Summary: $TOTAL_PASSED passed, $TOTAL_FAILED failed"
echo "  Reports: $REPORT_DIR/test-report-*.json"
echo "========================================"

exit 0
