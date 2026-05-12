# Workflow — Critical cron heartbeat

Spec section: `Internal Processes → Critical cron last-run capture`.

The dashboard surfaces a "stale critical cron" alert when any cron on the allowlist has not executed for > 36 h. Capturing the last-success timestamp is a workflow-side concern: every critical cron's GitHub Actions workflow ends with a call to `POST /api/maintenance/cron-heartbeat`, and only that call advances `CronRun.lastSuccessAt`.

## Registered crons (initial allowlist)

| CriticalCron enum | Workflow file | Schedule (UTC) | Threshold |
|-------------------|---------------|----------------|-----------|
| `NIGHTLY_LOG_PRUNE` | `.github/workflows/nightly-log-prune.yml` | `15 1 * * *` | 36 h |
| `NIGHTLY_HEALTH_SCANS` | `.github/workflows/nightly-health.yml` | `30 0 * * *` | 36 h |
| `BILLING_RECONCILE` | `.github/workflows/billing-reconcile.yml` (NEW — placeholder; functional work TBD by a follow-up ticket) | `0 2 * * *` | 36 h |

The 36 h threshold lives in `lib/admin/cron/registry.ts`, not on the workflow side, so the alert window is adjustable without a workflow edit.

## Inputs

The endpoint receives nothing except the bearer token and the `cron` enum value. There is no per-workflow customization.

## Phases (per workflow)

1. **Functional work** — the existing steps of the workflow (e.g., prune logs, dispatch health scans). Unchanged.
2. **Heartbeat** — appended as the last step:

```yaml
      - name: Cron heartbeat
        env:
          APP_URL: ${{ vars.APP_URL }}
          WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
        run: |
          set -euo pipefail
          response=$(curl -sS -w "\n%{http_code}" \
            -X POST "$APP_URL/api/maintenance/cron-heartbeat" \
            -H "Authorization: Bearer $WORKFLOW_API_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"cron":"NIGHTLY_LOG_PRUNE"}')
          body=$(echo "$response" | head -n -1)
          code=$(echo "$response" | tail -n 1)
          echo "HTTP $code"
          echo "$body"
          [ "$code" = "200" ]
```

3. **Ordering invariant** — the heartbeat step is the **last** step. If step 1 fails (non-zero exit), step 2 is skipped because the workflow has already failed → `lastSuccessAt` does NOT advance → the dashboard alert eventually fires. This is the behavior the spec demands.

## Environment requirements

- `vars.APP_URL`: production URL of the ai-board app (already configured).
- `secrets.WORKFLOW_API_TOKEN`: existing secret (already used by `nightly-log-prune.yml`).

No new secrets. No new repository variables.

## Failure handling

- A non-2xx response from the heartbeat endpoint causes the step (and therefore the workflow run) to fail. The workflow run appears red in GitHub Actions, which is the operator's signal that the cron *worked* but the *heartbeat* didn't. The dashboard alert will eventually fire too (after 36 h), giving a second signal.
- The heartbeat retry policy is "rerun the workflow"; this endpoint is intentionally not retried in-line because the underlying work has already completed, and a duplicate heartbeat is a no-op idempotent upsert.

## Reporting contract back to the app

- The app's `CronRun.lastSuccessAt` is the single source of truth.
- The alert query reads `lastSuccessAt < now() - 36h` OR `no row exists for this cron`. The latter clause is what gives the "deployed but never ran" alert (spec edge case).
- GitHub Actions run history is the secondary, longer-lived record; the app does not query it.
