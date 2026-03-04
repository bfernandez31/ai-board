import type { Agent } from '@prisma/client';

export function resolveEffectiveAgent(
  ticketAgent: Agent | null,
  projectDefaultAgent: Agent
): Agent {
  return ticketAgent ?? projectDefaultAgent;
}
