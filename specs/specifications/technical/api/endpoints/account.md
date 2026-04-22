# Account, Settings, Token & Credential Endpoints

## Settings Endpoints

### GET /api/settings/profile

Fetches the authenticated user's profile data for the settings page.

**Authentication**: Required (session or Bearer PAT)

**Response** (200 OK):
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

**Field Descriptions**:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `name` | string | No | Display name; falls back to GitHub username, then "Unknown" |
| `email` | string | No | User's email address; "Not available" if null |
| `image` | string | Yes | GitHub avatar URL; null if not set |
| `githubUsername` | string | Yes | GitHub login; null if GitHub API call fails |
| `githubProfileUrl` | string | Yes | Full GitHub profile URL; null if username unavailable |
| `createdAt` | string (ISO 8601) | No | Account creation timestamp |
| `plan` | string | No | Subscription plan: `"FREE"`, `"PRO"`, or `"TEAM"` |

**Notes**:
- GitHub username is resolved server-side via `GET https://api.github.com/user/{providerAccountId}` using the stored OAuth access token
- If the GitHub API is unreachable or the token is invalid, `githubUsername` and `githubProfileUrl` return `null` — the page displays a graceful fallback
- Missing subscription record defaults to `"FREE"`

**Error Responses**:

| Status | Body | Condition |
|--------|------|-----------|
| `401` | `{ "error": "Unauthorized" }` | No valid session or token |
| `500` | `{ "error": "Internal server error" }` | Server-side failure |

---


## Account Endpoints

### GET /api/account/summary

Fetches counts of the authenticated user's data for the delete-account confirmation modal.

**Authentication**: Required (session)

**Response** (200 OK):
```json
{
  "projectCount": 5,
  "credentialCount": 2,
  "tokenCount": 3,
  "hasActiveSubscription": true,
  "plan": "PRO"
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `projectCount` | number | Number of projects owned by the user |
| `credentialCount` | number | Number of AI credentials stored for the user |
| `tokenCount` | number | Number of personal access tokens for the user |
| `hasActiveSubscription` | boolean | `true` when the user has an `active` or `trialing` subscription |
| `plan` | string | Current subscription plan: `"FREE"`, `"PRO"`, or `"TEAM"` |

**Error Responses**:

| Status | Body | Condition |
|--------|------|-----------|
| `401` | `{ "error": "Unauthorized" }` | No valid session |

---

### DELETE /api/account

Permanently deletes the authenticated user's account and all associated data.

**Authentication**: Required (session)

**Request Body**: None — user is identified by the active session.

**Processing Order**:
1. Authenticate the user via session.
2. Attempt to cancel any active Stripe subscription. If cancellation fails, the error is captured and held.
3. Delete the `User` record — Prisma cascade deletes all related records (projects, tickets, comments, credentials, tokens, notifications, push subscriptions, sessions, subscription). This step always runs to satisfy GDPR right-to-erasure, even when Stripe cancellation failed.
4. If Stripe cancellation failed (step 2), throw a `StripeCleanupError` (with the original error as `cause`). The API handler catches this and returns a `500` response.
5. Otherwise, return success — the client calls `signOut()` and redirects to the landing page.

**Response** (200 OK):
```json
{ "message": "Account deleted successfully" }
```

**Error Responses**:

| Status | Body | Condition |
|--------|------|-----------|
| `401` | `{ "error": "Unauthorized" }` | No valid session |
| `500` | `{ "error": "Failed to delete account" }` | Server-side failure during deletion |

---


## Token Endpoints

### GET /api/tokens

List all personal access tokens for the authenticated user.

**Authentication**: Required (session or PAT)

**Response** (200 OK):
```json
{
  "tokens": [
    {
      "id": 1,
      "name": "CI Pipeline",
      "preview": "ab12",
      "lastUsedAt": "2025-01-20T09:00:00.000Z",
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated
- `500`: Database error

### POST /api/tokens

Create a new personal access token.

**Authentication**: Required (session or PAT)

**Request Body**:
```json
{
  "name": "CI Pipeline"
}
```

**Validation**:
- `name`: Required, 1-100 characters

**Response** (201 Created):
```json
{
  "id": 1,
  "name": "CI Pipeline",
  "token": "aib_xxxxxxxxxxxx",
  "preview": "ab12",
  "createdAt": "2025-01-20T09:00:00.000Z"
}
```

**Note**: The full `token` value is returned only once at creation. It cannot be retrieved again.

**Errors**:
- `400`: Invalid token name (Zod validation)
- `401`: Not authenticated
- `500`: Database error

### DELETE /api/tokens/:id

Delete (revoke) a personal access token.

**Authentication**: Required (session or PAT)

**Path Parameters**:
- `id` (number, required): Token ID

**Response** (200 OK):
```json
{
  "message": "Token deleted successfully"
}
```

**Errors**:
- `400`: Invalid token ID
- `401`: Not authenticated
- `404`: Token not found (or not owned by user)
- `500`: Database error


## Credential Endpoints

### GET /api/credentials

List the authenticated user's AI provider credentials. Encrypted values are never returned.

**Authentication**: Required (session or PAT)

**Response** (200 OK):
```json
{
  "credentials": [
    {
      "id": 1,
      "provider": "ANTHROPIC",
      "credentialType": "API_KEY",
      "label": "My production key",
      "preview": "ab12",
      "readinessStatus": "READY",
      "lastVerifiedAt": "2026-03-31T10:00:00Z",
      "verificationCode": "VALID",
      "verificationMessage": null,
      "createdAt": "2026-03-31T09:00:00Z",
      "updatedAt": "2026-03-31T10:00:00Z"
    }
  ]
}
```

**Errors**:
- `401`: Not authenticated

### POST /api/credentials

Create or replace a credential for the given provider. If a credential already exists for that provider, it is replaced (upsert). The credential is validated against the provider API before storage.

**Authentication**: Required (session or PAT)

**Request Body**:
```json
{
  "provider": "ANTHROPIC",
  "credentialType": "API_KEY",
  "label": "My production key",
  "value": "sk-ant-api03-..."
}
```

**Validation**:
- `provider`: Required, valid `CredentialProvider` enum value
- `credentialType`: Required, valid `CredentialType` enum value
- `label`: Required, 1–100 characters
- `value`: Required, format validated per provider and type (e.g., `/^sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}$/` for Anthropic API keys; `sk-` prefix + minimum 20 characters for OpenAI API keys)
- `credentialType`: Both `API_KEY` and `OAUTH_TOKEN` are supported for all providers. `OAUTH_TOKEN` credentials skip live provider verification (format-only validation)

**Server-side behavior**:
1. Validate input format (Zod)
2. Validate credential format (provider-specific regex)
3. Validate credential against provider API
4. Encrypt value with AES-256-GCM
5. Upsert into `UserCredential` with `readinessStatus: READY`
6. Return metadata (no encrypted value)

**Response** (201 Created / 200 OK on replace):
```json
{
  "id": 1,
  "provider": "ANTHROPIC",
  "credentialType": "API_KEY",
  "label": "My production key",
  "preview": "ab12",
  "readinessStatus": "READY",
  "lastVerifiedAt": "2026-03-31T10:00:00Z",
  "verificationCode": "VALID",
  "verificationMessage": null,
  "createdAt": "2026-03-31T09:00:00Z",
  "updatedAt": "2026-03-31T10:00:00Z"
}
```

**Errors**:
- `400`: Invalid credential format (`{ "error": "Invalid <Provider> API key format" }`)
- `401`: Not authenticated
- `422`: Provider validation failed — `{ "error": "...", "code": "INVALID_KEY" }` or `{ "error": "...", "code": "PROVIDER_UNREACHABLE" }`

### DELETE /api/credentials/:id

Delete a credential. Only the owning user can delete.

**Authentication**: Required (session or PAT)

**Path Parameters**:
- `id` (number, required): Credential ID

**Response** (204 No Content)

**Errors**:
- `401`: Not authenticated
- `404`: Credential not found or not owned by user

### POST /api/credentials/:id/test

Re-validate an existing credential against the provider API without modifying the credential value. Updates `readinessStatus`, `lastVerifiedAt`, `verificationCode`, and `verificationMessage`.

**Authentication**: Required (session or PAT)

**Path Parameters**:
- `id` (number, required): Credential ID

**Response** (200 OK):
```json
{
  "readinessStatus": "READY",
  "lastVerifiedAt": "2026-03-31T12:00:00Z",
  "verificationCode": "VALID",
  "verificationMessage": null
}
```

Possible `verificationCode` values: `VALID`, `INVALID_KEY`, `EXPIRED`, `UNREACHABLE`, `RATE_LIMITED`

**Errors**:
- `401`: Not authenticated
- `404`: Credential not found or not owned by user

### GET /api/internal/credentials

Internal endpoint called by GitHub Actions workflows to retrieve the decrypted credential for a project's owner. Not accessible to regular users.

**Authentication**: Workflow token only (`Authorization: Bearer ${WORKFLOW_API_TOKEN}`)

**Query Parameters**:
- `projectId` (positive integer, required): Project ID to resolve owner credential
- `provider` (string, optional): Credential provider to resolve — `ANTHROPIC` or `OPENAI` (defaults to `ANTHROPIC` for backward compatibility)

**Server-side behavior**:
1. Verify workflow token
2. Validate `projectId` (positive integer) and `provider` (enum: `ANTHROPIC` | `OPENAI`) via Zod schema; reject unknown providers with 400
3. Look up project → get owner `userId`
4. Find `UserCredential` for owner matching the requested `provider`
5. Decrypt credential with AES-256-GCM
6. Base64-encode the decrypted secret value
7. Return env var name and encoded value with no-cache headers

**Response** (200 OK):
```json
{
  "envVar": "ANTHROPIC_API_KEY",
  "value": "<base64-encoded-secret>",
  "encoding": "base64",
  "credentialType": "API_KEY"
}
```

The `envVar` field reflects the resolved provider and type: `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, or `OPENAI_API_KEY`. The `value` field is always base64-encoded. Callers must decode it before use (e.g., `echo "$VALUE" | base64 -d`). The response includes `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` headers to prevent credential caching.

**Errors**:
- `400`: `{ "error": "Invalid query parameters", "details": { ... } }` — invalid `projectId` or unrecognized `provider` value
- `401`: Missing or invalid workflow token
- `404`: `{ "error": "No <Provider> credential configured for project owner. Please add your <Provider> key in Settings → AI Credentials." }`

### PUT /api/internal/credentials

Internal endpoint called by GitHub Actions workflows to update (re-encrypt) an existing credential for a project's owner. Not accessible to regular users.

**Authentication**: Workflow token only (`Authorization: Bearer ${WORKFLOW_API_TOKEN}`)

**Request Body** (JSON):
- `projectId` (positive integer, required): Project ID to resolve owner credential
- `provider` (string, required): Credential provider — `ANTHROPIC` or `OPENAI`
- `value` (string, required): New credential value
- `encoding` (string, optional): Encoding of the `value` field — `base64` or `plain` (defaults to `base64`)

**Server-side behavior**:
1. Verify workflow token
2. Validate request body via Zod schema (`projectId`, `provider`, `value`, `encoding`)
3. Decode value if base64-encoded
4. Look up project → get owner `userId`
5. Find existing `UserCredential` for owner matching the requested `provider`
6. Re-encrypt plaintext with AES-256-GCM and update the credential record
7. Return success with no-cache headers

**Response** (200 OK):
```json
{
  "ok": true
}
```

The response includes `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` headers.

**Errors**:
- `400`: `{ "error": "Invalid request body", "details": { ... } }` — missing or invalid fields
- `401`: Missing or invalid workflow token
- `404`: `{ "error": "No existing credential found to update" }` — no matching project or credential
- `500`: `{ "error": "Failed to update credential" }` — malformed JSON body or unexpected server error

### GET /api/internal/github-token

Internal endpoint called by GitHub Actions workflows to retrieve the project owner's GitHub OAuth access token. Used for clone/push operations on repos owned by the project owner (especially external repos). Not accessible to regular users.

**Authentication**: Workflow token only (`Authorization: Bearer ${WORKFLOW_API_TOKEN}`)

**Query Parameters**:
- `projectId` (positive integer, required): Project ID to resolve owner's GitHub token

**Server-side behavior**:
1. Verify workflow token
2. Validate `projectId` (positive integer) via Zod schema
3. Look up project → get owner `userId`
4. Find `Account` record for owner with `provider: 'github'`
5. Verify the account's OAuth scope includes `repo`
6. Base64-encode the access token
7. Return encoded token with no-cache headers

**Response** (200 OK):
```json
{
  "token": "<base64-encoded-github-token>",
  "encoding": "base64"
}
```

The `token` field is base64-encoded. Callers must decode before use (e.g., `echo "$TOKEN" | base64 -d`). The response includes `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` headers.

**Security considerations**:
- The token is stored as a **step output** (not `GITHUB_ENV`) in workflows, so it is never exposed as an environment variable to LLM/agent steps
- After cloning, the authenticated remote URL is stripped from `.git/config` and only re-injected momentarily for push
- The `repo` scope check ensures only tokens with write access are returned (users must re-authorize with `repo` scope during project import)

**Errors**:
- `400`: `{ "error": "Invalid query parameters", "details": { ... } }` — invalid `projectId`
- `401`: Missing or invalid workflow token
- `403`: `{ "error": "Owner GitHub token lacks repo scope" }` — token exists but missing `repo` scope
- `404`: `{ "error": "Project not found" }` or `{ "error": "No GitHub access token found for project owner" }`

---

