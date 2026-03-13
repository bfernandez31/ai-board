import { PrismaClient, Stage, JobStatus, Ticket, Project, Agent, ApiKeyProvider } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import { isValidTransition, Stage as ValidationStage } from '@/lib/stage-transitions';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import { getProjectApiKey } from '@/lib/db/api-keys';

const prisma = new PrismaClient();

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
  errorCode?: 'INVALID_TRANSITION' | 'GITHUB_ERROR' | 'JOB_NOT_COMPLETED' | 'MISSING_JOB';
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

/** Map agent to API key provider */
function agentToProvider(agent: Agent): ApiKeyProvider {
  return agent === Agent.CODEX ? ApiKeyProvider.OPENAI : ApiKeyProvider.ANTHROPIC;
}

/** SPECIFY, PLAN, BUILD require validation; INBOX, VERIFY, SHIP do not */
function shouldValidateJobCompletion(currentStage: Stage): boolean {
  const stagesRequiringValidation: Stage[] = [Stage.SPECIFY, Stage.PLAN, Stage.BUILD];
  return stagesRequiringValidation.includes(currentStage);
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
      command: {
        not: {
          startsWith: 'comment-',
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      status: true,
      command: true,
      startedAt: true,
    },
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
    const errorMessage = getJobValidationErrorMessage(workflowJob.status);
    return {
      success: false,
      errorCode: 'JOB_NOT_COMPLETED',
      error: errorMessage,
      details: {
        currentStage: ticket.stage,
        targetStage: targetStage,
        jobStatus: workflowJob.status,
        jobCommand: workflowJob.command,
      },
    };
  }

  return { success: true };
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
    const currentStage = ticket.stage as Stage;

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
      if (!jobValidation.success) {
        return jobValidation;
      }
    }

    const command = isQuickImpl ? 'quick-impl' : STAGE_COMMAND_MAP[targetStage];

    if (!command) {
      return {
        success: true,
      };
    }

    let job;
    if (isQuickImpl) {
      const [createdJob] = await prisma.$transaction([
        prisma.job.create({
          data: {
            ticketId: ticket.id,
            projectId: ticket.projectId,
            command: command,
            status: JobStatus.PENDING,
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        prisma.ticket.update({
          where: { id: ticket.id },
          data: { workflowType: 'QUICK' },
        }),
      ]);
      job = createdJob;
    } else {
      job = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: ticket.projectId,
          command: command,
          status: JobStatus.PENDING,
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const aiboardOwner = process.env.GITHUB_OWNER;
    const aiboardRepo = process.env.GITHUB_REPO;

    if (!aiboardOwner || !aiboardRepo) {
      return {
        success: false,
        error: 'GITHUB_OWNER and GITHUB_REPO environment variables must be set',
        errorCode: 'GITHUB_ERROR',
      };
    }

    if (!isWorkflowTestMode(githubToken)) {
      let workflowFile: string = '';

      try {
        const octokit = new Octokit({
          auth: githubToken,
        });

        let workflowInputs: Record<string, string>;

        const effectiveAgent = resolveEffectiveAgent(ticket);

        // Resolve BYOK API key for the effective agent
        const provider = agentToProvider(effectiveAgent);
        const byokKey = await getProjectApiKey(ticket.projectId, provider);

        if (!byokKey && !process.env.ANTHROPIC_API_KEY) {
          // No BYOK key and no platform key - workflows can't run
          await prisma.job.delete({ where: { id: job.id } }).catch(() => {});
          return {
            success: false,
            error: `No API key configured. Please add your ${provider === ApiKeyProvider.ANTHROPIC ? 'Anthropic' : 'OpenAI'} API key in Project Settings > API Keys.`,
            errorCode: 'GITHUB_ERROR',
          };
        }

        if (isQuickImpl) {
          const quickImplPayload = {
            ticketKey: ticket.ticketKey,
            title: ticket.title,
            description: ticket.description || '',
            agent: effectiveAgent,
          };

          workflowInputs = {
            ticket_id: ticket.ticketKey,
            quickImplPayload: JSON.stringify(quickImplPayload),
            job_id: job.id.toString(),
            project_id: ticket.projectId.toString(),
            githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
            agent: effectiveAgent,
          };

          if (ticket.attachments) {
            workflowInputs.attachments = JSON.stringify(ticket.attachments);
          }

          workflowFile = 'quick-impl.yml';
        } else if (command === 'verify') {
          workflowInputs = {
            ticket_id: ticket.ticketKey,
            job_id: job.id.toString(),
            project_id: ticket.projectId.toString(),
            branch: ticket.branch || '',
            workflowType: ticket.workflowType,
            githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
            agent: effectiveAgent,
          };

          workflowFile = 'verify.yml';
        } else {
          workflowInputs = {
            ticket_id: ticket.ticketKey,
            command: command,
            branch: ticket.branch || '',
            job_id: job.id.toString(),
            project_id: ticket.projectId.toString(),
            githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
            agent: effectiveAgent,
          };

          if (targetStage === Stage.SPECIFY) {
            const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;
            const specifyPayload = {
              ticketKey: ticket.ticketKey,
              title: ticket.title,
              description: ticket.description || '',
              clarificationPolicy: effectivePolicy,
              agent: effectiveAgent,
            };

            workflowInputs.specifyPayload = JSON.stringify(specifyPayload);

            if (ticket.attachments) {
              workflowInputs.attachments = JSON.stringify(ticket.attachments);
            }
          }

          workflowFile = 'speckit.yml';
        }

        // Inject BYOK key into workflow inputs if configured
        if (byokKey) {
          workflowInputs.byok_api_key = byokKey;
        }

        console.log('[Workflow Dispatch]', {
          aiboardRepo: `${aiboardOwner}/${aiboardRepo}`,
          targetRepo: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
          workflow: workflowFile,
          command,
          ticketKey: ticket.ticketKey,
          hasByokKey: !!byokKey,
        });

        await octokit.actions.createWorkflowDispatch({
          owner: aiboardOwner,
          repo: aiboardRepo,
          workflow_id: workflowFile,
          ref: 'main',
          inputs: workflowInputs,
        });
      } catch (githubError) {
        if (githubError instanceof RequestError) {
          console.error('GitHub workflow dispatch failed:', {
            ticketId: ticket.id,
            command,
            status: githubError.status,
            message: githubError.message,
          });

          await prisma.job.delete({ where: { id: job.id } }).catch(() => {});

          let errorMessage = 'GitHub workflow dispatch failed';
          if (githubError.status === 401) {
            errorMessage = 'GitHub authentication failed. Check GITHUB_TOKEN in .env';
          } else if (githubError.status === 403) {
            errorMessage = 'GitHub rate limit exceeded';
          } else if (githubError.status === 404) {
            errorMessage = `Workflow file '${workflowFile}' not found in ai-board repository (${aiboardOwner}/${aiboardRepo}). Check .github/workflows/`;
          } else {
            errorMessage = githubError.message;
          }

          return {
            success: false,
            error: errorMessage,
            errorCode: 'GITHUB_ERROR',
          };
        }

        throw githubError;
      }
    }

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    console.error('Error in handleTicketTransition:', error);
    return {
      success: false,
      error: 'Internal server error during transition',
    };
  }
}

export async function cleanupOrphanedJob(jobId: number): Promise<void> {
  await prisma.job.delete({ where: { id: jobId } }).catch((error) => {
    console.error('Failed to cleanup orphaned job:', { jobId, error });
  });
}
