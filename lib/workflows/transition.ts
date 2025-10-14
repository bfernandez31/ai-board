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
  branchName?: string;
  error?: string;
  errorCode?: 'INVALID_TRANSITION' | 'GITHUB_ERROR';
}

/**
 * Ticket with required project relation for transition
 */
export type TicketWithProject = Ticket & {
  project: Project;
};

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

    // Validate stage transition (sequential only)
    if (!isValidTransition(currentStage as unknown as ValidationStage, targetStage as unknown as ValidationStage)) {
      return {
        success: false,
        error: `Cannot transition from ${currentStage} to ${targetStage}. Tickets must progress sequentially through stages.`,
        errorCode: 'INVALID_TRANSITION',
      };
    }

    // Check if target stage has automated workflow
    const command = STAGE_COMMAND_MAP[targetStage];

    // Handle manual stages (VERIFY, SHIP) - no job/workflow needed
    if (!command) {
      return {
        success: true,
      };
    }

    // Handle automated stages (SPECIFY, PLAN, BUILD)
    let branchName: string | undefined;

    // Generate branch name for SPECIFY stage only
    if (targetStage === Stage.SPECIFY) {
      branchName = `feature/ticket-${ticket.id}`;
    }

    // Create job record
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ticket.projectId,
        command: command,
        status: JobStatus.PENDING,
        startedAt: new Date(),
      },
    });

    // Initialize Octokit with GitHub token
    const githubToken = process.env.GITHUB_TOKEN;

    // Skip GitHub API call in test mode (when NODE_ENV is test, token is placeholder, or missing)
    const isTestMode = process.env.NODE_ENV === 'test' || !githubToken || githubToken.includes('test') || githubToken.includes('placeholder');

    if (!isTestMode) {
      try {
        const octokit = new Octokit({
          auth: githubToken,
        });

        // Prepare workflow inputs
        const workflowInputs: Record<string, string> = {
          ticket_id: ticket.id.toString(),
          command: command,
          branch: branchName || ticket.branch || '',
          job_id: job.id.toString(),
        };

        // Add ticket context for SPECIFY stage
        if (targetStage === Stage.SPECIFY) {
          workflowInputs.ticketTitle = ticket.title;
          workflowInputs.ticketDescription = ticket.description;
        }

        // Dispatch GitHub Actions workflow
        await octokit.actions.createWorkflowDispatch({
          owner: ticket.project.githubOwner,
          repo: ticket.project.githubRepo,
          workflow_id: 'speckit.yml',
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

    // Return success with job ID and optional branch name
    return {
      success: true,
      jobId: job.id,
      ...(branchName && { branchName }),
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
