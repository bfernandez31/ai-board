# Job Log Capture Workflow

## Purpose

Capture readable terminal execution logs for supported agent-driven ticket jobs and persist them as normalized, prunable artifacts that remain available after the GitHub Actions run ends.

## Trigger

- A supported ticket job finishes agent execution inside `.github/scripts/run-agent.sh`.
- The surrounding workflow is preparing to send the terminal `PATCH /api/jobs/:id/status` callback.

## Inputs

| Input | Source |
|-------|--------|
| `jobId` | Existing workflow input / `JOB_ID` env |
| `agent` | Existing workflow input (`CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI`) |
| `terminalStatus` | Workflow success/failure/cancel branch |
| `providerNativeOutput` | OTLP records, CLI session files, or provider output captured by `run-agent.sh` |
| `jobTelemetryContext` | Existing job metrics already stored through status/telemetry paths |

## Phases

1. **Collect provider-native output**
   - Claude/Codex/Gemini: gather the structured output or OTLP-friendly records already emitted during the run.
   - Mistral: continue reading the session artifacts under `~/.vibe/sessions` and expand the collection to message/error/tool chronology, not just aggregate telemetry.

2. **Normalize**
   - Convert provider-specific records into ordered `JobLogEvent[]`.
   - Preserve provider-specific context in `metadata`.
   - Remove secrets, headers, and credential material before persistence.

3. **Summarize**
   - Build `JobLogSummary` from the terminal status plus the latest important normalized events.
   - Mark `PARTIAL` or `UNAVAILABLE` when capture is incomplete or absent.

4. **Upload**
   - `POST /api/jobs/{jobId}/logs` with workflow bearer token.
   - Upsert idempotently by `jobId`.

5. **Finalize status**
   - After upload attempts, call the existing terminal `PATCH /api/jobs/{jobId}/status`.
   - Upload failure must not suppress the real terminal status.

## Output

- `JobExecutionLog` row for the job in one of:
  - `AVAILABLE`
  - `PARTIAL`
  - `UNAVAILABLE`
- Compressed detailed events when retained
- Preview summary ready for ticket timeline/jobs list surfaces

## Error Behavior

| Failure | Behavior |
|---------|----------|
| Normalization fails after agent exit | Upload `UNAVAILABLE` with a reason if possible; preserve the real job terminal status |
| Upload request fails | Log the failure in workflow output, continue to terminal status callback |
| Provider output is incomplete | Persist `PARTIAL` with the surviving events and explanation |
| Job already has an artifact | Replace idempotently by `jobId` and checksum-safe logic |

## Callback / Reporting Contract

- Primary callback: `POST /api/jobs/{jobId}/logs`
- Final status callback remains `PATCH /api/jobs/{jobId}/status`
- Ordering requirement: upload first, terminal status second

