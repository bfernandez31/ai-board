# API Contract: Mistral Credential Management

**Branch**: `AIB-593-add-mistral-vibe`

## Existing Endpoints (Extended)

All existing credential endpoints support Mistral without new routes — only new enum values.

### POST /api/credentials

**New accepted values**:
```json
{
  "provider": "MISTRAL",
  "credentialType": "API_KEY",
  "label": "My Mistral Key",
  "value": "<mistral-api-key>"
}
```

**Validation rules for MISTRAL provider**:
- `credentialType` must be `API_KEY` (only allowed type)
- `value` must be ≥32 characters, no whitespace
- Format validation via `lib/ai-credentials/providers/mistral.ts`
- Live verification against `GET https://api.mistral.ai/v1/models`

**Responses**: Same as existing (201 created, 200 replaced, 400 validation error)

### GET /api/internal/credentials

**New query parameter value**:
```
?projectId=123&provider=MISTRAL
```

**Response**: Same format — returns `{ envVar: "MISTRAL_API_KEY", value: "<base64>", encoding: "base64", credentialType: "API_KEY" }`

### GET /api/projects/:projectId/setup/credential-check

**New query parameter value**:
```
?agent=MISTRAL
```

**Response**: Same format — `{ hasCredential: boolean, provider: "MISTRAL", settingsUrl?: string }`

## Mistral Provider Verification Contract

### Format Validation

```typescript
validateFormat(credentialType: 'API_KEY', value: string): FormatValidationResult
```

| Input | Result |
|-------|--------|
| Empty string | `{ valid: false, error: "API key is required" }` |
| < 32 chars | `{ valid: false, error: "Invalid Mistral API key format: key is too short" }` |
| Contains whitespace | `{ valid: false, error: "Invalid Mistral API key format: key must not contain whitespace" }` |
| OAUTH_TOKEN type | `{ valid: false, error: "Mistral only supports API_KEY credentials" }` |
| Valid format | `{ valid: true }` |

### Live Verification

```typescript
verifyWithProvider(credentialType: 'API_KEY', value: string): Promise<VerificationResult>
```

**Endpoint**: `GET https://api.mistral.ai/v1/models`
**Headers**: `Authorization: Bearer <value>`
**Timeout**: 10,000ms

| HTTP Status | Result |
|-------------|--------|
| 200 | `{ readinessStatus: 'READY', verificationCode: 'VALID', verificationMessage: null }` |
| 401/403 | `{ readinessStatus: 'ACTION_REQUIRED', verificationCode: 'INVALID_KEY', verificationMessage: 'Your API key was rejected by Mistral...' }` |
| 429 | `{ readinessStatus: 'ACTION_REQUIRED', verificationCode: 'RATE_LIMITED', verificationMessage: 'Mistral rate limit reached...' }` |
| Timeout | `{ readinessStatus: 'ACTION_REQUIRED', verificationCode: 'UNREACHABLE', verificationMessage: 'Unable to reach Mistral...' }` |
