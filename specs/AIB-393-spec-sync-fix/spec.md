# [Spec Sync] Fix security issues: IDOR on docs endpoints + timing attack on workflow auth

## Description

Health scan found 3 security vulnerabilities across 2 severity levels.

### MEDIUM — IDOR on documentation endpoints (2 issues)

The documentation diff and history endpoints (`/api/projects/:projectId/docs/diff` and `/api/projects/:projectId/docs/history`) use `getProjectById()` instead of `verifyProjectAccess()`. Any authenticated user can access any project's documentation diffs and commit history.

### LOW — Timing attack on workflow token comparison (1 issue)

The workflow token comparison in `workflow-auth.ts` uses `===` instead of constant-time comparison.

## Acceptance Criteria

- Docs diff endpoint rejects requests from non-members/non-owners
- Docs history endpoint rejects requests from non-members/non-owners
- Workflow token uses constant-time comparison
- Existing tests updated to verify access control on docs endpoints
