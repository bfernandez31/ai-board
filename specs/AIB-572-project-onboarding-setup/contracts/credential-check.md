# API Contract: Credential Availability Check

**Feature Branch**: `AIB-572-project-onboarding-setup`

## Purpose

The setup page needs to verify whether the project owner has a READY credential for the selected agent's provider before enabling the "Initialize Project" button. This check happens on agent selection change.

## Endpoint

`GET /api/projects/[projectId]/setup/credential-check?agent=CLAUDE`

See [setup-api.md](./setup-api.md) for full contract details.

## Integration Pattern

### Frontend Flow

```
1. User selects agent (radio button change)
2. Debounce 300ms (via useDebounce hook)
3. Call GET /api/projects/[projectId]/setup/credential-check?agent={selected}
4. If available=true → enable "Initialize Project" button
5. If available=false → disable button, show guidance message
```

### Credential Resolution

Uses existing `AGENT_PROVIDER_MAP` from `lib/ai-credentials/types.ts`:

| Agent | Provider | Credential Types |
|-------|----------|-----------------|
| CLAUDE | ANTHROPIC | API_KEY, OAUTH_TOKEN |
| CODEX | OPENAI | API_KEY, OAUTH_TOKEN |

### Reuse

The check reuses `getOwnerCredential()` from `lib/ai-credentials/workflow.ts` which:
1. Looks up the project owner's userId
2. Queries `UserCredential` for that userId + provider
3. Checks `readinessStatus === READY`
4. Returns the credential or null

For the setup page, only the availability (not the decrypted value) is returned.
