# Workflow Spec: `insights-analyze.yml` (AIB-856 deltas)

**Branch**: `AIB-856-copy-of-insights` | **Spec**: [spec.md](../spec.md) | **Source**: `.github/workflows/insights-analyze.yml`

Implements the spec's **Insights Analysis Process**. Only the **changed steps**
are specified; unchanged steps (job-status RUNNING PATCH, Anthropic credential
fetch, `/insights` invocation via `run-agent.sh`, report collection, structural
marker validation, `/finalize` upload, failure reporting) are retained as-is.

## Inputs (unchanged)
`report_id`, `job_id`, `project_id`, `period_start`, `period_end`. The two
`period_*` inputs are now **informational** (the report's display window); they
no longer scope selection.

## Changed step — Enumerate Claude sessions (`id: enumerate`)
- Call `GET ${APP_URL}/api/admin/insights/jobs` (Bearer `WORKFLOW_API_TOKEN`).
  Period params are optional and ignored for selection (D-5); the endpoint
  returns **all eligible-unanalyzed** Claude sessions across all projects and
  all ticket outcomes.
- `expected_count = jq '.jobs | length' jobs.json` → `$GITHUB_OUTPUT`
  (this is the run's **expected** session count, FR-010).

## Changed step — Download raw native session JSONL (404-tolerant)
- **Abort only if `expected_count == 0`** (unchanged guard; pre-flight already
  rejects this so it means a full prune between trigger and enumeration).
- For each enumerated job, fetch `…/jobs/${jobId}/raw-native`, but capture the
  HTTP status instead of `curl -fsS` failing the whole loop:
  - `200` → extract (tar.gz) or split (legacy jsonl.gz) into the sessions dir
    **and append `jobId` to `analyzed_job_ids`** (the readable set).
  - `404` → transcript pruned/unavailable between enumeration and download
    (FR-009 edge): **skip, do not abort**, do not add to `analyzed_job_ids`.
    Log the skipped jobId.
  - any other non-200 (e.g. `502`) → genuine error: set
    `INSIGHTS_FAILURE_REASON` and `exit 1` (the run fails, marks nothing).
- After the loop: if `analyzed_job_ids` is empty (every session pruned) → set
  `INSIGHTS_FAILURE_REASON='No readable Claude sessions available'` and
  `exit 1`. Otherwise persist `analyzed_job_ids` (e.g. as a JSON array file)
  and `analyzed_count = len(analyzed_job_ids)`.
- The legacy jsonl.gz splitter (Python) is retained unchanged.

> Implementation note: drop `set -e`'s whole-loop abort by running the per-job
> curl with explicit `-o file -w '%{http_code}'` and branching on the code,
> mirroring the credential-fetch step's `http_code` handling
> (`insights-analyze.yml:151-159`).

## Changed step — Compute counts (`id: counts`)
- `analyzed_count` = number of readable jobs marked (`analyzed_job_ids` length).
- `expected_count` = `steps.enumerate.outputs.expected_count`.
- `ticket_count` = distinct `ticketId` among the **readable** jobs
  (`jq '[ .jobs[] | select(.jobId as $id | <id in analyzed_job_ids>) | .ticketId ] | unique | length'`),
  i.e. tickets among analyzed sessions (FR-015).

## Changed step — PATCH report status → COMPLETED
Send the marker payload (admin-api.md):
```json
{
  "status": "COMPLETED",
  "analyzedJobIds": <analyzed_job_ids array>,
  "expectedSessionsCount": <expected_count>,
  "ticketsCount": <ticket_count>,
  "artifactKey": "insights/reports/<report_id>.html",
  "artifactSize": <finalize.outputs.artifact_size>
}
```
The API filters `analyzedJobIds` to eligible sessions, writes one
`InsightsAnalyzedSession` per accepted job (skipDuplicates), and derives
`sessionsCount` from the accepted set.

## Failure path (unchanged)
`if: failure()` → PATCH report FAILED with `errorReason` and PATCH job FAILED.
**No markers are written on FAILED**, so all enumerated sessions remain eligible
for the next run (FR-006, US2-AC3).

## Agent command
The analysis itself is Claude Code's **built-in `/insights` slash command** (no
arguments; scans the locally-seeded session store). It is not a repo-defined
command and is unchanged by this feature.
</content>
