# Contract: Workflow Dispatch Input (`model`)

**Feature**: AIB-678
**Date**: 2026-04-18

## Purpose

Extends the workflow dispatch payload emitted by `handleTicketTransition()` in `lib/workflows/transition.ts` so that Claude workflow runs receive the resolved per-stage model as a new `model` input.

## Affected workflow files

- `.github/workflows/speckit.yml` — SPECIFY / PLAN / BUILD(=implement)
- `.github/workflows/quick-impl.yml` — QUICK-IMPL
- `.github/workflows/verify.yml` — VERIFY

Each must accept a new **optional** `workflow_dispatch.inputs.model` entry of type `string`. Absent value means the agent should use its own default (non-Claude agents, or Claude with no configuration at all — resolution will not omit `model` in the Claude path because fallback is always Opus 4.7).

## Application-side payload

Current `workflowInputs` objects (transition.ts:274–282, :290–299, :303–312) are extended to include `model` when `resolveStageModel()` returns a non-null value:

```ts
const resolvedModel = resolveStageModel(ticket, command, effectiveAgent); // may be null

workflowInputs = {
  ticket_id: ticket.ticketKey,
  job_id: job.id.toString(),
  project_id: ticket.projectId.toString(),
  githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
  agent: effectiveAgent,
  ...(resolvedModel && { model: resolvedModel }),
  // ... existing branch-specific fields ...
};
```

Rules:
- `model` is emitted ONLY when `resolvedModel` is non-null (i.e., effective agent is Claude and command is in the 5 configurable stages). FR-015, FR-017.
- The value, when emitted, is exactly one of `CLAUDE_MODEL_IDS`.

## Job record population

At the moment of `prisma.job.create(...)` (transition.ts:214 and :232), include `model: resolvedModel` in the data block. When `resolvedModel` is null (non-Claude or non-configurable stage), the column stays null — matching today's pre-feature behavior. FR-016.

## Error behavior

- Resolution cannot fail: the global fallback `CLAUDE_GLOBAL_FALLBACK_MODEL` is always a valid Claude model ID. The theoretical "no valid model for Claude" branch in the spec can only be reached by corrupting the constant, at which point the feature is broken at build time.
- Existing dispatch-then-rollback pattern (Pattern P1 in research.md) is preserved: Job row is created with the resolved model; if the `octokit.actions.createWorkflowDispatch()` call fails, the Job row is deleted (transition.ts:358–360), including its newly-written model value. No orphaned state.
