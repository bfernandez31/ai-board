#!/usr/bin/env bash
# Upload a captured agent execution log to the ai-board API.
#
# Usage:
#   upload-agent-log.sh <log_file> [<job_id> [<agent>]]
#
# Reads env: APP_URL, WORKFLOW_API_TOKEN, JOB_ID, AGENT_TYPE.
# Silent no-op when any required value is missing — log capture must never
# fail a workflow job just because observability plumbing is unavailable.

set -uo pipefail

LOG_FILE="${1:-}"
JOB_ID_ARG="${2:-${JOB_ID:-}}"
AGENT_ARG="${3:-${AGENT_TYPE:-}}"

if [[ -z "$LOG_FILE" ]]; then
  echo "[upload-agent-log] No log file provided — skipping" >&2
  exit 0
fi

if [[ ! -f "$LOG_FILE" ]]; then
  echo "[upload-agent-log] Log file not found: $LOG_FILE — skipping" >&2
  exit 0
fi

if [[ -z "${APP_URL:-}" || -z "${WORKFLOW_API_TOKEN:-}" ]]; then
  echo "[upload-agent-log] APP_URL or WORKFLOW_API_TOKEN unset — skipping" >&2
  exit 0
fi

if [[ -z "$JOB_ID_ARG" ]]; then
  echo "[upload-agent-log] JOB_ID unset — skipping" >&2
  exit 0
fi

# Cap the upload at 4 MB of raw bytes (server re-caps at 1 MB after
# normalization). Keep the tail — that is where failures surface.
MAX_BYTES=4194304
SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)
if [[ "$SIZE" -gt "$MAX_BYTES" ]]; then
  TAIL_FILE="$(mktemp /tmp/agent-log-tail-XXXXXX.txt)"
  tail -c "$MAX_BYTES" "$LOG_FILE" > "$TAIL_FILE"
  LOG_FILE="$TAIL_FILE"
  echo "[upload-agent-log] Log exceeded ${MAX_BYTES} bytes — uploading tail only" >&2
fi

PAYLOAD_FILE="$(mktemp /tmp/agent-log-payload-XXXXXX.json)"
trap 'rm -f "$PAYLOAD_FILE"' EXIT

# jq escapes the log content and safely encodes newlines / control chars.
if [[ -n "$AGENT_ARG" ]]; then
  jq -n --rawfile content "$LOG_FILE" --arg agent "$AGENT_ARG" \
    '{content: $content, agent: $agent}' > "$PAYLOAD_FILE"
else
  jq -n --rawfile content "$LOG_FILE" '{content: $content}' > "$PAYLOAD_FILE"
fi

HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST "${APP_URL}/api/jobs/${JOB_ID_ARG}/logs" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary "@${PAYLOAD_FILE}" \
  --max-time 30 || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "[upload-agent-log] Uploaded log for job ${JOB_ID_ARG}" >&2
else
  echo "[upload-agent-log] Upload failed (HTTP ${HTTP_CODE}) — non-blocking" >&2
fi

exit 0
