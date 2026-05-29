import { Agent } from '@prisma/client';
import {
  CLAUDE_GLOBAL_FALLBACK_MODEL,
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  SMART_DEFAULTS as CLAUDE_SMART_DEFAULTS,
  isClaudeModelId,
  type ClaudeModelId,
  type StageModelKey,
} from '@/lib/models/claude-models';
import {
  CODEX_GLOBAL_FALLBACK_MODEL,
  CODEX_MODEL_IDS,
  CODEX_MODEL_LABELS,
  CODEX_SMART_DEFAULTS,
  isCodexModelId,
  type CodexModelId,
} from '@/lib/models/codex-models';

export type ConfigurableAgent = Extract<Agent, 'CLAUDE' | 'CODEX'>;
export type AgentModelId = ClaudeModelId | CodexModelId;

interface AgentModelMetadata {
  modelIds: readonly string[];
  labels: Record<string, string>;
  fallback: string;
  smartDefaults: Record<StageModelKey, string>;
  isValidModelId: (value: unknown) => boolean;
}

export const AGENT_MODEL_METADATA: Record<ConfigurableAgent, AgentModelMetadata> = {
  CLAUDE: {
    modelIds: CLAUDE_MODEL_IDS,
    labels: CLAUDE_MODEL_LABELS,
    fallback: CLAUDE_GLOBAL_FALLBACK_MODEL,
    smartDefaults: CLAUDE_SMART_DEFAULTS,
    isValidModelId: isClaudeModelId,
  },
  CODEX: {
    modelIds: CODEX_MODEL_IDS,
    labels: CODEX_MODEL_LABELS,
    fallback: CODEX_GLOBAL_FALLBACK_MODEL,
    smartDefaults: CODEX_SMART_DEFAULTS,
    isValidModelId: isCodexModelId,
  },
};

export function isConfigurableAgent(agent: Agent): agent is ConfigurableAgent {
  return agent === Agent.CLAUDE || agent === Agent.CODEX;
}

export function getAgentModelMetadata(agent: Agent): AgentModelMetadata | null {
  return isConfigurableAgent(agent) ? AGENT_MODEL_METADATA[agent] : null;
}

export function isKnownModelId(value: unknown): value is AgentModelId {
  return isClaudeModelId(value) || isCodexModelId(value);
}
