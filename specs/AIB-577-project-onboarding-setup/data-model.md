# Data Model: Project Onboarding Setup

**Branch**: `AIB-577-project-onboarding-setup` | **Date**: 2026-04-08

## New Entities

### ProjectSetupJob

Represents a single onboarding attempt for a project. Each project can have multiple setup jobs (retry history). The most recent active job determines the project's setup state.

**Modeled after**: `HealthScan` (project-scoped, status lifecycle, workflow dispatch, error tracking)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `Int` | PK, autoincrement | Unique identifier |
| `projectId` | `Int` | FK → Project.id, NOT NULL | Parent project |
| `agent` | `Agent` (enum) | NOT NULL | Selected agent CLI (CLAUDE or CODEX) |
| `status` | `SetupJobStatus` (enum) | NOT NULL, default: PENDING | Current job status |
| `workflowRunId` | `BigInt?` | nullable | GitHub Actions workflow run ID |
| `errorMessage` | `String?` | max 2000 chars | Error details on failure |
| `artifactSummary` | `Json?` | nullable | Summary of files created by workflow (empty for stub) |
| `startedAt` | `DateTime?` | nullable | Set when status → RUNNING |
| `completedAt` | `DateTime?` | nullable | Set when status → terminal |
| `createdAt` | `DateTime` | default: now() | Record creation time |
| `updatedAt` | `DateTime` | @updatedAt | Last update time |

**Relations**:
- `project` → `Project` (many-to-one, cascade delete)
- `Project.setupJobs` → `ProjectSetupJob[]` (one-to-many)

**Indexes**:
- `@@index([projectId, status])` — fast lookup of active jobs for duplicate prevention
- `@@index([projectId, createdAt(sort: Desc)])` — fast latest-job query for derived status

### SetupJobStatus (Enum)

| Value | Description | Terminal? |
|-------|-------------|-----------|
| `PENDING` | Job created, workflow dispatch initiated | No |
| `RUNNING` | Workflow reported start | No |
| `COMPLETED` | Workflow reported success | Yes |
| `FAILED` | Workflow reported failure | Yes |

**State transitions** (same pattern as `JobStatus`):
- `PENDING` → `RUNNING`
- `RUNNING` → `COMPLETED` | `FAILED`
- Terminal states → self only (idempotent)

Note: `CANCELLED` is omitted because setup jobs have no cancellation UX in this ticket. Can be added later if needed.

## Modified Entities

### Project (extended)

No new persisted fields. The following are derived:

| Derived Property | Source | Logic |
|------------------|--------|-------|
| `needsSetup` | `configSyncedAt` + `ProjectSetupJob` | `configSyncedAt IS NULL` — project was imported but never configured |
| `setupStatus` | Latest `ProjectSetupJob` by `createdAt DESC` | PENDING/RUNNING → in-progress; COMPLETED → awaiting sync; FAILED → show error; none → show initial setup form |

**Schema change**: Add `setupJobs ProjectSetupJob[]` relation to the Project model.

## Prisma Schema Addition

```prisma
enum SetupJobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model ProjectSetupJob {
  id              Int             @id @default(autoincrement())
  projectId       Int
  agent           Agent
  status          SetupJobStatus  @default(PENDING)

  // Workflow tracking
  workflowRunId   BigInt?

  // Error tracking
  errorMessage    String?         @db.VarChar(2000)

  // Artifacts produced by workflow
  artifactSummary Json?

  // Timestamps
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relations
  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
  @@index([projectId, createdAt(sort: Desc)])
}
```

Add to Project model:
```prisma
setupJobs ProjectSetupJob[]
```

## Validation Rules

### Pre-Dispatch Validation

1. **Owner-only**: Only the project owner (`project.userId === session.userId`) can create setup jobs
2. **No active job**: No existing `ProjectSetupJob` with status `PENDING` or `RUNNING` for this project
3. **Not already configured**: Project `configSyncedAt` must be `null`
4. **Credential exists**: Owner must have a `UserCredential` with matching provider (CLAUDE → ANTHROPIC, CODEX → OPENAI) and `readinessStatus` of `READY`
5. **Valid agent**: Must be `CLAUDE` or `CODEX` (validated by Zod enum)

### Agent-to-Provider Mapping

| Agent | CredentialProvider |
|-------|-------------------|
| `CLAUDE` | `ANTHROPIC` |
| `CODEX` | `OPENAI` |

This mapping is used for:
- Pre-dispatch credential verification
- Workflow environment variable injection
- Setup page UI credential guidance
