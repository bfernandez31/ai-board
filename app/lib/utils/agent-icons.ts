import { Agent } from '@prisma/client';

const AGENT_METADATA: Record<
  Agent,
  {
    description: string;
    iconPath: string;
    label: string;
  }
> = {
  [Agent.CLAUDE]: {
    description: 'Anthropic Claude Code',
    iconPath: '/agents/claude.svg',
    label: 'Claude',
  },
  [Agent.CODEX]: {
    description: 'OpenAI Codex',
    iconPath: '/agents/codex.svg',
    label: 'Codex',
  },
  [Agent.MISTRAL]: {
    description: 'Mistral vibe',
    iconPath: '/agents/mistral.svg',
    label: 'Mistral',
  },
  [Agent.GEMINI]: {
    description: 'Google Gemini CLI',
    iconPath: '/agents/gemini.svg',
    label: 'Gemini',
  },
};

export function getAgentIconPath(agent: Agent): string {
  return AGENT_METADATA[agent].iconPath;
}

export function getAgentLabel(agent: Agent): string {
  return AGENT_METADATA[agent].label;
}

export function getAgentDescription(agent: Agent): string {
  return AGENT_METADATA[agent].description;
}

export function inferAgentFromIdentifier(agentIdentifier: string | null | undefined): Agent | null {
  if (!agentIdentifier) return null;

  const normalizedIdentifier = agentIdentifier.trim().toLowerCase();
  const isCodexIdentifier =
    normalizedIdentifier.includes('codex') ||
    normalizedIdentifier.includes('openai') ||
    normalizedIdentifier.includes('gpt-');

  if (normalizedIdentifier.includes('claude')) {
    return Agent.CLAUDE;
  }

  if (isCodexIdentifier) {
    return Agent.CODEX;
  }

  if (normalizedIdentifier.includes('mistral') || normalizedIdentifier.includes('vibe')) {
    return Agent.MISTRAL;
  }

  if (normalizedIdentifier.includes('gemini') || normalizedIdentifier.includes('google')) {
    return Agent.GEMINI;
  }

  return null;
}
