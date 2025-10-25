import { PrismaClient, Stage, JobStatus, Ticket, Project } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import { isValidTransition, Stage as ValidationStage } from '@/lib/stage-validation';

const prisma = new PrismaClient();

/**
 * Stage-to-command mapping for automated workflow stages
 * null indicates no automated workflow (manual stages like VERIFY and SHIP)
 */
export const STAGE_COMMAND_MAP: Record<Stage, string | null> = {
  INBOX: null,
  SPECIFY: 'specify',
  PLAN: 'plan',
  BUILD: 'implement',
  VERIFY: null,
  SHIP: null,
};

/**
 * Result of a ticket transition operation
 */
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

/**
 * Ticket with required project relation for transition
 */
export type TicketWithProject = Ticket & {
  project: Project;
};

/**
 * Determines if job completion validation is required for a given stage.
 *
 * Rules:
 * - INBOX: No validation (no prior job exists)
 * - SPECIFY, PLAN, BUILD: Requires validation (automated stages with prior jobs)
 * - VERIFY, SHIP: No validation (manual stages)
 *
 * @param currentStage - Current stage of the ticket
 * @returns true if validation is required, false otherwise
 */
function shouldValidateJobCompletion(currentStage: Stage): boolean {
  const stagesRequiringValidation: Stage[] = [Stage.SPECIFY, Stage.PLAN, Stage.BUILD];
  return stagesRequiringValidation.includes(currentStage);
}

/**
 * Maps job status to user-friendly error message.
 *
 * @param status - Current status of the job
 * @returns User-friendly error message explaining why transition is blocked
 */
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
 * Validates that the workflow job for the current stage has completed successfully.
 *
 * This validation ensures workflow integrity by checking:
 * 1. If the current stage requires job validation
 * 2. Whether a workflow job exists for the current stage (data integrity check)
 * 3. Whether the workflow job has status COMPLETED
 *
 * IMPORTANT: This only validates WORKFLOW jobs (specify, plan, implement), not AI-BOARD jobs (comment-*).
 * AI-BOARD jobs run in parallel and do not block stage transitions.
 *
 * @param ticket - Ticket with project relation loaded
 * @param targetStage - Target stage for transition
 * @returns TransitionResult indicating validation success or error details
 */
async function validateJobCompletion(
  ticket: TicketWithProject,
  targetStage: Stage
): Promise<TransitionResult> {
  // 1. Check if validation is required for current stage
  const requiresValidation = shouldValidateJobCompletion(ticket.stage);
  if (!requiresValidation) {
    return { success: true };
  }

  // 2. Fetch most recent job for ticket, excluding AI-BOARD jobs (comment-*)
  // Workflow jobs: specify, plan, implement, quick-impl
  // AI-BOARD jobs: comment-specify, comment-plan, comment-implement (excluded)
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

  // 4. Handle missing workflow job (data integrity issue)
  if (!workflowJob) {
    const expectedCommand = STAGE_COMMAND_MAP[ticket.stage];
    return {
      success: false,
      errorCode: 'MISSING_JOB',
      error: `Expected workflow job (${expectedCommand}) for stage ${ticket.stage} but none found`,
    };
  }

  // 5. Validate workflow job status is COMPLETED
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

  // 6. Validation passed
  return { success: true };
}

/**
 * Handle ticket stage transition with GitHub workflow dispatch
 *
 * Responsibilities:
 * 1. Validate stage transition is sequential
 * 2. Create Job record for automated stages (SPECIFY, PLAN, BUILD)
 * 3. Generate branch name for SPECIFY stage
 * 4. Dispatch GitHub Actions workflow (respects test mode)
 * 5. Return transition result (does NOT update ticket in database)
 *
 * The caller is responsible for:
 * - Updating the ticket stage and version in the database
 * - Handling optimistic concurrency control
 * - Cleaning up orphaned jobs on version conflicts
 *
 * @param ticket - Ticket with project relation loaded
 * @param targetStage - Target stage to transition to
 * @returns TransitionResult with jobId and branchName if successful, error otherwise
 */
export async function handleTicketTransition(
  ticket: TicketWithProject,
  targetStage: Stage
): Promise<TransitionResult> {
  try {
    const currentStage = ticket.stage as Stage;

    // 1. Validate stage transition (sequential only, with quick-impl special case)
    if (!isValidTransition(currentStage as unknown as ValidationStage, targetStage as unknown as ValidationStage)) {
      return {
        success: false,
        error: `Cannot transition from ${currentStage} to ${targetStage}. Tickets must progress sequentially through stages.`,
        errorCode: 'INVALID_TRANSITION',
      };
    }

    // 2. Detect quick-impl mode (INBOX → BUILD special case)
    const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;

    // 3. Validate job completion before proceeding (skip for quick-impl)
    if (!isQuickImpl) {
      const jobValidation = await validateJobCompletion(ticket, targetStage);
      if (!jobValidation.success) {
        return jobValidation;
      }
    }

    // 4. Determine command based on mode
    let command: string | null;
    if (isQuickImpl) {
      command = 'quick-impl'; // Override for quick-impl mode
    } else {
      command = STAGE_COMMAND_MAP[targetStage]; // Normal mode
    }

    // Handle manual stages (VERIFY, SHIP) - no job/workflow needed
    if (!command) {
      return {
        success: true,
      };
    }

    // Handle automated stages (SPECIFY, PLAN, BUILD)
    // Note: Branch is NOT set here - it will be created by GitHub workflow
    // and updated via PATCH /api/projects/:projectId/tickets/:id/branch

    // Create job record (with atomic workflowType update for quick-impl)
    let job;
    if (isQuickImpl) {
      // Atomic transaction: Job creation + workflowType update
      const [createdJob, _updatedTicket] = await prisma.$transaction([
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
      // Normal workflow: workflowType remains FULL (default)
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

    // Initialize Octokit with GitHub token
    const githubToken = process.env.GITHUB_TOKEN;

    // Skip GitHub API call in test mode (when TEST_MODE is set, NODE_ENV is test, token is placeholder, or missing)
    const isTestMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test' || !githubToken || githubToken.includes('test') || githubToken.includes('placeholder');

    if (!isTestMode) {
      try {
        const octokit = new Octokit({
          auth: githubToken,
        });

        // Prepare workflow inputs based on mode
        let workflowInputs: Record<string, string>;

        if (isQuickImpl) {
          // Quick-impl mode: Use quick-impl.yml input schema
          workflowInputs = {
            ticket_id: ticket.id.toString(),
            ticketTitle: ticket.title,
            ticketDescription: ticket.description,
            job_id: job.id.toString(),
            project_id: ticket.projectId.toString(),
          };
        } else {
          // Normal mode: Use speckit.yml input schema
          workflowInputs = {
            ticket_id: ticket.id.toString(),
            command: command,
            branch: ticket.branch || '', // Branch will be empty for SPECIFY (created by workflow)
            job_id: job.id.toString(),
            project_id: ticket.projectId.toString(),
            ticketTitle: ticket.title, // Include for all commands (used in debug output)
          };

          // Add SPECIFY-specific inputs
          if (targetStage === Stage.SPECIFY) {
            // Resolve effective clarification policy (ticket ?? project)
            const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;

            // Construct JSON payload with feature description and policy
            const specifyPayload = {
              featureDescription: `#${ticket.id} ${ticket.title}\n${ticket.description}`,
              clarificationPolicy: effectivePolicy,
            };

            // Pass as JSON string to workflow
            workflowInputs.specifyPayload = JSON.stringify(specifyPayload);

            // Add attachments for image context (if present)
            if (ticket.attachments) {
              workflowInputs.attachments = JSON.stringify(ticket.attachments);
            }

            // Legacy ticketDescription field for backward compatibility (deprecated)
            workflowInputs.ticketDescription = ticket.description;
          }
        }

        // Determine workflow file based on mode
        const workflowFile = isQuickImpl ? 'quick-impl.yml' : 'speckit.yml';

        // Dispatch GitHub Actions workflow
        await octokit.actions.createWorkflowDispatch({
          owner: ticket.project.githubOwner,
          repo: ticket.project.githubRepo,
          workflow_id: workflowFile,
          ref: 'main',
          inputs: workflowInputs,
        });
      } catch (githubError) {
        // Handle GitHub API errors
        if (githubError instanceof RequestError) {
          console.error('GitHub workflow dispatch failed:', {
            ticketId: ticket.id,
            command,
            status: githubError.status,
            message: githubError.message,
          });

          // Clean up orphaned job
          await prisma.job.delete({ where: { id: job.id } }).catch(() => {
            // Ignore errors during cleanup
          });

          let errorMessage = 'GitHub workflow dispatch failed';
          if (githubError.status === 401) {
            errorMessage = 'GitHub authentication failed';
          } else if (githubError.status === 403) {
            errorMessage = 'GitHub rate limit exceeded';
          } else if (githubError.status === 404) {
            errorMessage = 'Workflow file not found';
          } else {
            errorMessage = githubError.message;
          }

          return {
            success: false,
            error: errorMessage,
            errorCode: 'GITHUB_ERROR',
          };
        }

        // Re-throw non-GitHub errors
        throw githubError;
      }
    }

    // Return success with job ID
    // Note: Branch name is NOT returned - it will be set by GitHub workflow via /branch endpoint
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

/**
 * Clean up orphaned job created during failed transition
 *
 * @param jobId - Job ID to delete
 */
export async function cleanupOrphanedJob(jobId: number): Promise<void> {
  try {
    await prisma.job.delete({ where: { id: jobId } });
  } catch (error) {
    // Ignore errors during cleanup
    console.error('Failed to cleanup orphaned job:', { jobId, error });
  }
}
