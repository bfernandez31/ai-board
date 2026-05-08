# Internal Process — Plugin/Agent CLI Version Capture at Job Start

This document specifies the **runner-side internal process** described in spec
§"Internal Processes — Capture des versions au démarrage du job". It is the
counterpart to the API contract (`contracts/job-versions-api.yaml`).

## Purpose

For every Job that runs an agent CLI on GitHub Actions, capture and persist:

1. The AI-Board plugin version active in the runner's sparse checkout.
2. The version reported by the agent CLI itself.

…before the agent's first productive turn (FR-001/FR-002).

## Trigger

This is **not** a separate workflow — it is a single new step inserted into
each agent-running workflow:

| Workflow | Trigger | Inserted at | Justification |
|---|---|---|---|
| `.github/workflows/verify.yml` | VERIFY stage | After `Update Job Status - Running` (line 205) and after `Checkout ai-board (sparse - plugin only)` (line 263), before any `run-agent.sh` call. | This workflow is the largest and most observed one — first integration target. |
| `.github/workflows/speckit.yml` | SPECIFY/PLAN/BUILD | Same position relative to its own anchors. | Covers the bulk of FULL-workflow jobs. |
| `.github/workflows/quick-impl.yml` | INBOX→BUILD (QUICK) | Same. | Covers QUICK-workflow jobs. |
| `.github/workflows/iterate.yml` | VERIFY stage | Same. | Covers iterate jobs. |
| `.github/workflows/ai-board-assist.yml` | `@ai-board` mention | Same. | Covers AI-BOARD comment jobs. |

> **Workflows explicitly NOT touched**: `deploy-preview.yml`, `rollback-reset.yml`,
> `nightly-log-prune.yml`, `nightly-health.yml`, `auto-ship.yml` — these don't
> run an agent CLI, so there is no agent version to capture and no Job row in
> the canonical sense for some of them. `onboard.yml` and `retro-spec.yml`
> operate on `ProjectSetupJob` (not `Job`), which is out of scope.

## Step contract (workflow-side)

Each agent-running workflow gains exactly one new step. The step:

```yaml
- name: Capture Plugin/CLI Versions
  if: ${{ inputs.job_id }}
  env:
    JOB_ID: ${{ inputs.job_id }}
    APP_URL: ${{ vars.APP_URL }}
    WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
    AGENT_TYPE: ${{ inputs.agent }}
  run: bash ai-board/.github/scripts/capture-versions.sh
```

### Required guarantees of the step

1. **Non-blocking**: the script always exits 0. The step never fails the
   workflow run, even if both probes fail. Mirrors the AIB-715 capture step
   contract (FR-004, FR-010).
2. **No `if: env.SKIP_EXECUTION != 'true'`**: the `[e2e]` skip path still
   needs version capture so we can integration-test the full path against
   seeded jobs without running real agents. The step gates only on
   `inputs.job_id` (falsy when no job is associated).
3. **No new secret**: `WORKFLOW_API_TOKEN` is already in scope for every
   anchor workflow. No additional repository secret is required.
4. **No new permission**: the step calls only the new endpoint and reads
   files that the existing `Checkout ai-board (sparse - plugin only)` step
   has already placed on disk.

## Inputs (env contract for `capture-versions.sh`)

| Variable | Required | Provenance | Notes |
|---|---|---|---|
| `JOB_ID` | yes | `inputs.job_id` of the calling workflow | Numeric. Missing → script logs warning to stderr and exits 0. |
| `APP_URL` | yes | `vars.APP_URL` | The ai-board app's base URL (already used by the RUNNING PATCH). |
| `WORKFLOW_API_TOKEN` | yes | `secrets.WORKFLOW_API_TOKEN` | Bearer token for the new endpoint. |
| `AGENT_TYPE` | yes | `inputs.agent` (one of `CLAUDE \| CODEX \| MISTRAL \| GEMINI`) | Drives which CLI command to probe. |

If any required variable is missing, the script logs `"capture-versions: missing required env var: <NAME>"` to stderr and exits 0 — **no payload is sent, no error is surfaced, the job continues**. This is the same defensive pattern used at `capture-agent-logs.sh:18-24`.

## Phases

The script proceeds in three phases. Each phase is best-effort; a failure in
any one phase produces a `null` for that field and the script proceeds.

### Phase 1 — Resolve plugin version

Order of attempts (first non-empty wins):

1. **Primary**: `jq -r '.version // empty' ai-board/.claude-plugin/plugin.json 2>/dev/null`
   - Path `ai-board/.claude-plugin/plugin.json` is the runner's working copy
     of the sparse checkout (the existing checkout step uses `path: ai-board`
     and `sparse-checkout: .claude-plugin` — see verify.yml:263-271).
   - Returns the literal string of the JSON `version` field
     (e.g. `"1.0.1"`).
2. **Fallback**: `git -C ai-board rev-parse --short HEAD 2>/dev/null`
   - Stored prefixed: `"sha:<short>"` (e.g. `"sha:7bf6d3a4"`) so the consumer
     can distinguish it from a semver without a second column.
3. **Both failed**: leave `pluginVersion` unset in the payload.

Length cap: 100 chars (matches Zod + DB). Trim whitespace.

### Phase 2 — Resolve agent CLI version

A single `case "$AGENT_TYPE"` block — exactly one branch runs:

| `AGENT_TYPE` | Probe command |
|---|---|
| `CLAUDE` | `timeout 5s claude --version 2>/dev/null \| head -n1` |
| `CODEX` | `timeout 5s codex --version 2>/dev/null \| head -n1` |
| `GEMINI` | `timeout 5s gemini --version 2>/dev/null \| head -n1` |
| `MISTRAL` | `timeout 5s vibe --version 2>/dev/null \| head -n1` |

For each branch:

1. If the CLI is not yet installed (the version step runs *before* `run-agent.sh` calls `install_<agent>`), invoke the same install command used by `run-agent.sh` (lines 364-379, 389-403, 513-528, 674-688). Bound the install to `timeout 60s` so a hanging install can never starve the job. If install fails or times out, leave `agentCliVersion` unset and proceed.
2. Run the probe with `timeout 5s`. Discard stderr.
3. Trim whitespace, take only the first line, truncate to 100 characters.
4. If the result is empty, leave `agentCliVersion` unset.

> **Note on installation**: when capture runs before the agent step, the CLI
> is in fact not yet installed. By installing during capture, we get the same
> binary that `run-agent.sh` will later use — `command -v <cli>` short-circuits
> the second install. Net cost: ≤ 60 s, but for almost every run the install
> step has already happened in the runner image cache. If install is ever
> moved earlier in the workflow, `command -v <cli>` makes capture take milliseconds.

### Phase 3 — POST to the API

Build the payload from whatever Phases 1 and 2 produced:

```bash
PAYLOAD="{}"
[[ -n "$PLUGIN_VERSION" ]] && PAYLOAD=$(echo "$PAYLOAD" | jq --arg v "$PLUGIN_VERSION" '. + {pluginVersion:$v}')
[[ -n "$CLI_VERSION" ]]    && PAYLOAD=$(echo "$PAYLOAD" | jq --arg v "$CLI_VERSION"   '. + {agentCliVersion:$v}')
```

If `PAYLOAD == "{}"` → log `"capture-versions: nothing to write (both probes failed)"` and exit 0 without calling the endpoint. (Sending `{}` would only get back a 400 Validation error — pointless noise.)

Else, `curl -s -X POST` to `${APP_URL}/api/jobs/${JOB_ID}/versions` with the
`Authorization: Bearer ${WORKFLOW_API_TOKEN}` header and 3 retries with
1/2/4 s backoff (mirrors `capture-agent-logs.sh`'s upload retry). On HTTP 200
log `"capture-versions: ok"`. On any other code, log a single warning line
including the HTTP code and `JOB_ID`. Exit 0 either way.

## Outputs

- **DB-side**: zero, one, or two of `Job.pluginVersion` / `Job.agentCliVersion`
  populated (first-write-wins).
- **Workflow-side**: stdout/stderr lines for human-readable runner debugging;
  no `GITHUB_OUTPUT` writes, no `GITHUB_ENV` writes.

## Error behavior

| Failure | Outcome |
|---|---|
| Missing env var | Log to stderr, exit 0, no API call. |
| `plugin.json` missing or unparseable | Try SHA fallback. If that also fails, omit `pluginVersion` from the payload. |
| CLI install times out / fails | Omit `agentCliVersion` from the payload. |
| `<cli> --version` times out | Omit `agentCliVersion` from the payload. |
| API returns 400 (validation) | Log warning with HTTP code, exit 0. (This means the script's payload didn't satisfy Zod — almost impossible given the local trim/truncate, but logged so it's auditable.) |
| API returns 401 | Log warning, exit 0. (Misconfigured token — operator-visible via the warning, but doesn't fail the job per FR-004.) |
| API returns 404 | Log warning, exit 0. (Job was deleted — race-condition tolerance.) |
| API returns 5xx | Retry up to 3× with backoff, then log warning and exit 0. |
| Network error / DNS / TLS | Same retry loop. |

## Observability (FR-010)

Every non-success branch produces exactly one warning line on stderr with:
- Constant prefix `capture-versions:` (so operators can `grep` workflow logs).
- `JOB_ID` value (for cross-correlation with the Job row).
- A short reason (`plugin probe failed`, `cli probe failed`, `api 5xx`, etc.).

No PushSubscription, no notification, no dashboard alert. SC-006's "less than 2 minutes to correlate" is satisfied by the unique prefix + `JOB_ID` pair.

## Performance budget (SC-005)

| Phase | Worst case | Typical |
|---|---|---|
| Plugin probe (file read or git command) | ~50 ms | <10 ms |
| CLI install (cache miss) | 60 s (hard timeout) | <2 s (cache hit) |
| CLI version probe | 5 s (hard timeout) | <100 ms |
| POST + retries (worst case 3× 4 s = 7 s + backoff) | 7 s | <300 ms |
| **Total** | **~72 s in pathological install miss + retries** | **~500 ms** |

Typical case stays under SC-005's 1-second budget. The pathological case is
bounded but exceeds the budget; this is acceptable because it (a) requires
the same npm install that `run-agent.sh` would have done anyway (so it's
no net cost across the run), and (b) it is the runner's first-ever job in a
warm runner image, which by definition is not the steady-state regime SC-005
measures.

## Test surface (mapped to spec acceptance scenarios)

| Spec ref | Test type | Asserts |
|---|---|---|
| US-1 #1 | `tests/integration/api/jobs/versions-post.test.ts` | POST 200 with both fields → GET shows both fields. |
| US-1 #2, #3 | Same file | After POST with `{pluginVersion: "1.0.1"}`, GET returns plugin set / CLI null. |
| US-2 #1 | `tests/unit/components/jobs-timeline.test.tsx` | Renders `'-'` and `title="Non disponible"` for null fields. |
| US-2 #2 | Same | Capture-failure case is the same UI as pre-feature — covered by the both-null case. |
| US-2 #3 | Same | Partial render (one set, one null) shows mixed values + tooltip on the null one. |
| US-3 #1 | `tests/integration/api/jobs/versions-post.test.ts` | POST is accepted with each `AGENT_TYPE` label and writes succeed regardless. |
| US-3 #2 | Same | Versions are visible immediately after the POST (no terminal-state requirement). |
| FR-009 (immutability) | Same | A second POST with different values returns the original values; DB is unchanged. |
| FR-008 (no backfill) | Implicit | Existing tests for the GET endpoint continue to pass with `null` for pre-feature fixtures. |

## What this process does NOT do

- It does **not** retry capture later in the job's lifecycle (FR-009 immutability).
- It does **not** capture other runtime metadata (model, region, runner image). Those belong to the existing telemetry / OTLP path.
- It does **not** modify `run-agent.sh`. Capture is strictly a sibling step.
- It does **not** introduce a new `JobLog`-like row. Both columns live on `Job` directly.
