import type { Agent } from '@prisma/client';

const AGENT_METADATA: Record<
  Agent,
  {
    description: string;
    iconPath: string;
    label: string;
  }
> = {
  CLAUDE: {
    description: 'Anthropic Claude Code',
    iconPath: '/agents/claude.svg',
    label: 'Claude',
  },
  CODEX: {
    description: 'OpenAI Codex',
    iconPath: '/agents/codex.svg',
    label: 'Codex',
  },
  MISTRAL: {
    description: 'Mistral vibe',
    iconPath: '/agents/mistral.svg',
    label: 'Mistral',
  },
  GEMINI: {
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
    return 'CLAUDE';
  }

  if (isCodexIdentifier) {
    return 'CODEX';
  }

  if (normalizedIdentifier.includes('mistral') || normalizedIdentifier.includes('vibe')) {
    return 'MISTRAL';
  }

  if (normalizedIdentifier.includes('gemini') || normalizedIdentifier.includes('google')) {
    return 'GEMINI';
  }

  return null;
}
