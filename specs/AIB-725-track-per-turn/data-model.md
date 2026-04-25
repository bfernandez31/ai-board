# Data Model: Track Per-Turn Context Size on Jobs (AIB-725)

**Branch**: `AIB-725-track-per-turn` | **Spec**: `specs/AIB-725-track-per-turn/spec.md`

## Entities

### `Job` (extended)

Three new nullable integer columns, alongside the existing `inputTokens` / `outputTokens` / `durationMs` / etc. pattern. No new tables, no new relations, no new indexes.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `peakContextTokens` | `Int` | ✅ | Maximum per-turn context size observed during the job (input + cache_read + cache_creation, per D-001). `null` when the agent exposes no per-turn telemetry (Mistral today) or when no per-turn events were successfully parsed. |
| `avgContextTokens` | `Int` | ✅ | Arithmetic mean across parsed turns, rounded to integer. `null` under the same conditions as `peakContextTokens`, or when `turnCount == 0`. |
| `turnCount` | `Int` | ✅ | Number of per-turn events successfully parsed during the job. `null` under the same conditions as above. Gemini jobs leave this `null` because Gemini emits cumulative snapshots rather than per-turn deltas (see D-001). |

**All three share the same "null if unknown" contract** — FR-004 requires that `0` is never used as a stand-in, and the three fields either all populate together or all stay null per job (except Gemini: see D-001, `peakContextTokens` may populate while the other two stay null, which is acceptable under the "hide when unset" UI rule).

### Validation rules

- Zod: integration payloads do not expose these fields directly to callers — the OTLP processor computes them internally from per-event attributes already in `otlpAttributeSchema` (lib/schemas/otlp.ts). No new Zod schema.
- Database-level: `Int?` with no default. Consistent with `inputTokens`, `outputTokens`, `thinkingTokens`, etc. (prisma/schema.prisma:45–54).
- Application-level: the processor writes `peakContextTokens`/`avgContextTokens`/`turnCount` only when it observed at least one parseable per-turn event for the job (covers FR-004). No backfill job (FR-014).

### State transitions

None — the Job status state machine is unchanged. These fields accumulate alongside existing telemetry during `RUNNING` via the OTLP ingestion endpoint, and are read by the UI whenever the Job is queried.

### Relationships

No new relations. Fields hang off the existing `Job` row, same as `inputTokens`.

## Prisma schema diff

```prisma
model Job {
  // ...existing fields unchanged...

  // Telemetry (existing)
  inputTokens         Int?
  outputTokens        Int?
  thinkingTokens      Int?
  cacheReadTokens     Int?
  cacheCreationTokens Int?
  costUsd             Float?
  durationMs          Int?
  model               String?  @db.VarChar(50)
  toolsUsed           String[] @default([])

  // Context size (new — AIB-725)
  peakContextTokens   Int?     // Peak per-turn context tokens attended
  avgContextTokens    Int?     // Mean per-turn context tokens attended (rounded)
  turnCount           Int?     // Number of per-turn events successfully parsed

  // Quality (existing)
  qualityScore        Int?
  qualityScoreDetails String?

  // ...relations, indexes unchanged...
}
```

No new indexes. Analytics queries scan completed jobs within a time-bounded range (`buildJobWhere` at `lib/analytics/queries.ts:147–163` already uses `completedAt` + `projectId` indexes), and the distribution aggregation is O(n) over an already-bounded set.

## Migration plan

File: `prisma/migrations/<timestamp>_add_job_context_metrics/migration.sql`

```sql
ALTER TABLE "Job" ADD COLUMN "peakContextTokens" INTEGER;
ALTER TABLE "Job" ADD COLUMN "avgContextTokens" INTEGER;
ALTER TABLE "Job" ADD COLUMN "turnCount" INTEGER;
```

Follows the single-column-per-statement, nullable-no-default pattern from `prisma/migrations/20260413103000_add_job_thinking_tokens/migration.sql`. Safe on the existing `Job` table (adds nullable columns only — no table rewrite on Postgres 14+).

**No backfill.** Per FR-014, historical jobs leave the three fields null and the UI renders nothing for them.

## Running-merge semantics (recap from research.md D-003)

The OTLP processor accumulates per-batch `{peak, sum, turnCount}` in memory for the current request, then merges atomically:

```
newPeak       = max(db.peakContextTokens ?? 0, batchPeak)
newTurnCount  = (db.turnCount ?? 0) + batchTurnCount
oldSum        = (db.avgContextTokens ?? 0) * (db.turnCount ?? 0)  // integer reconstruction
newSum        = oldSum + batchSum
newAvg        = round(newSum / newTurnCount)   // only when newTurnCount > 0
```

All three columns are written in the **same** `prisma.job.update` that writes the existing aggregated token fields (one transaction, one `UPDATE`) — preserves the constitution §V guarantee that DB state is never split across writes.

For CUMULATIVE (Gemini) batches, only `peakContextTokens` updates via `Math.max`; `avgContextTokens` and `turnCount` remain null (D-001).
