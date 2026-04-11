# Contract: Google Credential API

No new endpoints required. Existing credential endpoints already support dynamic providers.

## Existing Endpoints (No Changes)

### POST /api/settings/credentials
Creates or replaces a credential. Already accepts any `CredentialProvider` value.

**Request body** (unchanged):
```json
{
  "provider": "GOOGLE",
  "credentialType": "API_KEY" | "OAUTH_TOKEN",
  "label": "My Google AI Studio Key",
  "value": "AIza..."
}
```

**Validation**: Delegates to `lib/ai-credentials/providers/google.ts` (new file).

### GET /api/internal/credentials?projectId={id}&provider=GOOGLE
Workflow credential fetch. Already dynamic via `provider` query param.

**Response** (unchanged structure):
```json
{
  "value": "<base64-encoded credential>",
  "envVar": "GEMINI_API_KEY" | "GEMINI_OAUTH_TOKEN",
  "credentialType": "API_KEY" | "OAUTH_TOKEN"
}
```

### GET /api/projects/{projectId}/setup/credential-check?agent=GEMINI
Credential readiness check. Already uses `AGENT_PROVIDER_MAP` to resolve provider.

**Response** (unchanged structure):
```json
{
  "hasCredential": true,
  "provider": "GOOGLE"
}
```

## New Provider Module Contract

### `lib/ai-credentials/providers/google.ts`

Exports matching `ProviderModule` interface:

```typescript
export function validateFormat(
  credentialType: CredentialType,
  value: string
): FormatValidationResult;

export async function verifyWithProvider(
  credentialType: CredentialType,
  value: string
): Promise<VerificationResult>;
```

**API_KEY validation**:
- Prefix check: starts with `AIza`
- Minimum length: 39
- No whitespace
- Verification: `GET https://generativelanguage.googleapis.com/v1beta/models?key={value}`

**OAUTH_TOKEN validation**:
- Minimum length: 20
- No whitespace
- Verification: `GET https://generativelanguage.googleapis.com/v1beta/models` with `Authorization: Bearer {value}`
