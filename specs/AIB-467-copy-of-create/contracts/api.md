# API Contract: Profile Settings Page (AIB-467)

## GET /api/settings/profile

Fetches the authenticated user's profile data for the settings page.

### Authentication
- Session cookie (NextAuth) OR Bearer token (PAT)
- Returns 401 if not authenticated

### Response: 200 OK

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "image": "https://avatars.githubusercontent.com/u/12345?v=4",
  "githubUsername": "johndoe",
  "githubProfileUrl": "https://github.com/johndoe",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "plan": "FREE"
}
```

### Field Descriptions

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `name` | string | No | Display name; falls back to GitHub username, then "Unknown" |
| `email` | string | No | User's email address |
| `image` | string | Yes | GitHub avatar URL; null if not set |
| `githubUsername` | string | Yes | GitHub login; null if API call fails |
| `githubProfileUrl` | string | Yes | Full GitHub profile URL; null if username unavailable |
| `createdAt` | string (ISO 8601) | No | Account creation timestamp |
| `plan` | string | No | Subscription plan: "FREE", "PRO", or "TEAM" |

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "Unauthorized" }` | No valid session or token |
| 500 | `{ "error": "Internal server error" }` | Server-side failure |

### Notes
- GitHub username is fetched server-side via GitHub API using stored OAuth access token
- If GitHub API is unreachable, `githubUsername` and `githubProfileUrl` return null
- Missing subscription defaults to "FREE" plan
