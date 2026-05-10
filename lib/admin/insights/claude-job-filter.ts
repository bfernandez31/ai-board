import type { Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { Prisma } from '@prisma/client';

const IMPLEMENTATION_COMMANDS: readonly string[] = ['implement', 'quick-impl'];

export function effectiveAgent(input: {
  ticketAgent?: Agent | null;
  projectDefaultAgent?: Agent | null;
}): Agent {
  return input.ticketAgent ?? input.projectDefaultAgent ?? 'CLAUDE';
}

export function isClaudeJob(input: {
  ticketAgent?: Agent | null;
  projectDefaultAgent?: Agent | null;
}): boolean {
  return effectiveAgent(input) === 'CLAUDE';
}

/**
 * Compose a Prisma `where` fragment that matches Jobs whose effective agent is
 * CLAUDE: either the ticket explicitly sets agent=CLAUDE, OR the ticket has no
 * agent and the project's defaultAgent is CLAUDE.
 *
 * Mirrors the runtime fallback `ticket.agent ?? project.defaultAgent ?? 'CLAUDE'`
 * established in `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-61`.
 */
export function claudeEffectiveAgentJobWhere(): Prisma.JobWhereInput {
  return {
    OR: [
      { ticket: { agent: 'CLAUDE' } },
      {
        AND: [
          { ticket: { agent: null } },
          { ticket: { project: { defaultAgent: 'CLAUDE' } } },
        ],
      },
    ],
  };
}

/**
 * Earliest startedAt of any Claude job that has actually run. Used as the
 * lower bound for the first-ever insights run window.
 */
export async function findEarliestClaudeJobStartedAt(): Promise<Date | null> {
  const job = await prisma.job.findFirst({
    where: {
      status: 'COMPLETED',
      ...claudeEffectiveAgentJobWhere(),
    },
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true },
  });
  return job?.startedAt ?? null;
}

/**
 * Count tickets with stage=SHIP that have at least one COMPLETED Claude job
 * (command in {implement, quick-impl}) updated after the previous run boundary.
 */
export async function countNewShippedClaudeTickets(
  previousHighWater: Date
): Promise<number> {
  return prisma.ticket.count({
    where: {
      stage: 'SHIP',
      updatedAt: { gt: previousHighWater },
      jobs: {
        some: {
          status: 'COMPLETED',
          command: { in: [...IMPLEMENTATION_COMMANDS] },
          updatedAt: { gt: previousHighWater },
          ...claudeEffectiveAgentJobWhere(),
        },
      },
    },
  });
}
