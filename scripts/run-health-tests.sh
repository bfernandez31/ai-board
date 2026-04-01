#!/bin/bash
# Health Test Scan Orchestrator
#
# Shell-based orchestration — LLM is only called to fix failing tests.
# If all tests pass, no LLM is invoked at all.
#
# Flow:
#   1. Run tests → JSON reports
#   2. Score from first run (fixed, never changes)
#   3. If no errors → write result, exit
#   4. If errors → call LLM fix agent → re-run tests → loop (max 3)
#   5. Write final result with score + fixes + non-fixable
#
# Usage: ./scripts/run-health-tests.sh <AGENT_TYPE>
#   AGENT_TYPE: CLAUDE or CODEX (default: CLAUDE)
#
# Outputs: /tmp/health-scan-result.json (same schema as other health scans)

set -uo pipefail

AGENT_TYPE="${1:-CLAUDE}"
MAX_ITERATIONS=3
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve run-agent.sh path (works in CI where ai-board is a sibling checkout)
if [ -f "$REPO_DIR/.github/scripts/run-agent.sh" ]; then
  RUN_AGENT="$REPO_DIR/.github/scripts/run-agent.sh"
elif [ -f "../ai-board/.github/scripts/run-agent.sh" ]; then
  RUN_AGENT="../ai-board/.github/scripts/run-agent.sh"
else
  echo "❌ run-agent.sh not found"
  exit 1
fi

# ── Helpers ─────────────────────────────────────────────────────────

read_summary() {
  cat /tmp/test-report-summary.json
}

has_errors() {
  jq -r '.hasErrors' /tmp/test-report-summary.json
}

# Regression-penalty scoring: 100 minus a cost per failure.
# Goal is 100% pass rate — every failure is a regression the AI introduced.
# Penalty per fail: unit -1, integration -3, e2e -5 (user-facing = most severe).
# Floor at 0.
compute_score() {
  local summary="$1"
  echo "$summary" | jq '
    [0, 100
      - (.unit.failed        * 1)
      - (.integration.failed * 3)
      - (.e2e.failed         * 5)
    ] | max
  '
}

# Write /tmp/health-scan-result.json
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
    }' > /tmp/health-scan-result.json

  echo "✅ Result written to /tmp/health-scan-result.json (score: $score, found: $issues_found, fixed: $issues_fixed)"
}

# Merge two JSON arrays
merge_arrays() {
  local arr1="$1"
  local arr2="$2"
  echo "$arr1" "$arr2" | jq -s '.[0] + .[1]'
}

# ── Phase 1: Run Tests ──────────────────────────────────────────────

echo "════════════════════════════════════════"
echo "  Health Test Scan — Phase 1: Run Tests"
echo "════════════════════════════════════════"

"$SCRIPT_DIR/run-tests-with-reports.sh"

# ── Phase 2: Score (from first run, never changes) ──────────────────

SUMMARY=$(read_summary)
TOTAL_TESTS=$(echo "$SUMMARY" | jq -r '.totalTests')
TOTAL_FAILED=$(echo "$SUMMARY" | jq -r '.totalFailed')
TOTAL_PASSED=$((TOTAL_TESTS - TOTAL_FAILED))
SCORE=$(compute_score "$SUMMARY")

echo ""
echo "📊 First-run score: $SCORE ($TOTAL_PASSED passed, $TOTAL_FAILED failed out of $TOTAL_TESTS)"

# ── Phase 3: Check if done ──────────────────────────────────────────

if [ "$(has_errors)" = "false" ]; then
  echo ""
  echo "✅ All tests pass — no LLM needed"
  write_result "$SCORE" "[]" "[]"
  exit 0
fi

# ── Phase 4: Fix Loop ──────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "  Health Test Scan — Phase 4: Fix Loop"
echo "════════════════════════════════════════"

ALL_AUTO_FIXED="[]"
ALL_NON_FIXABLE="[]"
ITERATION=0

while [ "$(has_errors)" = "true" ] && [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "── Fix iteration $ITERATION/$MAX_ITERATIONS ──"

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
    echo "  ⚠️ Fix agent did not produce valid results"
  fi

  # Re-run tests
  echo ""
  echo "  Re-running tests..."
  "$SCRIPT_DIR/run-tests-with-reports.sh"

  NEW_SUMMARY=$(read_summary)
  NEW_FAILED=$(echo "$NEW_SUMMARY" | jq -r '.totalFailed')
  echo "  After fix: $NEW_FAILED failures remaining"
done

if [ "$(has_errors)" = "false" ]; then
  echo ""
  echo "✅ All tests pass after $ITERATION fix iteration(s)"
  ALL_NON_FIXABLE="[]"
fi

# ── Phase 5: Write Result ──────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "  Health Test Scan — Phase 5: Result"
echo "════════════════════════════════════════"

write_result "$SCORE" "$ALL_AUTO_FIXED" "$ALL_NON_FIXABLE"
