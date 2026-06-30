# Workflow Artifact: insights-analyze.yml (AIB-852 delta)

**Feature**: AIB-852 | **File**: `.github/workflows/insights-analyze.yml` | **Auth**: `WORKFLOW_API_TOKEN`

The workflow shape is unchanged (single `analyze` job, 50-min timeout, native `/insights`
slash command via `.github/scripts/run-agent.sh`). AIB-852 changes only what is enumerated,
counted, and sent back at completion. **Inputs are unchanged**:
`report_id, job_id, project_id, period_start, period_end`.

## Step deltas

### `Enumerate Claude sessions in window` (id: enumerate)
- `GET /api/admin/insights/jobs?periodStart&periodEnd` now returns
  `{ jobs: [...all analyzable sessions...], expectedCount }`.
- Capture **two** outputs:
  - `session_count = jq '.jobs | length' jobs.json` (analyzed count).
  - `expected_count = jq '.expectedCount' jobs.json` (FR-011).
- `jobs` may contain **multiple sessions per ticket** and sessions from **unshipped**
  tickets — the download loop already iterates `.jobs[]`, so no change there.

### `Download raw native session JSONL artifacts`
- No logic change. The empty-set abort (`session_count -eq 0`) stays: pre-flight guarantees
  ≥1 analyzable session, so an empty enumeration here still means a between-steps prune.
- Note: `expected_count` may exceed `session_count` (transcript-pending sessions); the
  download loop only iterates the returned `jobs` (analyzable), so this is correct.

### `Compute counts` (id: counts)
- `session_count` = `steps.enumerate.outputs.session_count`.
- `expected_count` = `steps.enumerate.outputs.expected_count`.
- `ticket_count` = `jq '[.jobs[].ticketId] | unique | length' jobs.json` (unchanged).
- **NEW**: `analyzed_job_ids = jq -c '[.jobs[].jobId]' jobs.json` → JSON array of the exact
  jobs analyzed (these are the ones whose transcripts were downloaded and fed to `/insights`).

### `PATCH report status -> COMPLETED`
- Extend the `jq -n` payload to include the new fields (contract: admin-insights-api.md):
  ```bash
  payload=$(jq -n \
    --arg status 'COMPLETED' \
    --argjson sc "$session_count" \
    --argjson ec "$expected_count" \
    --argjson tc "$ticket_count" \
    --argjson ids "$analyzed_job_ids" \
    --arg ak "insights/reports/${report_id}.html" \
    --argjson asz "$artifact_size" \
    '{status:$status, sessionsCount:$sc, expectedSessionsCount:$ec,
      ticketsCount:$tc, analyzedJobIds:$ids, artifactKey:$ak, artifactSize:$asz}')
  ```
- The server writes one `InsightsSessionCoverage` row per `analyzedJobIds` entry inside the
  COMPLETED transaction (FR-007 — only on success; D5).

### `Report failure` (on `failure()`)
- Unchanged. FAILED PATCH carries only `{ status, errorReason }`; **no `analyzedJobIds`** →
  no coverage advanced (FR-007). The failed run's sessions remain uncovered and eligible.

## Invariants the workflow must keep
- **Count/enumeration parity (FR-016, SC-006)**: `sessionsCount` == `jobs.length` ==
  `analyzedJobIds.length`. All three derive from the same `jobs.json`.
- **No silent truncation**: the empty-set abort and the marker validation in `/finalize`
  + `/status` (server re-validates HTML markers, D8) stay; a vacuous COMPLETED is impossible.
- **Idempotent completion**: a re-delivered COMPLETED PATCH is a no-op server-side
  (`updateMany count===0` + `skipDuplicates` on coverage), so workflow retries are safe.
</content>
