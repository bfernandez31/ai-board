# Quickstart: /review Command Implementation

**Date**: 2026-01-22
**Branch**: AIB-178-review-command-from

## Implementation Overview

Add `/review` command to AI-BOARD assistance system for on-demand code reviews in VERIFY stage. **Key change**: Reuse existing `code-review.md` with new `--force` flag instead of creating a new command file.

## Files to Modify

### 1. Modify Existing Code-Review Command (MODIFY - NOT NEW)

**File**: `.claude/commands/code-review.md`

Purpose: Add `--force` flag support that skips step 1d (previous review check).

Changes needed:
- Add documentation for `--force` flag in the command description
- Modify step 1 to check for `--force` argument
- When `--force` is present: Skip step 1d (already has code review check)
- When `--force` is absent: Maintain existing behavior

Example modification to step 1:
```markdown
1. Use a Haiku agent to check if the pull request (a) is closed, (b) is a draft, (c) does not need a code review (...). If the `--force` flag is provided, skip check (d) for existing reviews. If so (and no --force for d), do not proceed.
```

### 2. Update Workflow Routing

**File**: `.github/workflows/ai-board-assist.yml`

Location: After `/compare` routing block (around line 222)

Add:
```bash
elif echo "$COMMENT" | grep -qE "/review\b"; then
  echo "📌 Detected /review command - routing to code-review with --force"
  # Invoke code-review with --force flag to allow re-reviews
  OUTPUT=$(claude --dangerously-skip-permissions "/code-review $PR_NUMBER --force" || true)
```

### 3. Update Autocomplete List

**File**: `app/lib/data/ai-board-commands.ts`

Add to `AI_BOARD_COMMANDS` array:
```typescript
{
  name: '/review',
  description: 'Request code review for the current PR',
},
```

## Testing Checklist

### Unit Tests

- [ ] `tests/unit/ai-board-commands.test.ts` - Test `/review` appears in command list
- [ ] Test `filterCommands('review')` returns the command

### Integration Tests

- [ ] Test command routing detects `/review` pattern
- [ ] Test error response when stage is not VERIFY
- [ ] Test error response when no PR exists
- [ ] Test `--force` flag behavior in code-review command

### Manual Verification

1. Create a ticket and move to VERIFY stage (PR must exist)
2. Post comment: `@ai-board /review`
3. Verify:
   - Job created with command `comment-verify`
   - Code review executes on PR (even if previously reviewed)
   - Summary comment posted to ticket
   - Detailed findings posted to PR (if any)

## Key Implementation Notes

1. **--force Flag**: The existing `/code-review` command is modified to accept `--force`. When provided, step 1d (previous review check) is skipped. This allows re-reviews after changes.

2. **No New Command File**: We do NOT create `.claude/commands/review.md`. Instead, the workflow routing invokes `/code-review $PR_NUMBER --force` directly.

3. **Stage Restriction**: Unlike other ai-board commands that work in multiple stages, `/review` is VERIFY-only because PRs only exist in that stage.

4. **Output Split**:
   - Brief summary (≤1500 chars) → Ticket comment
   - Detailed findings → PR comment (handled by code-review skill)

5. **No Arguments**: Unlike `/compare` which takes ticket references, `/review` operates on the current ticket's branch automatically.
