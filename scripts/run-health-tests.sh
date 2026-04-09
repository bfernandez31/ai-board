#!/bin/bash
# Platform-owned TESTS scan orchestrator. Runs from the ai-board checkout
# against an explicit target repository.

set -uo pipefail

AGENT_TYPE="${1:-CLAUDE}"
TARGET_REPO_DIR="${2:-}"
MAX_ITERATIONS=3
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_TESTS_WITH_REPORTS="${AI_BOARD_RUN_TESTS_WITH_REPORTS:-$SCRIPT_DIR/run-tests-with-reports.sh}"
RUN_COMMAND_SCRIPT="${AI_BOARD_RUN_COMMAND_SCRIPT:-$REPO_DIR/.github/scripts/run-command.sh}"

if [[ -z "$TARGET_REPO_DIR" ]]; then
  echo "Usage: ./scripts/run-health-tests.sh <AGENT_TYPE> <TARGET_REPO_DIR>" >&2
  exit 1
fi

if [[ -n "${AI_BOARD_RUN_AGENT:-}" ]]; then
  RUN_AGENT="$AI_BOARD_RUN_AGENT"
elif [[ -f "$REPO_DIR/.github/scripts/run-agent.sh" ]]; then
  RUN_AGENT="$REPO_DIR/.github/scripts/run-agent.sh"
elif [[ -f "../ai-board/.github/scripts/run-agent.sh" ]]; then
  RUN_AGENT="../ai-board/.github/scripts/run-agent.sh"
else
  echo "❌ run-agent.sh not found" >&2
  exit 1
fi

read_summary() {
  cat /tmp/test-report-summary.json
}

has_errors() {
  jq -r '.hasErrors' /tmp/test-report-summary.json
}

compute_score() {
  local summary="$1"
  echo "$summary" | jq '
    [0, 100
      - (.unit.failed * 1)
      - (.integration.failed * 3)
      - (.e2e.failed * 5)
    ] | max
  '
}

write_result() {
  local score="$1"
  local auto_fixed="$2"
  local non_fixable="$3"
  local skipped="${4:-false}"
  local skip_reason="${5:-}"

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
    --argjson skipped "$skipped" \
    --arg skipReason "$skip_reason" \
    '{
      score: $score,
      issuesFound: $issuesFound,
      issuesFixed: $issuesFixed,
      skipped: $skipped,
      skipReason: (if $skipReason == "" then null else $skipReason end),
      report: {
        type: "TESTS",
        autoFixed: $autoFixed,
        nonFixable: $nonFixable,
        generatedTickets: []
      },
      tokensUsed: 0,
      costUsd: 0
    }' > /tmp/health-scan-result.json
}

write_skipped_result() {
  local skip_reason="$1"
  write_result "null" "[]" "[]" "true" "$skip_reason"
  echo "ℹ️  TESTS scan skipped: $skip_reason"
}

merge_arrays() {
  local arr1="$1"
  local arr2="$2"
  echo "$arr1" "$arr2" | jq -s '([.[0][], .[1][]] | unique_by(.id))'
}

if ! "$RUN_COMMAND_SCRIPT" "$TARGET_REPO_DIR" test_primary >/dev/null 2>/tmp/run-health-tests-preflight.log; then
  echo "❌ Failed to resolve primary test command from config" >&2
  cat /tmp/run-health-tests-preflight.log >&2 || true
  exit 1
fi

if grep -q "skipping" /tmp/run-health-tests-preflight.log 2>/dev/null; then
  write_skipped_result "No executable automated test command was detected in project config"
  exit 0
fi

echo "════════════════════════════════════════"
echo "  Health Test Scan — Phase 1: Run Tests"
echo "════════════════════════════════════════"

"$RUN_TESTS_WITH_REPORTS" "$TARGET_REPO_DIR"

SUMMARY=$(read_summary)
TOTAL_TESTS=$(echo "$SUMMARY" | jq -r '.totalTests')
TOTAL_FAILED=$(echo "$SUMMARY" | jq -r '.totalFailed')
TOTAL_PASSED=$((TOTAL_TESTS - TOTAL_FAILED))
SCORE=$(compute_score "$SUMMARY")

echo ""
echo "📊 First-run score: $SCORE ($TOTAL_PASSED passed, $TOTAL_FAILED failed out of $TOTAL_TESTS)"

if [[ "$(has_errors)" == "false" ]]; then
  echo ""
  echo "✅ All tests pass — no LLM needed"
  write_result "$SCORE" "[]" "[]" "false" ""
  exit 0
fi

echo ""
echo "════════════════════════════════════════"
echo "  Health Test Scan — Phase 4: Fix Loop"
echo "════════════════════════════════════════"

ALL_AUTO_FIXED="[]"
ALL_NON_FIXABLE="[]"
ITERATION=0
PREV_FAILED=$TOTAL_FAILED

while [[ "$(has_errors)" == "true" && $ITERATION -lt $MAX_ITERATIONS ]]; do
  ITERATION=$((ITERATION + 1))
  FIX_RESULT_FILE="/tmp/health-tests-fix-result.json"
  echo '{"autoFixed":[],"nonFixable":[]}' > "$FIX_RESULT_FILE"

  ANTHROPIC_MODEL="${FIX_MODEL:-claude-sonnet-4-6}" \
    "$RUN_AGENT" "$AGENT_TYPE" "ai-board.health-tests-fix" "$TARGET_REPO_DIR" \
    2>&1 | tee /tmp/fix-agent-log.txt || true

  if [[ -f "$FIX_RESULT_FILE" ]] && jq empty "$FIX_RESULT_FILE" 2>/dev/null; then
    ITER_FIXED=$(jq -c '.autoFixed // []' "$FIX_RESULT_FILE")
    ITER_NON_FIXABLE=$(jq -c '.nonFixable // []' "$FIX_RESULT_FILE")
    ALL_AUTO_FIXED=$(merge_arrays "$ALL_AUTO_FIXED" "$ITER_FIXED")
    ALL_NON_FIXABLE="$ITER_NON_FIXABLE"
  fi

  "$RUN_TESTS_WITH_REPORTS" "$TARGET_REPO_DIR"

  NEW_SUMMARY=$(read_summary)
  NEW_FAILED=$(echo "$NEW_SUMMARY" | jq -r '.totalFailed')

  if [[ "$NEW_FAILED" -gt "$PREV_FAILED" ]]; then
    git -C "$TARGET_REPO_DIR" checkout . >/dev/null 2>&1 || true
    git -C "$TARGET_REPO_DIR" clean -fd --quiet >/dev/null 2>&1 || true
    ALL_AUTO_FIXED="[]"
    break
  fi

  PREV_FAILED=$NEW_FAILED
done

if [[ "$(has_errors)" == "false" ]]; then
  ALL_NON_FIXABLE="[]"
fi

write_result "$SCORE" "$ALL_AUTO_FIXED" "$ALL_NON_FIXABLE" "false" ""
