# Workflow Spec: Cron success-marker callback

**Status**: Draft · **Owner**: AIB-797 · **Implements**: FR-007, spec §Internal Processes "Cron marker persistence"

This spec defines the workflow-side changes required to make the "critical cron not executed in 36h" alert work. It applies to both `nightly-health.yml` and `nightly-log-prune.yml`.

## Scope

Add one final step at the end of each scheduled workflow that POSTs a success marker to the application. The step:

- Runs only after the workflow's main work has succeeded (placed after the existing terminal step).
- Uses `if: success()` to gate on prior step success.
- Uses `continue-on-error: true` so a marker outage does NOT fail the cron itself.

## Inputs

- `APP_URL` (env): the application base URL — already set per workflow as `${{ vars.APP_URL }}`.
- `WORKFLOW_API_TOKEN` (env): the workflow Bearer token — already set per workflow as `${{ secrets.WORKFLOW_API_TOKEN }}`.
- `WORKFLOW_NAME` (literal): hard-coded per workflow (`nightly-health` or `nightly-log-prune`). The basename of the workflow file (no `.yml` suffix).

## Computed values

- `RUN_URL`: `${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}` — built from GitHub-provided contexts.
- `START_EPOCH`: captured at the workflow's first effective step (`date +%s`); `DURATION_MS`: computed at the marker step as `(($(date +%s) - START_EPOCH) * 1000))`. Optional — if absent, the marker omits `durationMs`.

## Phases

### Phase A — main work (unchanged from existing workflow)

- `nightly-health.yml`: dispatches the five scan types via `POST /api/projects/${PROJECT_ID}/health/scans`. Exits non-zero on any dispatch failure.
- `nightly-log-prune.yml`: calls `POST /api/maintenance/prune-logs`. Exits non-zero on non-200.

### Phase B — success marker (new)

A single new step:

```yaml
- name: Record cron success marker
  if: success()
  continue-on-error: true
  env:
    APP_URL: ${{ vars.APP_URL }}
    WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
    WORKFLOW_NAME: nightly-health       # or 'nightly-log-prune'
    RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
  run: |
    set -euo pipefail
    payload=$(jq -n \
      --arg name "$WORKFLOW_NAME" \
      --arg url  "$RUN_URL" \
      '{ workflowName: $name, runUrl: $url }')
    code=$(curl -sS -o /tmp/marker.json -w "%{http_code}" \
      -X POST "$APP_URL/api/admin/cron-markers" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $WORKFLOW_API_TOKEN" \
      -d "$payload")
    echo "marker HTTP $code"
    cat /tmp/marker.json || true
    # Non-201 logs a warning but does not fail the cron (continue-on-error: true).
    [ "$code" = "201" ] || echo "::warning::Cron marker write returned HTTP $code"
```

## Output

- A 201 response with `{ id, ranAt }` is logged but discarded (workflow does not branch on it).
- A non-201 response logs an annotation but does not fail the run.

## Failure modes

| Failure | Behavior |
|---------|---------|
| App is unreachable (timeout / DNS) | curl fails, step exits non-zero, `continue-on-error: true` swallows it. Cron reports success. Dashboard alert will fire after 36h if successive nights miss markers. |
| App returns 401 (bad token) | Treated like above — annotation, no fail. Operator must rotate token. |
| App returns 400 (validation) | Treated like above — annotation only. Indicates a code drift between workflow and `CRITICAL_CRONS` allowlist. |
| App returns 500 | Annotation only. Will be retried tomorrow. |

## Acceptance

- A successful run of `nightly-health.yml` writes a `CronRunLog` row with `workflowName='nightly-health'` and `ranAt` within ±60s of run completion.
- A run that fails its main work (Phase A) MUST NOT write a marker (the new step's `if: success()` guard prevents it).
- A run whose marker step fails MUST still appear as a successful workflow run in GitHub Actions.

## Authorization

Bearer token (`WORKFLOW_API_TOKEN`). Same secret already used by:

- `.github/workflows/nightly-log-prune.yml:21` (`POST /api/maintenance/prune-logs`).
- `.github/workflows/nightly-health.yml:29` (`POST /api/projects/.../health/scans`).
- `.github/workflows/insights-analyze.yml` (`PATCH /api/jobs/.../status`).

No new secret is required.

## Reporting contract

The application records the marker in the `CronRunLog` table and exposes it via the read path in `GET /api/admin/home` — there is no synchronous "status" returned to the workflow beyond the HTTP code. The dashboard's alert logic compares `Date.now() - latestMarker.ranAt > 36h`.
