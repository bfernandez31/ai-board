import { Agent } from '@prisma/client';
import {
  CLAUDE_GLOBAL_FALLBACK_MODEL,
  commandToStageModelKey,
  isClaudeModelId,
  type ClaudeModelId,
  type StageModelKey,
} from '@/lib/models/claude-models';
import {
  CODEX_GLOBAL_FALLBACK_MODEL,
  commandToCodexStageModelKey,
  isCodexModelId,
  type CodexModelId,
  type CodexStageModelKey,
} from '@/lib/models/codex-models';

export interface StageModelSource {
  specifyModel?: string | null;
  planModel?: string | null;
  implementModel?: string | null;
  quickImplModel?: string | null;
  verifyModel?: string | null;
  codexSpecifyModel?: string | null;
  codexPlanModel?: string | null;
  codexImplementModel?: string | null;
  codexQuickImplModel?: string | null;
  codexVerifyModel?: string | null;
}

export interface TicketLikeForResolution extends StageModelSource {
  project: StageModelSource;
}

/**
 * Resolve the per-stage model for a workflow dispatch.
 *
 * Returns `null` when:
 *   - command is not one of the 5 configurable stages
 *   - effectiveAgent is neither Claude nor Codex
 *
 * Otherwise returns (in priority order, scoped to the active agent's columns):
 *   1. ticket's stored override (if valid whitelist value)
 *   2. project's stored default (if valid whitelist value)
 *   3. the agent's global fallback model
 *
 * Stale stored values (not in whitelist) are treated as "not set" and fall
 * through to the next layer.
 */
export function resolveStageModel(
  ticket: TicketLikeForResolution,
  command: string,
  effectiveAgent: Agent
): ClaudeModelId | CodexModelId | null {
  if (effectiveAgent === Agent.CLAUDE) {
    const stageKey: StageModelKey | null = commandToStageModelKey(command);
    if (!stageKey) {
      return null;
    }

    const ticketValue = ticket[stageKey];
    if (ticketValue != null && isClaudeModelId(ticketValue)) {
      return ticketValue;
    }

    const projectValue = ticket.project[stageKey];
    if (projectValue != null && isClaudeModelId(projectValue)) {
      return projectValue;
    }

    return CLAUDE_GLOBAL_FALLBACK_MODEL;
  }

  if (effectiveAgent === Agent.CODEX) {
    const stageKey: CodexStageModelKey | null = commandToCodexStageModelKey(command);
    if (!stageKey) {
      return null;
    }

    const ticketValue = ticket[stageKey];
    if (ticketValue != null && isCodexModelId(ticketValue)) {
      return ticketValue;
    }

    const projectValue = ticket.project[stageKey];
    if (projectValue != null && isCodexModelId(projectValue)) {
      return projectValue;
    }

    return CODEX_GLOBAL_FALLBACK_MODEL;
  }

  return null;
}
