# API Contracts: Credential Endpoints (Updated for OpenAI)

## POST /api/credentials — Create or Replace Credential

### Request

```json
{
  "provider": "ANTHROPIC" | "OPENAI",
  "credentialType": "API_KEY" | "OAUTH_TOKEN",
  "label": "string (1-100 chars, trimmed)",
  "value": "string (credential secret)"
}
```

**Validation constraints**:
- `provider`: Required. One of `ANTHROPIC`, `OPENAI`.
- `credentialType`: Required. Must be allowed for the given provider:
  - ANTHROPIC: `API_KEY` or `OAUTH_TOKEN`
  - OPENAI: `API_KEY` only
- `label`: Required, 1-100 chars after trim.
- `value`: Required, non-empty.

### Response (201 Created / 200 Replaced)

```json
{
  "id": 1,
  "provider": "OPENAI",
  "credentialType": "API_KEY",
  "label": "My OpenAI Key",
  "preview": "ab1c",
  "readinessStatus": "READY",
  "lastVerifiedAt": "2026-04-04T...",
  "verificationCode": "VALID",
  "verificationMessage": null,
  "createdAt": "2026-04-04T...",
  "updatedAt": "2026-04-04T..."
}
```

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid provider, type, label, or format | `{ "error": "..." }` |
| 400 | OPENAI + OAUTH_TOKEN | `{ "error": "OPENAI provider only supports API_KEY credential type" }` |
| 401 | Unauthenticated | `{ "error": "Unauthorized" }` |
| 422 | Live verification failed (invalid key) | `{ "error": "Credential validation failed: ...", "code": "INVALID_KEY" }` |
| 422 | Provider unreachable | `{ "error": "Unable to validate credential: provider unreachable", "code": "PROVIDER_UNREACHABLE" }` |

---

## GET /api/internal/credentials — Workflow Credential Fetch

### Request

```
GET /api/internal/credentials?projectId=1&provider=OPENAI
Authorization: Bearer <WORKFLOW_API_TOKEN>
```

**Query params**:
- `projectId` (required): Positive integer
- `provider` (optional): `ANTHROPIC` | `OPENAI`. Defaults to `ANTHROPIC` for backward compatibility.

### Response (200 OK)

```json
{
  "envVar": "OPENAI_API_KEY",
  "value": "<base64-encoded-secret>",
  "encoding": "base64",
  "credentialType": "API_KEY"
}
```

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing/invalid projectId | `{ "error": "projectId is required..." }` |
| 401 | Invalid workflow token | `{ "error": "Unauthorized" }` |
| 404 | No credential for provider | `{ "error": "No OPENAI credential configured for project owner. Please add your OpenAI key in Settings." }` |

---

## POST /api/credentials/[id]/test — Re-verify Credential

No contract changes. Existing endpoint already routes through provider-specific verification based on the stored credential's `provider` field. OpenAI credentials will automatically use the OpenAI verification module.

---

## DELETE /api/credentials/[id] — Delete Credential

No contract changes. Provider-agnostic.
