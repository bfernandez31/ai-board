# Data Model: Capture native Claude Code session JSONL alongside normalized logs

**Branch**: `AIB-783-copy-of-capture` | **Date**: 2026-05-08

This feature adds two nullable columns to one existing table and one new object-storage object class. No new tables, no new enum values, no new relationships.

---

## Entities

### JobLog (extended)

Existing model from `prisma/schema.prisma:77-94`. Two columns added:

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | `Int` | PK, autoincrement | unchanged |
| `jobId` | `Int` | unique, FK → `Job.id` (cascade delete) | unchanged |
| `captureStatus` | `CaptureStatus` | enum | unchanged. Reflects *normalized* capture only. |
| `preview` | `String(320)` | required | unchanged |
| `schemaVersion` | `Int` | default `1` | unchanged. Refers to the *normalized* artifact schema. |
| `eventCount` | `Int` | default `0` | unchanged |
| `errorCount` | `Int` | default `0` | unchanged |
| `artifactKey` | `String(300)?` | nullable | unchanged. Normalized artifact key. |
| `artifactSize` | `Int?` | nullable | unchanged. Normalized artifact size in bytes (compressed). |
| **`rawArtifactKey`** | **`String(300)?`** | **nullable** | **NEW.** Raw native Claude Code session artifact key. Non-null iff a raw artifact was successfully uploaded for this job. |
| **`rawArtifactSize`** | **`Int?`** | **nullable** | **NEW.** Compressed size in bytes of the raw artifact. Must be set iff `rawArtifactKey` is set. |
| `capturedAt` | `DateTime` | default `now()` | unchanged |
| `createdAt` | `DateTime` | default `now()` | unchanged |
| `updatedAt` | `DateTime` | `@updatedAt` | unchanged |

**Indexes**: unchanged. `(captureStatus, createdAt)` and `(createdAt)` already cover the prune scan; the new columns are not selective enough to warrant indexing.

**Validation rules**:
- `rawArtifactKey` and `rawArtifactSize` MUST both be set or both be null. The Zod submission schema enforces this with a refine() rule (see `app/lib/logs/schema.ts` extension); the database trusts the application layer (no `CHECK` constraint, mirroring how the normalized pair is enforced today).
- When `rawArtifactKey` is set, its value MUST equal `buildJobLogRawArtifactKey(projectId, ticketId, jobId)`. Drift is detected at retrieval time (P1 in research.md) and logged as `ARTIFACT_KEY_MISMATCH`.
- When `captureStatus === 'PRUNED'`, both `rawArtifactKey` and `rawArtifactSize` MUST be cleared by the prune cycle (mirroring how `artifactKey`/`artifactSize` are cleared today).

**State transitions** (per row, indexed by `captureStatus`):
- Initial → `CAPTURED` *with* normalized: `artifactKey` set, `rawArtifactKey` may or may not be set (depends on agent + raw success).
- Initial → `CAPTURED` *without* raw: `artifactKey` set, `rawArtifactKey === null`. This is the path for non-Claude jobs, Claude-no-data jobs, and Claude jobs whose raw upload failed.
- Initial → `UNAVAILABLE`: `artifactKey === null`, `rawArtifactKey === null`. The runner does not attempt raw upload if normalized failed (failure-isolation contract D5: raw runs *after* normalized success).
- Any → `PRUNED`: `artifactKey === null`, `rawArtifactKey === null`. Both Blob objects deleted in the same prune iteration.

### CaptureStatus enum
Unchanged. Values remain `CAPTURED | UNAVAILABLE | PRUNED`. The raw substate is encoded in `rawArtifactKey` nullability; reusing this enum for raw would require six values and is rejected in research.md D4.

### Job (read-only join target)
Unchanged. The retrieval endpoint joins `Job → Ticket` to read `Ticket.agent` for the Claude gate. No new column on Job.

### Ticket (read-only join target)
Unchanged. `Ticket.agent` (`Agent?`, prisma/schema.prisma:182) is the source of truth for the Claude gate.

### Agent enum
Unchanged. The runner-side gate uses the `AGENT_TYPE` env var (string match against `CLAUDE`); the server-side gate uses `Ticket.agent === 'CLAUDE'`.

---

## Object storage layout (Vercel Blob)

| Object | Key pattern | Owner | Retention |
|--------|-------------|-------|-----------|
| Normalized artifact (existing) | `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` | runner via `PUT /api/jobs/:id/logs/artifact` | 30 days |
| **Raw native artifact (new)** | `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` | runner via `PUT /api/jobs/:id/logs/raw-artifact` (Claude only) | 30 days |

**Determinism**: Both keys use the same `(projectId, ticketId, jobId)` tuple read from the database (not from workflow inputs that may be ticket *keys*). This matches the existing pattern in `app/api/jobs/[id]/logs/artifact/route.ts:65`.

**Co-residence**: Both objects share the same Blob bucket and the same access mode (`access: 'private'`). They are deleted together by the extended pruning job; the `deleteJobLogArtifact` client helper works for both keys (see `app/lib/blob/client.ts:53`).

---

## Migration

`prisma/migrations/<timestamp>_add_job_log_raw_artifact/migration.sql`:
```sql
ALTER TABLE "JobLog"
  ADD COLUMN "rawArtifactKey" VARCHAR(300),
  ADD COLUMN "rawArtifactSize" INTEGER;
```

**Risk**: zero — both columns are nullable with no default, so existing rows remain valid. No data migration. No index added.

**Backfill**: none. Pre-existing JobLog rows have `rawArtifactKey === null`, which the retrieval endpoint correctly treats as "raw not available" → 404.

**Rollback**: drop the two columns. Any rows with non-null `rawArtifactKey` would lose their pointer to a Blob object that the prune job would still need to delete; for that reason a rollback in production should be paired with a one-time list-and-delete of `raw-logs/...` keys.
