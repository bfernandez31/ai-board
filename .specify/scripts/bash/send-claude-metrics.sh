#!/bin/bash
# Send Claude telemetry metrics to ai-board API
# Usage: send-claude-metrics.sh <telemetry_log> <job_id> <app_url> <api_token>

set -e

TELEMETRY_LOG="${1:-}"
JOB_ID="${2:-}"
APP_URL="${3:-}"
API_TOKEN="${4:-}"

if [ -z "$TELEMETRY_LOG" ] || [ -z "$JOB_ID" ] || [ -z "$APP_URL" ] || [ -z "$API_TOKEN" ]; then
  echo "⚠️ Missing required parameters for telemetry upload"
  echo "Usage: send-claude-metrics.sh <telemetry_log> <job_id> <app_url> <api_token>"
  exit 0
fi

if [ ! -f "$TELEMETRY_LOG" ]; then
  echo "ℹ️ No telemetry log found at $TELEMETRY_LOG"
  exit 0
fi

if [ ! -s "$TELEMETRY_LOG" ]; then
  echo "ℹ️ Telemetry log is empty - no metrics to send"
  exit 0
fi

echo "📊 Parsing Claude telemetry metrics..."

METRICS=$(node -e "
const fs = require('fs');
const content = fs.readFileSync(process.env.TELEMETRY_LOG, 'utf-8');
const lines = content.split('\n');

const metrics = {
  inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
  cacheCreationTokens: 0, costUsd: 0, durationMs: 0,
  model: null, toolsUsed: new Set()
};

let inApiRequest = false;
for (const line of lines) {
  if (line.includes('claude_code.api_request')) inApiRequest = true;
  if (line.includes('claude_code.user_prompt') || line.includes('claude_code.tool_result')) inApiRequest = false;

  if (inApiRequest) {
    let m;
    if ((m = line.match(/input_tokens:\s*[\"']?(\d+)/))) metrics.inputTokens += parseInt(m[1]);
    if ((m = line.match(/output_tokens:\s*[\"']?(\d+)/))) metrics.outputTokens += parseInt(m[1]);
    if ((m = line.match(/cache_read_tokens:\s*[\"']?(\d+)/))) metrics.cacheReadTokens += parseInt(m[1]);
    if ((m = line.match(/cache_creation_tokens:\s*[\"']?(\d+)/))) metrics.cacheCreationTokens += parseInt(m[1]);
    if ((m = line.match(/cost_usd:\s*[\"']?([\d.]+)/))) metrics.costUsd += parseFloat(m[1]);
    if ((m = line.match(/duration_ms:\s*[\"']?(\d+)/))) metrics.durationMs += parseInt(m[1]);
    if ((m = line.match(/model:\s*[\"']([^\"']+)/))) metrics.model = m[1];
  }

  const toolMatch = line.match(/tool_name:\s*[\"']([^\"']+)/);
  if (toolMatch) metrics.toolsUsed.add(toolMatch[1]);
}

console.log(JSON.stringify({
  inputTokens: metrics.inputTokens,
  outputTokens: metrics.outputTokens,
  cacheReadTokens: metrics.cacheReadTokens,
  cacheCreationTokens: metrics.cacheCreationTokens,
  costUsd: Math.round(metrics.costUsd * 1000000) / 1000000,
  durationMs: metrics.durationMs,
  model: metrics.model,
  toolsUsed: Array.from(metrics.toolsUsed).sort()
}));
")

echo "📈 Metrics: $METRICS"

curl -X PATCH "${APP_URL}/api/jobs/${JOB_ID}/metrics" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -d "$METRICS" \
  -f -s -S || echo "⚠️ Failed to send telemetry metrics"

echo "✅ Telemetry metrics sent"
