# Contract: Google Credentials and Workflow Resolution

## Endpoints Extended

### `POST /api/credentials`

Adds support for:

```json
{
  "provider": "GOOGLE",
  "credentialType": "API_KEY",
  "label": "Gemini AI Studio Key",
  "value": "..."
}
```

```json
{
  "provider": "GOOGLE",
  "credentialType": "OAUTH_TOKEN",
  "label": "Gemini Cached Sign-In",
  "value": "{...serialized auth bundle...}"
}
```

### Validation rules

- `provider=GOOGLE`
- `credentialType` must be one of:
  - `API_KEY`
  - `OAUTH_TOKEN`
- `label` uses existing `1..100` character rule
- `API_KEY`:
  - provider format validation
  - live verification before `READY`
- `OAUTH_TOKEN`:
  - structural validation of the serialized auth bundle
  - no network verification required

### Error responses

- `400`: invalid provider/type/format
- `422`: provider unreachable or credential rejected
- `401`: unauthorized
- `500`: unexpected failure

## `POST /api/credentials/:id/test`

- Retests existing Google credential
- Expected behavior:
  - API key reruns provider verification
  - OAuth bundle reruns structural validation and cached-auth readiness checks

## `GET /api/internal/credentials?projectId=:id&provider=GOOGLE`

Returns the workflow-facing credential payload.

### API key response

```json
{
  "envVar": "GEMINI_API_KEY",
  "value": "base64-encoded-secret",
  "encoding": "base64",
  "credentialType": "API_KEY"
}
```

### OAuth bundle response

```json
{
  "envVar": "GEMINI_OAUTH_JSON",
  "value": "base64-encoded-auth-bundle",
  "encoding": "base64",
  "credentialType": "OAUTH_TOKEN"
}
```

### Guarantees

- `Cache-Control: no-store, no-cache, must-revalidate`
- plaintext secrets are never returned directly
- missing Google credential returns provider-specific 404 messaging

## `GET /api/projects/:projectId/setup/credential-check?agent=...`

### Request

- `agent` accepts at least:
  - `CLAUDE`
  - `CODEX`
  - `MISTRAL`
  - `GEMINI`

### Response

```json
{
  "hasCredential": true,
  "provider": "GOOGLE"
}
```

or

```json
{
  "hasCredential": false,
  "provider": "GOOGLE",
  "settingsUrl": "/settings/credentials"
}
```

## Workflow provider mapping

| Agent | Provider | Internal env var |
|-------|----------|------------------|
| `CLAUDE` | `ANTHROPIC` | existing |
| `CODEX` | `OPENAI` | existing |
| `MISTRAL` | `MISTRAL` | existing |
| `GEMINI` | `GOOGLE` | `GEMINI_API_KEY` or `GEMINI_OAUTH_JSON` |

