# Data Model: Project Onboarding Setup Flow

**Feature Branch**: `AIB-576-copy-of-project`

## Schema Changes

### New Enum: `ProjectSetupStatus`

```prisma
enum ProjectSetupStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

**Purpose**: Represents the lifecycle states explicitly allowed by the spec for a single onboarding attempt.

### New Model: `ProjectSetupAttempt`

```prisma
model ProjectSetupAttempt {
  id               Int                @id @default(autoincrement())
  projectId        Int
  selectedAgent    Agent
  status           ProjectSetupStatus @default(PENDING)
  workflowRunId    BigInt?
  attemptNumber    Int
  statusMessage    String?            @db.VarChar(500)
  failureCode      String?            @db.VarChar(100)
  failureMessage   String?            @db.VarChar(2000)
  artifactSummary  Json?
  startedAt        DateTime?
  completedAt      DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  project          Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, attemptNumber])
  @@index([projectId, createdAt(sort: Desc)])
  @@index([projectId, status])
}
```

### `Project` Relation Extension

```prisma
model Project {
  // existing fields...
  config         Json?
  configSyncedAt DateTime?
  setupAttempts  ProjectSetupAttempt[]
}
```

**Purpose**: Keep setup history attached to the project without adding redundant mutable setup-status columns on `Project`.

## Entity Definitions

### Project

Existing entity, extended conceptually with derived setup state.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `Int` | Project-scoped setup owner |
| `userId` | `String` | Owner; only this user can start/retry onboarding |
| `defaultAgent` | `Agent` | Existing default, but setup still requires explicit owner selection |
| `config` | `Json?` | Authoritative synced configuration payload |
| `configSyncedAt` | `DateTime?` | Authoritative signal that setup can be skipped once valid config exists |

### ProjectSetupAttempt

New project-scoped history record.

| Field | Type | Validation / meaning |
|-------|------|----------------------|
| `id` | `Int` | Primary key |
| `projectId` | `Int` | Required FK to `Project` |
| `selectedAgent` | `Agent` | Required; one of `CLAUDE` or `CODEX` |
| `status` | `ProjectSetupStatus` | Required; starts at `PENDING` |
| `workflowRunId` | `BigInt?` | Optional GitHub workflow run reference for observability |
| `attemptNumber` | `Int` | Monotonic per project, used for stable ordering/history |
| `statusMessage` | `String?` | Human-readable progress text shown during pending/running/completed states |
| `failureCode` | `String?` | Machine-friendly failure identifier (`MISSING_CREDENTIAL`, `DUPLICATE_ACTIVE_ATTEMPT`, `CONFIG_SYNC_FAILED`, etc.) |
| `failureMessage` | `String?` | Owner-facing actionable error copy |
| `artifactSummary` | `Json?` | Structured list/summary of created or preserved onboarding artifacts |
| `startedAt` | `DateTime?` | Set when callback transitions to `RUNNING` |
| `completedAt` | `DateTime?` | Set only for final persisted `COMPLETED` or `FAILED` state |
| `createdAt` | `DateTime` | Initial start/retry creation time |
| `updatedAt` | `DateTime` | Prisma managed |

## Derived Application-Layer Structures

### `DerivedProjectSetupState`

```ts
type DerivedProjectSetupState =
  | { kind: 'not_required'; projectId: number }
  | { kind: 'ready_to_start'; projectId: number; latestAttempt: ProjectSetupAttempt | null }
  | { kind: 'pending'; projectId: number; latestAttempt: ProjectSetupAttempt }
  | { kind: 'running'; projectId: number; latestAttempt: ProjectSetupAttempt; elapsedMs: number }
  | { kind: 'failed'; projectId: number; latestAttempt: ProjectSetupAttempt }
  | { kind: 'completed'; projectId: number; latestAttempt: ProjectSetupAttempt };
```

**Rule**: Derive this from the latest attempt plus the project’s current `config` / `configSyncedAt` fields. Do not persist it separately on `Project`.

### `ArtifactSummaryItem`

```ts
interface ArtifactSummaryItem {
  path: string;
  action: 'created' | 'preserved' | 'updated';
  description?: string;
}
```

Stored in `artifactSummary` JSON for display before the owner proceeds to the board.

## State Transitions

### Attempt Lifecycle

```text
null/latest failed -> PENDING -> RUNNING -> COMPLETED
                                 \-> FAILED
PENDING -> FAILED
```

Rules:

- Only one `PENDING` or `RUNNING` attempt may exist per project at a time.
- Retrying after `FAILED` creates a brand new row with a higher `attemptNumber`.
- `COMPLETED` may only be persisted after config synchronization succeeds.
- A callback for an older attempt must not overwrite the derived current state once a newer attempt exists.
- Duplicate callbacks with the same terminal state are idempotent no-ops.

### Project-Level Derived State

```text
config missing + no latest active attempt -> ready_to_start
config missing + latest PENDING           -> pending
config missing + latest RUNNING           -> running
config missing + latest FAILED            -> failed
config present + configSyncedAt set       -> not_required/completed path
```

## Validation Rules

| Concern | Rule |
|---------|------|
| Project access | `GET` setup state uses `verifyProjectAccess`; start/retry uses `verifyProjectOwnership` |
| Agent selection | Exactly one supported `Agent` value is required per start request |
| Credential readiness | Start requires a provider-mapped owner credential with readiness `READY` |
| Active attempt guard | Reject start when latest non-terminal attempt is `PENDING` or `RUNNING` |
| Callback auth | Workflow callback requires valid `WORKFLOW_API_TOKEN` Bearer auth |
| Callback staleness | Ignore or reject state updates for attempts superseded by a newer attempt where they would corrupt latest state |
| Artifact summary | Accept structured JSON array/object; render human-readable output without exposing secrets |

## Relationship Summary

```text
User (owner) 1 ── N Project
Project 1 ── N ProjectSetupAttempt
ProjectSetupAttempt N ── 1 Agent (enum value)
Project owner 1 ── N UserCredential

selectedAgent -> credential provider mapping:
CLAUDE -> ANTHROPIC
CODEX  -> OPENAI
```

## Operational Semantics

- Start/retry creation and workflow dispatch should be handled together so dispatch failures do not leave a misleading active row. If dispatch fails after insertion, mark the new attempt `FAILED` in the same orchestration path with a concrete failure message.
- Successful workflow completion must immediately call `syncProjectConfig()` using project repository coordinates. A sync failure converts the attempt to `FAILED` with preserved `artifactSummary`.
- UI polling should read the derived setup state, not query attempts and config separately from the client.
