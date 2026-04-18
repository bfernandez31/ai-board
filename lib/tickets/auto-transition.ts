import { Stage } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getNextStage, Stage as ValidationStage } from '@/lib/stage-transitions';
import { STAGE_COMMAND_MAP } from '@/lib/workflows/transition';
import { executeTicketTransition } from '@/lib/tickets/transition';

const AUTO_DISPATCH_STAGES: Set<Stage> = new Set([Stage.SPECIFY, Stage.PLAN]);

async function disableAutoMode(ticketId: number): Promise<void> {
  await prisma.ticket.updateMany({
    where: { id: ticketId, autoMode: true },
    data: { autoMode: false },
  });
}

/**
 * Run auto-transition side-effects after a workflow job reaches a terminal state.
 *
 * - FAILED/CANCELLED: turns autoMode off so the user can address the failure.
 * - COMPLETED on SPECIFY/PLAN: dispatches the next forward stage when the
 *   completed command matches the current stage's workflow command.
 *
 * Comment-* jobs are ignored (background AI-BOARD jobs unrelated to the chain).
 * Dispatch failures also turn autoMode off, mirroring the failure rule.
 */
export async function handleAutoTransitionAfterJob(
  jobId: number,
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED'
): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      command: true,
      ticket: {
        select: {
          id: true,
          projectId: true,
          stage: true,
          workflowType: true,
          autoMode: true,
        },
      },
    },
  });

  if (!job || !job.ticket) return;
  if (job.command.startsWith('comment-')) return;
  if (!job.ticket.autoMode) return;
  if (job.ticket.workflowType !== 'FULL') return;

  if (status === 'FAILED' || status === 'CANCELLED') {
    await disableAutoMode(job.ticket.id);
    return;
  }

  // COMPLETED path
  const stage = job.ticket.stage;
  if (!AUTO_DISPATCH_STAGES.has(stage)) return;

  const expectedCommand = STAGE_COMMAND_MAP[stage];
  if (!expectedCommand || job.command !== expectedCommand) return;

  const nextStage = getNextStage(stage as unknown as ValidationStage);
  if (!nextStage) return;

  try {
    const result = await executeTicketTransition(
      job.ticket.projectId,
      job.ticket.id.toString(),
      nextStage as unknown as Stage
    );
    if (!result.ok) {
      await disableAutoMode(job.ticket.id);
    }
  } catch (error) {
    console.error('[AutoTransition] Dispatch failed:', {
      ticketId: job.ticket.id,
      stage,
      nextStage,
      error: error instanceof Error ? error.message : String(error),
    });
    await disableAutoMode(job.ticket.id);
  }
}
