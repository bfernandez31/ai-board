# Runner Script Specification — `capture-versions.sh`

This document is the implementation contract for the new runner-side script
that the workflow step "Capture Plugin/CLI Versions" invokes. It is paired
with `version-capture-workflow.md` (the workflow-side step contract) and the
API contract (`contracts/job-versions-api.yaml`).

## File path

`.github/scripts/capture-versions.sh`

Executable bash. Same directory and ownership as `run-agent.sh` and
`capture-agent-logs.sh`.

## Invariants

These are the contract; the script can be implemented many ways but must
preserve all of them.

1. **Always exits 0.** No code path returns a non-zero status. (FR-004, FR-010.)
2. **No `set -e`.** Use `set -o pipefail` only — individual command failures must not abort the script.
3. **Required-vars guard at the top.** If any of `JOB_ID`, `APP_URL`, `WORKFLOW_API_TOKEN`, `AGENT_TYPE` is missing, log a warning to stderr with the missing var's name and exit 0 — no API call.
4. **Best-effort per phase.** Plugin probe, CLI probe, and API POST are independent; failure of one does not skip the next.
5. **No new files persisted to disk.** Any temp files cleaned up via `trap cleanup EXIT`.
6. **No payload sent if both probes failed.** Avoid useless API noise.
7. **First non-empty wins for plugin version.** `plugin.json` first, SHA fallback second.
8. **Single line, trimmed, ≤100 chars for both fields.**

## Required environment variables

| Var | Source | Type |
|---|---|---|
| `JOB_ID` | workflow `inputs.job_id` | integer string |
| `APP_URL` | workflow `vars.APP_URL` | URL string (no trailing slash assumed) |
| `WORKFLOW_API_TOKEN` | workflow `secrets.WORKFLOW_API_TOKEN` | bearer token |
| `AGENT_TYPE` | workflow `inputs.agent` | one of `CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI` (case-insensitive in input; uppercased internally) |

## Outline

```bash
#!/usr/bin/env bash
# capture-versions.sh — runner-side version capture for AIB-775.
#
# Phases:
#   1. Resolve plugin version:  jq plugin.json --> sha:<short>
#   2. Resolve agent CLI version: <cli> --version (per AGENT_TYPE)
#   3. POST {pluginVersion?, agentCliVersion?} to /api/jobs/$JOB_ID/versions
#
# Capture MUST NOT block the job. Always exits 0. Mirrors AIB-715
# capture-agent-logs.sh's defensive pattern.

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
```

## Acceptance per spec acceptance scenarios

- **US-1 #1/#2/#3** (versions visible after a successful run): script POSTs both fields → endpoint persists → next GET returns them.
- **US-2 #1** (pre-feature job): no POST ever happened → DB columns null → UI placeholder. The script does not need to do anything for this case.
- **US-2 #2** (capture failure): both probes fail → script logs warnings, sends nothing → DB stays null → UI placeholder. No error surfaces to the workflow.
- **US-2 #3** (partial capture): one probe fails → script sends only the field that succeeded → DB has one set, one null → UI mixes value + placeholder.
- **US-3 #1** (all 4 agents): the `case "$AGENT_TYPE"` covers every supported agent; default branch is logged and the API call is still attempted with whatever plugin version was resolved.
- **US-3 #2** (visible at start, not at end): script runs at workflow start (per `version-capture-workflow.md`), so versions are written before the agent's first turn.
- **Edge: format unknown** (CLI prints non-semver): we store the raw line. No format validation.
- **Edge: plugin without semver tag**: plugin.json's `.version` is empty/absent → SHA fallback fires.
- **Edge: simultaneous plugin upgrade**: capture is at start; an upgrade later in the run is not reflected, which is the spec's accepted behavior.

## Dependencies on the runner image

- `bash`, `jq`, `curl`, `git`, `head`, `tr`, `sed`, `timeout` — all present on `ubuntu-latest`.
- `npm`, `bun` — already required by `run-agent.sh`; we share the same install commands and tolerate failures gracefully.
- Network egress to `$APP_URL` — already required by the existing RUNNING PATCH.

## Lint / test seam

- The script has no Vitest test (it's bash). The integration test
  `tests/integration/api/jobs/versions-post.test.ts` exercises the API
  contract end-to-end with realistic payloads, which is sufficient for
  TDD coverage of the **endpoint** side. The script itself is a
  bash-execution detail; per the constitution's testing trophy, hand-
  testing the workflow on a single PR run is acceptable verification of
  the runner-side glue.
- Running `bash -n .github/scripts/capture-versions.sh` is the lint floor
  (syntax check); the existing CI lint job already does this implicitly
  if a contributor opens the file in a context where shellcheck is wired
  in. No new CI step is added.
