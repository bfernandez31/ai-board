# Internal Process: RTK token-saving activation during a Claude run

Implements the spec's "Token-saving activation during a Claude run" (FR-004 – FR-007, SC-003).

## Threading: app → workflow → runner

1. **App** (`lib/workflows/transition.ts`): compute `effectiveTokenSaving = resolveEffectiveTokenSaving(ticket)`. For Claude standard/quick/verify stages, add to `workflowInputs`:
   ```
   tokenSaving: String(effectiveTokenSaving)   // "true" | "false"
   ```
2. **Workflow YAML** (`speckit.yml`, `quick-impl.yml`, `verify.yml`, `iterate.yml`): new input
   ```yaml
   tokenSaving:
     description: 'Enable RTK output compression (Claude only)'
     required: false
     type: boolean
     default: false
   ```
   threaded to env in the run step:
   ```yaml
   TOKEN_SAVING: ${{ inputs.tokenSaving }}
   ```
3. **Runner** (`.github/scripts/run-agent.sh`): reads `TOKEN_SAVING`.

## Runner phases (`dispatch_agent` → CLAUDE branch)

Insert between `ensure_claude_commands` and `invoke_claude`:

```
CLAUDE)
  validate_auth
  install_claude
  ensure_claude_commands
  activate_token_saving        # <-- new; sets TOKEN_SAVING_OUTCOME
  report_runtime_versions claude   # extend to also PATCH tokenSavingOutcome
  invoke_claude
```

### `activate_token_saving` (non-blocking)
```
TOKEN_SAVING_OUTCOME="INACTIVE"

activate_token_saving() {
  # Phase 1: skip entirely when OFF or non-Claude (non-Claude never reaches here)
  [[ "${TOKEN_SAVING:-false}" == "true" ]] || { TOKEN_SAVING_OUTCOME="INACTIVE"; return 0; }

  # Phases 2-3: install pinned RTK + register PreToolUse hook; swallow ALL failures
  local rc=0
  set +e
  install_rtk        # curl pinned release installer; pinned RTK_VERSION constant
  rc=$?
  if [[ $rc -eq 0 ]]; then
    rtk init --global >&2     # writes ~/.claude/settings.json PreToolUse hook
    rc=$?
  fi
  set -e

  if [[ $rc -eq 0 ]] && rtk --version &>/dev/null; then
    TOKEN_SAVING_OUTCOME="ACTIVE"     # Phase 4: hook compresses; passes through unparseable output
  else
    TOKEN_SAVING_OUTCOME="FELL_BACK"  # FR-006: run continues, never aborts
    log_info "RTK activation failed — continuing without token saving (fell back)"
  fi
  return 0   # NEVER non-zero (SC-003)
}
```

- **Pinning** (FR-017): `RTK_VERSION` is an explicit constant in the script; the installer fetches that exact release, never "latest".
- **Pass-through** (Edge Case "unparseable output"): inherent to RTK — when it cannot parse a command's output it returns the full output unchanged. No extra code.
- **Non-Claude** (FR-007): the CODEX/MISTRAL/GEMINI branches never call `activate_token_saving`; their jobs report `INACTIVE`.

### Phase 5 — report outcome
Extend the existing `report_runtime_versions` status PATCH (`~run-agent.sh:399-414`) to include `tokenSavingOutcome: $TOKEN_SAVING_OUTCOME` in the RUNNING payload (jq, like `pluginVersion`/`agentCliVersion`). App persists via §3 contract.

## Error behavior (contract)
- Any install/activation error → swallowed; outcome `FELL_BACK`; run proceeds; not retried within the run (spec error behavior).
- OFF / non-Claude → no install, no hook, no measurable overhead (FR-005, SC-007); outcome `INACTIVE`.

## Verification hooks (acceptance)
- US1/US2 integration: dispatch Claude BUILD on inheriting ticket with project ON → workflow input `tokenSaving=true`; job ends with outcome `ACTIVE`.
- SC-003: simulate install failure → job `FELL_BACK`, run still COMPLETED.
- FR-007: non-Claude agent with override ON → job `INACTIVE`, run unchanged.
