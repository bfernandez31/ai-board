# Contract: /review Command

**Date**: 2026-01-22
**Branch**: AIB-178-review-command-from

## Command Interface

### Invocation

```
@ai-board /review
```

No arguments required. The command operates on the current ticket's branch.

### Prerequisites

| Requirement | Validation | Error Message |
|-------------|------------|---------------|
| Stage = VERIFY | Workflow routing | "The /review command is only available in VERIFY stage where PRs exist." |
| PR exists for branch | `gh pr list --head $BRANCH` | "No PR found for branch {BRANCH}. Please ensure a PR has been created." |

### Environment Variables (Workflow Inputs)

| Variable | Source | Description |
|----------|--------|-------------|
| `TICKET_ID` | Workflow input | Current ticket ID |
| `STAGE` | Workflow input | Must be "verify" |
| `BRANCH` | Workflow input | Git branch name (ticket's branch) |
| `USER_ID` | Workflow input | Requesting user's ID |
| `USER` | Workflow input | Requesting user's display name |
| `PROJECT_ID` | Workflow input | Project ID |

## Output Format

### Success Response (Ticket Comment)

```markdown
@[$USER_ID:$USER] ✅ **Code Review Complete**

Reviewed PR #123 for branch `AIB-178-review-command-from`.

**Result**: [X issues found | No issues found]

[If issues found:]
See PR comments for detailed findings.

[If no issues:]
No issues flagged. Checked for bugs, CLAUDE.md compliance, and constitution compliance.

→ [View PR](https://github.com/{owner}/{repo}/pull/123)
```

**Character Limit**: ≤ 1500 characters (buffer from 2000 DB limit)

### Error Responses

**Wrong Stage**:
```markdown
@[$USER_ID:$USER] ❌ **Review Failed**

The /review command is only available in VERIFY stage where PRs exist.

Current stage: {STAGE}
```

**No PR Found**:
```markdown
@[$USER_ID:$USER] ❌ **Review Failed**

No PR found for branch `{BRANCH}`.

Please ensure a PR has been created before requesting a review.
```

**PR Closed/Draft**:
```markdown
@[$USER_ID:$USER] ❌ **Review Failed**

PR #{PR_NUMBER} is [closed | a draft] and cannot be reviewed.

Please ensure the PR is open and not in draft state.
```

## Workflow Routing Contract

### Detection Pattern

```bash
# In ai-board-assist.yml, add after /compare routing:
if echo "$COMMENT" | grep -qE "/review\b"; then
  # Route to /review command
fi
```

### Invocation

```bash
# Stage validation
if [ "$STAGE" != "verify" ]; then
  # Return error response
fi

# PR lookup
PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number')
if [ -z "$PR_NUMBER" ]; then
  # Return error response
fi

# Invoke code-review with override instruction
claude --dangerously-skip-permissions "/review $PR_NUMBER"
```

## Integration Points

### Code-Review Skill

The /review command delegates to the existing `/code-review` skill with an override instruction:

**File**: `.claude/commands/review.md`

The command:
1. Validates stage and PR existence
2. Invokes `/code-review $PR_NUMBER` with preamble instruction to skip step 1d (previous review check)
3. Captures result (issues found or not)
4. Posts summary to ticket, details go to PR via code-review

### Result File Contract

**Path**: `specs/$BRANCH/.ai-board-result.md`

```markdown
# AI-BOARD Assist Result

## Status
SUCCESS | ERROR

## Message
@{USER} Code review [completed | failed] for PR #{PR_NUMBER}

## Files Modified
[None - no files modified by this command]
```

## Autocomplete Entry

**File**: `app/lib/data/ai-board-commands.ts`

```typescript
{
  name: '/review',
  description: 'Request code review for the current PR',
}
```
