# Contracts: Code Simplifier and PR Review

**Branch**: `AIB-169-add-code-simplifier` | **Date**: 2026-01-21

## No New API Contracts

This feature does not introduce new API endpoints. It uses existing infrastructure:

### Existing Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects/:projectId/tickets/:ticketId/comments/ai-board` | POST | Post PR review comment |
| `/api/jobs/:id/status` | PATCH | Update job status during workflow |

### Command Interfaces (Internal)

The commands are invoked via Claude Code CLI:

```bash
# Code Simplifier - invoked after test fixes commit
claude --dangerously-skip-permissions "/code-simplifier --branch ${BRANCH}"

# Code Review - invoked after PR creation
claude --dangerously-skip-permissions "/code-review --pr-url ${PR_URL} --pr-number ${PR_NUMBER}"
```

### GitHub CLI Integration

PR comments are posted using `gh`:

```bash
# Post review comment to PR
gh pr comment ${PR_NUMBER} --body "$(cat review-comment.md)"
```

## Contract Validation

Since no new API contracts are introduced, validation focuses on:

1. **Command invocation syntax** - Verified against existing command patterns
2. **Environment variable availability** - `BRANCH`, `PR_URL`, `PR_NUMBER` set by workflow
3. **API endpoint availability** - Existing endpoints already tested
