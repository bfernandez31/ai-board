# Workflow: insights-analyze.yml

**Branch**: `AIB-777-admin-section-with`
**Date**: 2026-05-10

This document specifies the GitHub Actions workflow that performs the Insights analysis. It is the "centralized workflow execution surface" the spec's Background-job-execution-model decision references — a sibling to `deploy-preview.yml`, `verify.yml`, etc. The workflow is **never triggered automatically**; it is dispatched only by `POST /api/admin/insights/runs`.

## File location

`.github/workflows/insights-analyze.yml` — sits next to existing workflow files.

## Inputs

```yaml
on:
  workflow_dispatch:
    inputs:
      report_id:
        description: 'AdminInsightsReport.id of the row already created in DB'
        required: true
        type: string
      period_start:
        description: 'ISO-8601 timestamp; inclusive lower bound of analysis window'
        required: true
        type: string
      period_end:
        description: 'ISO-8601 timestamp; exclusive upper bound of analysis window'
        required: true
        type: string
```

No `ticket_id`, no `project_id`, no `branch`, no `githubRepository` — the analysis is application-wide and operates on raw artifacts already in blob storage. There is no target repo to clone.

## Required secrets / vars

| Name | Source | Used by |
|------|--------|---------|
| `WORKFLOW_API_TOKEN` | repo secret | Bearer token on every PATCH/PUT callback. |
| `CLAUDE_CODE_OAUTH_TOKEN` | repo secret | Authenticate the Claude Code CLI. |
| `APP_URL` | repo variable | Base URL for callbacks. |
| `BLOB_READ_TOKEN_FOR_RAW_LOGS` | (not needed) | The workflow does NOT hold blob credentials directly; it streams raw artifacts through `GET /api/jobs/:jobId/logs/raw-native` (which already authenticates via Bearer + ownership/admin) — the new admin-scoped variant is `GET /api/internal/admin-insights/raw-artifacts?periodStart=…&periodEnd=…` (see "Internal artifact-listing endpoint" below). |

## Internal artifact-listing endpoint (added by this feature)

`GET /api/internal/admin-insights/raw-artifacts?periodStart=…&periodEnd=…`

- Auth: `Bearer ${WORKFLOW_API_TOKEN}` only — workflows-only, like the existing `/api/internal/credentials` and `/api/internal/github-token` routes referenced by `speckit.yml:251-253`.
- Returns: a JSON list of `{ jobId, projectId, ticketId, rawArtifactKey, capturedAt }` rows whose owning Job has `status='COMPLETED'`, effective agent = `CLAUDE` (computed via `ticket.agent ?? project.defaultAgent ?? 'CLAUDE'` per Risks-and-Open-Items in research.md), `JobLog.rawArtifactKey IS NOT NULL`, `JobLog.captureStatus = 'CAPTURED'`, and `Job.startedAt >= periodStart AND Job.startedAt < periodEnd`.
- The same query supports the trigger endpoint's pre-flight count (FR-025 — consistency between counted and analyzed).
- Cap on returned rows: 5000 (enough for years of activity, well above any plausible window). If the limit is hit, the workflow finalizes the report as FAILED with reason `"Analysis window contains too many sessions; narrow the trigger cadence"` — operator-actionable.

The ENDPOINT is in `contracts/admin-insights-api.md` only by reference (it's a workflow-internal route, not a user-facing API). The implementation lives at `app/api/internal/admin-insights/raw-artifacts/route.ts`.

## Step-by-step pipeline

```yaml
name: Admin Insights Analyze
on: workflow_dispatch: ...

env:
  APP_URL: ${{ vars.APP_URL }}
  WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
  CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
  REPORT_ID: ${{ inputs.report_id }}
  PERIOD_START: ${{ inputs.period_start }}
  PERIOD_END: ${{ inputs.period_end }}

jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 45        # < INSIGHTS_RUN_TIMEOUT_MS (60min) so the
                                # workflow's own timeout fires before lazy
                                # reconciliation; orphan reconciliation is
                                # the safety net, not the primary path.
    steps:

      # 1. Acknowledge run started.
      - name: PATCH …/status RUNNING
        run: |
          set -euo pipefail
          HTTP_CODE=$(curl -s -X PATCH \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
            -d "{\"status\": \"RUNNING\", \"workflowRunId\": ${{ github.run_id }}}" \
            -o /tmp/running.json -w "%{http_code}" \
            "${APP_URL}/api/admin/insights/reports/${REPORT_ID}/status")
          if [ "$HTTP_CODE" = "409" ]; then
            echo "🚫 Report already finalized — aborting"; exit 1
          elif [ "$HTTP_CODE" != "200" ]; then
            echo "⚠️ status=$HTTP_CODE"; cat /tmp/running.json; exit 1
          fi

      # 2. Setup runtime (Node + Bun + Claude CLI). No target-repo checkout.
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: '22.20.0' }

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with: { bun-version: 1.3.1 }

      - name: Install Claude Code CLI
        run: |
          npm install -g @anthropic-ai/claude-code
          claude --version  # records to logs; failure here means D-Risks "/insights analyzer availability"

      # 3. Enumerate raw artifacts in window.
      - name: Enumerate raw Claude artifacts
        id: enumerate
        run: |
          set -euo pipefail
          curl -sS -G \
            -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
            --data-urlencode "periodStart=${PERIOD_START}" \
            --data-urlencode "periodEnd=${PERIOD_END}" \
            "${APP_URL}/api/internal/admin-insights/raw-artifacts" \
            > /tmp/artifacts.json
          jq -r 'length' /tmp/artifacts.json > /tmp/sessions_count
          jq -r '[.[].ticketId] | unique | length' /tmp/artifacts.json > /tmp/tickets_count
          echo "sessionsCount=$(cat /tmp/sessions_count)" >> "$GITHUB_OUTPUT"
          echo "ticketsCount=$(cat /tmp/tickets_count)" >> "$GITHUB_OUTPUT"

      # 4. Download raw artifacts in parallel (small bash xargs loop).
      - name: Download raw artifacts
        run: |
          set -euo pipefail
          mkdir -p /tmp/sessions
          jq -c '.[]' /tmp/artifacts.json | while read -r row; do
            JOB_ID=$(echo "$row" | jq -r '.jobId')
            PROJECT_ID=$(echo "$row" | jq -r '.projectId')
            TICKET_ID=$(echo "$row" | jq -r '.ticketId')
            curl -sS -L \
              -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
              "${APP_URL}/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/jobs/${JOB_ID}/logs/raw-native" \
              -o "/tmp/sessions/${JOB_ID}.jsonl.gz"
          done

      # 5. Run /insights against the corpus.
      - name: Run Claude /insights
        run: |
          set -euo pipefail
          claude /insights \
            --input-dir /tmp/sessions \
            --output-html /tmp/report.html \
            --period-start "${PERIOD_START}" \
            --period-end "${PERIOD_END}"
          test -s /tmp/report.html

      # 6. Upload HTML body.
      - name: PUT …/html
        run: |
          set -euo pipefail
          SIZE=$(stat -c%s /tmp/report.html)
          curl -sS -X PUT \
            -H "Content-Type: text/html; charset=utf-8" \
            -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
            -H "Content-Length: ${SIZE}" \
            --data-binary @/tmp/report.html \
            "${APP_URL}/api/admin/insights/reports/${REPORT_ID}/html" \
            -o /tmp/upload.json
          jq -r '.htmlBlobKey' /tmp/upload.json > /tmp/blob_key
          jq -r '.htmlBlobSize' /tmp/upload.json > /tmp/blob_size

      # 7. Finalize → COMPLETED.
      - name: PATCH …/status COMPLETED
        if: success()
        run: |
          set -euo pipefail
          curl -sS -X PATCH \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
            -d "$(jq -n \
              --arg key "$(cat /tmp/blob_key)" \
              --argjson size "$(cat /tmp/blob_size)" \
              --argjson sessionsCount ${{ steps.enumerate.outputs.sessionsCount }} \
              --argjson ticketsCount ${{ steps.enumerate.outputs.ticketsCount }} \
              '{status: "COMPLETED", sessionsCount: $sessionsCount, ticketsCount: $ticketsCount, htmlBlobKey: $key, htmlBlobSize: $size}')" \
            "${APP_URL}/api/admin/insights/reports/${REPORT_ID}/status"

      # 8. Finalize → FAILED on any prior step's failure.
      - name: PATCH …/status FAILED
        if: failure()
        run: |
          set +e
          REASON="Workflow step failed; see GitHub Actions log run ${{ github.run_id }}"
          # Truncate just in case future composite reasons get verbose.
          REASON="${REASON:0:2000}"
          curl -sS -X PATCH \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
            -d "$(jq -n --arg r "$REASON" '{status: "FAILED", errorReason: $r}')" \
            "${APP_URL}/api/admin/insights/reports/${REPORT_ID}/status"
```

## Failure semantics

- Any step before "Run Claude /insights" failing leaves the row `RUNNING` until step 8 fires (it always fires on `if: failure()`). Step 8 transitions to `FAILED` with a non-secret reason.
- Step 6 (HTML upload) failing fires step 8. The pre-creation row's `htmlBlobKey` remains NULL — consistent with the spec's edge case "previous COMPLETED report's blob has been removed: still display metadata".
- If the runner crashes between steps such that step 8 never fires, lazy reconciliation (D2) catches the row at the next admin page load.
- A duplicated dispatch (e.g., GitHub retry) would attempt to re-create the same row id… which it can't — the row is created by the trigger endpoint, not by the workflow. The workflow operates on an existing id and uses idempotent PATCH/PUT (P2/P3) so duplicate runs at most overwrite the artifact during RUNNING; the atomic terminal write blocks double-finalization.

## What this workflow deliberately does NOT do

- It does not clone a target repo. There is no `githubRepository` input.
- It does not provision service containers. No DB, Redis, MySQL, Mongo.
- It does not run `bun install` on the target codebase. The analysis is over raw JSONL artifacts, not source code.
- It does not call `setup-environment.sh`, `run-command.sh`, or any project-level helpers used by `speckit.yml`.
- It does not run automatically. No `schedule`, no `push`, no `pull_request` triggers — only `workflow_dispatch`. (FR-021)
- It does not send notifications. (FR-022)

## Connection to spec's Internal Process diagram

This workflow implements **Phases 4–8** of the spec's "Insights Analysis Process":

| Spec Phase | Implementation |
|------------|----------------|
| 4. Workflow dispatch | Triggered by `POST /api/admin/insights/runs` via `octokit.actions.createWorkflowDispatch({ workflow_id: 'insights-analyze.yml', inputs: { report_id, period_start, period_end } })` from `app/lib/workflows/dispatch-insights-analyze.ts`. |
| 5. Artifact enumeration | Step 3 above; queries `/api/internal/admin-insights/raw-artifacts`. Non-Claude jobs filtered server-side (FR-010, SC-006). |
| 6. Insights execution | Step 5 above; Claude CLI's `/insights` runs unmodified, captures HTML untouched (FR-011). |
| 7. Artifact upload | Step 6 above; PUT through the authenticated app endpoint, never holding blob credentials. |
| 8. Run-record finalization | Steps 7/8 above; success → COMPLETED with counts and pointer; failure → FAILED with non-secret reason. |

Phases 1–3 (pre-flight gate, concurrency gate, run-record creation) are implemented by the trigger endpoint (`POST /api/admin/insights/runs`), not this workflow.
