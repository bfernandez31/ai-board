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

Add `UserCredential` model, `CredentialProvider`, `CredentialType`, and `CredentialReadiness` enums to `prisma/schema.prisma`, then:

```bash
bunx prisma migrate dev --name add-user-credential
bunx prisma generate
```

### Step 2: Shared Types (`lib/ai-credentials/types.ts`)

Define shared interfaces and types:
- `WorkflowCredentialRequest` — workflow credential resolution request
- `WorkflowResolvedCredential` — resolved credential payload for workflows
- API response types with `readinessStatus`, `verificationCode`, `verificationMessage`

### Step 3: Encryption Library (`lib/ai-credentials/crypto.ts`)

Two functions:
- `encryptCredential(plaintext: string): { encryptedValue, iv, authTag }`
- `decryptCredential(encryptedValue: string, iv: string, authTag: string): string`

Uses `CREDENTIAL_ENCRYPTION_KEY` from env. AES-256-GCM with random 12-byte IV per call.

### Step 4: Provider Validation (`lib/ai-credentials/providers/anthropic.ts`)

- `validateFormat(credentialType, value): { valid, error? }` — regex checks for Anthropic keys
- `verifyWithProvider(credentialType, value): Promise<{ readinessStatus, verificationCode, verificationMessage }>` — API call with 10s timeout

### Step 5: Business Logic (`lib/ai-credentials/service.ts`)

CRUD + verification with Prisma:
- `createOrReplaceCredential(userId, data)` — upsert with readinessStatus
- `listCredentials(userId)` — metadata only (no encrypted fields)
- `getCredentialForDecryption(id, userId)` — includes encrypted fields
- `deleteCredential(id, userId)`
- `testCredential(id, userId)` — decrypt, verify, update readinessStatus/verificationCode/verificationMessage

### Step 6: Workflow Resolution (`lib/ai-credentials/workflow.ts`)

- `getOwnerCredential(projectId)` — resolve project → owner → credential
- `buildWorkflowPayload(credential): WorkflowResolvedCredential` — map credential to workflow env var

### Step 7: User API Routes

- `GET /api/credentials` → list (returns readinessStatus, verificationCode, verificationMessage)
- `POST /api/credentials` → create/replace (validate + encrypt + upsert)
- `DELETE /api/credentials/[id]` → delete
- `POST /api/credentials/[id]/test` → re-validate, returns readinessStatus + verification details

### Step 8: Internal Workflow Endpoint

- `GET /api/internal/credentials?projectId=X` → decrypt + return WorkflowResolvedCredential (workflow token auth)

### Step 9: Workflow Dispatch Guard

In `dispatch-ai-board.ts`: use `lib/ai-credentials/workflow.ts` to check owner has credential before dispatching. Return user-facing error if missing.

### Step 10: Workflow YAML Update

Add credential fetch step to `ai-board-assist.yml` before Claude execution step.

### Step 11: Settings UI

- `/settings/credentials/page.tsx` — credential management page
- Components: `credential-form.tsx`, `credential-list.tsx` (with readinessStatus badge), `credential-test-button.tsx`
- TanStack Query hooks for CRUD operations with optimistic updates

### Step 12: Tests

- Unit: encryption round-trip, format validation (`tests/unit/ai-credentials.test.ts`)
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
| `prisma/schema.prisma` | Add UserCredential model + CredentialProvider + CredentialType + CredentialReadiness enums + User relation |
| `app/lib/workflows/dispatch-ai-board.ts` | Add credential existence check before dispatch (via lib/ai-credentials/workflow.ts) |
| `.github/workflows/ai-board-assist.yml` | Add credential fetch step |
| `app/settings/layout.tsx` or nav component | Add "Credentials" link to settings nav |

## New File Structure

```
lib/ai-credentials/
├── crypto.ts              # AES-256-GCM encrypt/decrypt
├── service.ts             # Business logic (save, list, delete, test)
├── workflow.ts            # Owner resolution + workflow payload mapping
├── types.ts               # Shared interfaces and types
└── providers/
    └── anthropic.ts       # Format validation + remote verification for Anthropic
```
