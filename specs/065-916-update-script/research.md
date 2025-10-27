# Research Notes: PR Ready Notification Enhancement

**Feature**: Ticket #916 - Update Script PR Ready Notification
**Branch**: `065-916-update-script`
**Date**: 2025-10-27

## Research Status

✅ **MINIMAL RESEARCH REQUIRED** - All technical context known from existing codebase

## Existing Infrastructure Analysis

### 1. Script Analysis: create-pr-and-transition.sh

**Current Comment Posting Logic** (lines 111-118):
```bash
# Post comment with PR link
echo ""
echo "💬 Posting PR notification comment..."
curl -X POST "${APP_URL}/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/comments" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"🔀 **Pull Request Created**\\n\\nPR #${PR_NUMBER} is ready for review:\\n👉 ${PR_URL}\\n\\nThe implementation is complete and ready for code review.\"}" \
  -f -s -S || echo "⚠️ Failed to post PR comment (continuing...)"
```

**Findings**:
- ✅ Comment posting already implemented
- ✅ Markdown formatting supported (`**bold**`, `\n` for newlines)
- ✅ PR number available via `${PR_NUMBER}` variable (line 108)
- ✅ PR URL available via `${PR_URL}` variable
- ✅ Non-blocking error handling in place (`|| echo "⚠️ Failed..."`)

**Enhancement Opportunity**:
- Current message: "Pull Request Created... ready for review"
- Enhancement: Make "ready for review" more prominent and explicit

### 2. API Endpoint Analysis

**Endpoint**: `POST /api/projects/:projectId/tickets/:id/comments`

**Contract** (from CLAUDE.md documentation):
- **Authentication**: Bearer token (`WORKFLOW_API_TOKEN`)
- **Request Body**: `{ "content": string }` (markdown-formatted)
- **Validation**: Zod schema enforces content rules
- **Character Support**: Letters, numbers, spaces, special chars including `[`, `]`, `*`, `#`, `\n`

**Compatibility Check**:
- ✅ Markdown bold syntax (`**text**`) supported
- ✅ Emoji characters supported (🔀, 👉 already in use)
- ✅ Line breaks (`\n`) supported
- ✅ Links in markdown format supported

### 3. Error Handling Strategy

**Current Behavior** (line 118):
```bash
|| echo "⚠️ Failed to post PR comment (continuing...)"
```

**Analysis**:
- Comment failure does NOT exit the script (FR-006 ✅)
- Script continues to ticket transition step (lines 123-141)
- Workflow completes successfully even if comment posting fails

**Decision**: Preserve this pattern (no changes needed)

### 4. PR Number Extraction

**Current Logic** (line 108):
```bash
PR_NUMBER=$(gh pr view "${BRANCH}" --json number -q '.number' 2>/dev/null || echo "")
```

**Behavior**:
- Success case: PR_NUMBER contains number (e.g., "42")
- Failure case: PR_NUMBER is empty string ("")
- Comment template handles both cases: `PR #${PR_NUMBER}` renders as "PR #42" or "PR #"

**Enhancement Decision**:
- Keep existing extraction logic
- Update comment template to handle empty PR_NUMBER gracefully
- If PR_NUMBER empty, could show "PR: {URL}" instead of "PR #:"

## Design Decisions

### Decision 1: Enhanced Comment Format

**Chosen Approach**: Update comment template for clarity

**New Format Proposal**:
```markdown
✅ **Pull Request Ready for Review**

**PR #{number}**: [View Pull Request]({url})

The implementation is complete. Code review can now begin.

**Next Steps**:
- Review the code changes
- Run tests to verify functionality
- Approve and merge when ready
```

**Rationale**:
1. Lead with "Ready for Review" (addresses FR-004)
2. Make PR link prominent and clickable
3. Provide clear next steps for reviewer
4. Keep emoji minimal and meaningful (✅ for completion)

**Backward Compatibility**:
- No API contract changes
- Uses existing markdown rendering
- Falls back gracefully if formatting not supported

### Decision 2: JSON Escaping Strategy

**Challenge**: Bash variable substitution in JSON string with special characters

**Current Pattern**:
```bash
-d "{\"content\": \"🔀 **Pull Request Created**\\n\\nPR #${PR_NUMBER}...\"}"
```

**Rules**:
- Escape double quotes: `\"`
- Escape newlines: `\\n`
- Escape backslashes: `\\\\` (if needed for markdown)
- Leave variables unescaped: `${PR_URL}`

**Decision**: Maintain current escaping pattern, verified safe for markdown formatting

### Decision 3: Testing Strategy

**Verification Method**: E2E tests via existing workflow integration tests

**Test Files**:
- `tests/e2e/workflow-integration.spec.ts` (existing)
- Validates full workflow including comment posting

**Test Requirements**:
1. Verify comment posted after PR creation
2. Check comment content contains "ready for review" language
3. Verify PR link is clickable markdown format
4. Confirm PR number included when available

**Manual Testing**:
- Trigger workflow on test ticket
- Inspect posted comment in ticket UI
- Verify markdown rendering (bold, links)

## Technology Best Practices

### Bash Scripting in CI/CD

**Best Practices Applied**:
1. ✅ Use `set -e` for fail-fast behavior (line 9)
2. ✅ Validate required arguments upfront (lines 18-23)
3. ✅ Non-blocking error handling for non-critical steps (line 118)
4. ✅ Echo informative messages for debugging (lines 25-28, 112-113)
5. ✅ Capture exit codes for conditional logic (lines 75-76)

**Bash + curl + JSON**:
1. ✅ Properly escape JSON strings
2. ✅ Use `-s -S` flags for silent mode with errors shown
3. ✅ Use `-f` flag to fail on HTTP errors
4. ✅ Include proper headers (Authorization, Content-Type)

### GitHub CLI Best Practices

**Current Usage**:
```bash
gh pr create --title "..." --body "..." --base main --head "${BRANCH}"
gh pr view "${BRANCH}" --json number -q '.number'
```

**Best Practices**:
1. ✅ Use `--json` flag with `jq` query (`-q`) for structured output
2. ✅ Handle errors with fallback logic (lines 94-105)
3. ✅ Suppress stderr when error is expected (`2>/dev/null`)

## Unknowns & Clarifications

**None** - All technical details confirmed through codebase analysis.

## Summary

This feature requires minimal research because:
1. All infrastructure already exists (API, authentication, error handling)
2. Enhancement is isolated to comment content template (lines 111-118)
3. No new dependencies or technologies required
4. Existing E2E tests provide verification coverage

**Ready for Phase 1 (Design & Contracts)**: ✅ YES
