import type { Agent } from '@prisma/client';

export const ALL_AGENTS: Agent[] = ['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'];
export const SETUP_VISIBLE_AGENTS: Agent[] = ['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'];
export const GEMINI_SUPPORTED_COMMANDS = [
  'specify',
  'plan',
  'implement',
  'quick-impl',
  'iterate',
] as const;
export const GEMINI_BLOCKED_COMMANDS = [
  'verify',
  'comment-specify',
  'comment-plan',
  'comment-build',
  'comment-verify',
  'comment-ship',
  'deploy-preview',
  'rollback-reset',
  'health-scan',
  'onboard',
  'retro-spec',
  'ai-board-assist',
] as const;

export function resolveEffectiveAgent(
  ticketAgent: Agent | null,
  projectDefaultAgent: Agent
): Agent {
  return ticketAgent ?? projectDefaultAgent;
}

export function supportsSetupAgentSelection(agent: Agent): boolean {
  return SETUP_VISIBLE_AGENTS.includes(agent);
}

export function supportsOnboardAgent(agent: Agent): boolean {
  return agent !== 'GEMINI';
}

export function supportsWorkflowCommand(agent: Agent, command: string): boolean {
  if (agent !== 'GEMINI') {
    return true;
  }

  return GEMINI_SUPPORTED_COMMANDS.includes(command as (typeof GEMINI_SUPPORTED_COMMANDS)[number]);
}
