# Workflow: `insights-analyze.yml`

**Feature**: AIB-791
**Date**: 2026-05-11

The GitHub Actions workflow that runs Claude Code's `/insights` analyzer over the native
session JSONL corpus for a given period and uploads the resulting HTML to durable blob storage.
Patterned on `.github/workflows/speckit.yml` (scaffolding, agent invocation, status PATCH) but
with simpler inputs and no PR creation.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `report_id` | yes | The `InsightsReport.id` to finalize. |
| `job_id` | yes | The companion `Job.id` (for status PATCH and log capture). |
| `period_start` | yes | ISO 8601 timestamp (inclusive lower bound). |
| `period_end` | yes | ISO 8601 timestamp (exclusive upper bound). |
| `app_url` | yes | Base URL of the deployment that triggered the run. Used to call back. |

No `githubRepository` input — this workflow does NOT operate on an external project repo (the
corpus comes from blob storage, not git).

## Required secrets

| Secret | Purpose |
|--------|---------|
| `WORKFLOW_API_TOKEN` | A-WORKFLOW Bearer token for status PATCH, finalize, jobs enumeration. |
| `ANTHROPIC_API_KEY` (or equivalent Claude Code auth) | Required for `claude /insights` to run. The existing `run-agent.sh` already plumbs this — reuse. |

## Steps (high level)

```yaml
name: Insights Analyze

on:
  workflow_dispatch:
    inputs:
      report_id: { required: true }
      job_id: { required: true }
      period_start: { required: true }
      period_end: { required: true }
      app_url: { required: true }

jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 50  # < INSIGHTS_RUN_TIMEOUT_MINUTES (default 60) so the workflow surfaces
                          # its own failure before reconciliation auto-FAILs the row.
    steps:
      - uses: actions/checkout@v4
      - name: PATCH job status → RUNNING
        run: |
          curl -fsS -X PATCH "${{ inputs.app_url }}/api/jobs/${{ inputs.job_id }}/status" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"status":"RUNNING"}'

      - name: Enumerate Claude sessions in window
        id: enumerate
        run: |
          curl -fsS \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            "${{ inputs.app_url }}/api/admin/insights/jobs?periodStart=${{ inputs.period_start }}&periodEnd=${{ inputs.period_end }}" \
            > jobs.json
          echo "session_count=$(jq '.jobs | length' jobs.json)" >> "$GITHUB_OUTPUT"

      - name: Download raw native session JSONL artifacts
        run: |
          mkdir -p ./sessions
          jq -c '.jobs[]' jobs.json | while read -r row; do
            jobId=$(echo "$row" | jq -r .jobId)
            projectId=$(echo "$row" | jq -r .projectId)
            ticketId=$(echo "$row" | jq -r .ticketId)
            curl -fsS \
              -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
              "${{ inputs.app_url }}/api/admin/insights/jobs/${jobId}/raw-native" \
              -o "./sessions/${jobId}.jsonl.gz"
            gunzip "./sessions/${jobId}.jsonl.gz"
          done

      - name: Setup runtime
        # Bun 1.3.1 + Node 22 per `.ai-board/config.yml`
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.1

      - name: Run Claude Code /insights
        id: insights
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # Real invocation — NOT a free-text prompt (FR-011).
          # The exact CLI surface is pinned at implementation time, but the contract is:
          #   bunx @anthropic-ai/claude-code /insights \
          #       --sessions ./sessions \
          #       --output ./report.html
          # If the slash command requires interactive input, use the corresponding skill
          # invocation registered in .claude-plugin/.
          set -euo pipefail
          bunx @anthropic-ai/claude-code /insights \
            --sessions ./sessions \
            --output ./report.html

      - name: Validate output (structural markers)
        run: |
          set -euo pipefail
          for marker in "Suggested CLAUDE.md additions" "Big wins" "Horizon"; do
            grep -F -q "$marker" report.html || { echo "Missing marker: $marker"; exit 1; }
          done

      - name: Upload artifact via /finalize
        id: finalize
        run: |
          set -euo pipefail
          response=$(curl -fsS -w "\n%{http_code}" \
            -X PUT "${{ inputs.app_url }}/api/admin/insights/reports/${{ inputs.report_id }}/finalize" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: text/html; charset=utf-8" \
            --data-binary @report.html)
          code=$(echo "$response" | tail -n 1)
          body=$(echo "$response" | head -n -1)
          [ "$code" = "200" ] || { echo "Finalize failed: $body"; exit 1; }
          echo "artifact_size=$(echo "$body" | jq -r .artifactSize)" >> "$GITHUB_OUTPUT"

      - name: Compute counts
        id: counts
        run: |
          session_count=${{ steps.enumerate.outputs.session_count }}
          # ticketsCount = distinct ticketIds in jobs.json
          ticket_count=$(jq '[.jobs[].ticketId] | unique | length' jobs.json)
          echo "session_count=$session_count" >> "$GITHUB_OUTPUT"
          echo "ticket_count=$ticket_count" >> "$GITHUB_OUTPUT"

      - name: PATCH report status → COMPLETED
        run: |
          curl -fsS -X PATCH "${{ inputs.app_url }}/api/admin/insights/reports/${{ inputs.report_id }}/status" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "$(jq -n \
                --arg status 'COMPLETED' \
                --argjson sc ${{ steps.counts.outputs.session_count }} \
                --argjson tc ${{ steps.counts.outputs.ticket_count }} \
                --arg ak "insights/reports/${{ inputs.report_id }}.html" \
                --argjson asz ${{ steps.finalize.outputs.artifact_size }} \
                '{status:$status, sessionsCount:$sc, ticketsCount:$tc, artifactKey:$ak, artifactSize:$asz}')"

      - name: PATCH job status → COMPLETED
        if: success()
        run: |
          curl -fsS -X PATCH "${{ inputs.app_url }}/api/jobs/${{ inputs.job_id }}/status" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"status":"COMPLETED"}'

      - name: Report failure
        if: failure()
        run: |
          # Determine a non-secret, operator-actionable reason. Default falls back to the
          # generic phrase; specific steps above (validation, finalize) can refine via a
          # $GITHUB_ENV-set variable.
          reason="${INSIGHTS_FAILURE_REASON:-Workflow step failed; see workflow logs}"
          curl -fsS -X PATCH "${{ inputs.app_url }}/api/admin/insights/reports/${{ inputs.report_id }}/status" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "$(jq -n --arg status 'FAILED' --arg er "$reason" '{status:$status, errorReason:$er}')"
          curl -fsS -X PATCH "${{ inputs.app_url }}/api/jobs/${{ inputs.job_id }}/status" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"status":"FAILED"}'
```

## Workflow-only callback contract

The workflow needs a way to download raw native JSONL artifacts without a user session. Two
endpoint reuse / addition decisions:

1. **`GET /api/admin/insights/jobs?periodStart=...&periodEnd=...`** — A-WORKFLOW, returns the
   list of `{ jobId, projectId, ticketId, rawArtifactKey }` for the window. Defined in
   `contracts/admin-api.md`.

2. **`GET /api/admin/insights/jobs/:jobId/raw-native`** — A-WORKFLOW, server-streams the
   `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` blob to the workflow. Distinct from the
   existing user-session-authenticated `/api/projects/:projectId/tickets/:ticketId/jobs/:jobId/
   logs/raw-native` because (a) the workflow has no user session and (b) the insights workflow
   intentionally crosses tenant boundaries (it reads from every project's raw artifacts).

   **Security note**: This new endpoint is the ONLY workflow-token-authenticated cross-tenant
   read in the platform. Compromising the `WORKFLOW_API_TOKEN` already gives an attacker write
   access to log artifacts for any job; adding read access (only to raw native session JSONL
   for Claude jobs whose ticket has shipped) does not change the trust boundary meaningfully.
   The endpoint MUST verify the `jobId` resolves to a Claude job (using the shared predicate
   from D-6) before streaming — preventing a compromised token from being used to enumerate
   non-Claude artifacts.

## Failure-isolation rules

- If the `Run Claude Code /insights` step fails, the row transitions to FAILED with a generic
  reason; the analyzer's stderr is captured into job logs (via the existing log-capture
  pipeline) but is NOT echoed into `errorReason` (because logs may contain secrets).
- If the `Validate output (structural markers)` step fails, the row transitions to FAILED with
  reason `"Insights output validation failed"`.
- If the `Upload artifact via /finalize` step fails with 422, the row transitions to FAILED with
  the same reason (server-side validation caught what the workflow-side validation missed).
- If the `Upload artifact via /finalize` step fails with any other status, the row transitions
  to FAILED with reason `"Artifact upload rejected by storage"`.

## Timeouts

- `timeout-minutes: 50` on the job — gives the workflow a 10-minute buffer below the default
  `INSIGHTS_RUN_TIMEOUT_MINUTES=60` so the workflow surfaces its own failure first; if the
  workflow truly hangs (network partition with no `failure()` callback), reconciliation
  auto-FAILs the row.
- The `Run Claude Code /insights` step itself MAY have a per-step timeout once we observe
  typical runtimes. Initial: rely on the job-level timeout.

## Not in this workflow

- No PR creation, no `gh pr create`. Reports are not committed to git.
- No external-repo clone. The workflow operates entirely on blob storage.
- No `.github/workflows/insights-analyze.yml` cron schedule — manual dispatch only (FR-021).
