# Workflow: `inbox-analysis.yml`

**Branch**: `AIB-743-inbox-ticket-analysis` · **Date**: 2026-04-27 · **Path**: `.github/workflows/inbox-analysis.yml`

A new minimal GitHub Actions workflow that runs the 2-stage LLM analysis and PATCHes the result back to the app. Modeled on `health-scan.yml` (non-TESTS path) but stripped of every step that doesn't apply to a text-only LLM call.

---

## 1. Trigger

```yaml
on:
  workflow_dispatch:
    inputs:
      analysis_id:
        description: 'TicketAnalysis row id'
        required: true
        type: string
      project_id:
        description: 'Project id'
        required: true
        type: string
      ticket_id:
        description: 'Ticket id'
        required: true
        type: string
      githubRepository:
        description: 'Target repository in format owner/repo (informational; no clone needed)'
        required: true
        type: string
      agent:
        description: 'Agent type (CLAUDE | CODEX | MISTRAL)'
        required: false
        type: string
        default: 'CLAUDE'
      model:
        description: 'Model id (e.g. claude-opus-4-7)'
        required: false
        type: string
        default: ''
```

`githubRepository` is accepted for parity with other workflows but **not** used to clone — analysis is text-only.

---

## 2. Permissions

```yaml
permissions:
  contents: read
```

No PR creation, no pushes, no issue comments.

---

## 3. Job structure

```yaml
jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 5             # hard cap; PATCH `failed` with errorReason='timeout' on overrun
```

No service containers (postgres/redis/etc.). No matrix.

### env

```yaml
env:
  APP_URL: ${{ vars.APP_URL }}
  WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
  ANTHROPIC_MODEL: ${{ inputs.model || 'claude-opus-4-7' }}
  INPUT_ANALYSIS_ID: ${{ inputs.analysis_id }}
  INPUT_PROJECT_ID: ${{ inputs.project_id }}
  INPUT_TICKET_ID: ${{ inputs.ticket_id }}
  INPUT_AGENT: ${{ inputs.agent }}
```

`CLAUDE_CODE_OAUTH_TOKEN` is **not** set as a fallback for v1 — BYOK from `UserCredential` is required (FR-020 / D1 in research.md). If the user has no credential the POST handler rejects with 412 before dispatch (`analysis-api.md` §2 step 8), so the workflow never starts without a credential.

---

## 4. Steps

### S1. Sparse-checkout ai-board (plugin + scripts only)

Same as `health-scan.yml:175-183`:

```yaml
- name: Checkout ai-board (sparse - plugin and scripts)
  uses: actions/checkout@v4
  with:
    path: ai-board
    sparse-checkout: |
      .claude-plugin
      .github/scripts
    sparse-checkout-cone-mode: true
```

This is the **only** checkout. No target-repo clone — the LLM doesn't need source files.

### S2. Update analysis status to `running` is implicit

The DB row is already in `running` (created by the POST handler before dispatch). The workflow does **not** PATCH a separate "RUNNING" event because the row was inserted with that status.

### S3. Fetch owner AI credential (BYOK)

Verbatim parity with `health-scan.yml:213-253` (P3 in research.md):

```yaml
- name: Fetch Owner AI Credential
  run: |
    if [[ "${INPUT_AGENT}" == "CODEX" ]]; then
      PROVIDER="OPENAI"
    elif [[ "${INPUT_AGENT}" == "MISTRAL" ]]; then
      PROVIDER="MISTRAL"
    else
      PROVIDER="ANTHROPIC"
    fi
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      "${APP_URL}/api/internal/credentials?projectId=${INPUT_PROJECT_ID}&provider=${PROVIDER}" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    if [ "$HTTP_CODE" != "200" ]; then
      echo "❌ No owner credential available — failing analysis"
      curl -X PATCH "${APP_URL}/api/projects/${INPUT_PROJECT_ID}/tickets/${INPUT_TICKET_ID}/analysis/${INPUT_ANALYSIS_ID}/status" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
        -d '{"status":"failed","errorReason":"credential_missing","errorMessage":"No AI credential available"}'
      exit 1
    fi
    CRED_TYPE=$(echo "$BODY" | jq -r '.credentialType')
    ENV_VAR=$(echo "$BODY" | jq -r '.envVar')
    CRED_VALUE_B64=$(echo "$BODY" | jq -r '.value')
    echo "::add-mask::${CRED_VALUE_B64}"
    CRED_VALUE=$(echo "$CRED_VALUE_B64" | base64 -d)
    echo "::add-mask::${CRED_VALUE}"
    {
      echo "${ENV_VAR}<<CREDENTIAL_EOF"
      echo "${CRED_VALUE}"
      echo "CREDENTIAL_EOF"
    } >> "$GITHUB_ENV"
```

Failure → PATCH `failed` with `errorReason='credential_missing'` and `exit 1`.

### S4. Run the agent slash command

```yaml
- name: Run Inbox Analysis Agent
  id: run-agent
  run: |
    SECONDS=0
    if ai-board/.github/scripts/run-agent.sh \
        "$INPUT_AGENT" \
        "ai-board.inbox-analysis" \
        "--analysis-id ${INPUT_ANALYSIS_ID} --project-id ${INPUT_PROJECT_ID} --ticket-id ${INPUT_TICKET_ID}" \
        2>&1 | tee /tmp/analysis_log.txt; then
      DURATION_MS=$((SECONDS * 1000))
      echo "duration_ms=$DURATION_MS" >> $GITHUB_OUTPUT
      echo "agent_success=true" >> $GITHUB_OUTPUT
    else
      DURATION_MS=$((SECONDS * 1000))
      echo "duration_ms=$DURATION_MS" >> $GITHUB_OUTPUT
      echo "agent_success=false" >> $GITHUB_OUTPUT
      echo "error_msg<<EOF_ERR" >> $GITHUB_OUTPUT
      tail -c 2000 /tmp/analysis_log.txt >> $GITHUB_OUTPUT
      echo "EOF_ERR" >> $GITHUB_OUTPUT
    fi
```

The agent writes its result to `/tmp/inbox-analysis-result.json` conforming to the discriminated union expected by the PATCH endpoint (see workflows/inbox-analysis-command.md §4).

### S5. PATCH result

```yaml
- name: PATCH Analysis Status
  if: always()
  run: |
    if [ "${{ steps.run-agent.outputs.agent_success }}" = "true" ] \
       && [ -f /tmp/inbox-analysis-result.json ] \
       && jq empty /tmp/inbox-analysis-result.json 2>/dev/null; then
      BODY=$(jq -c '.' /tmp/inbox-analysis-result.json)
    else
      BODY=$(jq -nc \
        --arg msg "$(jq -Rs '.' < /tmp/analysis_log.txt | tail -c 2000)" \
        '{status:"failed", errorReason:"grounded_pass_failed", errorMessage:$msg}')
    fi
    curl -X PATCH "${APP_URL}/api/projects/${INPUT_PROJECT_ID}/tickets/${INPUT_TICKET_ID}/analysis/${INPUT_ANALYSIS_ID}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d "$BODY" \
      --fail-with-body \
    || echo "⚠️ PATCH failed — DB row will be reaped by janitor"
```

`if: always()` ensures even a panicked agent step still posts a `failed` row.

---

## 5. Behavioural contract

| Outcome | Workflow behaviour |
|---|---|
| Agent succeeds and emits valid `success` JSON | PATCH 200 with `status='success'`. |
| Agent finishes but cold-start branch was hit (anchor count < 3) | Result file has `status='cold_start'`. PATCH 200. |
| Agent fails (non-zero exit, malformed JSON, OOM) | Result file missing or invalid → fallback PATCH `failed` with `errorReason='grounded_pass_failed'` (or `scoping_pass_failed` if the agent reports the stage in the JSON). |
| Credential missing | S3 PATCHes `failed` and exits before invoking the agent. |
| Workflow timed out at 5 min | GH Actions kills the job; the `running` row is reaped by the janitor (out-of-MVP) or stays orphaned. The hourly rate-limit query ignores `running` rows naturally (it only counts `success`/`cold_start`). |

---

## 6. Why this is intentionally minimal

- **No** target-repo checkout: analysis is purely on text + outcome data fetched via the slash command's tool calls (`api/projects/.../outcomes` etc.). The agent has read-only access to the project's outcome dataset through the same WORKFLOW_API_TOKEN-authenticated APIs that other workflows use, with no need for the file tree.
- **No** `setup-bun` / `setup-node`: the `run-agent.sh` script invokes the agent CLI directly; no compile step is required for this workflow.
- **No** matrix or service containers: removes ≈30 s of cold-start. This is the only knob available to push toward the 10 s p95 SLO; even with all optimisations the realistic p95 is 15–25 s (research.md D1).
- Result: a workflow that consists of `checkout (sparse) → fetch credential → run agent → PATCH result`, ≈ 4 logical steps.

---

## 7. Test mode

When `WORKFLOW_API_TOKEN === 'test-workflow-token-for-e2e-tests-only'` (matches `lib/health/scan-dispatch.ts:23-29` test-mode predicate), the dispatch is suppressed by the API route. Integration tests insert a `running` row directly and PATCH it via the `/status` endpoint with the test token.

---

## 8. Observability

- Standard GH Actions logs.
- The workflow does **not** emit metrics to a separate sink in v1.
- The `costUsd` and `durationMs` recorded on the row are the canonical post-run observability for the feature; future analytics queries aggregate by `projectId, status, costUsd`.
