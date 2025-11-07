# Implementation Continuation System

## Overview

The **Implementation Continuation System** automatically detects when Claude terminates `/speckit.implement` prematurely (incomplete implementation) and intelligently retries with `--continue` flag.

## Problem Statement

Claude sometimes terminates implementation workflows without completing all tasks in `tasks.md` due to:
- Context limits reached
- Premature completion signals
- Complexity underestimation
- Test failures causing early exit

**Challenge**: Distinguish between:
- ✅ **Intentional scope** (e.g., "MVP only, defer remaining features")
- ❌ **Premature completion** (e.g., stopped at 66% progress)

## Solution Architecture

### 1. Detection Script (`detect-incomplete-implementation.sh`)

**Location**: `.specify/scripts/bash/detect-incomplete-implementation.sh`

**Purpose**: Analyze `tasks.md` to determine if implementation is truly complete.

**Algorithm**:
```
1. Parse tasks.md for implementation tasks (T001-T999 format)
   - Exclude validation checklists (under "## Validation Checklist")
   - Count: total, completed [X], incomplete [ ]

2. Count critical/MVP incomplete tasks
   - Tasks marked with [P1], MVP, or Critical flags
   - Tasks in "## Phase.*MVP" or "## User Story.*(P1)" sections

3. Analyze summary file (if exists)
   - Look for: "not implemented", "remaining", "deferred"
   - Indicator scoring: 1 point for soft indicators, 2 for explicit

4. Apply decision rules (priority order):
   a. No tasks found → cannot determine (exit 2)
   b. All tasks complete → complete (exit 0)
   c. Critical/MVP incomplete → needs continue (exit 1)
   d. Completion rate <70% → needs continue (exit 1)
   e. Summary indicators ≥2 → needs continue (exit 1)
   f. ≤3 incomplete + rate ≥80% → intentionally scoped (exit 0)
   g. >3 incomplete + indicators ≥1 → needs continue (exit 1)
   h. Rate ≥85% → complete (exit 0)
   i. Default: needs continue (exit 1)
```

**Output Formats**:

**Human-readable** (default):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Implementation Completion Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Feature Directory: specs/077-935-jira-style

📈 Task Statistics:
   Total Tasks:           42
   ✅ Completed:          28
   ⏳ Incomplete:         14
   🎯 Critical Incomplete: 0
   🏆 MVP Incomplete:      0

📋 Incomplete Task IDs: T022,T023,T024,...

🔍 Decision: incomplete
💡 Reason: Completion rate too low (66%)

⚠️  RECOMMENDATION: Run implement command with --continue flag

   claude /speckit.implement --continue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**JSON** (`--json` flag):
```json
{
  "complete": false,
  "total_tasks": 42,
  "completed_tasks": 28,
  "incomplete_tasks": 14,
  "critical_incomplete": 0,
  "mvp_incomplete": 0,
  "needs_continue": true,
  "reason": "Completion rate too low (66%)",
  "incomplete_task_ids": ["T022","T023","T024","T025","T026","T030","T032","T033","T037","T038","T039","T040","T041","T042"]
}
```

**Exit Codes**:
- `0`: Implementation complete
- `1`: Implementation incomplete, needs `--continue`
- `2`: Cannot determine (missing files)

### 2. Workflow Integration (`speckit.yml`)

**Location**: `.github/workflows/speckit.yml`

**New Steps** (after "Execute Spec-Kit Command"):

#### Step 1: Detect Incomplete Implementation

```yaml
- name: Detect Incomplete Implementation (Implement Command)
  if: inputs.command == 'implement'
  id: detect-incomplete
  run: |
    # 1. Find feature directory (branch-based or ticket-based)
    # 2. Run detection script with --json
    # 3. Parse JSON and set GitHub outputs:
    #    - needs_continue: true/false
    #    - incomplete_count: N
    #    - reason: "explanation"
```

**Logic**:
- Find feature directory: `specs/{branch}` or `specs/{ticket-num}-*`
- Call `detect-incomplete-implementation.sh $FEATURE_DIR --json`
- Parse JSON with `jq`
- Set GitHub Action outputs for next step

#### Step 2: Continue Implementation (Retry Loop)

```yaml
- name: Continue Implementation (Retry Loop)
  if: steps.detect-incomplete.outputs.needs_continue == 'true'
  run: |
    # Retry loop (max 2 times):
    #   1. Execute /speckit.implement --continue
    #   2. Re-run detection script
    #   3. If complete → break
    #   4. If intentionally scoped → break
    #   5. If max retries → break with warning
    #   6. Continue loop
```

**Retry Logic**:
```
MAX_RETRIES=2
retry_count=0

while retry_count < MAX_RETRIES:
  retry_count++

  echo "🔄 Retry $retry_count / $MAX_RETRIES"

  # Execute with --continue
  claude /speckit.implement --continue "..."

  # Re-check completion
  if detect-incomplete-implementation.sh → exit 0:
    echo "✅ Complete after retry $retry_count"
    break

  needs_continue = parse_json(needs_continue)

  if needs_continue != true:
    echo "✅ Intentionally scoped"
    break

  if retry_count >= MAX_RETRIES:
    echo "⚠️  Max retries reached"
    break

  echo "⏳ Still incomplete, continuing..."

echo "🏁 Continuation complete (after $retry_count retries)"
```

## Usage Examples

### Example 1: Complete Implementation (No Retry)

**Initial execution**: `/speckit.implement`
- Claude completes 19/19 tasks
- Detection: `{"complete": true, "needs_continue": false}`
- Result: ✅ No retry needed, proceed to VERIFY

**Workflow output**:
```
🔍 Checking implementation completion status...
📁 Feature directory: specs/045-visual-distinction-between
✅ Implementation complete!
```

### Example 2: Incomplete Implementation (Auto-Retry)

**Initial execution**: `/speckit.implement`
- Claude completes 28/42 tasks (66%)
- Detection: `{"complete": false, "needs_continue": true, "reason": "Completion rate too low (66%)"}`
- Result: ⚠️ Trigger retry loop

**Retry 1**: `/speckit.implement --continue`
- Claude completes 38/42 tasks (90%)
- Detection: `{"complete": false, "needs_continue": true}`
- Result: ⏳ Continue

**Retry 2**: `/speckit.implement --continue`
- Claude completes 42/42 tasks (100%)
- Detection: `{"complete": true}`
- Result: ✅ Complete, exit loop

**Workflow output**:
```
🔍 Checking implementation completion status...
⚠️  Implementation incomplete: Completion rate too low (66%)
   Incomplete tasks: 14
   Will retry with --continue flag

🔄 Starting implementation continuation loop (max 2 retries)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Retry 1 / 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Executing: /speckit.implement --continue
✅ Implementation retry succeeded

🔍 Re-checking implementation completion status...
⏳ Still 4 tasks incomplete, continuing...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Retry 2 / 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Executing: /speckit.implement --continue
✅ Implementation retry succeeded

🔍 Re-checking implementation completion status...
✅ Implementation now complete after retry 2
{
  "complete": true,
  "total_tasks": 42,
  "completed_tasks": 42,
  "incomplete_tasks": 0
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 Implementation continuation complete (after 2 retries)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 3: Intentional Scoping (No Retry)

**Initial execution**: `/speckit.implement`
- Claude completes 19/22 tasks (86%)
- Summary: "📝 Next Steps (Not Implemented - Per User Request)"
- Detection: `{"complete": true, "needs_continue": false, "reason": "High completion rate with only non-critical tasks remaining"}`
- Result: ✅ No retry needed

**Workflow output**:
```
🔍 Checking implementation completion status...
📁 Feature directory: specs/003-awwwards-portfolio
✅ Implementation complete!
```

**Reasoning**:
- 86% completion rate ≥85% threshold
- Remaining tasks not critical (no MVP/P1 flags)
- Summary indicates intentional scoping

### Example 4: Max Retries Exhausted

**Initial execution**: `/speckit.implement`
- Claude completes 15/50 tasks (30%)
- Detection: `{"needs_continue": true}`

**Retry 1**: Claude completes 25/50 (50%)
**Retry 2**: Claude completes 30/50 (60%)
- Still incomplete, max retries reached

**Workflow output**:
```
⚠️  Max retries reached with 20 tasks still incomplete
   Manual intervention may be required

🏁 Implementation continuation complete (after 2 retries)
```

**Action Required**: Manual investigation needed

## Testing the Detection Script

### Test with Complete Spec

```bash
cd /Users/b.fernandez/Workspace/ai-board

# Human-readable output
.specify/scripts/bash/detect-incomplete-implementation.sh specs/045-visual-distinction-between

# Expected: ✅ Implementation complete (19/19 tasks)

# JSON output
.specify/scripts/bash/detect-incomplete-implementation.sh specs/045-visual-distinction-between --json

# Expected:
# {
#   "complete": true,
#   "total_tasks": 19,
#   "completed_tasks": 19,
#   "incomplete_tasks": 0,
#   "needs_continue": false,
#   "reason": "All tasks completed successfully"
# }
```

### Test with Incomplete Spec

```bash
# Test with 66% completion
.specify/scripts/bash/detect-incomplete-implementation.sh specs/077-935-jira-style

# Expected: ⚠️  Incomplete (28/42 tasks, 66%)

# JSON output
.specify/scripts/bash/detect-incomplete-implementation.sh specs/077-935-jira-style --json

# Expected:
# {
#   "complete": false,
#   "total_tasks": 42,
#   "completed_tasks": 28,
#   "incomplete_tasks": 14,
#   "needs_continue": true,
#   "reason": "Completion rate too low (66%)",
#   "incomplete_task_ids": ["T022","T023",...]
# }
```

## Configuration

### Adjusting Retry Count

Edit `.github/workflows/speckit.yml` line 414:

```bash
MAX_RETRIES=2  # Change to 1-5 as needed
```

**Recommendations**:
- `MAX_RETRIES=1`: Fast feedback, minimal cost
- `MAX_RETRIES=2`: **Default**, balances completion and cost
- `MAX_RETRIES=3`: High completion rate, higher cost
- `MAX_RETRIES=5`: Maximum thoroughness, use for critical features

### Adjusting Decision Thresholds

Edit `.specify/scripts/bash/detect-incomplete-implementation.sh`:

```bash
# Line 151: Low completion threshold
if [[ $completion_rate -lt 70 ]]; then  # Change to 60-80

# Line 170: Small incomplete task threshold
if [[ $incomplete -le 3 ]] && [[ $completion_rate -ge 80 ]]; then  # Adjust 3 and 80

# Line 180: High completion rate threshold
if [[ $completion_rate -ge 85 ]]; then  # Change to 80-95
```

**Recommendations**:
- **Conservative** (fewer retries): `70/80/85` (current)
- **Balanced**: `65/75/80`
- **Aggressive** (more retries): `60/70/75`

## Monitoring and Debugging

### View Detection Results in Workflow Logs

1. Go to GitHub Actions → Spec-Kit Workflow Execution
2. Expand "Detect Incomplete Implementation (Implement Command)" step
3. Review:
   - Feature directory detected
   - JSON output with metrics
   - Decision and reasoning

### View Retry Loop Progress

1. Expand "Continue Implementation (Retry Loop)" step
2. Review:
   - Retry count and attempts
   - Re-detection results after each retry
   - Final completion status

### Manual Testing Locally

```bash
# Simulate detection
cd /Users/b.fernandez/Workspace/ai-board
bash .specify/scripts/bash/detect-incomplete-implementation.sh specs/<ticket-dir>

# Check exit code
echo "Exit code: $?"
# 0 = complete, 1 = incomplete, 2 = error

# Parse JSON programmatically
bash .specify/scripts/bash/detect-incomplete-implementation.sh specs/<ticket-dir> --json | jq '.needs_continue'
```

## Edge Cases and Limitations

### Edge Case 1: Feature Directory Not Found

**Scenario**: Branch name doesn't match `specs/` directory structure

**Detection Output**:
```
⚠️  Could not find feature directory for ticket ABC-123
   Skipping completion detection
```

**Resolution**: Workflow continues without retry (conservative approach)

### Edge Case 2: tasks.md Missing

**Scenario**: Feature directory exists but no `tasks.md` file

**Detection Output**:
```json
{"complete":false,"needs_continue":false,"reason":"tasks.md not found"}
```

**Exit Code**: 2 (error)
**Resolution**: Workflow continues without retry

### Edge Case 3: All Tasks in Validation Checklist

**Scenario**: `tasks.md` only contains validation checklists (no T-prefixed tasks)

**Detection Output**:
```json
{"complete":false,"needs_continue":false,"reason":"No tasks found in tasks.md"}
```

**Exit Code**: 2 (error)
**Resolution**: Workflow continues without retry

### Edge Case 4: Claude Completes Exactly 85% (Threshold)

**Scenario**: Completion rate exactly at decision threshold

**Detection Logic**: Uses `>=` comparison, considers complete
**Result**: No retry triggered

### Limitation 1: Cannot Detect Quality Issues

**What it detects**: Task quantity completion (19/19 tasks done)
**What it misses**: Task quality (are implementations correct?)

**Mitigation**: Quality validation happens in VERIFY stage (tests + PR review)

### Limitation 2: Summary Analysis is Heuristic

**Method**: Keyword matching ("not implemented", "remaining")
**Risk**: False positives/negatives based on wording

**Example False Positive**:
> "Tasks T040-T050 not implemented because they are out of scope"

Parsed as incompletion, but actually intentional.

**Mitigation**: Decision algorithm prioritizes task counts over summary indicators

### Limitation 3: Max Retries May Not Be Enough

**Scenario**: Complex feature needs 4+ attempts to complete

**Current Limit**: 2 retries (3 total attempts)
**Resolution**: Manual intervention required, increase `MAX_RETRIES` if recurring

## Future Enhancements

### 1. Intelligent Retry Limit

Adjust retry count based on initial completion rate:
- `<50%`: MAX_RETRIES=3
- `50-70%`: MAX_RETRIES=2
- `70-85%`: MAX_RETRIES=1

### 2. Task Priority Awareness

Prioritize completing critical tasks over low-priority ones:
- Count P0/P1 incomplete tasks separately
- Adjust thresholds based on priority distribution

### 3. Historical Pattern Learning

Track completion rates across features:
- Identify patterns (e.g., frontend features need fewer retries)
- Adjust thresholds dynamically per project/domain

### 4. Slack/Discord Notifications

Send alerts when:
- Max retries exhausted
- Critical tasks incomplete after retry
- Unusual completion patterns detected

### 5. Resume from Checkpoint

Instead of full `/speckit.implement --continue`, resume from last completed task:
- Parse incomplete task IDs
- Pass to Claude: `/speckit.implement --tasks T022,T023,T024,...`

## Maintenance

### Regular Reviews

**Monthly**:
- Review retry frequency: `gh workflow view speckit.yml --limit 50 | grep "Retry"`
- Analyze completion rates: avg, min, max
- Adjust thresholds if needed

**Quarterly**:
- Review edge case handling
- Update decision rules based on patterns
- Evaluate retry limit effectiveness

### Version History

- **v1.0** (2025-11-07): Initial implementation
  - Detection script with 8-rule decision algorithm
  - Workflow integration with 2-retry loop
  - JSON output for automation
  - Human-readable output for manual use

## Support and Troubleshooting

### Common Issues

**Issue 1**: Retries triggered unnecessarily

**Diagnosis**:
```bash
# Check recent completion rates
.specify/scripts/bash/detect-incomplete-implementation.sh specs/<ticket-dir>
```

**Fix**: Increase completion rate threshold in decision rules

**Issue 2**: Max retries exhausted frequently

**Diagnosis**: Check task complexity and Claude instructions

**Fix**:
- Increase `MAX_RETRIES` to 3-4
- Review `/speckit.implement` instructions for clarity
- Break down complex features into smaller specs

**Issue 3**: Detection script fails (exit 2)

**Diagnosis**: Feature directory or tasks.md not found

**Fix**:
- Verify `specs/` directory structure matches branch names
- Ensure `tasks.md` exists and follows format
- Check workflow logs for directory detection logic

## References

- **Detection Script**: `.specify/scripts/bash/detect-incomplete-implementation.sh`
- **Workflow**: `.github/workflows/speckit.yml` (lines 346-494)
- **Spec-Kit Implement**: `.claude/commands/speckit.implement.md`
- **Project Guidelines**: `CLAUDE.md`
- **Constitution**: `.specify/memory/constitution.md`
