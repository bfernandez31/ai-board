# Internal Process: Codex Model Resolution

**Feature**: AIB-830
**Date**: 2026-05-29
**Spec reference**: `spec.md` → Internal Processes → "Codex Model Resolution"

## Process overview

When a workflow is dispatched and the effective agent for the ticket is Codex, the system resolves which exact Codex model identifier to inject into the dispatch payload. The resolution is a pure function over the ticket, the project, and the command being dispatched. It runs in-process inside the existing `handleTicketTransition()` flow at `lib/workflows/transition.ts:182`. No I/O, no async, no failure modes.

## Inputs

| Name | Type | Source | Notes |
|------|------|--------|-------|
| `ticket` | `TicketLikeForResolution` (includes 10 `*Model` + `codex*Model` fields and a `project` sub-object with the same 10 fields) | Loaded by `handleTicketTransition` from Prisma | Includes both Claude AND Codex columns; resolver picks the right set per branch |
| `command` | `string` | Computed by `getCommandForTransition(currentStage, targetStage)` | One of `specify`, `plan`, `implement`, `quick-impl`, `verify` for the 5 configurable stages; other strings return `null` |
| `effectiveAgent` | `Agent` (Prisma enum) | `resolveEffectiveAgent(ticketAgent, projectDefaultAgent)` from `app/lib/utils/agent-resolution.ts:41–46` | `ticket.agent ?? ticket.project.defaultAgent` |

## Phases

1. **Stage key lookup** — `commandToCodexStageModelKey(command)` maps the command to one of the 5 Codex column names (`codex*Model`). Non-mappable commands return `null` early.
2. **Agent gate** — if `effectiveAgent !== Agent.CODEX`, the Codex branch returns `null` (the Claude branch fires elsewhere in the same resolver, or no model is emitted for MISTRAL/GEMINI).
3. **Ticket-level check** — read `ticket[stageKey]` (where `stageKey` is `codexSpecifyModel`, etc.). If non-null AND `isCodexModelId(value)` is true, return that value.
4. **Project-level check** — read `ticket.project[stageKey]`. If non-null AND `isCodexModelId(value)` is true, return that value.
5. **Global fallback** — return `CODEX_GLOBAL_FALLBACK_MODEL` (`'gpt-5.5'`).

## Output

A single `CodexModelId` string, OR `null` if the effective agent isn't Codex or the command isn't one of the 5 configurable stages. The string flows into:

1. `workflowInputs.model` (via conditional spread at `transition.ts:285/303/317`) — passed to GitHub Actions `workflow_dispatch.inputs.model`.
2. `Job.model` column (via `prisma.job.create({ data: { model: resolvedModel, … } })` at `transition.ts:223/241`).

## Error behavior

- **Cannot throw**: every branch returns either a valid `CodexModelId` or `null`. No I/O, no exceptions.
- **Stale stored values**: A value that exists in storage but is not in `CODEX_MODEL_IDS` (e.g., a Codex model OpenAI deprecated after we wrote it) is treated as `null` at its layer and falls through to the next layer. Pattern P3 in `research.md`.
- **No-data path**: A brand-new Codex project with no per-stage configuration resolves to `CODEX_GLOBAL_FALLBACK_MODEL` on every stage. This satisfies SC-002 (100% of Codex jobs record a non-null model).

## Pattern adherence

This resolver MUST follow `lib/workflows/model-resolution.ts:50–60` (the Claude resolver) line-for-line, with three substitutions:
- `isClaudeModelId` → `isCodexModelId`
- `CLAUDE_GLOBAL_FALLBACK_MODEL` → `CODEX_GLOBAL_FALLBACK_MODEL`
- `commandToStageModelKey` → `commandToCodexStageModelKey`
- Column names `*Model` → `codex*Model`

The implementation extends the SAME `resolveStageModel` function rather than introducing a new exported symbol. The function's signature widens its return type to `ClaudeModelId | CodexModelId | null`; the call site at `transition.ts:182` is unchanged.

## Reference implementation sketch

```ts
// lib/workflows/model-resolution.ts (extended)
export function resolveStageModel(
  ticket: TicketLikeForResolution,
  command: string,
  effectiveAgent: Agent
): ClaudeModelId | CodexModelId | null {
  if (effectiveAgent === Agent.CLAUDE) {
    const stageKey = commandToStageModelKey(command);
    if (!stageKey) return null;

    const ticketValue = ticket[stageKey];
    if (ticketValue != null && isClaudeModelId(ticketValue)) return ticketValue;

    const projectValue = ticket.project[stageKey];
    if (projectValue != null && isClaudeModelId(projectValue)) return projectValue;

    return CLAUDE_GLOBAL_FALLBACK_MODEL;
  }

  if (effectiveAgent === Agent.CODEX) {
    const stageKey = commandToCodexStageModelKey(command);
    if (!stageKey) return null;

    const ticketValue = ticket[stageKey];
    if (ticketValue != null && isCodexModelId(ticketValue)) return ticketValue;

    const projectValue = ticket.project[stageKey];
    if (projectValue != null && isCodexModelId(projectValue)) return projectValue;

    return CODEX_GLOBAL_FALLBACK_MODEL;
  }

  return null; // MISTRAL, GEMINI, or unknown future agent
}
```
