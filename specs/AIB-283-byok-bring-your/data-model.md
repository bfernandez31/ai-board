# Data Model: BYOK - Bring Your Own API Key

**Feature**: AIB-283-byok-bring-your  
**Date**: 2026-03-13

## Overview

This feature adds project-scoped provider credentials plus immutable job-scoped credential snapshots. The project credential is the mutable source of truth for future launches; the job snapshot preserves the exact secret material used by an in-progress workflow.

## Prisma Enums

### `AiProvider`

```prisma
enum AiProvider {
  ANTHROPIC
  OPENAI
}
```

### `AiCredentialValidationStatus`

```prisma
enum AiCredentialValidationStatus {
  PENDING
  VALID
  INVALID
  ERROR
}
```

### `WorkflowCredentialSource`

```prisma
enum WorkflowCredentialSource {
  PROJECT_BYOK
}
```

## Persistent Entities

### `ProjectAiCredential`

One record per project/provider pair.

```prisma
model ProjectAiCredential {
  id                   Int                          @id @default(autoincrement())
  projectId            Int
  provider             AiProvider
  encryptedKey         String
  encryptionIv         String                       @db.VarChar(64)
  encryptionTag        String                       @db.VarChar(64)
  lastFour             String                       @db.VarChar(4)
  validationStatus     AiCredentialValidationStatus @default(PENDING)
  validationMessage    String?                      @db.VarChar(255)
  validatedAt          DateTime?
  createdByUserId      String
  updatedByUserId      String
  createdAt            DateTime                     @default(now())
  updatedAt            DateTime                     @updatedAt

  project              Project                      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy            User                         @relation("ProjectAiCredentialCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict)
  updatedBy            User                         @relation("ProjectAiCredentialUpdatedBy", fields: [updatedByUserId], references: [id], onDelete: Restrict)
  snapshots            JobAiCredentialSnapshot[]

  @@unique([projectId, provider])
  @@index([projectId])
  @@index([projectId, validationStatus])
}
```

**Notes**:
- `encryptedKey`, `encryptionIv`, and `encryptionTag` hold the encrypted provider secret; plaintext is never stored.
- `lastFour` is the only user-visible key fragment.
- `validationMessage` stores sanitized guidance only, never raw provider payloads.

### `JobAiCredentialSnapshot`

Immutable credential snapshot taken at workflow launch time.

```prisma
model JobAiCredentialSnapshot {
  id                        Int                    @id @default(autoincrement())
  jobId                      Int
  projectId                  Int
  provider                   AiProvider
  source                     WorkflowCredentialSource
  projectAiCredentialId      Int
  encryptedKey               String
  encryptionIv               String                 @db.VarChar(64)
  encryptionTag              String                 @db.VarChar(64)
  lastFour                   String                 @db.VarChar(4)
  createdAt                  DateTime               @default(now())

  job                        Job                    @relation(fields: [jobId], references: [id], onDelete: Cascade)
  project                    Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectAiCredential        ProjectAiCredential    @relation(fields: [projectAiCredentialId], references: [id], onDelete: Restrict)

  @@unique([jobId, provider])
  @@index([projectId, jobId])
}
```

**Notes**:
- Snapshot content is copied from the project credential at launch.
- Updates or deletion of `ProjectAiCredential` do not mutate existing snapshot rows.

## Derived / Virtual Entities

### `ProviderStatusView`

Response model for project settings.

```ts
type ProviderStatus = 'NOT_CONFIGURED' | 'CONFIGURED' | 'INVALID';

interface ProviderStatusView {
  provider: 'ANTHROPIC' | 'OPENAI';
  status: ProviderStatus;
  validationStatus: 'PENDING' | 'VALID' | 'INVALID' | 'ERROR' | null;
  lastFour: string | null;
  validatedAt: string | null;
  message: string | null;
  canManage: boolean;
}
```

**Derivation rules**:
- No `ProjectAiCredential` row => `status = NOT_CONFIGURED`
- Row with `validationStatus = VALID` or `PENDING` => `status = CONFIGURED`
- Row with `validationStatus = INVALID` or `ERROR` => `status = INVALID`
- `lastFour` is omitted for non-owners if the product decides member visibility should stay purely status-based

### `WorkflowProviderRequirement`

Code-level mapping used before dispatch.

```ts
interface WorkflowProviderRequirement {
  command: 'specify' | 'plan' | 'implement' | 'verify' | 'quick-impl' | 'clean' | 'comment-specify' | 'comment-plan' | 'comment-build' | 'comment-verify';
  agent: 'CLAUDE' | 'CODEX';
  providers: Array<'ANTHROPIC' | 'OPENAI'>;
}
```

**Current mapping**:
- Any Claude-based run => `['ANTHROPIC']`
- Any Codex-based run => `['OPENAI']`
- Array form remains to support future workflows that need both providers

### `ProviderValidationResult`

Normalized result returned by validation service.

```ts
interface ProviderValidationResult {
  provider: 'ANTHROPIC' | 'OPENAI';
  validationStatus: 'VALID' | 'INVALID' | 'ERROR';
  message: string;
  validatedAt: string;
}
```

## State Transitions

### Project Credential Lifecycle

```text
NOT_CONFIGURED
  -> save key -> PENDING
PENDING
  -> validation success -> VALID
  -> validation auth/quota/revoked failure -> INVALID
  -> validation transport/internal failure -> ERROR
VALID
  -> replace key -> PENDING
  -> revalidate failure -> INVALID or ERROR
INVALID
  -> replace key -> PENDING
  -> revalidate success -> VALID
ERROR
  -> revalidate success -> VALID
  -> replace key -> PENDING
ANY
  -> delete key -> NOT_CONFIGURED
```

### Workflow Launch Eligibility

```text
resolve effective agent
  -> resolve required providers
  -> load project credential for each provider
  -> if any missing => block launch
  -> if any validationStatus in INVALID/ERROR => block launch
  -> else create job + snapshot credentials + dispatch workflow
```

### In-Progress Job Credential Stability

```text
job created
  -> credential snapshots persisted
  -> workflow fetches snapshots
  -> project credential rotated/deleted
  -> running job continues with existing snapshot
  -> next launch uses latest project credential state
```

## Validation Rules

### Save / Replace Input

| Field | Rule |
|------|------|
| `provider` | Must be one of `ANTHROPIC`, `OPENAI` |
| `apiKey` | Required non-empty string, trimmed before validation |
| `apiKey` | Must not be returned in API response |
| `apiKey` | Wrong-provider or malformed keys surface provider-safe guidance only |

### Authorization

| Action | Required Access |
|--------|-----------------|
| View high-level provider status | `verifyProjectAccess(projectId)` |
| Save / replace / validate / delete key | `verifyProjectOwnership(projectId)` |
| Retrieve job credential snapshots | Valid workflow token plus matching `jobId` and `projectId` |

## Existing Model Touchpoints

### `Project`

Add relation:

```prisma
aiCredentials ProjectAiCredential[]
jobCredentialSnapshots JobAiCredentialSnapshot[]
```

### `Job`

Add relation:

```prisma
providerCredentialSnapshots JobAiCredentialSnapshot[]
```

No existing `Project`, `Job`, or `Ticket` business fields need to be repurposed.
