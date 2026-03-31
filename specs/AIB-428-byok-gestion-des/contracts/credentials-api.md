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
      "isValid": true,
      "lastValidatedAt": "2026-03-31T10:00:00Z",
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
2. Validate credential format (provider-specific regex)
3. Validate credential against provider API (server-side call)
4. Encrypt value with AES-256-GCM
5. Upsert into UserCredential (unique on userId + provider)
6. Return created/updated credential metadata (no encrypted value)

**Response 201** (created) / **200** (replaced):
```json
{
  "id": 1,
  "provider": "ANTHROPIC",
  "credentialType": "API_KEY",
  "label": "My production key",
  "preview": "ab12",
  "isValid": true,
  "lastValidatedAt": "2026-03-31T10:00:00Z",
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

Re-validate an existing credential against the provider API without modifying it.

**Request body**: None

**Server-side behavior**:
1. Fetch credential by id (verify ownership)
2. Decrypt credential value
3. Call provider API to validate
4. Update `isValid` and `lastValidatedAt` fields
5. Return validation result

**Response 200**:
```json
{
  "isValid": true,
  "lastValidatedAt": "2026-03-31T12:00:00Z"
}
```

**Response 200** (invalid key):
```json
{
  "isValid": false,
  "error": "Key rejected by provider",
  "lastValidatedAt": "2026-03-31T12:00:00Z"
}
```

**Response 200** (provider unreachable):
```json
{
  "isValid": null,
  "error": "Provider unreachable — try again later",
  "lastValidatedAt": null
}
```

**Response 401**: `{ "error": "Unauthorized" }`
**Response 404**: `{ "error": "Credential not found" }`
