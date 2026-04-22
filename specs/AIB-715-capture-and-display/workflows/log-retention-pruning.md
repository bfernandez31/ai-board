# Internal Process: Log Retention Pruning

**Scope**: Scheduled GitHub Actions workflow invoking
`POST /api/maintenance/prune-logs` once a day.

## Inputs

| Input | Source |
|---|---|
| Current time | `now()` on the API server |
| Retention window | `LOG_RETENTION_DAYS` env var, default `30` |
| API token | `${{ secrets.WORKFLOW_API_TOKEN }}` |

## Phases

### Phase 1 — Enumerate
- Read candidate rows:
  ```ts
  prisma.jobLog.findMany({
    where: {
      createdAt: { lt: new Date(Date.now() - retentionDays * 86400_000) },
      captureStatus: { not: 'PRUNED' },
    },
    select: { id: true, artifactKey: true },
    take: 500, // bounded batch
  });
  ```
- Loop until `findMany` returns fewer than the batch size (natural termination
  without holding a transaction across many pages).

### Phase 2 — Delete artifact
- For each row with `artifactKey`, call `del(artifactKey)` on the Vercel Blob
  client. A `404 / already-absent` response is treated as success.
- On transient 5xx, skip the row (no DB delete for that row) and increment
  `skippedCount` — the next cycle retries.

### Phase 3 — Delete Postgres row
- Once the artifact delete succeeded (or the row never had one), delete the
  `JobLog` row:
  ```ts
  prisma.jobLog.deleteMany({ where: { id: { in: confirmedIds } } });
  ```
- Cascade on the relation is not used here because the parent `Job` is
  retained; we only remove the log summary.

### Phase 4 — Report
- Return `{ prunedCount, skippedCount, durationMs }` to the scheduled workflow.
- Workflow logs the counts to the GitHub Actions run.

## Outputs

- Postgres + Blob reduced by the pruned set.
- Counters suitable for future dashboards.

## Error behavior

- **Idempotent.** A second run over the same window finds no matches once the
  last cycle completed.
- **Atomicity per row.** Blob delete happens before DB delete so we never
  orphan blobs. If a DB delete fails after a successful Blob delete, the row's
  `artifactKey` will resolve to a missing blob on the next prune pass — which
  the Blob `404 → success` contract handles as a no-op.
- **Bounded runtime.** Batch size = 500, total rows per cycle capped at 50 k
  to keep the endpoint under Vercel's serverless invocation time.

## Scheduled workflow

`.github/workflows/nightly-log-prune.yml`

```yaml
name: Nightly Log Prune

on:
  schedule:
    - cron: '15 1 * * *' # 01:15 UTC — offset from nightly-health (00:30 UTC)
  workflow_dispatch: {}

jobs:
  prune-logs:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Trigger log retention prune
        env:
          APP_URL: ${{ vars.APP_URL }}
          WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
        run: |
          set -euo pipefail
          response=$(curl -sS -w "\n%{http_code}" \
            -X POST "$APP_URL/api/maintenance/prune-logs" \
            -H "Authorization: Bearer $WORKFLOW_API_TOKEN")
          body=$(echo "$response" | head -n -1)
          code=$(echo "$response" | tail -n 1)
          echo "HTTP $code"
          echo "$body"
          [ "$code" = "200" ]
```
