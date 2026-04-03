# Contract: /fix Command

**Branch**: `AIB-494-add-fix-assist` | **Date**: 2026-04-03

## Command Interface

### User Invocation

```
@ai-board /fix           # Fix all pertinent findings
@ai-board /fix 1 3       # Fix specific ai-board finding numbers
@ai-board /fix all       # Explicit "fix all" (identical to no args)
```

### Command Autocomplete Entry

```typescript
// app/lib/data/ai-board-commands.ts
{
  name: '/fix',
  description: 'Fix PR review findings from code review',
}
```

### Workflow Routing

```yaml
# .github/workflows/ai-board-assist.yml — new elif block
elif echo "$COMMENT" | grep -qE "/fix\b"; then
  echo "Detected /fix command - routing to ai-board.fix"
  # Stage validation: VERIFY only
  if [ "$STAGE" != "verify" ]; then
    OUTPUT="@[$USER_ID:$USER] /fix is only available in VERIFY stage (current: $STAGE)"
  else
    PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number')
    if [ -z "$PR_NUMBER" ]; then
      OUTPUT="@[$USER_ID:$USER] No PR found for branch $BRANCH"
    else
      ARGS=$(echo "$COMMENT" | sed -n 's/.*\/fix[[:space:]]*\(.*\)/\1/p')
      OUTPUT=$(run-agent.sh "CLAUDE" "ai-board.fix" "$PR_NUMBER $ARGS")
    fi
  fi
```

## Command File Contract

**Path**: `.claude-plugin/commands/ai-board.fix.md`

### Input

| Source | Variable | Description |
|--------|----------|-------------|
| Env | `TICKET_ID` | Ticket ID |
| Env | `BRANCH` | Git branch name |
| Env | `STAGE` | Current stage (must be "verify") |
| Env | `USER_ID` | Requesting user ID (for mention) |
| Env | `USER` | Requesting user display name |
| Env | `PROJECT_ID` | Project ID |
| Argument | `$ARGUMENTS` | `<PR_NUMBER> [finding_numbers...]` |

### Processing Steps

1. **Parse arguments**: Extract PR number and optional finding numbers from `$ARGUMENTS`
2. **Fetch PR reviews**: Use `gh` CLI to fetch all comments/reviews on the PR
3. **Parse findings**: Extract structured findings from each source
4. **Deduplicate**: Remove duplicates using priority order (ai-board > Codex > Copilot)
5. **Filter**: Apply selective filter (if finding numbers specified) or pertinence filter (for Codex/Copilot)
6. **Apply fixes**: For each pertinent finding, make targeted code changes
7. **Check specs**: Detect and fix spec contradictions in `specs/specifications/`
8. **Validate**: Run `bun run type-check && bun run lint`; fix any introduced errors
9. **Commit & push**: Single commit `fix(review): address N review findings`, push to PR branch
10. **Write result file**: `specs/$BRANCH/.ai-board-result.md`

### Output

**Comment format** (posted via workflow):
```
@[$USER_ID:$USER] fix **Review Fixes Applied**

N findings fixed, M specs updated, K findings rejected

**Fixed**: #1 description (ai-board), #2 description (Codex)
**Rejected**: #3 (Copilot) — documentation nitpick
```

**Character limit**: <1500 characters

**Result file** (`specs/$BRANCH/.ai-board-result.md`):
```markdown
# AI-BOARD Assist Result

## Status
SUCCESS

## Message
@[$USER_ID:$USER] Review fixes applied: N fixed, M specs updated, K rejected

## Files Modified
- path/to/fixed-file.ts
- specs/specifications/technical/api/endpoints.md

## Summary
Fixed N review findings from ai-board (X), Codex (Y), Copilot (Z).
M spec files updated for contract consistency.
K findings rejected: [reasons].
```

### Error Cases

| Condition | Status | Output |
|-----------|--------|--------|
| Stage is not VERIFY | ERROR | `/fix is only available in VERIFY stage` |
| No PR found for branch | ERROR | `No PR found for branch $BRANCH` |
| PR has no review comments | ERROR | `No review comments found. Run /review first.` |
| All findings rejected | SUCCESS | Summary lists all rejections, no commit made |
| Type-check/lint fails after fixes | ERROR | `Fix introduced errors that could not be resolved` |
| Finding numbers not found | SUCCESS | Fix what exists, report missing IDs |

## Review Source Parsing Contracts

### ai-board Custom Review

**Fetch**: `gh api repos/{owner}/{repo}/issues/{pr}/comments` → filter by `### Code review` header

**Parse pattern**:
```
/^(\d+)\.\s+(.+)$/  → finding number + description
/https:\/\/github\.com\/.*\/blob\/[a-f0-9]+\/(.+)#L(\d+)(?:-L(\d+))?/  → file path + line range
```

### Codex Bot

**Fetch**: `gh api repos/{owner}/{repo}/pulls/{pr}/comments` → filter by `user.login == "chatgpt-codex-connector[bot]"`

**Parse**: Each comment is one finding. Extract `path` and `line`/`original_line` from API response. Description is comment body.

### Copilot

**Fetch**: `gh api repos/{owner}/{repo}/pulls/{pr}/comments` → filter by `user.login == "Copilot"`

**Parse**: Same structure as Codex. Each comment is one finding with `path` and line info from API response.
