#!/usr/bin/env bash
# capture-versions.sh — runner-side plugin/CLI version capture for AIB-775.
#
# Phases:
#   1. Resolve plugin version:  jq plugin.json --> sha:<short>
#   2. Resolve agent CLI version: <cli> --version (per AGENT_TYPE)
#   3. POST {pluginVersion?, agentCliVersion?} to /api/jobs/$JOB_ID/versions
#
# Capture MUST NOT block the job. Always exits 0.

set -o pipefail

REQUIRED_VARS=(JOB_ID APP_URL WORKFLOW_API_TOKEN AGENT_TYPE)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "capture-versions: missing required env var: $var" >&2
    exit 0
  fi
done

AGENT_UPPER="$(echo "${AGENT_TYPE}" | tr '[:lower:]' '[:upper:]')"

# ---------- Phase 1: plugin version ----------
PLUGIN_VERSION=""
PLUGIN_JSON_CANDIDATES=("ai-board/.claude-plugin/plugin.json" ".claude-plugin/plugin.json")
for f in "${PLUGIN_JSON_CANDIDATES[@]}"; do
  if [[ -f "$f" ]]; then
    PLUGIN_VERSION="$(jq -r '.version // empty' "$f" 2>/dev/null | head -n1 | tr -d '[:space:]')"
    [[ -n "$PLUGIN_VERSION" ]] && break
  fi
done
if [[ -z "$PLUGIN_VERSION" ]]; then
  for d in "ai-board" "."; do
    if [[ -d "$d/.git" || -f "$d/.git" ]]; then
      SHORT="$(git -C "$d" rev-parse --short HEAD 2>/dev/null)"
      if [[ -n "$SHORT" ]]; then
        PLUGIN_VERSION="sha:$SHORT"
        break
      fi
    fi
  done
fi
if [[ -n "$PLUGIN_VERSION" ]]; then
  PLUGIN_VERSION="${PLUGIN_VERSION:0:100}"
else
  echo "capture-versions: plugin version probe failed (job_id=${JOB_ID})" >&2
fi

# ---------- Phase 2: agent CLI version ----------
CLI_VERSION=""
case "$AGENT_UPPER" in
  CLAUDE)
    command -v claude >/dev/null 2>&1 || timeout 60s npm install -g @anthropic-ai/claude-code >/dev/null 2>&1 || true
    CLI_VERSION="$(timeout 5s claude --version 2>/dev/null | head -n1)"
    ;;
  CODEX)
    command -v codex >/dev/null 2>&1 || timeout 60s bun add -g @openai/codex >/dev/null 2>&1 || true
    CLI_VERSION="$(timeout 5s codex --version 2>/dev/null | head -n1)"
    ;;
  GEMINI)
    command -v gemini >/dev/null 2>&1 || timeout 60s npm install -g @google/gemini-cli >/dev/null 2>&1 || true
    CLI_VERSION="$(timeout 5s gemini --version 2>/dev/null | head -n1)"
    ;;
  MISTRAL)
    command -v vibe >/dev/null 2>&1 || (timeout 60s curl -LsSf https://mistral.ai/vibe/install.sh | bash >/dev/null 2>&1) || true
    export PATH="${HOME}/.local/bin:${PATH}"
    CLI_VERSION="$(timeout 5s vibe --version 2>/dev/null | head -n1)"
    ;;
  *)
    echo "capture-versions: unknown AGENT_TYPE='${AGENT_TYPE}' — skipping CLI probe (job_id=${JOB_ID})" >&2
    ;;
esac
CLI_VERSION="$(echo "$CLI_VERSION" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
CLI_VERSION="${CLI_VERSION:0:100}"
if [[ -z "$CLI_VERSION" ]]; then
  echo "capture-versions: cli probe failed (agent=${AGENT_UPPER}, job_id=${JOB_ID})" >&2
fi

# ---------- Phase 3: POST ----------
PAYLOAD="{}"
[[ -n "$PLUGIN_VERSION" ]] && PAYLOAD="$(echo "$PAYLOAD" | jq --arg v "$PLUGIN_VERSION" '. + {pluginVersion:$v}')"
[[ -n "$CLI_VERSION"    ]] && PAYLOAD="$(echo "$PAYLOAD" | jq --arg v "$CLI_VERSION"    '. + {agentCliVersion:$v}')"

if [[ "$PAYLOAD" == "{}" ]]; then
  echo "capture-versions: nothing to write (both probes failed, job_id=${JOB_ID})" >&2
  exit 0
fi

DELAYS=(1 2 4)
HTTP_CODE=""
for delay in "${DELAYS[@]}"; do
  HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "${APP_URL}/api/jobs/${JOB_ID}/versions" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-raw "$PAYLOAD" \
    --max-time 10 || echo '000')"
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "capture-versions: ok (job_id=${JOB_ID}, plugin=${PLUGIN_VERSION:-none}, cli=${CLI_VERSION:-none})" >&2
    exit 0
  fi
  case "$HTTP_CODE" in
    400|401|404)
      echo "capture-versions: api ${HTTP_CODE} (job_id=${JOB_ID}) — not retrying" >&2
      exit 0
      ;;
  esac
  sleep "$delay"
done

echo "capture-versions: api ${HTTP_CODE:-error} after retries (job_id=${JOB_ID})" >&2
exit 0
