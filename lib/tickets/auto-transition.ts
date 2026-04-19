import { Stage } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { executeTicketTransition } from '@/lib/tickets/transition';

type TerminalJobStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** Stage → next stage mapping for auto-transition (SPECIFY/PLAN only). */
const NEXT_AUTO_STAGE: Partial<Record<Stage, Stage>> = {
  [Stage.SPECIFY]: Stage.PLAN,
  [Stage.PLAN]: Stage.BUILD,
};

/**
 * React to a workflow job reaching a terminal state on a ticket with auto mode enabled.
 *
 * - On FAILED or CANCELLED: disable autoMode so the user must re-enable after handling the failure.
 * - On COMPLETED with ticket in SPECIFY or PLAN: dispatch the next stage transition.
 *   If dispatch fails, auto mode is disabled so the chain doesn't silently retry.
 *
 * BUILD → VERIFY and VERIFY → SHIP keep their existing auto-progression paths and
 * are intentionally not handled here. AI-BOARD comment jobs and deploy jobs are ignored.
 */
export async function handleAutoTransitionOnJobComplete(
  jobId: number,
  jobStatus: TerminalJobStatus
): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      command: true,
      ticket: {
        select: {
          id: true,
          projectId: true,
          ticketKey: true,
          stage: true,
          autoMode: true,
          workflowType: true,
        },
      },
    },
  });

  if (!job?.ticket) return;
  const ticket = job.ticket;

  if (!ticket.autoMode) return;
  if (ticket.workflowType !== 'FULL') return;

  if (job.command.startsWith('comment-')) return;
  if (job.command === 'deploy-preview') return;

  if (jobStatus === 'FAILED' || jobStatus === 'CANCELLED') {
    await disableAutoMode(ticket.id);
    return;
  }

  const nextStage = NEXT_AUTO_STAGE[ticket.stage];
  if (!nextStage) return;

  const result = await executeTicketTransition(
    ticket.projectId,
    ticket.ticketKey,
    nextStage
  );

  if (!result.ok) {
    await disableAutoMode(ticket.id);
  }
}

async function disableAutoMode(ticketId: number): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { autoMode: false },
  });
}
