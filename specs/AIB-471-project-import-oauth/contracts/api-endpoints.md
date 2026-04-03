# API Contracts: Project Import

**Ticket**: AIB-471
**Date**: 2026-04-02

---

## GET /api/github/auth-status

Check whether the current user has a GitHub account with `repo` scope.

**Auth**: Session cookie (required)

**Response 200**:
```json
{
  "hasGitHubAccount": true,
  "hasRepoScope": true
}
```

**Response 200 (needs re-auth)**:
```json
{
  "hasGitHubAccount": true,
  "hasRepoScope": false
}
```

**Response 200 (no GitHub account)**:
```json
{
  "hasGitHubAccount": false,
  "hasRepoScope": false
}
```

**Response 401**: Unauthenticated.

---

## GET /api/github/repos

List GitHub repositories accessible to the authenticated user.

**Auth**: Session cookie (required)

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `per_page` | number | 30 | Items per page (max 100) |
| `sort` | string | `"pushed"` | Sort: `pushed`, `updated`, `full_name` |
| `type` | string | `"all"` | Filter: `all`, `owner`, `member` |
| `org` | string | — | Filter by organization login |
| `q` | string | — | Search query (uses GitHub Search API) |

**Response 200**:
```json
{
  "repos": [
    {
      "id": 123456,
      "name": "my-app",
      "fullName": "octocat/my-app",
      "owner": "octocat",
      "ownerAvatar": "https://avatars.githubusercontent.com/u/1?v=4",
      "description": "My awesome app",
      "isPrivate": false,
      "pushedAt": "2026-03-28T12:00:00Z",
      "hasAdminAccess": true,
      "isAlreadyImported": false,
      "existingProjectId": null
    }
  ],
  "totalCount": 42,
  "page": 1,
  "perPage": 30,
  "hasNextPage": true
}
```

**Response 401**: Unauthenticated.
**Response 403**: `{ "error": "GitHub token lacks repo scope", "code": "MISSING_SCOPE" }`
**Response 502**: `{ "error": "GitHub API error", "code": "GITHUB_ERROR" }`
**Response 429**: `{ "error": "GitHub rate limit exceeded. Resets at {time}.", "code": "RATE_LIMITED", "resetAt": "2026-04-02T12:30:00Z" }`

---

## GET /api/github/orgs

List organizations the authenticated user belongs to.

**Auth**: Session cookie (required)

**Response 200**:
```json
{
  "orgs": [
    {
      "login": "my-org",
      "avatarUrl": "https://avatars.githubusercontent.com/u/2?v=4"
    }
  ]
}
```

**Response 401**: Unauthenticated.
**Response 403**: `{ "error": "GitHub token lacks repo scope", "code": "MISSING_SCOPE" }`

---

## POST /api/projects/import

Import a GitHub repository as a new ai-board project.

**Auth**: Session cookie (required)

**Request Body**:
```json
{
  "githubOwner": "octocat",
  "githubRepo": "my-app",
  "name": "My App",
  "description": "My awesome app"
}
```

| Field | Required | Default |
|-------|----------|---------|
| `githubOwner` | Yes | — |
| `githubRepo` | Yes | — |
| `name` | No | Repository name |
| `description` | No | Repository description or `""` |

**Response 201**:
```json
{
  "project": {
    "id": 5,
    "name": "My App",
    "key": "MYA",
    "githubOwner": "octocat",
    "githubRepo": "my-app",
    "hasConfig": true
  },
  "redirectTo": "/projects/5"
}
```

**Response 201 (no config)**:
```json
{
  "project": {
    "id": 5,
    "name": "My App",
    "key": "MYA",
    "githubOwner": "octocat",
    "githubRepo": "my-app",
    "hasConfig": false
  },
  "redirectTo": "/projects/5/setup"
}
```

**Response 400**: `{ "error": "Validation error", "code": "VALIDATION_ERROR" }`
**Response 401**: Unauthenticated.
**Response 403 (quota)**: `{ "error": "Project limit reached. Your FREE plan allows 1 project(s). Upgrade to create more.", "code": "PLAN_LIMIT" }`
**Response 403 (no admin)**: `{ "error": "You need admin access to this repository to import it.", "code": "INSUFFICIENT_PERMISSIONS" }`
**Response 403 (no scope)**: `{ "error": "GitHub token lacks repo scope", "code": "MISSING_SCOPE" }`
**Response 409**: `{ "error": "This repository is already linked to project \"Existing Project\" (KEY-123).", "code": "DUPLICATE_REPO", "existingProjectId": 3 }`
**Response 502**: `{ "error": "GitHub API error", "code": "GITHUB_ERROR" }`
