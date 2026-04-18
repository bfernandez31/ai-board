import { Agent } from '@prisma/client';
import {
  CLAUDE_GLOBAL_FALLBACK_MODEL,
  commandToStageModelKey,
  isClaudeModelId,
  type ClaudeModelId,
  type StageModelKey,
} from '@/lib/models/claude-models';

export interface StageModelSource {
  specifyModel?: string | null;
  planModel?: string | null;
  implementModel?: string | null;
  quickImplModel?: string | null;
  verifyModel?: string | null;
}

export interface TicketLikeForResolution extends StageModelSource {
  project: StageModelSource;
}

/**
 * Resolve the Claude model for a stage transition.
 *
 * Returns `null` when:
 *   - command is not one of the 5 configurable stages
 *   - effectiveAgent is not Claude
 *
 * Otherwise returns (in priority order):
 *   1. ticket's stored override (if valid whitelist value)
 *   2. project's stored default (if valid whitelist value)
 *   3. CLAUDE_GLOBAL_FALLBACK_MODEL
 *
 * Stale stored values (not in whitelist) are treated as "not set" and fall
 * through to the next layer.
 */
export function resolveStageModel(
  ticket: TicketLikeForResolution,
  command: string,
  effectiveAgent: Agent
): ClaudeModelId | null {
  const stageKey: StageModelKey | null = commandToStageModelKey(command);
  if (!stageKey) {
    return null;
  }
  if (effectiveAgent !== Agent.CLAUDE) {
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
