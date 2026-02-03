#!/usr/bin/env bash

# detect-incomplete-implementation.sh - Detect if implementation is incomplete and needs --continue
#
# Usage:
#   ./detect-incomplete-implementation.sh <feature-dir> [--json]
#
# Exit Codes:
#   0 - Implementation complete
#   1 - Implementation incomplete, needs --continue
#   2 - Cannot determine (missing files)
#
# Output (--json flag):
#   {
#     "complete": true/false,
#     "total_tasks": N,
#     "completed_tasks": N,
#     "incomplete_tasks": N,
#     "critical_incomplete": N,
#     "mvp_incomplete": N,
#     "needs_continue": true/false,
#     "reason": "explanation",
#     "incomplete_task_ids": ["T001", "T005"]
#   }

set -uo pipefail

# ============================================================================
# Configuration
# ============================================================================

FEATURE_DIR="${1:-}"
JSON_OUTPUT=false

if [[ "${2:-}" == "--json" ]]; then
  JSON_OUTPUT=true
fi

# ============================================================================
# Validation
# ============================================================================

if [[ -z "$FEATURE_DIR" ]]; then
  echo "Error: Feature directory required" >&2
  echo "Usage: $0 <feature-dir> [--json]" >&2
  exit 2
fi

if [[ ! -d "$FEATURE_DIR" ]]; then
  echo "Error: Feature directory does not exist: $FEATURE_DIR" >&2
  exit 2
fi

TASKS_FILE="$FEATURE_DIR/tasks.md"

if [[ ! -f "$TASKS_FILE" ]]; then
  if [[ "$JSON_OUTPUT" == true ]]; then
    echo '{"complete":false,"needs_continue":false,"reason":"tasks.md not found"}'
  else
    echo "⚠️  tasks.md not found in $FEATURE_DIR"
  fi
  exit 2
fi

# ============================================================================
# Task Parsing Functions
# ============================================================================

# Count total implementation tasks (T001-T999 format only)
count_total_tasks() {
  grep -E '^\s*-\s+\[([ Xx])\]\s+T[0-9]{3,4}' "$TASKS_FILE" | wc -l | tr -d ' '
}

# Count completed implementation tasks [X] or [x]
count_completed_tasks() {
  grep -E '^\s*-\s+\[[Xx]\]\s+T[0-9]{3,4}' "$TASKS_FILE" | wc -l | tr -d ' '
}

# Count incomplete implementation tasks [ ]
count_incomplete_tasks() {
  grep -E '^\s*-\s+\[\s\]\s+T[0-9]{3,4}' "$TASKS_FILE" | wc -l | tr -d ' '
}

# Extract incomplete task IDs
get_incomplete_task_ids() {
  grep -E '^\s*-\s+\[\s\]\s+T[0-9]{3,4}' "$TASKS_FILE" | \
    grep -oE 'T[0-9]{3,4}' | \
    sort -u | \
    tr '\n' ',' | \
    sed 's/,$//'
}

# Count critical/MVP incomplete tasks (marked with [P1], MVP, or Critical)
count_critical_incomplete() {
  grep -E '^\s*-\s+\[\s\]\s+T[0-9]{3,4}' "$TASKS_FILE" | \
    grep -iE '\[(P1|MVP|Critical)\]|MVP|Critical' | \
    wc -l | tr -d ' '
}

# Count MVP phase incomplete tasks
count_mvp_incomplete() {
  # Extract MVP phase section and count incomplete tasks with T-prefix
  awk '
    /## Phase.*MVP|## User Story.*\(P1\)/ {in_mvp=1}
    /## Phase|## User Story/ {if (prev_mvp) in_mvp=0; prev_mvp=0}
    in_mvp && /^\s*-\s+\[\s\]\s+T[0-9]{3,4}/ {count++}
    {if (in_mvp) prev_mvp=1}
    END {print count+0}
  ' "$TASKS_FILE"
}

# ============================================================================
# Summary Analysis (Optional)
# ============================================================================

analyze_summary() {
  local summary_file="$FEATURE_DIR/IMPLEMENTATION_SUMMARY.md"
  local indicators=0

  if [[ ! -f "$summary_file" ]]; then
    return 0
  fi

  # Check for incompletion indicators in summary
  if grep -qiE 'not implemented|remaining|next steps|deferred|todo|pending' "$summary_file"; then
    indicators=$((indicators + 1))
  fi

  # Check for explicit "incomplete" statements
  if grep -qiE 'incomplete|partial|not finished|not complete' "$summary_file"; then
    indicators=$((indicators + 2))
  fi

  echo "$indicators"
}

# ============================================================================
# Decision Logic
# ============================================================================

make_decision() {
  local total=$1
  local completed=$2
  local incomplete=$3
  local critical_incomplete=$4
  local mvp_incomplete=$5
  local summary_indicators=$6

  # Rule 1: No tasks found → cannot determine
  if [[ $total -eq 0 ]]; then
    echo "unknown:No tasks found in tasks.md"
    return 2
  fi

  # Rule 2: All tasks completed → complete
  if [[ $incomplete -eq 0 ]]; then
    echo "complete:All tasks completed successfully"
    return 0
  fi

  # Rule 3: Critical/MVP tasks incomplete → definitely needs continue
  if [[ $critical_incomplete -gt 0 ]] || [[ $mvp_incomplete -gt 0 ]]; then
    echo "incomplete:Critical/MVP tasks not completed"
    return 1
  fi

  # Rule 4: High incompletion rate (>30%) → likely premature completion
  local completion_rate=$((completed * 100 / total))
  if [[ $completion_rate -lt 70 ]]; then
    echo "incomplete:Completion rate too low ($completion_rate%)"
    return 1
  fi

  # Rule 5: Summary indicates incompletion → needs continue
  if [[ $summary_indicators -ge 2 ]]; then
    echo "incomplete:Summary indicates incomplete implementation"
    return 1
  fi

  # Rule 6: Small number of incomplete non-critical tasks → likely intentional
  # (e.g., "Next Steps" section or low-priority enhancements)
  if [[ $incomplete -le 3 ]] && [[ $completion_rate -ge 80 ]]; then
    echo "complete:High completion rate with only non-critical tasks remaining"
    return 0
  fi

  # Rule 7: Moderate incompletion with summary indicators → needs continue
  if [[ $incomplete -gt 3 ]] && [[ $summary_indicators -ge 1 ]]; then
    echo "incomplete:Multiple incomplete tasks with summary indicators"
    return 1
  fi

  # Default: Consider complete if completion rate is high
  if [[ $completion_rate -ge 85 ]]; then
    echo "complete:High completion rate achieved"
    return 0
  else
    echo "incomplete:Completion rate below threshold"
    return 1
  fi
}

# ============================================================================
# Main Execution
# ============================================================================

# Gather metrics
TOTAL_TASKS=$(count_total_tasks)
COMPLETED_TASKS=$(count_completed_tasks)
INCOMPLETE_TASKS=$(count_incomplete_tasks)
CRITICAL_INCOMPLETE=$(count_critical_incomplete)
MVP_INCOMPLETE=$(count_mvp_incomplete)
SUMMARY_INDICATORS=$(analyze_summary)
INCOMPLETE_IDS=$(get_incomplete_task_ids)

# Make decision
DECISION_OUTPUT=$(make_decision "$TOTAL_TASKS" "$COMPLETED_TASKS" "$INCOMPLETE_TASKS" "$CRITICAL_INCOMPLETE" "$MVP_INCOMPLETE" "$SUMMARY_INDICATORS")
EXIT_CODE=$?
DECISION_STATUS="${DECISION_OUTPUT%%:*}"
DECISION_REASON="${DECISION_OUTPUT#*:}"

NEEDS_CONTINUE=false
if [[ $EXIT_CODE -eq 1 ]]; then
  NEEDS_CONTINUE=true
fi

COMPLETE=false
if [[ $EXIT_CODE -eq 0 ]]; then
  COMPLETE=true
fi

# ============================================================================
# Output
# ============================================================================

if [[ "$JSON_OUTPUT" == true ]]; then
  # JSON output for workflow integration
  cat <<EOF
{
  "complete": $COMPLETE,
  "total_tasks": $TOTAL_TASKS,
  "completed_tasks": $COMPLETED_TASKS,
  "incomplete_tasks": $INCOMPLETE_TASKS,
  "critical_incomplete": $CRITICAL_INCOMPLETE,
  "mvp_incomplete": $MVP_INCOMPLETE,
  "needs_continue": $NEEDS_CONTINUE,
  "reason": "$DECISION_REASON",
  "incomplete_task_ids": [$(echo "$INCOMPLETE_IDS" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/' | sed 's/""//g')]
}
EOF
else
  # Human-readable output
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 Implementation Completion Analysis"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📁 Feature Directory: $FEATURE_DIR"
  echo ""
  echo "📈 Task Statistics:"
  echo "   Total Tasks:           $TOTAL_TASKS"
  echo "   ✅ Completed:          $COMPLETED_TASKS"
  echo "   ⏳ Incomplete:         $INCOMPLETE_TASKS"
  echo "   🎯 Critical Incomplete: $CRITICAL_INCOMPLETE"
  echo "   🏆 MVP Incomplete:      $MVP_INCOMPLETE"
  echo ""

  if [[ $INCOMPLETE_TASKS -gt 0 ]]; then
    echo "📋 Incomplete Task IDs: $INCOMPLETE_IDS"
    echo ""
  fi

  echo "🔍 Decision: $DECISION_STATUS"
  echo "💡 Reason: $DECISION_REASON"
  echo ""

  if [[ "$NEEDS_CONTINUE" == true ]]; then
    echo "⚠️  RECOMMENDATION: Run implement command with --continue flag"
    echo ""
    echo "   claude /speckit.implement --continue"
    echo ""
  else
    echo "✅ Implementation appears complete or intentionally scoped"
    echo ""
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

exit $EXIT_CODE
