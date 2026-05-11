# Data Model: Admin Section with Claude Code Insights Report

**Branch**: `AIB-790-admin-section-with` | **Date**: 2026-05-11

## New Entities

### InsightsRun

Represents a single execution of the Claude Code `/insights` analysis over captured agent sessions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | PK, autoincrement | Unique run identifier |
| `status` | InsightsRunStatus | NOT NULL, default PENDING | Current state: PENDING → RUNNING → COMPLETED/FAILED |
| `triggeredBy` | String | NOT NULL, FK → User.id | Admin who triggered the run |
| `periodStart` | DateTime | NULL | Start of analyzed period (null until analysis begins) |
| `periodEnd` | DateTime | NULL | End of analyzed period (null until analysis begins) |
| `sessionCount` | Int | NULL | Number of Claude sessions analyzed |
| `ticketCount` | Int | NULL | Number of shipped tickets covered |
| `reportKey` | String? | VarChar(300) | Blob storage key for the HTML report artifact |
| `reportSize` | Int? | NULL | Size of the HTML report in bytes |
| `errorMessage` | String? | VarChar(2000) | Error description if run failed |
| `timeoutAt` | DateTime | NOT NULL | Deadline after which a stuck run can be re-triggered |
| `startedAt` | DateTime? | NULL | When analysis processing began |
| `completedAt` | DateTime? | NULL | When analysis finished (success or failure) |
| `createdAt` | DateTime | NOT NULL, default now() | Record creation timestamp |
| `updatedAt` | DateTime | NOT NULL, @updatedAt | Last modification timestamp |

**Indexes**:
- `@@index([status, createdAt])` — find PENDING/RUNNING runs for duplicate check
- `@@index([createdAt(sort: Desc)])` — chronological listing of all runs (newest first)
- `@@index([status])` — filter by status

**Relations**:
- `triggeredBy` → `User.id` (onDelete: Cascade)

### InsightsRunStatus (Enum)

| Value | Description |
|-------|-------------|
| `PENDING` | Run created, analysis not yet started |
| `RUNNING` | Analysis in progress (downloading artifacts, running /insights) |
| `COMPLETED` | Analysis finished successfully, report available |
| `FAILED` | Analysis encountered an error |

### State Transitions

```
PENDING → RUNNING     (analysis starts processing)
PENDING → FAILED      (pre-flight check fails, e.g., no blob token)
RUNNING → COMPLETED   (report generated and uploaded)
RUNNING → FAILED      (analysis error, CLI failure, blob upload failure)
```

**Timeout behavior**: If a run is in PENDING or RUNNING state and `timeoutAt` has passed, it is considered stuck. A new run can be triggered despite the existing one — the stuck run is marked FAILED with `errorMessage: "Timed out"` before creating the new one.

## Blob Artifact

### Insights Report (HTML)

- **Key pattern**: `insights-reports/<runId>.html`
- **Content type**: `text/html; charset=utf-8`
- **Access**: `private` (proxied through authenticated API route)
- **Immutable**: Once created, never modified or overwritten
- **No retention policy initially**: Reports are small (< 1MB typically) and have long-term value for trend analysis

## Validation Rules

### InsightsRun Creation (Trigger)
- Caller must be authenticated AND on admin allowlist (`ADMIN_EMAILS` env var)
- No existing run with `status IN (PENDING, RUNNING)` unless `timeoutAt < now()`
- `BLOB_READ_WRITE_TOKEN` must be configured (checked at trigger time, not deferred)
- At least one shipped ticket with CLAUDE agent sessions must exist since last successful run's `periodEnd` (or all-time for first run)

### InsightsRun Status Update
- Must follow valid state transitions (no backward transitions)
- `COMPLETED` requires `reportKey`, `sessionCount`, `ticketCount`, `periodStart`, `periodEnd`
- `FAILED` requires `errorMessage`
- `startedAt` set on transition to RUNNING
- `completedAt` set on transition to COMPLETED or FAILED

## Environment Variables

| Variable | Format | Required | Description |
|----------|--------|----------|-------------|
| `ADMIN_EMAILS` | Comma-separated emails | Yes (for admin area to function) | Allowlist of users who can access /admin. Fail-closed: if empty or missing, no one has access. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | Yes (existing) | Already used for job log artifacts; reused for report storage |

## Schema Changes (Prisma)

```prisma
enum InsightsRunStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model InsightsRun {
  id           Int               @id @default(autoincrement())
  status       InsightsRunStatus @default(PENDING)
  triggeredBy  String
  periodStart  DateTime?
  periodEnd    DateTime?
  sessionCount Int?
  ticketCount  Int?
  reportKey    String?           @db.VarChar(300)
  reportSize   Int?
  errorMessage String?           @db.VarChar(2000)
  timeoutAt    DateTime
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  user User @relation(fields: [triggeredBy], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@index([createdAt(sort: Desc)])
  @@index([status])
}
```

**Migration note**: `User` model needs `insightsRuns InsightsRun[]` relation field added.

## Query Patterns

### Find latest completed run
```typescript
prisma.insightsRun.findFirst({
  where: { status: 'COMPLETED' },
  orderBy: { createdAt: 'desc' },
})
```

### Check for active run (duplicate prevention)
```typescript
prisma.insightsRun.findFirst({
  where: {
    status: { in: ['PENDING', 'RUNNING'] },
    timeoutAt: { gt: new Date() },
  },
})
```

### List all runs (paginated, newest first)
```typescript
prisma.insightsRun.findMany({
  orderBy: { createdAt: 'desc' },
  take: limit + 1,
  ...(cursor ? { where: { id: { lt: cursor } } } : {}),
})
```

### Find shipped CLAUDE tickets since last run
```typescript
prisma.ticket.findMany({
  where: {
    stage: 'SHIP',
    updatedAt: { gt: lastRun?.periodEnd ?? new Date(0) },
    OR: [
      { agent: 'CLAUDE' },
      { agent: null, project: { is: { defaultAgent: 'CLAUDE' } } },
    ],
  },
  include: {
    jobs: {
      where: { status: 'COMPLETED' },
      include: { log: { select: { rawArtifactKey: true, captureStatus: true } } },
    },
  },
})
```
