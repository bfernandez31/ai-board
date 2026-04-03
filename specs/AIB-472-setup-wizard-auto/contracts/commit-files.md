# API Contract: Commit Setup Files

**Endpoint**: `POST /api/projects/[projectId]/setup/commit`
**Auth**: Session (requireAuth) + verifyProjectAccess
**Purpose**: Commit generated configuration files to the project's GitHub repository and sync config to database.

---

## Request

```typescript
POST /api/projects/{projectId}/setup/commit

interface CommitRequest {
  files: Array<{
    path: string;           // File path: '.ai-board/config.yml' | 'CLAUDE.md' | '.ai-board/constitution.md'
    content: string;        // Final file content (after user edits)
    sha?: string;           // Existing file SHA (for updates); omit for new files
  }>;
  defaultBranch: string;    // Branch to commit to (from detect response)
}
```

### Validation

- `files` must contain 1-3 entries (user may skip some)
- `path` must be one of the 3 allowed paths
- `content` must be non-empty string
- `defaultBranch` must be non-empty string

## Response (200 OK)

```typescript
interface CommitResponse {
  commitSha: string;        // SHA of the created commit
  commitUrl: string;        // GitHub URL to the commit
  syncResult: {
    success: boolean;
    warnings: string[];     // Config validation warnings (if any)
  };
}
```

## Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | User not project owner/member |
| 404 | `PROJECT_NOT_FOUND` | Invalid projectId |
| 409 | `SHA_MISMATCH` | Existing file changed since detection (concurrent edit) |
| 422 | `BRANCH_PROTECTED` | Branch protection prevents direct commit |
| 422 | `INSUFFICIENT_PERMISSIONS` | Token lacks write access |
| 502 | `GITHUB_ERROR` | GitHub API unreachable |

## Notes

- Uses GitHub Git Data API (createTree + createCommit + updateRef) for atomic multi-file commit
- Commit message: `chore: initialize ai-board configuration`
- After successful commit, triggers `syncProjectConfig()` to store config in database
- Uses `createUserGitHubClient()` for write access via user's OAuth token
- On 409 (SHA mismatch), client should re-run detection to get fresh SHAs
