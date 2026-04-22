#!/usr/bin/env bash
# capture-agent-logs.sh — runner-side log capture for AIB-715.
#
# Phases:
#   1. Collect raw agent stdout from $RUNNER_TEMP/agent-raw-<jobId>.log
#   2. Normalize per-agent into v1 NormalizedEvent NDJSON
#   3. Redact secrets using scripts/lib/redactor.mjs
#   4. Derive a <= 280-char preview
#   5. gzip + PUT /api/jobs/:id/logs/artifact (retry 3×, 1/2/4s backoff)
#   6. POST /api/jobs/:id/logs with the summary (same retry)
#   7. Cleanup temp files
#
# Capture MUST NOT block the job-status PATCH. Always exits 0 so the
# containing workflow step's `if: always()` does not cascade failure.

set -o pipefail

REQUIRED_VARS=(JOB_ID PROJECT_ID TICKET_ID APP_URL WORKFLOW_API_TOKEN AGENT_TYPE)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "capture-agent-logs: missing required env var: $var" >&2
    exit 0
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"

TMPDIR="${RUNNER_TEMP:-/tmp}"
RAW_LOG="${TMPDIR}/agent-raw-${JOB_ID}.log"
NORMALIZED="${TMPDIR}/agent-normalized-${JOB_ID}.jsonl"
REDACTED="${TMPDIR}/agent-redacted-${JOB_ID}.jsonl"
ARTIFACT="${TMPDIR}/agent-redacted-${JOB_ID}.jsonl.gz"

AGENT_UPPER="$(echo "${AGENT_TYPE}" | tr '[:lower:]' '[:upper:]')"
STARTED_AT="${CAPTURE_STARTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)}"
ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)"

cleanup() {
  rm -f "${NORMALIZED}" "${REDACTED}" "${ARTIFACT}" 2>/dev/null || true
  rm -f "${RAW_LOG}" 2>/dev/null || true
}
trap cleanup EXIT

# ---------- Phase 1: Collect ----------

if [[ ! -s "${RAW_LOG}" ]]; then
  : > "${RAW_LOG}"
fi

# ---------- Phase 2: Normalize ----------

case "${AGENT_UPPER}" in
  CLAUDE)  NORMALIZER="${LIB_DIR}/normalize-claude.mjs" ;;
  CODEX)   NORMALIZER="${LIB_DIR}/normalize-codex.mjs" ;;
  MISTRAL) NORMALIZER="${LIB_DIR}/normalize-mistral.mjs" ;;
  GEMINI)  NORMALIZER="${LIB_DIR}/normalize-gemini.mjs" ;;
  *)
    echo "capture-agent-logs: unknown agent ${AGENT_TYPE}; defaulting to Claude" >&2
    NORMALIZER="${LIB_DIR}/normalize-claude.mjs"
    ;;
esac

HEADER=$(cat <<JSON
{"schemaVersion":1,"agent":"${AGENT_UPPER}","jobId":${JOB_ID},"startedAt":"${STARTED_AT}","endedAt":"${ENDED_AT}"}
JSON
)

{
  echo "${HEADER}"
  node "${NORMALIZER}" "${RAW_LOG}" 2>/dev/null || true
} > "${NORMALIZED}"

# If normalization produced no events, synthesize lifecycle pair
EVENT_LINES=$(($(wc -l < "${NORMALIZED}" 2>/dev/null || echo 0) - 1))
if [[ "${EVENT_LINES}" -le 0 ]]; then
  {
    echo "${HEADER}"
    echo "{\"ts\":\"${STARTED_AT}\",\"type\":\"lifecycle\",\"agent\":\"${AGENT_UPPER}\",\"payload\":{\"kind\":\"started\"}}"
    echo "{\"ts\":\"${ENDED_AT}\",\"type\":\"lifecycle\",\"agent\":\"${AGENT_UPPER}\",\"payload\":{\"kind\":\"cancelled\"}}"
  } > "${NORMALIZED}"
fi

# ---------- Phase 3: Redact ----------

node --input-type=module -e "
import('${LIB_DIR}/redactor.mjs').then(mod => {
  const { redactEvents } = mod;
  const fs = require('node:fs');
  const raw = fs.readFileSync('${NORMALIZED}', 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.length > 0);
  const header = JSON.parse(lines[0]);
  const events = lines.slice(1).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const redacted = redactEvents(events);
  const out = [JSON.stringify(header)].concat(redacted.map(e => JSON.stringify(e)));
  fs.writeFileSync('${REDACTED}', out.join('\n') + '\n');
});
" >/dev/null 2>&1 || cp "${NORMALIZED}" "${REDACTED}"

# ---------- Phase 4: Derive preview ----------

CAPTURE_STATUS="CAPTURED"
EVENT_COUNT=$(($(wc -l < "${REDACTED}") - 1))
if [[ "${EVENT_COUNT}" -lt 0 ]]; then EVENT_COUNT=0; fi
ERROR_COUNT=$(grep -c '"type":"error"' "${REDACTED}" 2>/dev/null || echo 0)

derive_preview() {
  node --input-type=module -e "
const fs = require('node:fs');
const raw = fs.readFileSync('${REDACTED}', 'utf-8');
const lines = raw.split(/\r?\n/).filter(l => l.length > 0).slice(1);
const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const status = process.env.CAPTURE_END_KIND === 'cancelled' ? 'CANCELLED'
  : events.some(e => e.type === 'error') ? 'FAILED'
  : 'COMPLETED';
function truncate(v) {
  const c = v.replace(/\s+/g, ' ').trim();
  return c.length <= 280 ? c : c.slice(0, 279).trimEnd() + '…';
}
let preview = '';
if (status === 'FAILED') {
  const err = [...events].reverse().find(e => e.type === 'error');
  if (err && err.payload && err.payload.message) preview = err.payload.message;
  else {
    const m = [...events].reverse().find(e => e.type === 'message' && e.payload && e.payload.text);
    preview = m ? m.payload.text : 'Job failed — no diagnostic output captured.';
  }
} else if (status === 'CANCELLED') {
  const lc = [...events].reverse().find(e => e.type === 'lifecycle');
  const reason = lc && lc.payload && lc.payload.detail ? lc.payload.kind + ': ' + lc.payload.detail : (lc && lc.payload ? lc.payload.kind : 'cancelled');
  preview = 'Cancelled (' + reason + ').';
} else {
  const m = [...events].reverse().find(e => e.type === 'message' && e.payload && e.payload.text);
  preview = m ? m.payload.text : 'Completed with no agent output.';
}
process.stdout.write(truncate(preview));
"
}

PREVIEW="$(derive_preview 2>/dev/null || echo 'Completed with no agent output.')"
if [[ -z "${PREVIEW}" ]]; then
  PREVIEW="Completed with no agent output."
fi

# ---------- Phase 5: Compress + upload artifact ----------

gzip -c "${REDACTED}" > "${ARTIFACT}"
ARTIFACT_SIZE=$(stat -c%s "${ARTIFACT}" 2>/dev/null || stat -f%z "${ARTIFACT}" 2>/dev/null || wc -c < "${ARTIFACT}")

ARTIFACT_KEY="logs/${PROJECT_ID}/${TICKET_ID}/${JOB_ID}.jsonl.gz"

put_artifact() {
  local attempt=0
  local delay=1
  while [[ ${attempt} -lt 3 ]]; do
    local code
    code=$(curl -sS -o /tmp/upload-response.json -w "%{http_code}" \
      -X PUT "${APP_URL}/api/jobs/${JOB_ID}/logs/artifact" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -H "Content-Type: application/gzip" \
      --data-binary @"${ARTIFACT}" || echo "000")
    if [[ "${code}" == "201" ]]; then
      return 0
    fi
    if [[ "${code}" =~ ^4 ]]; then
      echo "capture-agent-logs: FAILED status=${code} reason=non_retriable_upload" >&2
      return 1
    fi
    attempt=$((attempt + 1))
    sleep "${delay}"
    delay=$((delay * 2))
  done
  echo "capture-agent-logs: FAILED status=retry_exhausted reason=upload_timeout" >&2
  return 1
}

if ! put_artifact; then
  CAPTURE_STATUS="UNAVAILABLE"
  PREVIEW="Logs unavailable — capture failed."
fi

# ---------- Phase 6: Submit summary ----------

build_summary_body() {
  if [[ "${CAPTURE_STATUS}" == "CAPTURED" ]]; then
    cat <<JSON
{"captureStatus":"CAPTURED","preview":$(printf '%s' "${PREVIEW}" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync(0,'utf-8')))"),"schemaVersion":1,"eventCount":${EVENT_COUNT},"errorCount":${ERROR_COUNT},"artifactKey":"${ARTIFACT_KEY}","artifactSize":${ARTIFACT_SIZE}}
JSON
  else
    cat <<JSON
{"captureStatus":"UNAVAILABLE","preview":"Logs unavailable — capture failed.","schemaVersion":1,"eventCount":0,"errorCount":0}
JSON
  fi
}

post_summary() {
  local body="$1"
  local attempt=0
  local delay=1
  while [[ ${attempt} -lt 3 ]]; do
    local code
    code=$(curl -sS -o /tmp/summary-response.json -w "%{http_code}" \
      -X POST "${APP_URL}/api/jobs/${JOB_ID}/logs" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${body}" || echo "000")
    if [[ "${code}" == "200" ]]; then
      return 0
    fi
    if [[ "${code}" =~ ^4 ]]; then
      echo "capture-agent-logs: FAILED status=${code} reason=non_retriable_summary" >&2
      return 1
    fi
    attempt=$((attempt + 1))
    sleep "${delay}"
    delay=$((delay * 2))
  done
  echo "capture-agent-logs: FAILED status=retry_exhausted reason=summary_timeout" >&2
  return 1
}

SUMMARY_BODY="$(build_summary_body)"
post_summary "${SUMMARY_BODY}" || true

exit 0
