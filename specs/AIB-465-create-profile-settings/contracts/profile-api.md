# API Contract: GET /api/settings/profile

**Feature**: AIB-465 | **Date**: 2026-04-01

## Endpoint

```
GET /api/settings/profile
```

## Authentication

Required. Uses `requireAuth()` from `lib/db/users.ts`. Supports session-based auth (NextAuth) and Bearer token (PAT).

## Request

No request body or query parameters.

## Response

### 200 OK — Success

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "image": "https://avatars.githubusercontent.com/u/12345",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "githubUsername": "johndoe",
  "githubUrl": "https://github.com/johndoe",
  "plan": "FREE"
}
```

**Field details**:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | User display name from GitHub OAuth. Null if GitHub profile has no name. |
| `email` | string | No | User email (always present, required at registration). |
| `image` | string | Yes | GitHub avatar URL. Null if not provided by GitHub. |
| `createdAt` | string | No | ISO 8601 datetime of account creation. |
| `githubUsername` | string | Yes | GitHub login name, resolved server-side. Null if GitHub API call fails. |
| `githubUrl` | string | Yes | Full URL to GitHub profile. Null if username resolution fails. |
| `plan` | string | No | One of: `"FREE"`, `"PRO"`, `"TEAM"`. Defaults to `"FREE"` if no subscription record. |

### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

Returned when no valid session or Bearer token is provided.

### 500 Internal Server Error

```json
{
  "error": "Failed to load profile"
}
```

Returned on unexpected server errors (database failure, etc.). GitHub API failures are handled gracefully — `githubUsername` and `githubUrl` return as `null` rather than causing a 500.

## Implementation Notes

- GitHub username is resolved via `GET https://api.github.com/user` with the stored `access_token` from the Account record
- If the GitHub API call fails (expired token, rate limit, network error), the endpoint still returns 200 with `githubUsername: null` and `githubUrl: null`
- Subscription defaults to `FREE` plan when no Subscription record exists for the user
- No caching headers — data should reflect current state on each request
