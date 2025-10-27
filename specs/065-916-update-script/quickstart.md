# Quickstart Guide: PR Ready Notification Enhancement

**Feature**: Ticket #916 - Enhanced PR Ready Notifications
**Branch**: `065-916-update-script`
**Complexity**: ⭐ Simple (Single file, 8 lines changed)
**Estimated Time**: 10-15 minutes

## Overview

This feature enhances the PR notification comment posted by the `create-pr-and-transition.sh` script to make it clearer that the pull request is ready for review.

**What Changes**:
- Comment content template in `.specify/scripts/bash/create-pr-and-transition.sh` (lines 111-118)

**What Stays the Same**:
- API endpoint (`POST /api/projects/:projectId/tickets/:id/comments`)
- Authentication mechanism (Bearer token)
- Error handling strategy (non-blocking)
- Script flow and structure

## Prerequisites

- [x] Read `spec.md` for functional requirements
- [x] Read `research.md` for technical context
- [x] Read `plan.md` for design decisions

## Implementation Steps

### Step 1: Update Comment Content Template

**File**: `.specify/scripts/bash/create-pr-and-transition.sh`
**Lines**: 114-117 (within the curl command)

**Current Content**:
```bash
-d "{\"content\": \"🔀 **Pull Request Created**\\n\\nPR #${PR_NUMBER} is ready for review:\\n👉 ${PR_URL}\\n\\nThe implementation is complete and ready for code review.\"}"
```

**New Content** (Enhanced Format):
```bash
-d "{\"content\": \"✅ **Pull Request Ready for Review**\\n\\n**PR #${PR_NUMBER}**: [View Pull Request](${PR_URL})\\n\\nThe implementation is complete. Code review can now begin.\\n\\n**Next Steps**:\\n- Review the code changes\\n- Run tests to verify functionality\\n- Approve and merge when ready\"}"
```

**Changes Explained**:
1. **Title**: "Pull Request Ready for Review" (more explicit than "Pull Request Created")
2. **Icon**: ✅ (checkmark) instead of 🔀 (emphasizes completion)
3. **Link Format**: `[View Pull Request](url)` (clickable markdown link)
4. **Next Steps**: Added actionable list for reviewers
5. **Tone**: More directive ("Code review can now begin")

**Key Requirements Satisfied**:
- ✅ FR-001: Indicates PR is ready for review
- ✅ FR-002: Includes PR number in clear format
- ✅ FR-003: Markdown-formatted link
- ✅ FR-004: Explicit "ready for review" language
- ✅ FR-005: PR number handled (uses existing extraction logic)
- ✅ FR-006: Non-blocking error handling preserved

### Step 2: Handle Missing PR Number Edge Case (Optional Enhancement)

**Current Behavior**: If PR number extraction fails, `PR #${PR_NUMBER}` renders as `PR #` (empty)

**Enhancement** (if desired): Add conditional logic to handle missing PR number

**Option A**: Keep simple (use existing logic)
```bash
# PR_NUMBER will be empty string if extraction fails
# Comment will show "PR #: [View Pull Request](url)"
# This is acceptable and still functional
```

**Option B**: Add conditional format (more complex)
```bash
# Before curl command, add:
if [ -z "$PR_NUMBER" ]; then
  PR_LABEL="Pull Request"
else
  PR_LABEL="PR #${PR_NUMBER}"
fi

# Then use in content:
-d "{\"content\": \"✅ **Pull Request Ready for Review**\\n\\n**${PR_LABEL}**: [View Pull Request](${PR_URL})...\""
```

**Recommendation**: Use Option A (simpler, FR-005 satisfied by having URL)

### Step 3: Verify JSON Escaping

**Rules Applied**:
- Double quotes: `\"` (escaped)
- Newlines: `\\n` (double backslash for shell + JSON)
- Markdown bold: `**text**` (no escaping needed)
- Markdown links: `[text](url)` (no escaping needed)
- Variables: `${VAR}` (no escaping, shell substitutes)

**Validation Checklist**:
- [x] All literal double quotes escaped: `\"`
- [x] All newlines properly escaped: `\\n`
- [x] Markdown syntax preserved (bold, links)
- [x] Variables correctly referenced: `${PR_NUMBER}`, `${PR_URL}`

### Step 4: Test the Change

#### Unit Test (Manual Verification)

**Create a test script** (`test-comment-format.sh`):
```bash
#!/bin/bash

# Simulate variables
PR_NUMBER="42"
PR_URL="https://github.com/user/repo/pull/42"

# Construct JSON payload (same as script)
PAYLOAD="{\"content\": \"✅ **Pull Request Ready for Review**\\n\\n**PR #${PR_NUMBER}**: [View Pull Request](${PR_URL})\\n\\nThe implementation is complete. Code review can now begin.\\n\\n**Next Steps**:\\n- Review the code changes\\n- Run tests to verify functionality\\n- Approve and merge when ready\"}"

# Pretty print JSON
echo "$PAYLOAD" | python3 -m json.tool

# Expected output should be valid JSON with markdown content
```

**Run**: `bash test-comment-format.sh`

**Expected Output**:
```json
{
    "content": "✅ **Pull Request Ready for Review**\n\n**PR #42**: [View Pull Request](https://github.com/user/repo/pull/42)\n\nThe implementation is complete. Code review can now begin.\n\n**Next Steps**:\n- Review the code changes\n- Run tests to verify functionality\n- Approve and merge when ready"
}
```

#### E2E Test (Existing Test Suite)

**File**: `tests/e2e/workflow-integration.spec.ts`

**What to Verify**:
1. Comment is posted after PR creation
2. Comment content contains "Ready for Review"
3. Comment contains clickable markdown link
4. Comment contains PR number (when available)

**Run Tests**:
```bash
bun run test:e2e tests/e2e/workflow-integration.spec.ts
```

**If Tests Need Updates**:
- Update expected comment content matcher
- Verify markdown link format: `[View Pull Request](url)`
- Verify PR number format: `PR #42`

### Step 5: Commit and Push

**Commit Message**:
```
feat(ticket-916): enhance PR ready notification in workflow script

- Update comment template to emphasize "ready for review" status
- Use markdown link format for better UX ([View PR](url))
- Add "Next Steps" section for reviewer guidance
- Preserve non-blocking error handling (FR-006)
- Maintain backward compatibility with existing API

Resolves #916
```

**Commands**:
```bash
git add .specify/scripts/bash/create-pr-and-transition.sh
git commit -m "feat(ticket-916): enhance PR ready notification in workflow script"
git push origin 065-916-update-script
```

## Verification Checklist

After implementation, verify:

- [ ] Script syntax is valid (no bash errors)
- [ ] JSON payload is valid (test with `json.tool`)
- [ ] Markdown formatting renders correctly in UI
- [ ] PR link is clickable
- [ ] PR number displays correctly
- [ ] Error handling preserves non-blocking behavior
- [ ] E2E tests pass
- [ ] Comment posting succeeds in workflow run
- [ ] Ticket transitions to VERIFY successfully

## Rollback Plan

**If issues occur**:

1. **Immediate Rollback** (revert commit):
   ```bash
   git revert HEAD
   git push origin 065-916-update-script
   ```

2. **Restore Original** (manual edit):
   - Restore lines 114-117 to original content
   - Original: `🔀 **Pull Request Created**\n\nPR #${PR_NUMBER} is ready for review:\n👉 ${PR_URL}\n\nThe implementation is complete and ready for code review.`

3. **Known Safe State**: Commit `fb72762` (before this feature)

## Success Criteria

Feature is complete when:

1. ✅ Comment template updated with new format
2. ✅ JSON escaping validated (test script passes)
3. ✅ E2E tests pass (workflow-integration.spec.ts)
4. ✅ Manual workflow run posts enhanced comment
5. ✅ Comment renders correctly in ticket UI
6. ✅ PR link is clickable
7. ✅ All functional requirements (FR-001 through FR-006) satisfied

## Troubleshooting

### Issue: JSON parsing error in curl

**Symptom**: curl fails with "Invalid JSON" error

**Fix**: Check escaping rules
- Ensure all `"` are escaped as `\"`
- Ensure all newlines are `\\n` (double backslash)
- Test JSON with: `echo "$PAYLOAD" | python3 -m json.tool`

### Issue: Markdown not rendering

**Symptom**: Comment shows raw markdown syntax (e.g., `**text**` instead of bold)

**Diagnosis**: This is a UI rendering issue, not a script issue

**Fix**: Verify API endpoint receives correct markdown content (check network logs)

### Issue: Comment not posted

**Symptom**: Workflow completes but no comment appears

**Diagnosis**: Check workflow logs for curl error
- Verify `WORKFLOW_API_TOKEN` is set
- Check API endpoint URL is correct
- Verify ticket ID and project ID are valid

**Expected Behavior**: Script continues even if comment fails (non-blocking)

### Issue: PR number shows as "PR #"

**Symptom**: Comment shows "PR #: [link]" instead of "PR #42: [link]"

**Root Cause**: PR number extraction failed (line 108)

**Diagnosis**: Check `gh pr view` command output in logs

**Fix**: This is acceptable per FR-005 (URL is sufficient). If needed, implement Option B from Step 2.

## References

- **Feature Spec**: `specs/065-916-update-script/spec.md`
- **Research Notes**: `specs/065-916-update-script/research.md`
- **Implementation Plan**: `specs/065-916-update-script/plan.md`
- **Script Location**: `.specify/scripts/bash/create-pr-and-transition.sh`
- **API Endpoint**: `app/api/projects/[projectId]/tickets/[id]/comments/route.ts`
- **E2E Tests**: `tests/e2e/workflow-integration.spec.ts`
