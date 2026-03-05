import { Agent } from '@prisma/client';

export function getAgentIcon(agent: Agent): string {
  const icons: Record<Agent, string> = {
    [Agent.CLAUDE]: '🤖',
    [Agent.CODEX]: '⚡',
  };
  return icons[agent];
}

export function getAgentLabel(agent: Agent): string {
  const labels: Record<Agent, string> = {
    [Agent.CLAUDE]: 'Claude',
    [Agent.CODEX]: 'Codex',
  };
  return labels[agent];
}

export function getAgentDescription(agent: Agent): string {
  const descriptions: Record<Agent, string> = {
    [Agent.CLAUDE]: 'Anthropic Claude Code',
    [Agent.CODEX]: 'OpenAI Codex',
  };
  return descriptions[agent];
}
