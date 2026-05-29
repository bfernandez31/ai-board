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
  isCodexModelId,
  type CodexModelId,
} from '@/lib/models/codex-models';

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

interface AgentModelConfig {
  isValidModelId: (value: unknown) => value is ClaudeModelId | CodexModelId;
  fallbackModel: ClaudeModelId | CodexModelId;
}

const AGENT_MODEL_CONFIG: Partial<Record<Agent, AgentModelConfig>> = {
  [Agent.CLAUDE]: { isValidModelId: isClaudeModelId, fallbackModel: CLAUDE_GLOBAL_FALLBACK_MODEL },
  [Agent.CODEX]: { isValidModelId: isCodexModelId, fallbackModel: CODEX_GLOBAL_FALLBACK_MODEL },
};

/**
 * Resolve the model for a stage transition.
 *
 * Returns `null` when:
 *   - command is not one of the 5 configurable stages
 *   - effectiveAgent is not Claude or Codex
 *
 * Otherwise returns (in priority order):
 *   1. ticket's stored override (if valid for the agent)
 *   2. project's stored default (if valid for the agent)
 *   3. agent's global fallback model
 *
 * Stale stored values (not in the agent's whitelist) are treated as "not set"
 * and fall through to the next layer.
 */
export function resolveStageModel(
  ticket: TicketLikeForResolution,
  command: string,
  effectiveAgent: Agent
): ClaudeModelId | CodexModelId | null {
  const stageKey: StageModelKey | null = commandToStageModelKey(command);
  if (!stageKey) {
    return null;
  }

  const config = AGENT_MODEL_CONFIG[effectiveAgent];
  if (!config) {
    return null;
  }

  const ticketValue = ticket[stageKey];
  if (ticketValue != null && config.isValidModelId(ticketValue)) {
    return ticketValue;
  }
  const projectValue = ticket.project[stageKey];
  if (projectValue != null && config.isValidModelId(projectValue)) {
    return projectValue;
  }
  return config.fallbackModel;
}
