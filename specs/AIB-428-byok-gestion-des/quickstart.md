# Quickstart: BYOK - User API Key Management

**Branch**: `AIB-428-byok-gestion-des` | **Date**: 2026-03-31

## Prerequisites

- `CREDENTIAL_ENCRYPTION_KEY` env var: 32-byte hex string (64 hex chars)
  ```bash
  # Generate a key:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Add to `.env.local`:
  ```
  CREDENTIAL_ENCRYPTION_KEY=<64-hex-chars>
  ```

## Implementation Order

### Step 1: Database Schema

Add `UserCredential` model, `CredentialProvider` and `CredentialType` enums to `prisma/schema.prisma`, then:

```bash
bunx prisma migrate dev --name add-user-credential
bunx prisma generate
```

### Step 2: Encryption Library (`lib/crypto/credentials.ts`)

Two functions:
- `encryptCredential(plaintext: string): { encryptedValue, iv, authTag }`
- `decryptCredential(encryptedValue: string, iv: string, authTag: string): string`

Uses `CREDENTIAL_ENCRYPTION_KEY` from env. AES-256-GCM with random 12-byte IV per call.

### Step 3: Validation Library (`lib/credentials/validation.ts`)

- `validateCredentialFormat(provider, credentialType, value): { valid, error? }` — regex checks
- `validateCredentialWithProvider(provider, credentialType, value): Promise<{ valid, error? }>` — API call

### Step 4: Database Operations (`lib/db/credentials.ts`)

CRUD with Prisma:
- `createOrReplaceCredential(userId, data)` — upsert
- `listCredentials(userId)` — metadata only (no encrypted fields)
- `getCredentialForDecryption(id, userId)` — includes encrypted fields
- `getOwnerCredential(projectId)` — resolve project → owner → credential
- `deleteCredential(id, userId)`
- `updateValidationStatus(id, isValid)`

### Step 5: User API Routes

- `GET /api/credentials` → list
- `POST /api/credentials` → create/replace (validate + encrypt + upsert)
- `DELETE /api/credentials/[id]` → delete
- `POST /api/credentials/[id]/test` → re-validate against provider

### Step 6: Internal Workflow Endpoint

- `GET /api/internal/credentials?projectId=X` → decrypt + return (workflow token auth)

### Step 7: Workflow Dispatch Guard

In `dispatch-ai-board.ts`: check owner has credential before dispatching. Return user-facing error if missing.

### Step 8: Workflow YAML Update

Add credential fetch step to `ai-board-assist.yml` before Claude execution step.

### Step 9: Settings UI

- `/settings/credentials/page.tsx` — credential management page
- Components: `credential-form.tsx`, `credential-list.tsx`, `credential-test-button.tsx`
- TanStack Query hooks for CRUD operations with optimistic updates

### Step 10: Tests

- Unit: encryption round-trip, format validation
- Component: credential form interactions
- Integration: API CRUD, workflow credential retrieval, validation flows

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CREDENTIAL_ENCRYPTION_KEY` | Yes | 32-byte hex (64 chars) AES-256 master key |
| `WORKFLOW_API_TOKEN` | Existing | Already used for workflow→app auth |

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add UserCredential model + enums + User relation |
| `app/lib/workflows/dispatch-ai-board.ts` | Add credential existence check before dispatch |
| `.github/workflows/ai-board-assist.yml` | Add credential fetch step |
| `app/settings/layout.tsx` or nav component | Add "Credentials" link to settings nav |
