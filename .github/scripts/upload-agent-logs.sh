#!/usr/bin/env bash
set -uo pipefail

# Upload captured agent output to the ai-board log API.
# Non-blocking: failures are logged but always exit 0 (FR-015).

LOG_FILE="${LOG_CAPTURE_FILE:-}"
AGENT="${AGENT_TYPE:-${1:-CLAUDE}}"
JOB="${JOB_ID:-}"
APP="${APP_URL:-}"
TOKEN="${WORKFLOW_API_TOKEN:-}"

if [ -z "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
  echo "⚠️ No agent output to upload (LOG_CAPTURE_FILE empty or missing)"
  exit 0
fi

if [ -z "$JOB" ] || [ -z "$APP" ] || [ -z "$TOKEN" ]; then
  echo "⚠️ Missing required env vars for log upload (JOB_ID, APP_URL, or WORKFLOW_API_TOKEN)"
  exit 0
fi

RAW_OUTPUT=$(cat "$LOG_FILE")

PAYLOAD=$(jq -n --arg agentType "$AGENT" --arg rawOutput "$RAW_OUTPUT" \
  '{ agentType: $agentType, rawOutput: $rawOutput }')

HTTP_CODE=$(curl -X POST "${APP}/api/jobs/${JOB}/logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "$PAYLOAD" \
  --max-time 30 \
  -s -o /dev/null -w "%{http_code}") || true

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Agent logs uploaded successfully (HTTP $HTTP_CODE)"
else
  echo "⚠️ Agent log upload returned HTTP $HTTP_CODE (non-blocking)"
fi

exit 0
