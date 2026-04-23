# Job Log Capture Workflow

1. A workflow job starts in ai-board and the agent runs through `.github/scripts/run-agent.sh`.
2. `run-agent.sh` captures the agent stdout/stderr stream into a temporary runner file and writes a normalized bundle to `${RUNNER_TEMP}/job-log-${JOB_ID}.json`.
3. Before the workflow sends its final `PATCH /api/jobs/:id/status`, it uploads that bundle to `POST /api/jobs/:id/logs` using workflow bearer-token auth.
4. The upload route normalizes events, builds a bounded preview summary, compresses retained detail, and upserts `JobExecutionLog`.
5. If the final status callback arrives without any uploaded log row, the status route creates a summary-only `UNAVAILABLE` fallback record so the UI never implies successful capture.

Notes:
- Upload is allowed while the job is still `RUNNING` because the workflow sends logs before its final terminal callback.
- Upload is idempotent per `jobId`; retries replace the same artifact row.
- The runner bundle intentionally stores sanitized readable output, not credential material.
