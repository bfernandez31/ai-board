# Phase 1 Data Model — AIB-777 Admin Insights

**Branch**: `AIB-777-admin-section-with`
**Date**: 2026-05-10

## Overview

One new entity: `AdminInsightsReport`. The HTML body is *not* a column — it lives in blob storage at `insights/reports/<id>.html` and the row carries only the pointer plus metadata. Per spec's auto-resolved storage decision and Reviewer Notes, the row is created with `status='RUNNING'` *before* workflow dispatch so failed/orphaned runs leave an auditable record.

No changes to existing models. The admin allowlist is configuration, not data (per spec's allowlist-mechanism decision); no new role/admin column is added to `User`.

## Entity: `AdminInsightsReport`

### Prisma model (additions to `prisma/schema.prisma`)

```prisma
model AdminInsightsReport {
  id              Int                       @id @default(autoincrement())
  status          AdminInsightsReportStatus @default(RUNNING)

  // Period covered by the analysis (half-open: [periodStart, periodEnd)).
  // periodStart is the previous successful run's periodEnd, or the earliest
  // available Claude session timestamp on the first-ever run.
  // periodEnd is the trigger timestamp.
  periodStart     DateTime
  periodEnd       DateTime

  // Counts of what the workflow actually fed into /insights, not what the
  // pre-flight predicted. May be 0 on a COMPLETED row when raw artifacts
  // aged out (edge case in spec). NULL on RUNNING and FAILED rows.
  sessionsCount   Int?
  ticketsCount    Int?

  // Pointer to the HTML artifact in blob storage (insights/reports/<id>.html).
  // Set only on COMPLETED. NULL on RUNNING and FAILED.
  htmlBlobKey     String?                   @db.VarChar(300)
  htmlBlobSize    Int?

  // Non-secret, operator-actionable reason. Set only on FAILED. Max 2000
  // chars matches the existing Comment.content cap (prisma/schema.prisma:246).
  errorReason     String?                   @db.VarChar(2000)

  // Identity of the operator who triggered the run. NextAuth User.id is a
  // String, so this is String. ON DELETE SET NULL — keep the audit trail if
  // the user is later deleted; the row's identity is its primary key, not
  // its triggerer.
  triggeredById   String?
  triggeredBy     User?                     @relation("AdminInsightsReportTriggeredBy", fields: [triggeredById], references: [id], onDelete: SetNull)

  // GitHub Actions workflow run id, set on the first RUNNING callback for
  // operator forensics. Not used for state machine decisions.
  workflowRunId   BigInt?

  // Lifecycle timestamps. startedAt is set at row creation (acts as the
  // "RUNNING since" timestamp surfaced in the "Already running since…"
  // refusal message). completedAt is set on the COMPLETED/FAILED transition.
  startedAt       DateTime                  @default(now())
  completedAt     DateTime?

  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt

  // Indexes:
  //   - `status` alone is the hottest query: "is anything RUNNING?" runs on
  //     every page load and every trigger attempt.
  //   - `(status, periodEnd)` supports "previous successful run high-water
  //     mark" lookup (D5): findFirst where status=COMPLETED order by
  //     periodEnd desc.
  //   - `createdAt desc` supports the past-reports list ordering (FR-016).
  @@index([status])
  @@index([status, periodEnd])
  @@index([createdAt])
}

enum AdminInsightsReportStatus {
  RUNNING
  COMPLETED
  FAILED
}
```

### Field validations (Zod ↔ Prisma constraints, per Constitution Principle IV)

| Field | Prisma | Zod (request side) |
|-------|--------|--------------------|
| `id` | `Int @id @default(autoincrement())` | `z.number().int().positive()` for path params. |
| `status` | enum (3 values) | `z.enum(['RUNNING','COMPLETED','FAILED'])` for the workflow PATCH body; `z.enum(['COMPLETED','FAILED'])` if the route enforces "RUNNING is implicit at creation". |
| `periodStart` / `periodEnd` | `DateTime` non-null | `z.coerce.date()`; refine `periodEnd > periodStart` (a zero-length window must be impossible — pre-flight already requires at least one shipped ticket since `periodStart`). |
| `sessionsCount` / `ticketsCount` | `Int?` | `z.number().int().nonnegative()` when present. May be 0 (edge case: aged-out raw artifacts). |
| `htmlBlobKey` | `VarChar(300)` | `z.string().max(300).regex(/^insights\/reports\/\d+\.html$/)` — the regex pin matches the canonical key shape (D4). |
| `htmlBlobSize` | `Int?` | `z.number().int().positive().max(ARTIFACT_MAX_BYTES)` (`ARTIFACT_MAX_BYTES = 25 * 1024 * 1024` from `app/lib/logs/schema.ts:6`). |
| `errorReason` | `VarChar(2000)` | `z.string().min(1).max(2000)`. The validator must reject content that looks like a stack trace containing tokens or paths revealing secrets — but in practice the workflow controls this string, so the constraint is "non-empty when status=FAILED". |
| `triggeredById` | `String?` | `z.string().min(1).max(64)` (matches `User.id`). |
| `workflowRunId` | `BigInt?` | `z.coerce.bigint().positive()`. |

### State machine

```
                 trigger endpoint (POST /api/admin/insights/runs)
                 — pre-flight + concurrency gate pass —
                                  │
                                  ▼
                        ┌──────────────────┐
                        │     RUNNING      │ ◄── only initial state; row is
                        │ (created with    │     created at trigger time.
                        │  periodStart,    │
                        │  periodEnd,      │
                        │  triggeredById)  │
                        └────────┬─────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼                             ▼
       PATCH …/status {COMPLETED}     PATCH …/status {FAILED, errorReason}
       + htmlBlobKey set via PUT      OR lazy reconciliation timeout
       …/html before this PATCH       (D2)
                  │                             │
                  ▼                             ▼
          ┌──────────────┐              ┌──────────────┐
          │  COMPLETED   │              │    FAILED    │
          │ (terminal)   │              │ (terminal)   │
          └──────────────┘              └──────────────┘
```

**Allowed transitions** (`lib/admin/insights/state-machine.ts` mirroring `app/lib/job-state-machine.ts`):
- `RUNNING → COMPLETED`
- `RUNNING → FAILED`

**Disallowed transitions**:
- `COMPLETED → *`, `FAILED → *` — terminal.
- `RUNNING → RUNNING` (idempotent same-status) is accepted with a 200 no-op, mirroring `app/api/jobs/[id]/status/route.ts:167-205`.
- Direct database creation outside the trigger endpoint is forbidden by code review; tests assert the trigger endpoint is the only writer of new rows.

**Atomicity** (P2 from research.md): all `RUNNING → terminal` writes go through `prisma.adminInsightsReport.updateMany({ where: { id, status: 'RUNNING' }, data })`. If `count === 0`, re-read and return current state with 200. This is what makes a duplicated workflow callback (e.g., GitHub Actions retry) impossible to double-finalize.

### Lazy reconciliation rule (D2)

Before any read of "is anything RUNNING?" *and* before any `RUNNING → terminal` transition initiated by the workflow, run:

```ts
const cutoff = new Date(Date.now() - INSIGHTS_RUN_TIMEOUT_MS);
await prisma.adminInsightsReport.updateMany({
  where: { status: 'RUNNING', startedAt: { lt: cutoff } },
  data: {
    status: 'FAILED',
    errorReason: 'Run timed out — workflow did not report terminal status',
    completedAt: new Date(),
  },
});
```

`INSIGHTS_RUN_TIMEOUT_MS` defaults to `60 * 60 * 1000` (60 min). The query is idempotent (running it twice on the same set is a no-op the second time, exactly the behaviour spec's Run-Record Reconciliation Process requires).

### Pre-flight + period derivation (used by the trigger endpoint)

```ts
// 1. Lazy-reconcile orphans first (so the next steps see truth).
await reconcileOrphanedInsightsReports();

// 2. Concurrency gate.
const inFlight = await prisma.adminInsightsReport.findFirst({
  where: { status: 'RUNNING' },
  select: { id: true, startedAt: true },
});
if (inFlight) throw new ConcurrencyConflict(inFlight.startedAt);

// 3. Previous high-water mark (D5).
const previous = await prisma.adminInsightsReport.findFirst({
  where: { status: 'COMPLETED' },
  orderBy: { periodEnd: 'desc' },
  select: { periodEnd: true },
});

// 4. Earliest Claude session bound (used only for first-ever run).
const earliestClaude = previous
  ? null
  : (await prisma.job.findFirst({
      where: { status: 'COMPLETED', startedAt: { not: null }, /* effective agent = CLAUDE */ },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    }))?.startedAt ?? null;

const periodStart = previous?.periodEnd ?? earliestClaude;
const periodEnd = new Date();

if (!periodStart) throw new NoClaudeWorkYet();

// 5. Pre-flight count (D6) — same query the workflow will use to enumerate.
const newShippedTickets = await countNewShippedClaudeTickets(periodStart);
if (newShippedTickets === 0) throw new NoNewShippedTickets(previous?.periodEnd);

// 6. Create the RUNNING row inside a transaction.
const report = await prisma.adminInsightsReport.create({
  data: { status: 'RUNNING', periodStart, periodEnd, triggeredById: userId },
});

// 7. Dispatch (P1: rollback-on-error).
try {
  await dispatchInsightsAnalyzeWorkflow({ reportId: report.id, periodStart, periodEnd });
} catch (e) {
  await prisma.adminInsightsReport.delete({ where: { id: report.id } }).catch(/* logged */);
  throw e;
}
```

### Relationship additions

The `User` model gains one back-relation (no new column on User itself — `triggeredById` lives on `AdminInsightsReport`):

```prisma
model User {
  // …existing fields…
  adminInsightsReportsTriggered AdminInsightsReport[] @relation("AdminInsightsReportTriggeredBy")
}
```

`onDelete: SetNull` keeps the historical audit row when an admin user is removed — consistent with spec's read-only / never-delete posture for reports themselves.

### Out of scope (data-model)

- No new `User.isAdmin` column. Allowlist is env-driven (spec's allowlist-mechanism decision).
- No `notifications` table changes. Spec FR-022 explicitly forbids run-related notifications.
- No `Project` link. Reports are application-wide vantage points, not per-project (spec's Out-of-Scope item #7 — "Any ticket-level, project-level, or per-user partitioning of reports").
- No archival / soft-delete columns. Spec FR-020: reports are read-only artifacts.

## Migration plan

1. `bunx prisma migrate dev --name add_admin_insights_report` — Prisma generates the migration SQL. The migration is purely additive (new table + new enum + new index), no risk of breaking existing data.
2. Verify `bunx prisma generate` runs cleanly so generated types are up-to-date (per CLAUDE.md commit rules).
3. Add a seed helper in `tests/helpers/admin-insights-fixtures.ts` for tests that need pre-existing reports (used by Story 1 + Story 4 integration tests).
