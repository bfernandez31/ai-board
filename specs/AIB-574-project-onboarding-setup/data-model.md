# Data Model: Project Onboarding — Setup Page, API, and Job Tracking

**Feature Branch**: `AIB-574-project-onboarding-setup`
**Date**: 2026-04-08

## New Entity: ProjectSetupJob

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | PK, auto-increment | Unique identifier |
| `projectId` | Int | FK → Project.id, NOT NULL | Parent project |
| `agent` | Agent (enum) | NOT NULL | Selected agent CLI (CLAUDE or CODEX) |
| `status` | JobStatus (enum) | NOT NULL, default: PENDING | Current job status |
| `workflowRunId` | BigInt? | nullable | GitHub Actions workflow run ID |
| `logs` | String? | nullable | Error details on failure |
| `artifactSummary` | Json? | nullable | List of files created by workflow (stub: empty) |
| `startedAt` | DateTime | NOT NULL, default: now() | When the job was created |
| `completedAt` | DateTime? | nullable | When the job reached terminal state |
| `createdAt` | DateTime | NOT NULL, default: now() | Record creation time |
| `updatedAt` | DateTime | NOT NULL, @updatedAt | Last modification time |

### Relationships

- `ProjectSetupJob.projectId` → `Project.id` (many-to-one, cascade delete)
- `Project.setupJobs` → `ProjectSetupJob[]` (one-to-many, reverse relation)

### Prisma Schema Addition

```prisma
model ProjectSetupJob {
  id              Int       @id @default(autoincrement())
  projectId       Int
  agent           Agent
  status          JobStatus @default(PENDING)
  workflowRunId   BigInt?
  logs            String?
  artifactSummary Json?
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

### Indexes

- Implicit: `projectId` (foreign key)
- Query pattern: Latest setup job per project → `ORDER BY createdAt DESC LIMIT 1` (no composite index needed at current scale)

## Extended Entity: Project

### New Relation Only

| Change | Description |
|--------|-------------|
| `setupJobs ProjectSetupJob[]` | Reverse relation added to Project model |

No new fields on Project — setup state is derived from the latest `ProjectSetupJob` status and existing `configSyncedAt` field.

## State Machine

Reuses existing `JobStatus` enum with same transitions defined in `app/lib/job-state-machine.ts`:

```
PENDING → RUNNING → COMPLETED
                  → FAILED
                  → CANCELLED
```

### Derived Project Setup State (application logic, not DB field)

| Condition | Derived State |
|-----------|--------------|
| `project.configSyncedAt` is not null | CONFIGURED (bypass setup) |
| No `ProjectSetupJob` exists | NEEDS_SETUP |
| Latest job is PENDING or RUNNING | IN_PROGRESS |
| Latest job is COMPLETED (but configSyncedAt is null) | SYNC_FAILED |
| Latest job is FAILED or CANCELLED | FAILED (retryable) |

## Validation Rules

- `agent` must be a valid `Agent` enum value (CLAUDE or CODEX)
- Only project owners can create setup jobs (FR-015)
- Cannot create a new job while one is PENDING or RUNNING (FR-006, 409 Conflict)
- Cannot create a job if `project.configSyncedAt` is not null (FR-007, 409 Conflict)
- Status transitions validated by existing state machine before persistence
