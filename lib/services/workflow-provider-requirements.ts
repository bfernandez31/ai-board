import type { Agent } from '@prisma/client';
import { Agent as AgentEnum } from '@prisma/client';
import type { AiProvider } from '@prisma/client';
import type { WorkflowProviderRequirement } from '@/lib/types/ai-credentials';

const DEFAULT_PROVIDER_BY_AGENT: Record<Agent, AiProvider[]> = {
  [AgentEnum.CLAUDE]: ['ANTHROPIC'],
  [AgentEnum.CODEX]: ['OPENAI'],
};

export function resolveWorkflowProviderRequirement(
  command: string,
  agent: Agent
): WorkflowProviderRequirement {
  return {
    command,
    agent,
    providers: DEFAULT_PROVIDER_BY_AGENT[agent],
  };
}
