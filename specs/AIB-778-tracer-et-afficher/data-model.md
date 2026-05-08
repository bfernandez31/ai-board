# Phase 1 Data Model: AIB-778

## Affected entity: `Job` (existing)

Source of truth: `prisma/schema.prisma:29-75`. Two new optional fields are added; nothing else changes.

### Fields added

| Field name | Type | Prisma | Nullable | Default | Indexed | Notes |
|------------|------|--------|----------|---------|---------|-------|
| `pluginVersion` | String | `String? @db.VarChar(40)` | yes | (none) | no | Plugin manifest `version` field, captured at job start |
| `agentCliVersion` | String | `String? @db.VarChar(40)` | yes | (none) | no | First trimmed line of agent CLI's `--version` output |

### Validation rules

- **Length**: ≤ 40 characters at the database column level (`VarChar(40)`) and at the API layer (`z.string().max(40)`). Any plausible semver, calver, or `1.x.y (Tool Name)` string fits well within 40 chars.
- **Allowed contents**: Free-form ASCII string. Spec explicitly notes "capture is not validation" — malformed semver from a CLI is stored as-is.
- **Empty string**: NOT permitted. The runner converts empty captures to absent fields in the JSON payload (P6 in research.md). Zod `optional()` accepts absence; an empty string value would be normalized to `undefined` by the runner before the request leaves the workflow.
- **Null semantics**: `null` means "not captured" — covers (a) jobs that pre-date this feature, (b) jobs whose capture step failed, (c) jobs cancelled before capture completed.

### Why no enum / no separate table

- Values are free-form strings opaque to the application logic; no need to constrain via an enum.
- Two scalar columns suffice. A separate `JobRuntime` join table would be over-engineering — there is no 1-to-many relationship and no cross-job reuse.

### State transitions

These fields are write-once-on-RUNNING:

```
PENDING ──► RUNNING ──► COMPLETED / FAILED / CANCELLED
            ▲
            └── pluginVersion + agentCliVersion populated here, first-write-wins
```

- Both fields are `null` while the job is `PENDING`.
- The PATCH that transitions the job to `RUNNING` carries the values in its body (when capture succeeded). The handler writes them in the same `prisma.job.updateMany` call that sets `status: RUNNING`, gated by `where: { id, status: currentStatus }` (atomic conditional update — pattern P2).
- Subsequent PATCHes (RUNNING → COMPLETED/FAILED/CANCELLED) MUST NOT touch these columns.
- Idempotent retry of the RUNNING PATCH MUST NOT overwrite a previously-populated value (first-write-wins guard, pattern P1).

### Migration

```sql
-- prisma/migrations/<timestamp>_add_job_runtime_versions/migration.sql
ALTER TABLE "Job"
  ADD COLUMN "pluginVersion"   VARCHAR(40),
  ADD COLUMN "agentCliVersion" VARCHAR(40);
```

- Both columns nullable, no default → existing rows stay `NULL` (matches FR-005: no backfill).
- No new index — neither column is queried for filtering or sorting.
- Migration is reversible (`DROP COLUMN`) with no data loss for jobs created before the feature shipped.

### Read model (API → UI)

`GET /api/projects/:projectId/tickets/:id/jobs` returns each Job's selected fields. The response shape grows by exactly two keys:

```json
{
  "id": 123,
  "command": "specify",
  "status": "COMPLETED",
  "model": "claude-sonnet-4-6",
  "inputTokens": 1000,
  "outputTokens": 500,
  "...": "...existing telemetry fields...",
  "pluginVersion":   "1.0.1",
  "agentCliVersion": "1.0.92 (Claude Code)"
}
```

Both keys are always present (string or null), never omitted.

### Type contract (TypeScript)

`lib/types/job-types.ts` — `TicketJobWithTelemetry` interface gains:

```ts
pluginVersion: string | null;
agentCliVersion: string | null;
```

Inserted alphabetically grouped with the other nullable string metric fields (`model`, `qualityScoreDetails`).

## No other entity is affected

- `Project`, `Ticket`, `JobLog`, `Subscription`, `Notification`, `User` — unchanged.
- `JobStatus` enum — unchanged.
- `AgentType` enum — unchanged.
- No new model. No new relation. No new index.
