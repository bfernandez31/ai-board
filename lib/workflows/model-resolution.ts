import { Agent } from '@prisma/client';
import {
  commandToStageModelKey,
  type StageModelKey,
} from '@/lib/models/claude-models';
import { getAgentModelMetadata, type AgentModelId } from '@/lib/models/agent-models';

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
 * Resolve the agent-specific model for a stage transition.
 *
 * Returns `null` when:
 *   - command is not one of the 5 configurable stages
 *   - effectiveAgent is not a model-configurable agent (CLAUDE or CODEX)
 *
 * Otherwise returns (in priority order):
 *   1. ticket's stored override (if valid for this agent's whitelist)
 *   2. project's stored default (if valid for this agent's whitelist)
 *   3. agent's global fallback model
 *
 * Stale stored values (not in the agent's whitelist — e.g. a Claude ID stored
 * while the effective agent is Codex) are treated as "not set" and fall
 * through to the next layer.
 */
export function resolveStageModel(
  ticket: TicketLikeForResolution,
  command: string,
  effectiveAgent: Agent
): AgentModelId | null {
  const stageKey: StageModelKey | null = commandToStageModelKey(command);
  if (!stageKey) {
    return null;
  }

  const metadata = getAgentModelMetadata(effectiveAgent);
  if (!metadata) {
    return null;
  }

  const ticketValue = ticket[stageKey];
  if (ticketValue != null && metadata.isValidModelId(ticketValue)) {
    return ticketValue as AgentModelId;
  }

  const projectValue = ticket.project[stageKey];
  if (projectValue != null && metadata.isValidModelId(projectValue)) {
    return projectValue as AgentModelId;
  }

  return metadata.fallback as AgentModelId;
}
