# Data Model: BYOK - gestion des cles API utilisateur pour les agents AI

**Feature**: AIB-431-byok-gestion-des  
**Date**: 2026-03-31

## Overview
This feature introduces one new persisted entity for user-owned AI credentials, extends the `User` aggregate with a provider-scoped credential relationship, and defines a workflow-time transient payload used to hand the project owner's credential to authenticated workflows. The model is intentionally provider-extensible but launches with Anthropic only.

## Persisted Entities

### UserAiCredential
**Purpose**: Stores one active AI credential per `(userId, provider)` with encrypted secret material, masked metadata, and readiness state.

**Proposed Prisma Shape**:
```prisma
model UserAiCredential {
  id                          Int                       @id @default(autoincrement())
  userId                      String
  provider                    AiCredentialProvider
  credentialType              AiCredentialType
  label                       String                    @db.VarChar(100)
  maskedPreview               String                    @db.VarChar(4)
  encryptedSecret             String?                   @db.Text
  encryptionIv                String?                   @db.VarChar(64)
  encryptionAuthTag           String?                   @db.VarChar(64)
  readinessStatus             AiCredentialReadinessStatus @default(PENDING_VERIFICATION)
  lastVerifiedAt              DateTime?
  lastVerificationCode        String?                   @db.VarChar(50)
  lastVerificationMessage     String?                   @db.VarChar(500)
  deletedAt                   DateTime?
  createdAt                   DateTime                  @default(now())
  updatedAt                   DateTime                  @updatedAt
  user                        User                      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
  @@index([provider, readinessStatus])
  @@index([deletedAt])
}
```

**Field Rules**:
- `provider`: enum; initial value set contains only `ANTHROPIC`
- `credentialType`: enum; initial values `ANTHROPIC_API_KEY`, `ANTHROPIC_OAUTH`
- `label`: required user-provided label, 1-100 chars
- `maskedPreview`: last 4 characters only; never enough to reconstruct the secret
- `encryptedSecret`, `encryptionIv`, `encryptionAuthTag`: required while active; nulled when deleted to shred secret material
- `readinessStatus`: reflects whether workflows may currently use the credential
- `lastVerificationCode`: machine-readable cause like `INVALID`, `EXPIRED`, `UNREACHABLE`, `MISSING`, `VERIFY_FAILED`
- `lastVerificationMessage`: user-facing remediation text, non-sensitive
- `deletedAt`: soft-delete timestamp for auditability; active queries must filter `deletedAt: null`

**Lifecycle**:
1. Create/update begins in `PENDING_VERIFICATION`
2. Server verifies the secret with the provider
3. On success, record becomes `READY`
4. On failure, record remains stored but moves to `ACTION_REQUIRED`
5. On delete, `deletedAt` is set and secret fields are nulled

---

### User (Existing, Extended)
**Purpose in Feature**: Owns zero or one active credential per provider and serves as the source of truth for project-owner billing responsibility.

**Required Extension**:
```prisma
model User {
  id            String
  ...
  aiCredentials UserAiCredential[]
}
```

**Feature Usage**:
- User settings pages list and mutate the current user's `aiCredentials`
- Workflow retrieval resolves the owning `User` through `Project.userId`

---

### Project (Existing, Reused)
**Purpose in Feature**: Defines which user's credential is authoritative for workflow launches.

**Relevant Fields**:
```prisma
model Project {
  id      Int
  userId  String
  ...
  user    User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Feature Usage**:
- `project.userId` determines the owner whose credential must be retrieved
- Member-initiated launches still resolve the same owner credential

## Enums

### AiCredentialProvider
```prisma
enum AiCredentialProvider {
  ANTHROPIC
}
```

### AiCredentialType
```prisma
enum AiCredentialType {
  ANTHROPIC_API_KEY
  ANTHROPIC_OAUTH
}
```

### AiCredentialReadinessStatus
```prisma
enum AiCredentialReadinessStatus {
  PENDING_VERIFICATION
  READY
  ACTION_REQUIRED
}
```

## Transient Service Models

### WorkflowCredentialRequest
**Purpose**: Validated workflow-authenticated request asking for the current owner credential for one provider.

```ts
interface WorkflowCredentialRequest {
  projectId: number;
  provider: "ANTHROPIC";
  ticketId?: number;
  jobId?: number;
  command: string;
}
```

**Validation Rules**:
- `projectId` positive integer
- `provider` supported enum
- `command` must match a known workflow command string
- Request must be authenticated by `WORKFLOW_API_TOKEN`

---

### WorkflowResolvedCredential
**Purpose**: One-time secret-bearing payload returned only to authenticated workflows.

```ts
interface WorkflowResolvedCredential {
  provider: "ANTHROPIC";
  credentialType: "ANTHROPIC_API_KEY" | "ANTHROPIC_OAUTH";
  authMode: "api-key" | "oauth-token";
  secret: string;
  ownerUserId: string;
  readinessStatus: "READY";
  resolvedAt: string;
}
```

**Rules**:
- Only returned when the stored credential is active, not deleted, and `READY`
- Never returned from session-authenticated endpoints
- Not persisted in logs, client caches, or ticket/job payload columns

## State Transitions

### Credential Readiness
```text
PENDING_VERIFICATION -> READY
  Trigger: provider verification succeeds during save/update

PENDING_VERIFICATION -> ACTION_REQUIRED
  Trigger: provider rejects the secret or verification cannot confirm usability

READY -> ACTION_REQUIRED
  Trigger: later verification or workflow retrieval determines the credential is invalid, expired, inaccessible, or unusable

ACTION_REQUIRED -> READY
  Trigger: user replaces credential and verification succeeds

READY|ACTION_REQUIRED -> DELETED (represented by deletedAt != null and secret fields nulled)
  Trigger: user deletes credential
```

## Relationships

```text
User (1) ---- (0..N) UserAiCredential
User (1) ---- (0..N) Project [as owner through Project.userId]
Project (1) ---- (1) Owner UserAiCredential for provider at workflow launch time
```

**Integrity Constraints**:
- Unique `(userId, provider)` ensures one active provider credential per user
- Workflow resolution must join `Project.userId -> UserAiCredential.userId`
- Active credential queries must enforce `deletedAt IS NULL`

## Validation Rules

### Client/Server Shared Validation
- `label`: required, trimmed, max 100 chars
- `provider`: supported enum only
- `credentialType`: must belong to selected provider
- `secret`: required on save/replace, min length depends on provider/type

### Provider-Specific Validation
- `ANTHROPIC_API_KEY`: local format validation before submit, then server verification
- `ANTHROPIC_OAUTH`: local token-shape validation before submit, then server verification

### Deletion Rules
- Delete removes availability immediately for future launches
- Secret-bearing columns must be nulled in the same transaction that sets `deletedAt`
- Deleted rows are excluded from normal list/retrieval queries

## Derived Views

### User Settings Response
```ts
interface UserAiCredentialSummary {
  provider: "ANTHROPIC";
  credentialType: "ANTHROPIC_API_KEY" | "ANTHROPIC_OAUTH";
  label: string;
  maskedPreview: string;
  readinessStatus: "PENDING_VERIFICATION" | "READY" | "ACTION_REQUIRED";
  lastVerifiedAt: string | null;
  lastVerificationCode: string | null;
  lastVerificationMessage: string | null;
  updatedAt: string;
}
```

### Launch Eligibility View
```ts
interface ProjectOwnerCredentialEligibility {
  projectId: number;
  provider: "ANTHROPIC";
  eligible: boolean;
  reasonCode: "READY" | "MISSING" | "ACTION_REQUIRED" | "VERIFY_FAILED";
  remediationMessage: string;
}
```
