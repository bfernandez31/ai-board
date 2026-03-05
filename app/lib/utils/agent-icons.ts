import { Agent } from '@prisma/client';

export function getAgentIconPath(agent: Agent): string {
  const paths: Record<Agent, string> = {
    [Agent.CLAUDE]: '/agents/claude.svg',
    [Agent.CODEX]: '/agents/codex.svg',
  };
  return paths[agent];
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
