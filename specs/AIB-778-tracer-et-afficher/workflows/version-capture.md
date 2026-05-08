# Workflow Artifact: Job-Start Version Capture

Captures the AI-Board plugin manifest version and the resolved agent CLI version on every dispatched job, before the agent's main task runs.

## Where this lives

- **Capture script**: extension of `.github/scripts/run-agent.sh` (existing). No new script file.
- **Trigger**: `dispatch_agent` function at `.github/scripts/run-agent.sh:759-795` — runs once per job.
- **Reporter**: parent workflow's existing "Update Job Status - Running" step (e.g. `speckit.yml:228`, `verify.yml:208`, `quick-impl.yml:202`, `iterate.yml`, `ai-board-assist.yml`).

## Inputs

| Var | Source | Notes |
|-----|--------|-------|
| `AGENT_TYPE` | First argument to `run-agent.sh` (existing) | One of `CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI` |
| `JOB_ID` | Parent workflow env (existing — already used at line 752) | For log correlation only; the PATCH carries it via URL path |
| `GITHUB_WORKSPACE` / repo checkout | Existing | Plugin manifest is read from `.claude-plugin/plugin.json` relative to repo root |

## Steps

Numbered phases inside `dispatch_agent`. Each step's failure is non-fatal (matches FR-004, FR-010, pattern P3).

### Phase 1 — Read plugin version

New helper, defined alongside the other helpers near the top of `run-agent.sh`:

```bash
read_plugin_version() {
  local manifest=".claude-plugin/plugin.json"
  if [[ ! -f "$manifest" ]]; then
    log_info "Plugin manifest not found at $manifest — pluginVersion will be absent"
    return 0
  fi
  local version
  version=$(jq -r '.version // empty' "$manifest" 2>/dev/null | head -1 | tr -d '\n' | cut -c1-40)
  if [[ -z "$version" ]]; then
    log_info "Plugin manifest has no usable .version field — pluginVersion will be absent"
    return 0
  fi
  printf '%s' "$version"
}
```

Called once near the top of `dispatch_agent`, before the case switch:

```bash
PLUGIN_VERSION="$(read_plugin_version)"
```

### Phase 2 — Resolve & invoke per-agent CLI version reporter

Per-agent helpers, each placed next to the matching `install_*` function for cohesion. All share the same shape: `<binary> --version 2>/dev/null | head -1 | tr -d '\n' | cut -c1-40`. Output captured to stdout, never to stderr.

```bash
capture_claude_version()  { claude  --version 2>/dev/null | head -1 | tr -d '\n' | cut -c1-40; }
capture_codex_version()   { codex   --version 2>/dev/null | head -1 | tr -d '\n' | cut -c1-40; }
capture_mistral_version() { vibe    --version 2>/dev/null | head -1 | tr -d '\n' | cut -c1-40; }
capture_gemini_version()  { gemini  --version 2>/dev/null | head -1 | tr -d '\n' | cut -c1-40; }
```

Wired into each branch of the existing case switch in `dispatch_agent` (between `install_*`/`auth_*` and `invoke_*`):

```bash
case "$AGENT_TYPE" in
  CLAUDE)
    validate_auth
    install_claude
    AGENT_CLI_VERSION="$(capture_claude_version)"
    invoke_claude
    ;;
  CODEX)
    validate_auth
    install_codex
    auth_codex
    AGENT_CLI_VERSION="$(capture_codex_version)"
    setup_codex_telemetry
    invoke_codex
    persist_codex_token
    ;;
  MISTRAL)
    validate_auth
    install_mistral
    AGENT_CLI_VERSION="$(capture_mistral_version)"
    setup_mistral_telemetry
    invoke_mistral
    collect_mistral_telemetry
    ;;
  GEMINI)
    validate_auth
    install_gemini
    auth_gemini
    AGENT_CLI_VERSION="$(capture_gemini_version)"
    setup_gemini_telemetry
    local gemini_exit=0
    invoke_gemini || gemini_exit=$?
    return $gemini_exit
    ;;
esac
```

If the helper fails (binary missing, returns non-zero, prints nothing to stdout), `AGENT_CLI_VERSION` is the empty string. The parent workflow then omits the field from the JSON body (Phase 4).

### Phase 3 — Export captured values to parent workflow

`run-agent.sh` is invoked from a workflow step. Bash variables don't survive the step boundary, so they must be written to `$GITHUB_ENV`. Append to the script (after the `dispatch_agent` invocation completes successfully OR fails — capture is independent of agent outcome):

```bash
if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "PLUGIN_VERSION=${PLUGIN_VERSION:-}"
    echo "AGENT_CLI_VERSION=${AGENT_CLI_VERSION:-}"
  } >> "$GITHUB_ENV"
fi
```

This block runs even if `dispatch_agent` fails so that even a job that errors out reports the versions it had attempted to use (consistent with spec edge case "A job that was started but cancelled before the agent task ran: if capture happened first, version fields are populated").

### Phase 4 — Workflow PATCH carries captured values

Each of the five workflow files (`speckit.yml`, `verify.yml`, `quick-impl.yml`, `iterate.yml`, `ai-board-assist.yml`) has a "Update Job Status - Running" step. Today it sends:

```yaml
- name: Update Job Status - Running
  if: ${{ inputs.job_id }}
  run: |
    HTTP_CODE=$(curl -X PATCH "${APP_URL}/api/jobs/${{ inputs.job_id }}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d '{"status": "RUNNING", "workflowRunId": ${{ github.run_id }}}' \
      -s -o /dev/null -w "%{http_code}") || true
    ...
```

This step runs BEFORE `run-agent.sh` is invoked, so `PLUGIN_VERSION` and `AGENT_CLI_VERSION` are not yet known. Two options:

**Option A (chosen)** — Move the PATCH to AFTER `run-agent.sh` so the captured env vars are available, and gate it `if: always()` so it runs even on agent failure. The body is built with `jq -nc`:

```yaml
- name: Update Job Status - Running
  if: ${{ always() && inputs.job_id }}
  run: |
    BODY=$(jq -nc \
      --arg status RUNNING \
      --argjson runId "${{ github.run_id }}" \
      --arg plugin "${PLUGIN_VERSION:-}" \
      --arg cli "${AGENT_CLI_VERSION:-}" \
      '{status:$status, workflowRunId:$runId}
        + (if $plugin == "" then {} else {pluginVersion:$plugin} end)
        + (if $cli == "" then {} else {agentCliVersion:$cli} end)')
    HTTP_CODE=$(curl -X PATCH "${APP_URL}/api/jobs/${{ inputs.job_id }}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d "${BODY}" \
      -s -o /dev/null -w "%{http_code}") || true
    if [ "$HTTP_CODE" = "409" ]; then
      echo "🚫 Job already CANCELLED — aborting workflow"
      exit 1
    elif [ "$HTTP_CODE" != "200" ]; then
      echo "⚠️ Failed to update job status to RUNNING (HTTP $HTTP_CODE)"
    fi
```

**Option B (rejected)** — Two PATCHes: one before `run-agent.sh` (status: RUNNING, no versions) and one after (with versions). Rejected because:
- Doubles the API calls per job.
- The 409-on-cancellation guard at line 213 of the existing step relies on the FIRST PATCH being early so a cancelled job aborts before the agent runs. Splitting the PATCH would push the cancellation check after the agent has already started.

**Conclusion**: Option A is incompatible with the early cancellation guard. Therefore the FINAL design is Option B with a refinement:

**Option B' (final)** — Keep the existing early "Update Job Status - Running" step exactly as is (preserves the 409 cancellation gate). Add a NEW step AFTER `run-agent.sh` named "Update Job Versions" that re-PATCHes the same endpoint with `{status:'RUNNING', pluginVersion, agentCliVersion}`. The handler's first-write-wins guard ensures the second PATCH only writes the version fields and leaves status unchanged (idempotent path at route.ts:147-164). The status idempotency check returns 200 immediately, so the call is cheap.

```yaml
- name: Update Job Versions
  if: ${{ always() && inputs.job_id && (env.PLUGIN_VERSION != '' || env.AGENT_CLI_VERSION != '') }}
  run: |
    BODY=$(jq -nc \
      --arg status RUNNING \
      --arg plugin "${PLUGIN_VERSION:-}" \
      --arg cli "${AGENT_CLI_VERSION:-}" \
      '{status:$status}
        + (if $plugin == "" then {} else {pluginVersion:$plugin} end)
        + (if $cli == "" then {} else {agentCliVersion:$cli} end)')
    curl -X PATCH "${APP_URL}/api/jobs/${{ inputs.job_id }}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d "${BODY}" \
      -s -o /dev/null || true
```

The original "Update Job Status - Running" step is left untouched. The new step is best-effort (no failure path to the workflow) — capture is a non-blocking auxiliary path per FR-004 / FR-010.

## Output

| Output | Where it goes | When |
|--------|---------------|------|
| `pluginVersion` column on Job row | `Job` table via PATCH | After `run-agent.sh` returns, before workflow finishes |
| `agentCliVersion` column on Job row | Same | Same |
| Capture-failure log line | Runner stderr (`log_info` to stderr — existing pattern) | Synchronously when each helper exits with empty output |

## Reporting contract

The script never reports back to the app on its own. Reporting is the parent workflow's responsibility (Phase 4), using the existing job-status API endpoint extended by `contracts/job-status-api.md`.

## Failure paths (matrix)

| Failure | Effect on `pluginVersion` | Effect on `agentCliVersion` | Effect on job |
|---------|--------------------------|----------------------------|---------------|
| `.claude-plugin/plugin.json` missing | NULL | (unaffected) | None — agent runs |
| Plugin manifest `.version` field missing or non-string | NULL | (unaffected) | None |
| `<cli> --version` exits non-zero | (unaffected) | NULL | None |
| `<cli>` binary missing on PATH | (unaffected) | NULL | None |
| `--version` returns multi-line garbage | NULL or truncated to first 40 chars | Same | None |
| Job already CANCELLED before "Update Job Versions" step runs | NULL | NULL | The status PATCH returns 409 from the FIRST status step (early gate); workflow exits before reaching the version PATCH |
| `Update Job Versions` curl fails network-wise | (unaffected by code) — second-write would have failed silently anyway | Same | None — `\|\| true` swallows the curl exit |

## Why no new endpoint

See contract `job-status-api.md`. Adding two optional fields to the existing PATCH minimizes API surface and reuses the proven first-write-wins + atomic update pattern at `app/api/jobs/[id]/status/route.ts:204-226`.
