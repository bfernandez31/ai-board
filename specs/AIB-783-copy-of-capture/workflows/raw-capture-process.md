# Internal Process: Raw-session capture (per Claude Code job)

**Process owner**: `.github/scripts/capture-agent-logs.sh` (runner-side, extended).
**Triggered**: After every Claude Code job that has reached a terminal status, immediately after the existing normalized capture pipeline completes successfully.

## Inputs (env vars, no new wiring)
- `JOB_ID`, `PROJECT_ID`, `TICKET_ID`, `APP_URL`, `WORKFLOW_API_TOKEN` — already required by capture-agent-logs.sh:18.
- `AGENT_TYPE` — already required; gates the new phase via `${AGENT_UPPER} == "CLAUDE"`.
- `${CLAUDE_AGGREGATED}` (intermediate file) — populated by Phase 1 when the agent is Claude (capture-agent-logs.sh:62-72). The new phase reuses this file directly.

## Inputs (filesystem)
- `${HOME}/.claude/projects/<cwd-with-/.-replaced-by->/<sessionId>.jsonl` — Claude Code's standard layout. Already aggregated by Phase 1.

## Phases (new — appended after the existing Phase 5 in capture-agent-logs.sh)

### Phase 5b.0 — Gate
```bash
if [[ "${AGENT_UPPER}" != "CLAUDE" ]]; then
  : # non-Claude: silently skip. No log line. No raw artifact.
elif [[ "${CAPTURE_STATUS}" != "CAPTURED" ]]; then
  : # normalized failed: do not run raw. Same exit point as non-Claude.
elif [[ -z "${CLAUDE_AGGREGATED:-}" || ! -s "${CLAUDE_AGGREGATED}" ]]; then
  echo "capture-agent-logs: raw_capture skipped reason=no_session_data jobId=${JOB_ID}"
  # info-level log; no upload attempt; FR-009.
else
  # Phase 5b.1–5b.4 below
fi
```

### Phase 5b.1 — Redact native JSONL
Stream-process `${CLAUDE_AGGREGATED}` line-by-line through `redactNativeJsonl(line)` (from `.github/scripts/lib/redactor.mjs`), writing to `${TMPDIR}/agent-redacted-raw-${JOB_ID}.jsonl`.

The redactor MUST be invoked through Node so it shares the exact same module the existing Phase 3 normalized redaction uses (P11 in research.md). Implementation pattern:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import { redactNativeJsonl } from '${LIB_DIR}/redactor.mjs';
const raw = readFileSync('${CLAUDE_AGGREGATED}', 'utf-8');
const lines = raw.split(/\r?\n/);
const out = lines
  .map(l => l.length === 0 ? l : redactNativeJsonl(l))
  .join('\n');
writeFileSync('${RAW_REDACTED}', out);
"
```

If redaction throws (would be a `redactor.mjs` bug, not a per-line failure), capture stderr and skip the upload — same fail-soft semantics as Phase 3 (capture-agent-logs.sh:127-132).

### Phase 5b.2 — Compress
```bash
gzip -c "${RAW_REDACTED}" > "${RAW_ARTIFACT}"
RAW_ARTIFACT_SIZE=$(stat -c%s "${RAW_ARTIFACT}" 2>/dev/null || stat -f%z "${RAW_ARTIFACT}" 2>/dev/null || wc -c < "${RAW_ARTIFACT}")
```

### Phase 5b.3 — Upload (with retry)
Mirror `put_artifact()` (capture-agent-logs.sh:190-213) — 3 attempts, 1/2/4s backoff. Endpoint is `PUT ${APP_URL}/api/jobs/${JOB_ID}/logs/raw-artifact` with `Content-Type: application/gzip`. On success the server returns `{ rawArtifactKey, rawArtifactSize }`; the runner stores `RAW_ARTIFACT_KEY` from the response (NOT reconstructed client-side — D1 in research.md).

### Phase 5b.4 — Log outcome
- Success: `echo "capture-agent-logs: raw_capture ok jobId=${JOB_ID} size=${RAW_ARTIFACT_SIZE}"` (info-level, stdout).
- 4xx response: `echo "capture-agent-logs: raw_capture FAILED status=${code} reason=non_retriable_raw_upload jobId=${JOB_ID}" >&2`.
- Retry exhausted: `echo "capture-agent-logs: raw_capture FAILED status=retry_exhausted reason=raw_upload_timeout jobId=${JOB_ID}" >&2`.

All structured log lines include `jobId` and a non-secret reason token (FR-010). The token vocabulary distinct from the normalized log:
- `no_session_data` (Phase 5b.0)
- `non_retriable_raw_upload`, `raw_upload_timeout` (Phase 5b.3)
- `redaction_failed` if the inline Node script throws

## Failure isolation (CRITICAL — P3 in research.md)
Failure at any phase MUST:
- Leave `CAPTURE_STATUS` = `CAPTURED` (do **not** flip to `UNAVAILABLE`).
- Leave `PREVIEW` unchanged.
- Leave `ARTIFACT_KEY`/`ARTIFACT_SIZE` (normalized) unchanged.
- Set `RAW_ARTIFACT_KEY` = "" and `RAW_ARTIFACT_SIZE` = 0 so the summary submission omits raw fields.
- Emit a single structured log line (above).
- **Continue** to Phase 6 (summary submission). The script still exits 0.

## Outputs
- `${RAW_ARTIFACT_KEY}` (string, possibly empty) — fed into Phase 6 summary builder.
- `${RAW_ARTIFACT_SIZE}` (integer, 0 if empty key) — fed into Phase 6 summary builder.
- Cleanup: `cleanup()` trap (capture-agent-logs.sh:39-44) extended to remove `${RAW_REDACTED}` and `${RAW_ARTIFACT}`.

## Phase 6 — Summary submission extension
`build_summary_body()` (capture-agent-logs.sh:238-248) is extended: when `CAPTURE_STATUS == "CAPTURED"` AND `RAW_ARTIFACT_KEY` is non-empty, the JSON body adds `"rawArtifactKey":"${RAW_ARTIFACT_KEY}","rawArtifactSize":${RAW_ARTIFACT_SIZE}`. Otherwise the body is unchanged from today.

`delete_orphan_artifact()` (lines 276-282) is extended in parallel: if the summary write fails permanently AND `RAW_ARTIFACT_KEY` is non-empty, also DELETE the raw artifact via `DELETE /api/jobs/${JOB_ID}/logs/raw-artifact` so storage doesn't leak.

## Test coverage demanded
- `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` — happy path + 415 + 413 + 401 + 502 + non-Claude `409 AGENT_NOT_CLAUDE`.
- Runner-script smoke test (if one exists; otherwise covered by integration tests of the upload contract).
- A redaction integration test that injects a fake `ghp_...` token into a fixture native session line and asserts the uploaded artifact contains `[REDACTED:github_token]` at the same JSON path (FR-003 acceptance scenario US2.1).
