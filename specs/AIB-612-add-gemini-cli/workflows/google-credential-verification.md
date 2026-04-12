# Workflow Artifact: Google Credential Verification

## Workflow Definition

### Input

- `provider`: `GOOGLE`
- `credentialType`: `API_KEY | OAUTH_TOKEN`
- `value`: submitted secret
- `userId`: acting user

### Phases

1. Validate provider/type compatibility
2. Validate submitted format or bundle structure
3. If `API_KEY`, perform live provider verification
4. Persist encrypted credential with readiness metadata
5. Return masked credential summary and verification result

### Environment requirements

- `CREDENTIAL_ENCRYPTION_KEY`
- outbound network access for API-key verification

## Agent Command Specification

### Functional phases

- API key mode:
  - validate key format
  - call Google verification endpoint
  - classify as `READY` or `ACTION_REQUIRED`
- OAuth mode:
  - validate cached-auth bundle structure
  - do not depend on browser interaction
  - classify as ready only if the bundle can be restored safely for workflow use

### Output format

```json
{
  "provider": "GOOGLE",
  "credentialType": "API_KEY",
  "readinessStatus": "READY",
  "verificationCode": "VALID",
  "verificationMessage": null
}
```

## Callback / Reporting Contract

- Successful create or replace returns normal credential response payload
- Validation failures return structured `{ error, code? }`
- Unreachable verification returns `422` and must not mark the credential as verified

