# Internal Process: Retention pruning (extended)

**Process owner**: `app/api/maintenance/prune-logs/route.ts` (existing handler, extended).
**Triggered**: Nightly via `.github/workflows/nightly-log-prune.yml` (cron `15 1 * * *`). No schedule changes.

## Inputs (unchanged)
- `LOG_RETENTION_DAYS` env var (default `30`).
- `BLOB_READ_WRITE_TOKEN` env var (required for delete operations).

## Phases

### Phase 1 — Cutoff calculation (unchanged)
```ts
const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
```

### Phase 2 — Batch query (extended SELECT)
```ts
const batch = await prisma.jobLog.findMany({
  where: {
    createdAt: { lt: cutoff },
    captureStatus: { not: 'PRUNED' },
  },
  select: {
    id: true,
    artifactKey: true,
    rawArtifactKey: true, // NEW
    jobId: true,
  },
  take: BATCH_SIZE,
});
```

### Phase 3 — Per-row deletion (extended)
For each `row` in `batch` (P6 in research.md):

```ts
let confirmed = true;

if (row.artifactKey) {
  if (!blobConfigured) { skippedCount += 1; confirmed = false; }
  else {
    try { await deleteJobLogArtifact(row.artifactKey); }
    catch (e) { console.error('[prune-logs] Blob delete failed (normalized)', row.artifactKey, e); skippedCount += 1; confirmed = false; }
  }
}

if (confirmed && row.rawArtifactKey) {
  if (!blobConfigured) { skippedCount += 1; confirmed = false; }
  else {
    try { await deleteJobLogArtifact(row.rawArtifactKey); }
    catch (e) { console.error('[prune-logs] Blob delete failed (raw)', row.rawArtifactKey, e); skippedCount += 1; confirmed = false; }
  }
}

if (confirmed) confirmedIds.push(row.id);
```

The "raw delete only after normalized delete succeeds" ordering preserves the spec invariant "system never has a raw artifact pointing at a job whose normalized record is gone" (Decision 6 reviewer notes in spec.md). On any failure, the row is skipped — the next prune cycle will retry both deletes from the top.

### Phase 4 — Mark as pruned (extended)
```ts
await prisma.jobLog.updateMany({
  where: { id: { in: confirmedIds }, captureStatus: { not: 'PRUNED' } },
  data: {
    captureStatus: 'PRUNED',
    artifactKey: null,
    artifactSize: null,
    rawArtifactKey: null, // NEW
    rawArtifactSize: null, // NEW
  },
});
```

### Phase 5 — Observability
The existing response shape `{ prunedCount, skippedCount, durationMs }` is unchanged — `prunedCount` reflects rows confirmed (both objects deleted). For finer-grained metrics we may add `rawDeletedCount` in a follow-up; this ticket explicitly does NOT add it (out of scope per the spec's Storage Hygiene priority).

## Idempotency
- A second prune run after a partial failure converges (Decision 6 in spec.md): either both keys are deleted, both are absent, or only normalized was deleted — the row is still flagged for re-attempt because `captureStatus !== 'PRUNED'` until both deletes succeed.
- A `404` from Blob during raw delete is mapped to `{ deleted: false }` by `deleteJobLogArtifact` — does NOT mark the row as failed. The row's raw key may simply have never been produced; the prune still confirms.

## Test coverage demanded
- Extend `tests/integration/api/maintenance/prune-logs.test.ts`:
  - Row with both `artifactKey` and `rawArtifactKey` → both Blob keys deleted, row marked PRUNED with both columns nulled.
  - Row with `artifactKey` only (non-Claude or pre-AIB-783 row) → existing behavior unchanged.
  - Row with both keys, raw delete throws → row stays unpruned, skippedCount += 1.
  - Row with both keys, raw key returns 404 from Blob → row pruned (consistent with idempotency contract).
