# Data Model: Admin Insights

**Feature**: AIB-791
**Date**: 2026-05-11

## Overview

One new database model (`InsightsReport`) and one new enum (`InsightsRunStatus`). No
modifications to existing tables. The Vercel Blob artifact for each report is keyed
deterministically by the row's primary key and is not represented as its own table.

## Entities

### Entity: `InsightsReport`

The metadata row for one Insights analysis attempt. Created in RUNNING status BEFORE the
workflow is dispatched (FR-013), transitions to exactly one of COMPLETED or FAILED.

**Prisma fragment** (target shape — exact migration name and ordering decided at implementation
time):

```prisma
model InsightsReport {
  id              Int                 @id @default(autoincrement())
  status          InsightsRunStatus   @default(RUNNING)
  generatedAt     DateTime            @default(now())  // trigger timestamp
  periodStart     DateTime                              // first-run: earliest Claude job; else previous run's periodEnd
  periodEnd       DateTime                              // trigger timestamp (same as generatedAt at creation)
  sessionsCount   Int?                                  // populated on COMPLETED
  ticketsCount    Int?                                  // populated on COMPLETED
  artifactKey     String?             @db.VarChar(300)  // populated on COMPLETED — `insights/reports/<id>.html`
  artifactSize    Int?                                  // bytes
  errorReason     String?             @db.VarChar(500)  // populated on FAILED
  jobId           Int?                                  // optional pointer to the Job row driving the workflow
  job             Job?                @relation(fields: [jobId], references: [id], onDelete: SetNull)
  completedAt     DateTime?                             // populated on COMPLETED or FAILED
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([status, createdAt])
  @@index([generatedAt])
  @@index([periodEnd])
}

enum InsightsRunStatus {
  RUNNING
  COMPLETED
  FAILED
}
```

#### Fields

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `id` | Int (autoincrement) | yes | n/a | Primary key. Used as the report's identity in URL paths and blob keys. |
| `status` | `InsightsRunStatus` | yes | one of `RUNNING`, `COMPLETED`, `FAILED` | Default `RUNNING` on insert. Transitions are atomic conditional (P-1). |
| `generatedAt` | DateTime | yes | n/a | Trigger timestamp — never changes. Used in the canonical header phrasing for COMPLETED rows. |
| `periodStart` | DateTime | yes | `periodStart <= periodEnd` | Half-open window start (inclusive). First-run: earliest Claude job's `startedAt`. Subsequent runs: previous COMPLETED row's `periodEnd`. |
| `periodEnd` | DateTime | yes | `periodEnd >= periodStart` | Half-open window end (exclusive). Equal to `generatedAt` at row creation. |
| `sessionsCount` | Int? | only on COMPLETED | `>= 0` | Count of Claude Code sessions actually fed into `/insights`. Reported by the workflow at finalization. |
| `ticketsCount` | Int? | only on COMPLETED | `>= 0` | Count of distinct tickets the sessions belonged to. Reported by the workflow. |
| `artifactKey` | String? (VarChar 300) | only on COMPLETED | matches `^insights/reports/\d+\.html$` | Deterministic — equal to `buildInsightsReportKey(id)`. Stored explicitly so a future key-shape change doesn't break old rows. |
| `artifactSize` | Int? | only on COMPLETED | `> 0` | Bytes of the HTML artifact. |
| `errorReason` | String? (VarChar 500) | only on FAILED | non-secret, operator-actionable | Examples: `"Workflow dispatch failed: ..."`, `"Insights output validation failed"`, `"Artifact upload rejected by storage"`, `"Run timed out — workflow did not report terminal status"`. |
| `jobId` | Int? | optional | FK to `Job.id` (nullable, `onDelete: SetNull`) | Set when the trigger creates the corresponding `Job` row (workflow dispatch). May remain null if dispatch failed before job creation (D-5 specifies dispatch occurs AFTER both rows, so this scenario is rare but possible). |
| `completedAt` | DateTime? | only on terminal | n/a | Populated when transitioning to COMPLETED or FAILED. |
| `createdAt` / `updatedAt` | DateTime | yes | n/a | Standard timestamps. `createdAt` equals `generatedAt` for the same row; both columns kept for query-pattern flexibility. |

#### Validation rules (enforced in code, not DB constraints)

- **VR-1**: `periodStart < periodEnd` strictly when sessions exist; allowed `periodStart == periodEnd`
  only on a cold-start refusal that never inserts a row (defense-in-depth check).
- **VR-2**: A row may NOT transition from `COMPLETED` back to any other status.
- **VR-3**: A row may NOT transition from `FAILED` back to any other status.
- **VR-4**: A `RUNNING` row whose `createdAt < now() - INSIGHTS_RUN_TIMEOUT_MINUTES` is eligible
  for the reconciliation atomic update to FAILED.
- **VR-5**: A FAILED row MUST have a non-empty `errorReason`.
- **VR-6**: A COMPLETED row MUST have all of: `artifactKey`, `artifactSize`, `sessionsCount`,
  `ticketsCount`, `completedAt`.
- **VR-7**: `artifactKey`, when present, MUST equal `buildInsightsReportKey(id)`. A row whose
  `artifactKey` does not match (corrupted insert) is treated as a blob-404 (FR-024 placeholder)
  at serve time.

#### Relationships

- `InsightsReport.jobId` → `Job.id` (optional, `onDelete: SetNull`). Used only for log
  artifact traceability — the workflow's own job logs are available through the existing
  `/api/projects/:projectId/tickets/:id/jobs/:jobId/logs/...` route family. Since insights jobs
  do NOT belong to a user-visible ticket, the linkage is informational; the admin Insights page
  does NOT render any job-log UI.
- No relationship to `Project` or `Ticket`. This is intentional — the report is application-wide.

#### Indexes

- `@@index([status, createdAt])` — used by `reconcileOrphanedRunningReports` to find stale RUNNING
  rows and by the concurrency gate (`exists RUNNING`).
- `@@index([generatedAt])` — used by the list endpoint's `ORDER BY generatedAt DESC LIMIT 200`.
- `@@index([periodEnd])` — used by `getLastCompletedRunEnd()` (`ORDER BY periodEnd DESC LIMIT 1
  WHERE status='COMPLETED'`).

#### Lifecycle / state transitions

```
                       (insert)
                          │
                          ▼
                      ┌─────────┐
                      │ RUNNING │
                      └─────────┘
                          │
            ┌─────────────┴─────────────────────┐
            │                                   │
   workflow PATCH                       reconciliation
   /finalize success                    (idle > timeout)
   AND output validation OK             OR dispatch-failure rollback
            │                                   │
            ▼                                   ▼
       ┌──────────┐                       ┌─────────┐
       │ COMPLETED│  ◀──── (terminal) ──▶ │ FAILED  │
       └──────────┘                       └─────────┘
            │                                   │
            └────────── (no exit) ──────────────┘
```

Every transition uses the atomic pattern from P-1:
```ts
await prisma.insightsReport.updateMany({
  where: { id, status: 'RUNNING' },   // guard
  data: { status: '...', ... },
});
```

A late workflow callback for a row already auto-FAILED finds no row matching the
`status: 'RUNNING'` guard; the update is a no-op (`count === 0`); the row's terminal status is
preserved (SC-012).

## Auxiliary entity: `Job` (existing, with one new `command` value)

No schema change. The implementation adds one valid value to the existing `Job.command` string
column: `insights-analyze`. Documentation update only.

- A `Job` row IS created for each accepted trigger (alongside the `InsightsReport` row) so the
  existing log-capture pipeline, push-notification opt-out, and version-capture machinery work
  unchanged. The `Job.ticketId` field is non-nullable in the current schema and the new job
  has no natural ticket — see **Migration note** below.

### Migration note (ticketId requirement)

`Job.ticketId` is currently non-nullable (`prisma/schema.prisma:31`). Three options, ordered by
preference:

1. **(Chosen)** Make `Job.ticketId` nullable in this migration. The new `insights-analyze`
   command has no ticket. Risk: existing code paths assuming non-null `ticketId`. Implementation
   must grep for `job.ticketId` consumers and confirm each handles the new null case (most
   already do via `?.` access; verify in the implementation phase).
2. Create a sentinel "Admin/Insights" project and ticket (project key `ADM`). Rejected: pollutes
   the tickets list and tangles tenancy.
3. Skip creating a `Job` row entirely; use a custom workflow-token endpoint only. Rejected:
   loses log capture, push opt-out logic, version capture, and `JobLog` linkage.

**Concrete migration** (in addition to `InsightsReport` + `InsightsRunStatus`):

```sql
ALTER TABLE "Job" ALTER COLUMN "ticketId" DROP NOT NULL;
```

Prisma schema change: `ticketId Int?` and `ticket Ticket? @relation(...)`. Audit consumers
during implementation.

---

## Configuration values (not data, included for completeness)

| Env var | Default | Read where | Purpose |
|---------|---------|------------|---------|
| `ADMIN_ALLOWLIST` | (empty — no admins) | `app/lib/auth/admin.ts` | Comma-separated emails. |
| `INSIGHTS_RUN_TIMEOUT_MINUTES` | `60` | `app/lib/insights/reconcile.ts` | Reconciliation cutoff. |
| `BLOB_READ_WRITE_TOKEN` | (required in prod) | `app/lib/blob/client.ts:4` | Vercel Blob auth (already in use). |
| `WORKFLOW_API_TOKEN` | (required in prod) | `lib/auth/workflow-token.ts:26` | Workflow-token auth for PATCH/PUT endpoints (already in use). |

## What is NOT modeled

- **Admin allowlist as a table**: explicit non-goal (FR-002).
- **Per-user pinning / favorites / bookmarks on reports**: out of scope.
- **Report tags / labels / annotations**: out of scope (FR-020).
- **Soft delete (`deletedAt`)**: reports are immutable after creation. The existing constitution
  rule "soft deletes for user-generated content" does NOT apply — reports are operator artifacts
  with no user-generated content.
- **Multi-agent reports**: out of scope (FR-010).
