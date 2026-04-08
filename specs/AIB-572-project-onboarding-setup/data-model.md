# Data Model: Project Onboarding — Setup Page + Hybrid Workflow

**Feature Branch**: `AIB-572-project-onboarding-setup`
**Date**: 2026-04-08

## New Entities

### SetupJob

Tracks the state of a project's onboarding workflow. One active setup job per project at a time.

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | Int | PK, autoincrement | Unique identifier |
| `projectId` | Int | FK → Project.id, indexed | Associated project |
| `selectedAgent` | Agent (enum) | Required | Agent CLI selected by owner (CLAUDE / CODEX) |
| `status` | SetupJobStatus (enum) | Default: PENDING | Current workflow state |
| `isPartial` | Boolean | Default: false | True if Phase 1 succeeded but Phase 2 failed |
| `completedFiles` | String[] | Default: [] | List of files committed by the workflow |
| `errorMessage` | String? | VarChar(2000) | Error details if failed |
| `workflowRunId` | BigInt? | | GitHub Actions workflow run ID |
| `startedAt` | DateTime? | | When workflow execution began |
| `completedAt` | DateTime? | | When workflow finished |
| `createdAt` | DateTime | Default: now() | Record creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

**Relationships**:
- `project` → `Project` (many-to-one, onDelete: Cascade)

**Indexes**:
- `@@index([projectId, status])` — query active jobs for duplicate guard
- `@@index([projectId, createdAt(sort: Desc)])` — query latest job for status

**Unique constraint**: None at DB level (duplicate guard enforced in application logic by checking for PENDING/RUNNING status before creation)

### SetupJobStatus (enum)

| Value | Description |
|-------|-------------|
| `PENDING` | Job created, workflow not yet started |
| `RUNNING` | Workflow execution in progress |
| `COMPLETED` | Workflow finished (check `isPartial` for partial success) |
| `FAILED` | Workflow failed entirely |

## Modified Entities

### Project (extended relationship)

| Change | Description |
|--------|-------------|
| Add relation `setupJobs` | `SetupJob[]` — one-to-many relationship to track onboarding history |

No new fields on Project — existing `config` (Json?) and `configSyncedAt` (DateTime?) are populated by the post-workflow config sync.

## Extended Enums (lib/validations/config.ts)

### ProjectLanguageSchema

Add: `ruby`, `php`

### ProjectFrameworkSchema

Add: `rails`, `laravel`

### PackageManagerSchema

Add: `bundler`, `composer`

## State Transitions

```
                    ┌──────────┐
   POST /setup ───▶│  PENDING  │
                    └────┬─────┘
                         │ workflow starts (callback)
                    ┌────▼─────┐
                    │  RUNNING  │
                    └────┬─────┘
                         │
                ┌────────┼────────┐
                │        │        │
           ┌────▼───┐ ┌─▼──────┐ │
           │COMPLETED│ │COMPLETED│ │
           │         │ │isPartial│ │
           │(full)   │ │= true   │ │
           └─────────┘ └─────────┘ │
                                   │
                              ┌────▼──┐
                              │ FAILED │
                              └───┬────┘
                                  │ user clicks Retry
                              ┌───▼──────┐
                              │  PENDING  │ (new job)
                              └──────────┘
```

**Retry behavior**: On retry, a new SetupJob record is created (old one stays as historical record). The duplicate guard checks for PENDING or RUNNING status only, so COMPLETED/FAILED jobs don't block retry.

## Validation Rules

### Dispatch Request (POST /api/projects/[projectId]/setup)

```typescript
const DispatchSetupSchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
});
```

### Status Callback (PATCH from workflow)

```typescript
const SetupStatusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  isPartial: z.boolean().optional(),
  completedFiles: z.array(z.string()).optional(),
  errorMessage: z.string().max(2000).optional(),
  workflowRunId: z.number().optional(),
});
```
