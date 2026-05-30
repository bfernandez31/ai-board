# Contract: Workflow Dispatch Input (`model`) — Codex Branch

**Feature**: AIB-830
**Date**: 2026-05-29

## Purpose

When `handleTicketTransition()` resolves a workflow's model and the effective agent is Codex, the resolved Codex model identifier MUST be injected into the workflow dispatch payload under the existing `model` input key, identical to how the Claude resolver does it for Claude IDs.

## Affected workflow files

All three workflow files already accept an optional `model` input string (added in AIB-678). No `workflow_dispatch` schema change is required for AIB-830:

- `.github/workflows/speckit.yml` — SPECIFY / PLAN / BUILD(=implement)
- `.github/workflows/quick-impl.yml` — QUICK-IMPL
- `.github/workflows/verify.yml` — VERIFY

When the runner receives a Codex `model` value (e.g., `gpt-5.4-mini`), it passes it through to the Codex CLI via `--model`. The runner is agent-aware (existing) and already routes based on the `agent` input; the `model` input is just a string and the agent decides how to consume it.

## Application-side payload

`workflowInputs` is unchanged in shape. The conditional spread at `lib/workflows/transition.ts:285`, `:303`, `:317` continues to inject `model` when `resolvedModel` is non-null:

```ts
const resolvedModel = resolveStageModel(ticket, command, effectiveAgent);
// resolvedModel: ClaudeModelId | CodexModelId | null

workflowInputs = {
  ticket_id: ticket.ticketKey,
  job_id: job.id.toString(),
  project_id: ticket.projectId.toString(),
  githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
  agent: effectiveAgent,
  ...(resolvedModel && { model: resolvedModel }),
  // … existing command-specific fields …
};
```

Rules:
- `model` is emitted ONLY when `resolvedModel` is non-null. For Codex, this means: effective agent is Codex AND command is one of the 5 configurable stages. The Codex fallback (`gpt-5.5`) is always a valid Codex ID, so `resolvedModel` will be non-null for Codex in those 5 stages even when neither ticket nor project has a configuration.
- The value, when emitted, is exactly one of `CODEX_MODEL_IDS` (for Codex agent) or `CLAUDE_MODEL_IDS` (for Claude agent).

## Job record population

`prisma.job.create(...)` at `lib/workflows/transition.ts:223` (quick-impl) and `:241` (other commands) already writes `model: resolvedModel`. No change. The `Job.model` column accepts any model string and is consumed by analytics (`lib/analysis/cost-table.ts`).

## Error behavior

- Resolution cannot fail for Codex: the global fallback `CODEX_GLOBAL_FALLBACK_MODEL = 'gpt-5.5'` is always a valid Codex ID.
- Existing dispatch-then-rollback pattern (Pattern P1 in research.md) at `transition.ts:349–388` is preserved unchanged: Job row is created with the resolved model; if the `octokit.actions.createWorkflowDispatch()` call fails, the Job row is deleted (L365), including its model value. No orphaned PENDING rows. This pattern applies regardless of which agent's model was resolved.

## Compatibility with existing Codex runs

Today, dispatches with `effectiveAgent === CODEX` send `agent: 'CODEX'` and no `model` input. After AIB-830, dispatches with Codex agent on any of the 5 stages will additionally include `model: <codex_id>`. The runner is responsible for handling this gracefully — but the runner already handles Claude `model` input identically, so the change is mechanical.

For commands NOT in the 5-stage configurable set (e.g., `iterate`, `comment-*`, `health-scan`, `deploy-preview`), the Codex resolver returns `null` (same as Claude resolver does today) and no `model` input is emitted — the runner uses the Codex CLI's default model. This preserves current behavior for non-stage commands.

## Cost telemetry hookup

`lib/analysis/cost-table.ts:22–40` MUST gain pricing rows for the three newly-whitelisted Codex models that aren't already priced:
- `gpt-5.4-mini`
- `gpt-5.3-codex`
- `gpt-5.2`

`gpt-5.4` and `gpt-5.5` are already priced (L31–32). Cost estimation logic at L51–69 needs no change; it looks up by `Job.model` string. Without these rows, `estimateAnalysisCostUsd()` would fall back to `DEFAULT_MODEL_BY_AGENT.CODEX` pricing (`gpt-5.4`), which would still produce a usable estimate but would under/over-report the actual cost for the minis. Adding the rows is a one-line cost-accuracy fix.
