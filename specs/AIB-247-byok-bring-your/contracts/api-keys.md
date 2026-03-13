# API Contracts: BYOK API Keys

**Date**: 2026-03-13 | **Branch**: `AIB-247-byok-bring-your`

## Endpoints

### GET /api/projects/:projectId/api-keys

**Description**: List configured API keys for a project (masked).
**Authorization**: `verifyProjectAccess(projectId)` — Owner or member.

**Response 200**:
```json
{
  "keys": [
    {
      "provider": "ANTHROPIC",
      "preview": "a1b2",
      "configured": true,
      "updatedAt": "2026-03-13T10:00:00Z"
    },
    {
      "provider": "OPENAI",
      "preview": null,
      "configured": false,
      "updatedAt": null
    }
  ]
}
```

**Response 401**: `{ "error": "Unauthorized" }`
**Response 403**: `{ "error": "Access denied" }`

**Notes**:
- Always returns both providers with `configured` boolean
- Never returns the full or encrypted key value
- Members and owners see the same response

---

### POST /api/projects/:projectId/api-keys

**Description**: Save or replace an API key for a provider.
**Authorization**: `verifyProjectOwnership(projectId)` — Owner only.

**Request Body** (Zod schema):
```json
{
  "provider": "ANTHROPIC",  // "ANTHROPIC" | "OPENAI"
  "key": "sk-ant-api03-..."  // Plaintext API key
}
```

**Validation**:
```typescript
const apiKeySaveSchema = z.object({
  provider: z.enum(["ANTHROPIC", "OPENAI"]),
  key: z.string().min(20).max(500),
});
```

**Response 200** (key saved/replaced):
```json
{
  "provider": "ANTHROPIC",
  "preview": "a1b2",
  "configured": true,
  "updatedAt": "2026-03-13T10:00:00Z"
}
```

**Response 400**: `{ "error": "Invalid key format. Anthropic keys must start with 'sk-ant-'." }`
**Response 401**: `{ "error": "Unauthorized" }`
**Response 403**: `{ "error": "Only project owners can manage API keys" }`

**Notes**:
- Format validation runs before encryption (FR-012)
- If key exists for provider, upsert (replace old key)
- Plaintext key is encrypted before storage, never persisted in logs
- Response never includes the full key

---

### DELETE /api/projects/:projectId/api-keys/:provider

**Description**: Remove an API key for a specific provider.
**Authorization**: `verifyProjectOwnership(projectId)` — Owner only.

**Path Parameters**:
- `provider`: `ANTHROPIC` | `OPENAI` (case-insensitive, normalized to uppercase)

**Response 200**:
```json
{
  "provider": "ANTHROPIC",
  "configured": false,
  "message": "API key removed. Workflows requiring Anthropic will be blocked until a new key is configured."
}
```

**Response 404**: `{ "error": "No API key found for provider ANTHROPIC" }`
**Response 401**: `{ "error": "Unauthorized" }`
**Response 403**: `{ "error": "Only project owners can manage API keys" }`

---

### POST /api/projects/:projectId/api-keys/:provider/validate

**Description**: Test a saved API key against the provider's API.
**Authorization**: `verifyProjectOwnership(projectId)` — Owner only.

**Path Parameters**:
- `provider`: `ANTHROPIC` | `OPENAI`

**Response 200** (key valid):
```json
{
  "provider": "ANTHROPIC",
  "valid": true,
  "message": "API key is valid and working."
}
```

**Response 200** (key invalid):
```json
{
  "provider": "ANTHROPIC",
  "valid": false,
  "message": "API key is invalid or has been revoked."
}
```

**Response 200** (provider unreachable):
```json
{
  "provider": "ANTHROPIC",
  "valid": null,
  "message": "Could not reach Anthropic API. Validation could not be completed."
}
```

**Response 404**: `{ "error": "No API key configured for provider ANTHROPIC" }`
**Response 401**: `{ "error": "Unauthorized" }`
**Response 403**: `{ "error": "Only project owners can manage API keys" }`

**Notes**:
- Decrypts the stored key, calls provider validation endpoint
- Returns `valid: null` when provider is unreachable (not `valid: false`)
- Does not expose the key in the response

## Zod Schemas

```typescript
// Request schemas
const apiKeySaveSchema = z.object({
  provider: z.enum(["ANTHROPIC", "OPENAI"]),
  key: z.string().min(20).max(500),
});

// Response types
interface ApiKeyStatus {
  provider: "ANTHROPIC" | "OPENAI";
  preview: string | null;
  configured: boolean;
  updatedAt: string | null;
}

interface ApiKeyListResponse {
  keys: ApiKeyStatus[];
}

interface ApiKeySaveResponse {
  provider: "ANTHROPIC" | "OPENAI";
  preview: string;
  configured: true;
  updatedAt: string;
}

interface ApiKeyDeleteResponse {
  provider: "ANTHROPIC" | "OPENAI";
  configured: false;
  message: string;
}

interface ApiKeyValidateResponse {
  provider: "ANTHROPIC" | "OPENAI";
  valid: boolean | null;
  message: string;
}
```

## Workflow Integration

When dispatching workflows in `lib/workflows/transition.ts`:

```typescript
// Before dispatch, retrieve and decrypt project API key
const apiKey = await getDecryptedApiKey(projectId, provider);
if (!apiKey) {
  throw new Error(
    `API key required. Configure your ${provider} API key in Project Settings to run workflows.`
  );
}

// Add to workflow inputs
workflowInputs.anthropicApiKey = apiKey; // or openaiApiKey
```

The workflow YAML receives the key as an input and sets it as an environment variable with masking.
