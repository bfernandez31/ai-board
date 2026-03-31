# Data Model: BYOK - User API Key Management

**Branch**: `AIB-428-byok-gestion-des` | **Date**: 2026-03-31

## New Entities

### UserCredential

Stores an encrypted AI provider credential belonging to a user. Each user may have at most one credential per provider.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `Int` | PK, autoincrement | Primary key |
| `userId` | `String` | FK → User.id, NOT NULL | Credential owner |
| `provider` | `CredentialProvider` | NOT NULL | AI provider (enum) |
| `credentialType` | `CredentialType` | NOT NULL | API_KEY or OAUTH_TOKEN |
| `label` | `String` | VarChar(100), NOT NULL | User-assigned display name |
| `encryptedValue` | `String` | NOT NULL | AES-256-GCM encrypted credential |
| `iv` | `String` | VarChar(24), NOT NULL | Base64-encoded 12-byte initialization vector |
| `authTag` | `String` | VarChar(24), NOT NULL | Base64-encoded 16-byte GCM authentication tag |
| `preview` | `String` | VarChar(4), NOT NULL | Last 4 characters (for display) |
| `readinessStatus` | `CredentialReadiness` | DEFAULT PENDING_VERIFICATION | Current readiness state of the credential |
| `lastVerifiedAt` | `DateTime` | nullable | Timestamp of last provider verification |
| `verificationCode` | `String` | VarChar(50), nullable | Machine-readable verification result code (e.g., INVALID_KEY, EXPIRED, UNREACHABLE) |
| `verificationMessage` | `String` | VarChar(500), nullable | User-facing remediation message |
| `createdAt` | `DateTime` | DEFAULT now() | Creation timestamp |
| `updatedAt` | `DateTime` | @updatedAt | Last update timestamp |

**Unique constraint**: `@@unique([userId, provider])` — one credential per provider per user.

**Indexes**:
- `@@index([userId])` — list credentials by user
- `@@index([userId, provider])` — lookup specific provider credential

**Relations**:
- `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`

### New Enums

```prisma
enum CredentialProvider {
  ANTHROPIC
}

enum CredentialType {
  API_KEY
  OAUTH_TOKEN
}

enum CredentialReadiness {
  PENDING_VERIFICATION
  READY
  ACTION_REQUIRED
}
```

## Prisma Schema Addition

```prisma
model UserCredential {
  id                  Int                 @id @default(autoincrement())
  userId              String
  provider            CredentialProvider
  credentialType      CredentialType
  label               String              @db.VarChar(100)
  encryptedValue      String
  iv                  String              @db.VarChar(24)
  authTag             String              @db.VarChar(24)
  preview             String              @db.VarChar(4)
  readinessStatus     CredentialReadiness @default(PENDING_VERIFICATION)
  lastVerifiedAt      DateTime?
  verificationCode    String?             @db.VarChar(50)
  verificationMessage String?             @db.VarChar(500)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
}
```

**User model update** — add relation:
```prisma
model User {
  // ... existing fields ...
  credentials UserCredential[]
}
```

## Workflow Typed Interfaces

TypeScript interfaces for workflow credential resolution, defined in `lib/ai-credentials/types.ts`:

```typescript
interface WorkflowCredentialRequest {
  projectId: number;
  provider: "ANTHROPIC";
}

interface WorkflowResolvedCredential {
  provider: "ANTHROPIC";
  credentialType: "API_KEY" | "OAUTH_TOKEN";
  envVar: string; // ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN
  secret: string;
  ownerUserId: string;
}
```

These interfaces are consumed by `lib/ai-credentials/workflow.ts` for owner resolution and workflow payload mapping.

## Entity Relationships

```
User (1) ──── (0..N) UserCredential
  │                    └── unique on (userId, provider)
  │
  └──── (0..N) Project
                  │
                  └── Workflow trigger resolves:
                      project.userId → UserCredential
```

## Credential Resolution Flow

```
Workflow triggered for Project
  → project.userId (owner)
  → UserCredential WHERE userId = project.userId AND provider = ANTHROPIC
  → Decrypt encryptedValue using iv + authTag + master key
  → Return env var name based on credentialType:
      API_KEY     → ANTHROPIC_API_KEY
      OAUTH_TOKEN → CLAUDE_CODE_OAUTH_TOKEN
```

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `label` | 1-100 chars, non-empty after trim | "Label is required (1-100 characters)" |
| `provider` | Must be valid CredentialProvider enum | "Unsupported provider" |
| `credentialType` | Must be valid CredentialType enum | "Invalid credential type" |
| `value` (input, not stored) | API_KEY: matches `/^sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}$/` | "Invalid Anthropic API key format" |
| `value` (input, not stored) | OAUTH_TOKEN: non-empty string, min 20 chars | "Invalid OAuth token format" |

## State Transitions

`readinessStatus` field tracks credential readiness:

```
Created (PENDING_VERIFICATION) → Validated successfully (READY) → Re-tested fails (ACTION_REQUIRED)
                                                                 → Provider revokes key → Workflow fails (ACTION_REQUIRED)
                                → Validation fails (ACTION_REQUIRED) → User replaces key → (PENDING_VERIFICATION)
```

**Readiness status semantics**:
- `PENDING_VERIFICATION`: Credential just created or replaced, not yet verified against provider
- `READY`: Last verification succeeded — credential is usable by workflows
- `ACTION_REQUIRED`: Last verification failed — user must fix or replace the credential

**Verification detail fields**:
- `verificationCode`: Machine-readable code set on verification (e.g., `VALID`, `INVALID_KEY`, `EXPIRED`, `UNREACHABLE`, `RATE_LIMITED`)
- `verificationMessage`: User-facing remediation message (e.g., "Your API key has been revoked. Please generate a new key in the Anthropic console.")

## Migration Notes

- New model only — no existing data affected
- Migration is additive (new table + enums)
- No backfill required
- `CREDENTIAL_ENCRYPTION_KEY` env var must be provisioned before deployment
