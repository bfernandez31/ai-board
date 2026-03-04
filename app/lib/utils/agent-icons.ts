import { Agent } from '@prisma/client';

/**
 * Get the icon/emoji for an agent
 * Used for consistent visual representation across UI
 */
export function getAgentIcon(agent: Agent): string {
  const icons: Record<Agent, string> = {
    [Agent.CLAUDE]: '🤖',
    [Agent.CODEX]: '⚡',
  };
  return icons[agent];
}

/**
 * Get the human-readable label for an agent
 */
export function getAgentLabel(agent: Agent): string {
  const labels: Record<Agent, string> = {
    [Agent.CLAUDE]: 'Claude',
    [Agent.CODEX]: 'Codex',
  };
  return labels[agent];
}

/**
 * Get a short description for an agent
 * Used in tooltips and help text
 */
export function getAgentDescription(agent: Agent): string {
  const descriptions: Record<Agent, string> = {
    [Agent.CLAUDE]: 'Anthropic Claude Code',
    [Agent.CODEX]: 'OpenAI Codex',
  };
  return descriptions[agent];
}
