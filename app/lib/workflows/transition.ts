import { Stage, Ticket, Project, WorkflowType } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { enqueueWorkflow } from '@/lib/queue/enqueue';
import type { WorkflowCommand } from '@/lib/queue/types';

interface TransitionResult {
  success: boolean;
  jobId?: number;
  message?: string;
  error?: string;
  errorCode?: string;
  details?: Record<string, any>;
}

/**
 * Validates if a stage transition is allowed based on business rules
 */
export function isValidTransition(currentStage: Stage, targetStage: Stage): boolean {
  const validTransitions: Record<Stage, Stage[]> = {
    INBOX: [Stage.SPECIFY, Stage.BUILD], // Can go to SPECIFY or BUILD (quick-impl)
    SPECIFY: [Stage.PLAN],
    PLAN: [Stage.BUILD],
    BUILD: [Stage.VERIFY],
    VERIFY: [Stage.SHIP, Stage.BUILD], // Can go back to BUILD or forward to SHIP
    SHIP: [], // Terminal stage
  };

  return validTransitions[currentStage]?.includes(targetStage) ?? false;
}

/**
 * Get the command for a given stage transition
 */
function getCommandForStage(stage: Stage, isQuickImpl: boolean): WorkflowCommand {
  if (isQuickImpl) {
    return 'quick-impl';
  }

  const commandMap: Record<Stage, WorkflowCommand> = {
    SPECIFY: 'specify',
    PLAN: 'plan',
    BUILD: 'implement',
    VERIFY: 'implement', // Not implemented yet, but would trigger implementation
    SHIP: 'implement', // Not a workflow stage
    INBOX: 'specify', // Should not happen
  };

  return commandMap[stage] || 'specify';
}

/**
 * Main transition handler that creates jobs and enqueues workflows
 */
export async function handleTicketTransition(
  currentTicket: Ticket & { project: Project },
  targetStage: Stage
): Promise<TransitionResult> {
  const { id: ticketId, stage: currentStage, project } = currentTicket;

  // 1. Validate transition
  if (!isValidTransition(currentStage, targetStage)) {
    return {
      success: false,
      error: `Cannot transition from ${currentStage} to ${targetStage}`,
      errorCode: 'INVALID_TRANSITION',
    };
  }

  // 2. Check if this is a quick-impl transition
  const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;

  // 3. For stages that require prior job completion, validate the job status
  // SPECIFY -> PLAN and PLAN -> BUILD require the previous job to be completed
  if (
    (currentStage === Stage.SPECIFY && targetStage === Stage.PLAN) ||
    (currentStage === Stage.PLAN && targetStage === Stage.BUILD && !isQuickImpl)
  ) {
    const lastJob = await prisma.job.findFirst({
      where: {
        ticketId: ticketId,
        command: currentStage.toLowerCase(),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastJob) {
      return {
        success: false,
        error: `No ${currentStage.toLowerCase()} job found. Please complete the ${currentStage.toLowerCase()} stage first.`,
        errorCode: 'MISSING_JOB',
      };
    }

    if (lastJob.status !== 'COMPLETED') {
      return {
        success: false,
        error: `The ${currentStage.toLowerCase()} job must be completed before transitioning to ${targetStage}`,
        errorCode: 'JOB_NOT_COMPLETED',
        details: { jobStatus: lastJob.status },
      };
    }
  }

  // 4. Manual stages (VERIFY, SHIP) don't create jobs
  if (targetStage === Stage.VERIFY || targetStage === Stage.SHIP) {
    return {
      success: true,
      message: `Stage updated to ${targetStage} (no workflow required)`,
    };
  }

  // 5. Create a job record for automated stages
  const command = getCommandForStage(targetStage, isQuickImpl);

  const job = await prisma.job.create({
    data: {
      ticketId: ticketId,
      projectId: project.id,
      command: command,
      status: 'PENDING',
      branch: currentTicket.branch,
    },
  });

  // 6. Update ticket workflowType for quick-impl
  if (isQuickImpl) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { workflowType: WorkflowType.QUICK },
    });
  }

  // 7. Enqueue the workflow job instead of dispatching to GitHub Actions
  try {
    await enqueueWorkflow({
      ticket: currentTicket,
      project,
      command,
      job,
    });

    return {
      success: true,
      jobId: job.id,
      message: 'Workflow enqueued successfully',
    };
  } catch (error) {
    // If enqueue fails, update job status to FAILED
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        logs: error instanceof Error ? error.message : 'Failed to enqueue workflow',
      },
    });

    return {
      success: false,
      error: 'Failed to enqueue workflow',
      errorCode: 'ENQUEUE_ERROR',
      details: error instanceof Error ? { message: error.message } : undefined,
    };
  }
}

/**
 * Cleanup function to delete orphaned jobs (when version conflict occurs)
 */
export async function cleanupOrphanedJob(jobId: number): Promise<void> {
  try {
    await prisma.job.delete({
      where: { id: jobId },
    });
  } catch (error) {
    console.error('Failed to cleanup orphaned job:', error);
  }
}