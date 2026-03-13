# API Contracts: Project API Keys

**Branch**: `AIB-285-copy-of-byok` | **Date**: 2026-03-13

## Endpoints

### GET /api/projects/[projectId]/api-keys

List configured API keys for a project (masked).

**Auth**: Session or PAT (project access required)
**Authorization**:
- Owner: sees masked preview and provider status
- Member: sees only provider status (configured/not configured)

**Response 200** (Owner):
```json
{
  "keys": [
    {
      "provider": "ANTHROPIC",
      "configured": true,
      "preview": "abcd",
      "updatedAt": "2026-03-13T12:00:00Z"
    },
    {
      "provider": "OPENAI",
      "configured": false,
      "preview": null,
      "updatedAt": null
    }
  ]
}
```

**Response 200** (Member):
```json
{
  "keys": [
    {
      "provider": "ANTHROPIC",
      "configured": true,
      "preview": null,
      "updatedAt": null
    },
    {
      "provider": "OPENAI",
      "configured": false,
      "preview": null,
      "updatedAt": null
    }
  ]
}
```

**Response 401**: Unauthorized
**Response 403**: Not a project member

---

### POST /api/projects/[projectId]/api-keys

Save or replace an API key for a provider.

**Auth**: Session or PAT (project owner only)
**Authorization**: `verifyProjectOwnership(projectId)`

**Request Body**:
```json
{
  "provider": "ANTHROPIC",
  "apiKey": "sk-ant-api03-...",
  "skipValidation": false
}
```

**Validation** (Zod):
```typescript
z.object({
  provider: z.enum(["ANTHROPIC", "OPENAI"]),
  apiKey: z.string().min(1).max(500),
  skipValidation: z.boolean().optional().default(false),
})
```

**Response 200** (key saved):
```json
{
  "provider": "ANTHROPIC",
  "configured": true,
  "preview": "abcd",
  "validated": true,
  "message": "API key saved successfully"
}
```

**Response 200** (saved without validation):
```json
{
  "provider": "ANTHROPIC",
  "configured": true,
  "preview": "abcd",
  "validated": false,
  "message": "API key saved without validation (provider unreachable)"
}
```

**Response 400**: Invalid key format or validation failed
```json
{
  "error": "Invalid API key format. Anthropic keys must start with 'sk-ant-'",
  "code": "INVALID_FORMAT"
}
```
```json
{
  "error": "API key validation failed: key is invalid or expired",
  "code": "VALIDATION_FAILED"
}
```

**Response 401**: Unauthorized
**Response 403**: Not the project owner

---

### POST /api/projects/[projectId]/api-keys/validate

Test an API key without saving it.

**Auth**: Session or PAT (project owner only)
**Authorization**: `verifyProjectOwnership(projectId)`

**Request Body**:
```json
{
  "provider": "ANTHROPIC",
  "apiKey": "sk-ant-api03-..."
}
```

**Response 200** (valid):
```json
{
  "valid": true,
  "message": "API key is valid"
}
```

**Response 200** (invalid):
```json
{
  "valid": false,
  "message": "API key is invalid or does not have required permissions"
}
```

**Response 200** (unreachable):
```json
{
  "valid": false,
  "message": "Could not reach the provider API. Please try again later.",
  "unreachable": true
}
```

**Response 400**: Invalid format
**Response 401**: Unauthorized
**Response 403**: Not the project owner

---

### DELETE /api/projects/[projectId]/api-keys/[provider]

Delete an API key for a provider.

**Auth**: Session or PAT (project owner only)
**Authorization**: `verifyProjectOwnership(projectId)`

**Path Params**: `provider` = `ANTHROPIC` | `OPENAI`

**Response 200**:
```json
{
  "message": "API key deleted successfully",
  "provider": "ANTHROPIC"
}
```

**Response 404**: Key not found for this provider
**Response 401**: Unauthorized
**Response 403**: Not the project owner

## Shared Types

```typescript
// lib/types/api-keys.ts

export type APIProvider = "ANTHROPIC" | "OPENAI";

export interface APIKeyStatus {
  provider: APIProvider;
  configured: boolean;
  preview: string | null;
  updatedAt: string | null;
}

export interface SaveAPIKeyRequest {
  provider: APIProvider;
  apiKey: string;
  skipValidation?: boolean;
}

export interface ValidateAPIKeyRequest {
  provider: APIProvider;
  apiKey: string;
}

export interface SaveAPIKeyResponse {
  provider: APIProvider;
  configured: boolean;
  preview: string;
  validated: boolean;
  message: string;
}

export interface ValidateAPIKeyResponse {
  valid: boolean;
  message: string;
  unreachable?: boolean;
}
```
