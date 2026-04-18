import { Stage, JobStatus, Ticket, Project, Agent } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import { isValidTransition, Stage as ValidationStage } from '@/lib/stage-transitions';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import { getProjectServiceInputs } from '@/lib/workflows/service-inputs';
import { ensureFreshConfig } from '@/lib/config-sync';
import { prisma } from '@/lib/db/client';
import { supportsWorkflowCommand } from '@/app/lib/utils/agent-resolution';
import { resolveClaudeModel } from '@/lib/workflows/claude-models';

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

/**
 * Resolve the workflow command triggered by a stage transition.
 * INBOX → BUILD bypasses SPECIFY/PLAN and uses the dedicated quick-impl
 * command instead of the regular `implement`. All other transitions defer
 * to STAGE_COMMAND_MAP.
 */
export function getCommandForTransition(
  sourceStage: Stage,
  targetStage: Stage
): string | null {
  if (sourceStage === Stage.INBOX && targetStage === Stage.BUILD) {
    return 'quick-impl';
  }
  return STAGE_COMMAND_MAP[targetStage];
}

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

    // Prisma Stage and ValidationStage are structurally identical string enums
    // but TypeScript treats them as distinct nominal types, requiring a bridge cast
    if (!isValidTransition(currentStage as unknown as ValidationStage, targetStage as unknown as ValidationStage)) {
      return {
        success: false,
        error: `Cannot transition from ${currentStage} to ${targetStage}. Tickets must progress sequentially through stages.`,
        errorCode: 'INVALID_TRANSITION',
      };
    }

    const command = getCommandForTransition(currentStage, targetStage);
    const isQuickImpl = command === 'quick-impl';

    if (!isQuickImpl) {
      const jobValidation = await validateJobCompletion(ticket, targetStage);
      if (!jobValidation.success) {
        return jobValidation;
      }
    }

    if (!command) {
      return {
        success: true,
      };
    }

    const effectiveAgent = resolveEffectiveAgent(ticket);
    const resolvedClaudeModel = resolveClaudeModel({
      command,
      effectiveAgent,
      projectClaudeModels: ticket.project.claudeModels,
      ticketClaudeModelOverrides: ticket.claudeModelOverrides,
    });
    if (!supportsWorkflowCommand(effectiveAgent, command)) {
      return {
        success: false,
        error: `${effectiveAgent} does not support the ${command} workflow`,
        errorCode: 'UNSUPPORTED_AGENT',
      };
    }

    // Validate BYOK credential and ensure fresh config before dispatch
    if (!isWorkflowTestMode(process.env.GITHUB_TOKEN)) {
      const provider = AGENT_PROVIDER_MAP[effectiveAgent];
      const credential = await getOwnerCredential(ticket.projectId, provider);
      if (!credential) {
        return {
          success: false,
          error: getMissingCredentialError(provider),
          errorCode: 'MISSING_CREDENTIAL',
        };
      }

      try {
        await ensureFreshConfig(ticket.project);
      } catch (configError) {
        return {
          success: false,
          error: configError instanceof Error ? configError.message : 'Config sync failed before dispatch',
          errorCode: 'CONFIG_SYNC_FAILED',
        };
      }
    }

    let job;
    if (isQuickImpl) {
      const [createdJob] = await prisma.$transaction([
        prisma.job.create({
          data: {
            ticketId: ticket.id,
            projectId: ticket.projectId,
            command,
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
          command,
          status: JobStatus.PENDING,
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;

    if (!isWorkflowTestMode(githubToken)) {
      const aiboardOwner = process.env.GITHUB_OWNER;
      const aiboardRepo = process.env.GITHUB_REPO;

      if (!aiboardOwner || !aiboardRepo) {
        return {
          success: false,
          error: 'GITHUB_OWNER and GITHUB_REPO environment variables must be set',
          errorCode: 'GITHUB_ERROR',
        };
      }
      let workflowFile = '';

      try {
        const octokit = new Octokit({
          auth: githubToken,
        });

        let workflowInputs: Record<string, string>;

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
            ...(resolvedClaudeModel ? { model: resolvedClaudeModel } : {}),
            ...getProjectServiceInputs(ticket.project),
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
            ...(resolvedClaudeModel ? { model: resolvedClaudeModel } : {}),
            ...getProjectServiceInputs(ticket.project),
          };

          workflowFile = 'verify.yml';
        } else {
          workflowInputs = {
            ticket_id: ticket.ticketKey,
            command,
            branch: ticket.branch || '',
            job_id: job.id.toString(),
            project_id: ticket.projectId.toString(),
            githubRepository: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
            agent: effectiveAgent,
            ...(resolvedClaudeModel ? { model: resolvedClaudeModel } : {}),
            ...(command === 'implement' && getProjectServiceInputs(ticket.project)),
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

        console.log('[Workflow Dispatch]', {
          aiboardRepo: `${aiboardOwner}/${aiboardRepo}`,
          targetRepo: `${ticket.project.githubOwner}/${ticket.project.githubRepo}`,
          workflow: workflowFile,
          command,
          ticketKey: ticket.ticketKey,
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

          await prisma.job.delete({ where: { id: job.id } }).catch((deleteError) => {
            console.warn('Failed to delete job after GitHub dispatch failure:', { jobId: job.id, error: deleteError });
          });

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
