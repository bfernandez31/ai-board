import { Stage, JobStatus, Ticket, Project, Agent } from '@prisma/client';
import { RequestError } from '@octokit/request-error';
import { isValidTransition, Stage as ValidationStage } from '@/lib/stage-transitions';
import { prisma } from '@/lib/db/client';
import { supportsWorkflowCommand } from '@/app/lib/utils/agent-resolution';
import { dispatchWorkflow } from '@/lib/workflows/dispatch';

/** Stage-to-command mapping (null = manual/no workflow) */
export const STAGE_COMMAND_MAP: Record<Stage, string | null> = {
  INBOX: null,
  SPECIFY: 'specify',
  PLAN: 'plan',
  BUILD: 'implement',
  VERIFY: 'verify', // Automated workflow with test execution and PR creation
  SHIP: null,
  CLOSED: null, // Terminal state - no workflow
};

export interface TransitionResult {
  success: boolean;
  jobId?: number;
  error?: string;
  errorCode?: 'INVALID_TRANSITION' | 'GITHUB_ERROR' | 'JOB_NOT_COMPLETED' | 'MISSING_JOB' | 'MISSING_CREDENTIAL' | 'CONFIG_SYNC_FAILED' | 'UNSUPPORTED_AGENT';
  details?: {
    currentStage?: Stage;
    targetStage?: Stage;
    jobStatus?: JobStatus;
    jobCommand?: string;
  };
}

export type TicketWithProject = Ticket & {
  project: Project;
};

/** Resolve the effective agent: ticket override > project default > CLAUDE fallback */
export function resolveEffectiveAgent(ticket: TicketWithProject): Agent {
  return ticket.agent ?? ticket.project.defaultAgent ?? Agent.CLAUDE;
}

/** SPECIFY, PLAN, BUILD require validation; INBOX, VERIFY, SHIP do not */
function shouldValidateJobCompletion(currentStage: Stage): boolean {
  return ([Stage.SPECIFY, Stage.PLAN, Stage.BUILD] as Stage[]).includes(currentStage);
}

function getJobValidationErrorMessage(status: JobStatus): string {
  switch (status) {
    case JobStatus.PENDING:
    case JobStatus.RUNNING:
      return 'Cannot transition: workflow is still running';
    case JobStatus.FAILED:
      return 'Cannot transition: previous workflow failed. Please retry the workflow.';
    case JobStatus.CANCELLED:
      return 'Cannot transition: workflow was cancelled. Please retry the workflow.';
    default:
      return 'Cannot transition: job is not completed';
  }
}

/**
 * Validates workflow job completion. Only validates workflow jobs (specify, plan, implement),
 * not AI-BOARD jobs (comment-*) which run in parallel.
 */
async function validateJobCompletion(
  ticket: TicketWithProject,
  targetStage: Stage
): Promise<TransitionResult> {
  if (!shouldValidateJobCompletion(ticket.stage)) {
    return { success: true };
  }

  // Fetch most recent workflow job (exclude comment-* AI-BOARD jobs)
  const workflowJob = await prisma.job.findFirst({
    where: {
      ticketId: ticket.id,
      command: { not: { startsWith: 'comment-' } },
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, command: true },
  });

  if (!workflowJob) {
    const expectedCommand = STAGE_COMMAND_MAP[ticket.stage];
    return {
      success: false,
      errorCode: 'MISSING_JOB',
      error: `Expected workflow job (${expectedCommand}) for stage ${ticket.stage} but none found`,
    };
  }

  if (workflowJob.status !== JobStatus.COMPLETED) {
    return {
      success: false,
      errorCode: 'JOB_NOT_COMPLETED',
      error: getJobValidationErrorMessage(workflowJob.status),
      details: {
        currentStage: ticket.stage,
        targetStage,
        jobStatus: workflowJob.status,
        jobCommand: workflowJob.command,
      },
    };
  }

  return { success: true };
}

/**
 * Constructs the workflow file and inputs for the given transition.
 */
function getWorkflowConfig(
  ticket: TicketWithProject,
  job: { id: number },
  command: string,
  targetStage: Stage,
  isQuickImpl: boolean,
  effectiveAgent: Agent
) {
  const baseInputs = {
    ticket_id: ticket.ticketKey,
    job_id: job.id.toString(),
    project_id: ticket.projectId.toString(),
    githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
    agent: effectiveAgent,
  };

  if (isQuickImpl) {
    return {
      workflowId: 'quick-impl.yml',
      inputs: {
        ...baseInputs,
        quickImplPayload: JSON.stringify({
          ticketKey: ticket.ticketKey,
          title: ticket.title,
          description: ticket.description || '',
          agent: effectiveAgent,
        }),
        ...(ticket.attachments && { attachments: JSON.stringify(ticket.attachments) }),
      },
    };
  }

  if (command === 'verify') {
    return {
      workflowId: 'verify.yml',
      inputs: {
        ...baseInputs,
        branch: ticket.branch || '',
        workflowType: ticket.workflowType,
      },
    };
  }

  const inputs: Record<string, string> = {
    ...baseInputs,
    command,
    branch: ticket.branch || '',
  };

  if (targetStage === Stage.SPECIFY) {
    const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;
    inputs.specifyPayload = JSON.stringify({
      ticketKey: ticket.ticketKey,
      title: ticket.title,
      description: ticket.description || '',
      clarificationPolicy: effectivePolicy,
      agent: effectiveAgent,
    });

    if (ticket.attachments) {
      inputs.attachments = JSON.stringify(ticket.attachments);
    }
  }

  return {
    workflowId: 'speckit.yml',
    inputs,
  };
}

/**
 * Handle ticket stage transition with GitHub workflow dispatch.
 * Does NOT update ticket in database - caller handles that.
 */
export async function handleTicketTransition(
  ticket: TicketWithProject,
  targetStage: Stage
): Promise<TransitionResult> {
  try {
    const currentStage = ticket.stage;

    // Prisma Stage and ValidationStage are structurally identical string enums
    if (!isValidTransition(currentStage as unknown as ValidationStage, targetStage as unknown as ValidationStage)) {
      return {
        success: false,
        error: `Cannot transition from ${currentStage} to ${targetStage}. Tickets must progress sequentially through stages.`,
        errorCode: 'INVALID_TRANSITION',
      };
    }

    const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;

    if (!isQuickImpl) {
      const jobValidation = await validateJobCompletion(ticket, targetStage);
      if (!jobValidation.success) return jobValidation;
    }

    const command = isQuickImpl ? 'quick-impl' : STAGE_COMMAND_MAP[targetStage];
    if (!command) return { success: true };

    const effectiveAgent = resolveEffectiveAgent(ticket);
    if (!supportsWorkflowCommand(effectiveAgent, command)) {
      return {
        success: false,
        error: `${effectiveAgent} does not support the ${command} workflow`,
        errorCode: 'UNSUPPORTED_AGENT',
      };
    }

    const jobData = {
      ticketId: ticket.id,
      projectId: ticket.projectId,
      command,
      status: JobStatus.PENDING,
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    const job = isQuickImpl
      ? (await prisma.$transaction([
          prisma.job.create({ data: jobData }),
          prisma.ticket.update({ where: { id: ticket.id }, data: { workflowType: 'QUICK' } }),
        ]))[0]
      : await prisma.job.create({ data: jobData });

    try {
      const { workflowId, inputs } = getWorkflowConfig(ticket, job, command, targetStage, isQuickImpl, effectiveAgent);

      await dispatchWorkflow({
        workflowId,
        projectId: ticket.projectId,
        agent: effectiveAgent,
        githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
        inputs,
        project: ticket.project,
      });

      return { success: true, jobId: job.id };
    } catch (error) {
      // Rollback job on dispatch failure
      await prisma.job.delete({ where: { id: job.id } }).catch(() => {});

      if (error instanceof RequestError) {
        let errorMessage = error.message;
        if (error.status === 401) errorMessage = 'GitHub authentication failed. Check GITHUB_TOKEN in .env';
        else if (error.status === 403) errorMessage = 'GitHub rate limit exceeded';
        else if (error.status === 404) errorMessage = 'Workflow file not found. Check .github/workflows/';

        return { success: false, error: errorMessage, errorCode: 'GITHUB_ERROR' };
      }

      if (error instanceof Error && error.message.includes('credential')) {
        return { success: false, error: error.message, errorCode: 'MISSING_CREDENTIAL' };
      }

      throw error;
    }
  } catch (error) {
    console.error('Error in handleTicketTransition:', error);
    return { success: false, error: 'Internal server error during transition' };
  }
}

export async function cleanupOrphanedJob(jobId: number): Promise<void> {
  await prisma.job.delete({ where: { id: jobId } }).catch((error) => {
    console.error('Failed to cleanup orphaned job:', { jobId, error });
  });
}
