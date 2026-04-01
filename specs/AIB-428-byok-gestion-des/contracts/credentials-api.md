# API Contract: User Credential Management

**Base path**: `/api/credentials`
**Auth**: Session (NextAuth) or PAT (Bearer token)

---

## GET /api/credentials

List the authenticated user's credentials. Never returns encrypted values.

**Response 200**:
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

**Response 401**: `{ "error": "Unauthorized" }`

---

## POST /api/credentials

Create or replace a credential for the given provider. If a credential already exists for the same provider, it is replaced (upsert).

**Request body** (Zod schema):
```json
{
  "provider": "ANTHROPIC",
  "credentialType": "API_KEY",
  "label": "My production key",
  "value": "sk-ant-api03-..."
}
```

| Field | Type | Validation |
|-------|------|-----------|
| `provider` | `CredentialProvider` enum | Required, must be valid enum |
| `credentialType` | `CredentialType` enum | Required, must be valid enum |
| `label` | `string` | Required, 1-100 chars trimmed |
| `value` | `string` | Required, format validated per provider+type |

**Server-side behavior**:
1. Validate input format (Zod)
2. Validate credential format (provider-specific regex via `lib/ai-credentials/providers/anthropic.ts`)
3. Validate credential against provider API (server-side call)
4. Encrypt value with AES-256-GCM (via `lib/ai-credentials/crypto.ts`)
5. Upsert into UserCredential with `readinessStatus: READY` if verification succeeds (via `lib/ai-credentials/service.ts`)
6. Return created/updated credential metadata (no encrypted value)

**Response 201** (created) / **200** (replaced):
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

**Response 400**: `{ "error": "Invalid Anthropic API key format" }`
**Response 401**: `{ "error": "Unauthorized" }`
**Response 422**: `{ "error": "Credential validation failed: invalid key", "code": "INVALID_KEY" }`
**Response 422**: `{ "error": "Unable to validate credential: provider unreachable", "code": "PROVIDER_UNREACHABLE" }`

---

## DELETE /api/credentials/[id]

Delete a credential. Only the owning user can delete.

**Response 204**: No content (success)
**Response 401**: `{ "error": "Unauthorized" }`
**Response 404**: `{ "error": "Credential not found" }`

---

## POST /api/credentials/[id]/test

Re-validate an existing credential against the provider API without modifying the credential value.

**Request body**: None

**Server-side behavior**:
1. Fetch credential by id (verify ownership)
2. Decrypt credential value (via `lib/ai-credentials/crypto.ts`)
3. Call provider API to validate (via `lib/ai-credentials/providers/anthropic.ts`)
4. Update `readinessStatus`, `lastVerifiedAt`, `verificationCode`, and `verificationMessage` fields
5. Return validation result

**Response 200** (valid key):
```json
{
  "readinessStatus": "READY",
  "lastVerifiedAt": "2026-03-31T12:00:00Z",
  "verificationCode": "VALID",
  "verificationMessage": null
}
```

**Response 200** (invalid key):
```json
{
  "readinessStatus": "ACTION_REQUIRED",
  "lastVerifiedAt": "2026-03-31T12:00:00Z",
  "verificationCode": "INVALID_KEY",
  "verificationMessage": "Your API key was rejected by Anthropic. Please verify the key in your Anthropic console and replace it."
}
```

**Response 200** (expired key):
```json
{
  "readinessStatus": "ACTION_REQUIRED",
  "lastVerifiedAt": "2026-03-31T12:00:00Z",
  "verificationCode": "EXPIRED",
  "verificationMessage": "Your API key has expired. Please generate a new key in the Anthropic console."
}
```

**Response 200** (provider unreachable):
```json
{
  "readinessStatus": "ACTION_REQUIRED",
  "lastVerifiedAt": null,
  "verificationCode": "UNREACHABLE",
  "verificationMessage": "Unable to reach Anthropic to verify your key. Please try again later."
}
```

**Response 401**: `{ "error": "Unauthorized" }`
**Response 404**: `{ "error": "Credential not found" }`
