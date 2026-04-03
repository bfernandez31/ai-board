# API Contract: Detect Repository Stack

**Endpoint**: `POST /api/projects/[projectId]/setup/detect`
**Auth**: Session (requireAuth) + verifyProjectAccess
**Purpose**: Analyze a GitHub repository to detect tech stack for wizard pre-fill.

---

## Request

```
POST /api/projects/{projectId}/setup/detect
```

No request body — detection is based on the project's linked GitHub repo.

## Response (200 OK)

```typescript
interface DetectResponse {
  detection: {
    language: string | null;       // Config schema Language enum value
    framework: string | null;      // Config schema Framework enum value
    manager: string | null;        // Config schema PackageManager enum value
    managerVersion: string | null;
    runtimeVersion: string | null;
    services: Array<{
      type: string;                // 'postgres' | 'redis' | 'mysql' | 'mongo'
      version: string | null;
    }>;
    testFrameworks: string[];      // e.g., ['vitest', 'playwright']
    commands: Record<string, string>;  // e.g., { build: 'npm run build' }
  };
  existingFiles: Array<{
    path: string;                  // e.g., '.ai-board/config.yml'
    content: string;               // Decoded file content
    sha: string;                   // Git blob SHA
  }>;
  defaultBranch: string;           // e.g., 'main'
  warnings: string[];              // e.g., ['Rate limit: some detections skipped']
}
```

## Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | User not project owner/member |
| 404 | `PROJECT_NOT_FOUND` | Invalid projectId |
| 502 | `GITHUB_ERROR` | GitHub API unreachable or token invalid |

## Notes

- All detection fields are optional — partial results are normal
- Uses `createUserGitHubClient()` for private repo access
- Runs detection queries in parallel via `Promise.allSettled`
- Existing files include only the 3 target paths that exist in the repo
