# Internal Process: Agent Log Capture

**Scope**: Invoked as part of every workflow that runs an AI agent
(`speckit.yml`, `quick-impl.yml`, `verify.yml`, `ai-board-assist.yml`,
`iterate.yml`).

## Inputs

| Input | Source | Notes |
|---|---|---|
| `$AGENT_TYPE` | `run-agent.sh` argv | `CLAUDE` \| `CODEX` \| `MISTRAL` \| `GEMINI` |
| `$JOB_ID` | `${{ inputs.job_id }}` | ai-board Job row |
| `$PROJECT_ID` | `${{ inputs.project_id }}` | |
| `$TICKET_ID` | `${{ inputs.ticket_id }}` | |
| `$APP_URL` | `${{ vars.APP_URL }}` | |
| `$WORKFLOW_API_TOKEN` | `${{ secrets.WORKFLOW_API_TOKEN }}` | |
| Raw agent stdout | `$RUNNER_TEMP/agent-raw-<jobId>.log` | Tee'd by `run-agent.sh` |
| Agent-specific session dirs | `~/.vibe/sessions/*` (Mistral), `~/.claude/projects/...` (Claude), `~/.codex/sessions/*` (Codex) | Used for richer normalization |

## Phases

### Phase 1 — Collect
- Confirm the tee'd raw log exists. If it is empty (e.g., cancelled before any
  output), still synthesize a 2-event artifact: `lifecycle:started` +
  `lifecycle:cancelled`.

### Phase 2 — Normalize
- Dispatch to `lib/normalize-claude.mjs` / `normalize-codex.mjs` /
  `normalize-mistral.mjs` / `normalize-gemini.mjs` based on `$AGENT_TYPE`.
- Each normalizer emits NDJSON to stdout in the v1 format.
- Prepend the header line with `schemaVersion: 1`, `agent`, `jobId`,
  `startedAt`, `endedAt`.

### Phase 3 — Redact
- Pipe the NDJSON through `node -r ts-node/register app/lib/logs/redactor.ts`
  (or a compiled JS equivalent bundled into `.github/scripts/lib/`) acting as a
  stream filter that applies the shared redaction patterns to every string
  payload.
- Placeholder format: `[REDACTED:<kind>]`.

### Phase 4 — Derive preview
- Read the redacted stream once more (small, bounded pass) and compute the
  preview string per the rules in `research.md §1.7`.
- Capped at 280 chars.

### Phase 5 — Compress & upload
- `gzip -c redacted.jsonl > artifact.jsonl.gz`.
- `curl -X PUT "$APP_URL/api/jobs/$JOB_ID/logs/artifact" -H "Authorization: Bearer $WORKFLOW_API_TOKEN" -H "Content-Type: application/gzip" --data-binary @artifact.jsonl.gz`.
- Bounded retry: **3 attempts, exponential 1/2/4s**. Retriable HTTP: 5xx, 502,
  503, 504. Non-retriable: 4xx (400/401/404/413/415/422) → abort to Phase 6
  with `captureStatus=UNAVAILABLE`.

### Phase 6 — Submit summary
- Build JSON body: `{ captureStatus, preview, schemaVersion: 1, eventCount, errorCount, artifactKey, artifactSize }`.
- When Phase 5 failed, omit `artifactKey`/`artifactSize` and set
  `captureStatus: 'UNAVAILABLE'`; keep the `preview` as the literal
  `"Logs unavailable — capture failed."`.
- `curl -X POST "$APP_URL/api/jobs/$JOB_ID/logs" -H "Authorization: Bearer $WORKFLOW_API_TOKEN" -H "Content-Type: application/json" -d @summary.json`.
- Bounded retry: same 3/1-2-4 strategy.

### Phase 7 — Cleanup
- `rm -f $RUNNER_TEMP/agent-raw-*.log redacted.jsonl artifact.jsonl.gz` —
  ensures secrets are not left on the runner disk.

## Outputs

| Output | Destination |
|---|---|
| Gzipped JSONL artifact | `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` in Vercel Blob |
| Log summary row | `JobLog` table in Postgres |
| Runner stdout log messages | GitHub Actions run output (unchanged) |

## Error behavior (FR-016, FR-017, FR-018, SC-008)

- **Capture failure MUST NOT block `PATCH /api/jobs/:id/status`.** The capture
  script runs with `if: always()` **before** the terminal status call, but the
  status-report step does not depend on the capture script's success.
- **Telemetry is unaffected.** OTLP `POST /api/telemetry/v1/logs` from the
  agent runtime continues to flow irrespective of capture outcome.
- **Bounded retry and explicit abort.** No unbounded retry loops; 3 attempts
  then hard-abort to `UNAVAILABLE`.
- **Never swallow.** All non-retriable failures log a single structured line:
  `capture-agent-logs: FAILED status=<status_code> reason=<short>`.

## Trigger placement (per workflow)

The capture step is added to each of the five agent-invoking workflows as a
new step **immediately after** the `run-agent.sh` step and **before** the
final `curl PATCH /api/jobs/:id/status`:

```yaml
      - name: Capture agent execution logs
        if: always()
        env:
          JOB_ID: ${{ inputs.job_id }}
          PROJECT_ID: ${{ inputs.project_id }}
          TICKET_ID: ${{ inputs.ticket_id }}
          APP_URL: ${{ vars.APP_URL }}
          WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
          AGENT_TYPE: ${{ inputs.agent }}
        run: |
          ../ai-board/.github/scripts/capture-agent-logs.sh
```

`verify.yml` calls `run-agent.sh` twice (fix-tests + code-review). The capture
step runs once, after the last agent invocation — the raw log file is
append-only so both invocations' output is present.
