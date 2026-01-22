# Quickstart: /review Command Implementation

**Date**: 2026-01-22
**Branch**: AIB-178-review-command-from

## Implementation Overview

Add `/review` command to AI-BOARD assistance system for on-demand code reviews in VERIFY stage.

## Files to Modify/Create

### 1. Create Command Spec (NEW)

**File**: `.claude/commands/review.md`

Purpose: Define the /review command skill that invokes /code-review with override.

Key sections:
- Frontmatter with allowed tools (gh CLI)
- Stage validation (VERIFY only)
- PR lookup using branch
- Code-review invocation with skip-previous-review instruction
- Output format (summary to ticket, details to PR)

### 2. Update Workflow Routing

**File**: `.github/workflows/ai-board-assist.yml`

Location: After `/compare` routing block (around line 222)

Add:
```bash
elif echo "$COMMENT" | grep -qE "/review\b"; then
  echo "📌 Detected /review command - routing to review skill"
  OUTPUT=$(claude --dangerously-skip-permissions "/review" || true)
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

### Manual Verification

1. Create a ticket and move to VERIFY stage (PR must exist)
2. Post comment: `@ai-board /review`
3. Verify:
   - Job created with command `comment-verify`
   - Code review executes on PR
   - Summary comment posted to ticket
   - Detailed findings posted to PR (if any)

## Key Implementation Notes

1. **Re-review Behavior**: The `/review` command MUST include instruction to skip the "already reviewed" check in step 1d of code-review. This allows re-reviews after changes.

2. **Stage Restriction**: Unlike other ai-board commands that work in multiple stages, `/review` is VERIFY-only because PRs only exist in that stage.

3. **Output Split**:
   - Brief summary (≤1500 chars) → Ticket comment
   - Detailed findings → PR comment (handled by code-review skill)

4. **No Arguments**: Unlike `/compare` which takes ticket references, `/review` operates on the current ticket's branch automatically.
