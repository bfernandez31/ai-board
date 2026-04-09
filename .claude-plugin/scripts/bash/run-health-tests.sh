#!/bin/bash
# Generic Health Test Scan Orchestrator
#
# Config-aware orchestrator that reads test commands from config.yml and runs
# the appropriate test runner. Replaces the hardcoded ai-board-specific
# orchestrator at scripts/run-health-tests.sh.
#
# ── SKIPPED Detection ──
# If neither `commands.test` nor `commands.test_unit` are present in config.yml,
# the project has no test commands configured. In this case, we write a SKIPPED
# result JSON (score: 0, skipped: true, skipReason explaining the absence) and
# exit 0 immediately. The workflow reads the skipped flag and reports accordingly.
#
# ── Scoring Modes ──
# Two scoring modes based on how tests are configured:
#
#   GRANULAR mode (commands.test_unit / test_integration / test_e2e):
#     Weighted penalties: unit=-1, integration=-3, e2e=-5 per failure.
#     This matches the original ai-board scoring — user-facing tests cost more.
#
#   SINGLE-COMMAND mode (only commands.test):
#     Flat -2 per failure (middle weight, since we cannot distinguish test type).
#     Results populate the "unit" bucket in the summary JSON.
#
#   Both modes floor the score at 0.
#
# ── Fix Loop ──
# If tests fail on the first run, we enter a fix loop (max 3 iterations):
#   1. Call the LLM fix agent (Sonnet for cost efficiency) via run-agent.sh
#   2. Read fix results from /tmp/health-tests-fix-result.json
#   3. Merge autoFixed arrays across all iterations
#   4. Re-run tests
#   5. Degradation guard: if failures INCREASED, revert all changes
#      (git checkout . && git clean -fd) and stop the loop
#   6. Only keep nonFixable from the LAST iteration (earlier ones may be fixed)
# After the loop, if fixes exist and files changed, commit and push.
#
# Flow:
#   1. Read config → detect mode (SKIPPED / granular / single-command)
#   2. Write /tmp/test-framework.txt for the fix agent
#   3. Run tests via generic runner → JSON reports
#   4. Score from first run (fixed, never changes)
#   5. If no errors → write result, exit
#   6. If errors → fix loop → re-run tests → loop (max 3)
#   7. Commit & push if fixes applied
#   8. Write final result with score + fixes + non-fixable
#
# Usage: run-health-tests.sh <AGENT_TYPE> <CONFIG_YML_PATH> <TARGET_DIR>
#   AGENT_TYPE:      CLAUDE or CODEX (default: CLAUDE)
#   CONFIG_YML_PATH: Path to the project's .ai-board/config.yml
#   TARGET_DIR:      Path to the target project directory (working directory for tests and git)
#
# Outputs: $HEALTH_RESULT_FILE (same schema as other health scans)

set -uo pipefail

AGENT_TYPE="${1:-CLAUDE}"
CONFIG_YML="${2:-}"
TARGET_DIR="${3:-}"
MAX_ITERATIONS="${MAX_ITERATIONS:-3}"
HEALTH_RESULT_DIR="${HEALTH_RESULT_DIR:-/tmp}"
HEALTH_RESULT_FILE="$HEALTH_RESULT_DIR/health-scan-result.json"

# ── Resolve script locations ───────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Resolve run-agent.sh path (works in CI where ai-board is a sibling checkout)
# In CI: SCRIPT_DIR is <workspace>/ai-board/.claude-plugin/scripts/bash
# So ai-board root would be SCRIPT_DIR/../../.. and .github/scripts is there
AIBOARD_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
if [ -f "$AIBOARD_ROOT/.github/scripts/run-agent.sh" ]; then
  RUN_AGENT="$AIBOARD_ROOT/.github/scripts/run-agent.sh"
elif [ -f "../ai-board/.github/scripts/run-agent.sh" ]; then
  RUN_AGENT="../ai-board/.github/scripts/run-agent.sh"
else
  echo "run-agent.sh not found"
  exit 1
fi

# Generic test runner (sibling script)
TEST_RUNNER="$SCRIPT_DIR/run-tests-with-reports.sh"

# ── Config reading ─────────────────────────────────────────────────

# read_config: Read a key from config.yml using yq.
# Returns the value if present, or the default if missing/null/error.
#   $1: yq key path (e.g., ".commands.test")
#   $2: default value (optional, defaults to "")
read_config() {
  local key="$1"
  local default="${2:-}"
  local val

  # If CONFIG_YML is empty or the file does not exist, return default
  if [[ -z "$CONFIG_YML" || ! -f "$CONFIG_YML" ]]; then
    echo "$default"
    return
  fi

  val=$(yq -r "$key // \"\"" "$CONFIG_YML" 2>/dev/null || echo "")
  if [[ -z "$val" || "$val" == "null" ]]; then
    echo "$default"
  else
    echo "$val"
  fi
}

# ── SKIPPED detection (T028) ──────────────────────────────────────
# If no test commands at all in config.yml, this project has no test
# commands configured. Write SKIPPED result and exit cleanly.

CMD_TEST=$(read_config ".commands.test")
CMD_TEST_UNIT=$(read_config ".commands.test_unit")
CMD_TEST_INTEGRATION=$(read_config ".commands.test_integration")
CMD_TEST_E2E=$(read_config ".commands.test_e2e")

if [[ -z "$CMD_TEST" && -z "$CMD_TEST_UNIT" && -z "$CMD_TEST_INTEGRATION" && -z "$CMD_TEST_E2E" ]]; then
  echo "========================================"
  echo "  Health Test Scan — SKIPPED"
  echo "========================================"
  echo ""
  echo "No test command configured in config.yml"
  echo "  commands.test: (not set)"
  echo "  commands.test_unit: (not set)"
  echo "  commands.test_integration: (not set)"
  echo "  commands.test_e2e: (not set)"
  echo ""
  echo "Writing SKIPPED result to $HEALTH_RESULT_FILE"

  jq -n '{
    score: 0,
    issuesFound: 0,
    issuesFixed: 0,
    skipped: true,
    skipReason: "No test command configured in .ai-board/config.yml",
    report: {
      type: "TESTS",
      autoFixed: [],
      nonFixable: [],
      generatedTickets: []
    },
    tokensUsed: 0,
    costUsd: 0
  }' > $HEALTH_RESULT_FILE

  echo "Result written to $HEALTH_RESULT_FILE (SKIPPED)"
  exit 0
fi

# ── Determine mode ─────────────────────────────────────────────────

CMD_TEST_INTEGRATION=$(read_config ".commands.test_integration")
CMD_TEST_E2E=$(read_config ".commands.test_e2e")

GRANULAR=false
if [[ -n "$CMD_TEST_UNIT" || -n "$CMD_TEST_INTEGRATION" || -n "$CMD_TEST_E2E" ]]; then
  GRANULAR=true
fi

if $GRANULAR; then
  echo "Mode: GRANULAR (separate unit/integration/e2e commands)"
else
  echo "Mode: SINGLE-COMMAND (one test command, flat scoring)"
fi

# ── Write /tmp/test-framework.txt (T022) ──────────────────────────
# The fix agent reads this file to know which report format to parse.

FRAMEWORK=$(read_config ".testing.framework" "unknown")
echo "$FRAMEWORK" > "$HEALTH_RESULT_DIR/test-framework.txt"
echo "Test framework: $FRAMEWORK (written to $HEALTH_RESULT_DIR/test-framework.txt)"

# ── Helpers ─────────────────────────────────────────────────────────

SUMMARY_REPORT="${TEST_REPORT_DIR:-/tmp}/test-report-summary.json"

read_summary() {
  cat "$SUMMARY_REPORT"
}

has_errors() {
  jq -r '.hasErrors' "$SUMMARY_REPORT"
}

# compute_score: Calculate health score from test summary.
#   Granular mode: weighted penalties (unit=-1, integration=-3, e2e=-5)
#   Single-command mode: flat -2 per failure (middle weight)
#   Both modes floor at 0.
compute_score() {
  local summary="$1"
  if $GRANULAR; then
    echo "$summary" | jq '
      [0, 100
        - (.unit.failed        * 1)
        - (.integration.failed * 3)
        - (.e2e.failed         * 5)
      ] | max
    '
  else
    # Single command: results are in the unit bucket, flat -2 penalty
    echo "$summary" | jq '
      [0, 100
        - (.unit.failed * 2)
      ] | max
    '
  fi
}

# write_result: Write $HEALTH_RESULT_FILE with the standard schema.
write_result() {
  local score="$1"
  local auto_fixed="$2"
  local non_fixable="$3"

  local issues_fixed
  local issues_found
  local non_fixable_count
  issues_fixed=$(echo "$auto_fixed" | jq 'length')
  non_fixable_count=$(echo "$non_fixable" | jq 'length')
  issues_found=$((issues_fixed + non_fixable_count))

  jq -n \
    --argjson score "$score" \
    --argjson issuesFound "$issues_found" \
    --argjson issuesFixed "$issues_fixed" \
    --argjson autoFixed "$auto_fixed" \
    --argjson nonFixable "$non_fixable" \
    '{
      score: $score,
      issuesFound: $issuesFound,
      issuesFixed: $issuesFixed,
      report: {
        type: "TESTS",
        autoFixed: $autoFixed,
        nonFixable: $nonFixable,
        generatedTickets: []
      },
      tokensUsed: 0,
      costUsd: 0
    }' > $HEALTH_RESULT_FILE

  echo "Result written to $HEALTH_RESULT_FILE (score: $score, found: $issues_found, fixed: $issues_fixed)"
}

# merge_arrays: Merge two JSON arrays into one.
merge_arrays() {
  local arr1="$1"
  local arr2="$2"
  echo "$arr1" "$arr2" | jq -s '.[0] + .[1]'
}

# ── Phase 1: Run Tests ──────────────────────────────────────────────

echo ""
echo "========================================"
echo "  Health Test Scan — Phase 1: Run Tests"
echo "========================================"

# T030: Handle execution failures gracefully — if the test runner fails to
# execute (e.g., script not found, dependencies missing), capture the error
# and report it in the result JSON without crashing the workflow.
if [[ ! -x "$TEST_RUNNER" ]]; then
  echo "Test runner not found or not executable: $TEST_RUNNER"
  echo "Writing error result to $HEALTH_RESULT_FILE"

  jq -n \
    --arg reason "Test runner script not found: $TEST_RUNNER" \
    '{
      score: 0,
      issuesFound: 1,
      issuesFixed: 0,
      report: {
        type: "TESTS",
        autoFixed: [],
        nonFixable: [{ test: "runner", error: $reason }],
        generatedTickets: []
      },
      tokensUsed: 0,
      costUsd: 0
    }' > $HEALTH_RESULT_FILE

  exit 0
fi

# Run the generic test runner, passing config and target directory
"$TEST_RUNNER" "$CONFIG_YML" "$TARGET_DIR"
RUNNER_EXIT=$?

# T030: If the runner itself crashed (non-zero exit that is NOT a test failure),
# check that the summary report was produced. If not, write an error result.
if [[ $RUNNER_EXIT -ne 0 ]] && [[ ! -f "$SUMMARY_REPORT" ]]; then
  echo "Test runner failed to produce summary report (exit: $RUNNER_EXIT)"
  echo "Writing error result to $HEALTH_RESULT_FILE"

  jq -n \
    --argjson exitCode "$RUNNER_EXIT" \
    '{
      score: 0,
      issuesFound: 1,
      issuesFixed: 0,
      report: {
        type: "TESTS",
        autoFixed: [],
        nonFixable: [{ test: "runner", error: ("Test runner exited with code " + ($exitCode | tostring) + " and produced no summary") }],
        generatedTickets: []
      },
      tokensUsed: 0,
      costUsd: 0
    }' > $HEALTH_RESULT_FILE

  exit 0
fi

# ── Phase 2: Score (from first run, never changes) ──────────────────

SUMMARY=$(read_summary)
TOTAL_TESTS=$(echo "$SUMMARY" | jq -r '.totalTests')
TOTAL_FAILED=$(echo "$SUMMARY" | jq -r '.totalFailed')
TOTAL_PASSED=$((TOTAL_TESTS - TOTAL_FAILED))
SCORE=$(compute_score "$SUMMARY")

echo ""
echo "First-run score: $SCORE ($TOTAL_PASSED passed, $TOTAL_FAILED failed out of $TOTAL_TESTS)"

# ── Phase 3: Check if done ──────────────────────────────────────────

if [ "$(has_errors)" = "false" ]; then
  echo ""
  echo "All tests pass — no LLM needed"
  write_result "$SCORE" "[]" "[]"
  exit 0
fi

# ── Phase 4: Fix Loop ──────────────────────────────────────────────
# Max 3 iterations. Each iteration:
#   1. Call LLM fix agent (Sonnet for cost)
#   2. Merge autoFixed arrays across iterations
#   3. Re-run tests
#   4. Degradation guard: if more failures, revert and stop
#   5. Keep only last iteration's nonFixable

echo ""
echo "========================================"
echo "  Health Test Scan — Phase 4: Fix Loop"
echo "========================================"

ALL_AUTO_FIXED="[]"
ALL_NON_FIXABLE="[]"
ITERATION=0
PREV_FAILED=$TOTAL_FAILED

while [ "$(has_errors)" = "true" ] && [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "-- Fix iteration $ITERATION/$MAX_ITERATIONS --"

  # Call LLM fix agent (Sonnet for cost efficiency)
  FIX_RESULT_FILE="/tmp/health-tests-fix-result.json"
  echo '{"autoFixed":[],"nonFixable":[]}' > "$FIX_RESULT_FILE"

  ANTHROPIC_MODEL="${FIX_MODEL:-claude-sonnet-4-6}" \
    "$RUN_AGENT" "$AGENT_TYPE" "ai-board.health-tests-fix" 2>&1 | tee /tmp/fix-agent-log.txt || true

  # Read fix agent results
  if [ -f "$FIX_RESULT_FILE" ] && jq empty "$FIX_RESULT_FILE" 2>/dev/null; then
    ITER_FIXED=$(jq -c '.autoFixed // []' "$FIX_RESULT_FILE")
    ITER_NON_FIXABLE=$(jq -c '.nonFixable // []' "$FIX_RESULT_FILE")
    ALL_AUTO_FIXED=$(merge_arrays "$ALL_AUTO_FIXED" "$ITER_FIXED")
    # Only keep nonFixable from last iteration (previous ones may have been fixed)
    ALL_NON_FIXABLE="$ITER_NON_FIXABLE"
    echo "  Fixed: $(echo "$ITER_FIXED" | jq 'length'), Non-fixable: $(echo "$ITER_NON_FIXABLE" | jq 'length')"
  else
    echo "  Fix agent did not produce valid results"
  fi

  # Re-run tests
  echo ""
  echo "  Re-running tests..."
  "$TEST_RUNNER" "$CONFIG_YML" "$TARGET_DIR"

  NEW_SUMMARY=$(read_summary)
  NEW_FAILED=$(echo "$NEW_SUMMARY" | jq -r '.totalFailed')
  echo "  After fix: $NEW_FAILED failures remaining (was $PREV_FAILED)"

  # Degradation guard: if more failures than before, revert and stop
  if [ "$NEW_FAILED" -gt "$PREV_FAILED" ]; then
    echo ""
    echo "  Degradation detected: $PREV_FAILED -> $NEW_FAILED failures"
    echo "  Reverting all changes from this iteration..."
    git -C "$TARGET_DIR" checkout .
    # Remove any untracked files the agent may have created
    git -C "$TARGET_DIR" clean -fd --quiet
    # Discard fixes claimed by this iteration since we reverted
    ALL_AUTO_FIXED="[]"
    echo "  Reverted. Stopping fix loop."
    break
  fi

  PREV_FAILED=$NEW_FAILED
done

if [ "$(has_errors)" = "false" ]; then
  echo ""
  echo "All tests pass after $ITERATION fix iteration(s)"
  ALL_NON_FIXABLE="[]"
fi

# ── Phase 4b: Commit & push fixes ─────────────────────────────────

FIXED_COUNT=$(echo "$ALL_AUTO_FIXED" | jq 'length')
if [ "$FIXED_COUNT" -gt 0 ] && [ -n "$(git -C "$TARGET_DIR" diff --name-only)" ]; then
  echo ""
  echo "Committing $FIXED_COUNT auto-fixed test(s)..."
  git -C "$TARGET_DIR" config user.name "ai-board[bot]"
  git -C "$TARGET_DIR" config user.email "ai-board[bot]@users.noreply.github.com"
  git -C "$TARGET_DIR" add -A
  git -C "$TARGET_DIR" commit -m "fix(tests): auto-fix $FIXED_COUNT test failure(s) [health-scan]

Automated fixes applied by health scan test fixer.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  git -C "$TARGET_DIR" push
  echo "Fixes committed and pushed"
fi

# ── Phase 5: Write Result ──────────────────────────────────────────

echo ""
echo "========================================"
echo "  Health Test Scan — Phase 5: Result"
echo "========================================"

write_result "$SCORE" "$ALL_AUTO_FIXED" "$ALL_NON_FIXABLE"
