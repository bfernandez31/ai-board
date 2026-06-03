# Workflow Artifact: Claude token-saving activation

## Scope

In scope:

- `ai-board.specify`
- `ai-board.plan`
- `ai-board.implement`
- `ai-board.quick-impl`
- `ai-board.verify`

Out of scope:

- comment workflows
- assistant mentions
- health scans
- deploy previews
- rollbacks
- iterate
- code review
- code simplifier
- sync specifications
- log pruning
- non-Claude agents

## Workflow Inputs

Add a string or boolean workflow input to `speckit.yml`, `quick-impl.yml`, and `verify.yml`:

```yaml
token_saving:
  description: 'Run-captured token-saving setting'
  required: false
  default: 'false'
  type: string
```

Dispatch must pass this from the persisted job snapshot, not from live project/ticket settings.

## Environment

Set for core agent invocation steps only:

```bash
AI_BOARD_TOKEN_SAVING="${{ inputs.token_saving }}"
AI_BOARD_TOKEN_SAVING_JOB_ID="${{ inputs.job_id }}"
```

The central runner also already has `APP_URL` and `WORKFLOW_API_TOKEN` for authenticated status callbacks.

## Activation Steps

1. `.github/scripts/run-agent.sh` receives `AGENT_TYPE`, `COMMAND`, and arguments.
2. Before invoking Claude, check:
   - `AGENT_TYPE == CLAUDE`
   - `AI_BOARD_TOKEN_SAVING == true`
   - `COMMAND` is one of the in-scope core commands
3. If any check fails, skip RTK setup and report `INACTIVE` or `NOT_APPLICABLE` based on the job-captured state.
4. If checks pass:
   - install or verify the `rtk` binary
   - run non-interactive Claude hook initialization such as `rtk init -g --auto-patch`
   - verify hook status where available
   - PATCH job status with `tokenSavingStatus=ACTIVE`
5. If any RTK setup step fails:
   - record a bounded fallback reason
   - PATCH job status with `tokenSavingStatus=FALLBACK`
   - continue to `invoke_claude` without token saving

## Reporting Contract

Use `PATCH /api/jobs/:id/status` with workflow bearer auth:

```json
{
  "status": "RUNNING",
  "tokenSavingStatus": "ACTIVE"
}
```

Fallback example:

```json
{
  "status": "RUNNING",
  "tokenSavingStatus": "FALLBACK",
  "tokenSavingFallbackReason": "rtk init failed"
}
```

## Failure Semantics

- RTK install/init/reporting failures never fail the workflow by themselves.
- Claude CLI authentication or invocation failures keep their existing behavior.
- GitHub dispatch failures keep existing transition-blocking behavior.
- If the activation status PATCH fails, the runner logs a non-fatal message and continues.

## RTK Reference

The RTK project documents Claude Code shell-hook support, fail-open graceful degradation, and command rewrite behavior in its GitHub README and supported agents guide:

- https://github.com/rtk-ai/rtk
- https://github.com/rtk-ai/rtk/blob/master/docs/guide/getting-started/supported-agents.md
