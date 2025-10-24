import { workflowQueue } from '@/lib/queue/client';
import type { WorkflowJobData } from '@/lib/queue/types';

/**
 * AI-BOARD assist workflow inputs
 */
export interface AIBoardWorkflowInputs {
  /** Ticket ID */
  ticket_id: string;
  /** Ticket title */
  ticketTitle: string;
  /** Current stage */
  stage: string;
  /** Git branch name */
  branch: string;
  /** Requester username (for mention) */
  user: string;
  /** Comment content (user request) */
  comment: string;
  /** Job ID for status tracking */
  job_id: string;
  /** Project ID */
  project_id: string;
}

/**
 * Dispatch AI-BOARD assist to worker queue
 *
 * Enqueues an AI-BOARD assist job to be processed by the worker
 * instead of triggering GitHub Actions workflow.
 *
 * @param inputs Workflow dispatch inputs
 * @throws Error if queue enqueue fails
 *
 * @example
 * await dispatchAIBoardWorkflow({
 *   ticket_id: '123',
 *   ticketTitle: 'Add error handling',
 *   stage: 'specify',
 *   branch: '123-add-error-handling',
 *   user: 'john-doe',
 *   comment: '@ai-board please add network timeout handling',
 *   job_id: '456',
 *   project_id: '1',
 * });
 */
export async function dispatchAIBoardWorkflow(
  inputs: AIBoardWorkflowInputs
): Promise<void> {
  // Get GitHub owner and repo from environment or use defaults
  const owner = process.env.GITHUB_OWNER || 'bfernandez31';
  const repo = process.env.GITHUB_REPO || 'ai-board';

  try {
    // Create job data for the queue
    const jobData: WorkflowJobData = {
      ticketId: parseInt(inputs.ticket_id, 10),
      projectId: parseInt(inputs.project_id, 10),
      command: `comment-${inputs.stage}`,
      ticketTitle: inputs.ticketTitle,
      ticketDescription: inputs.comment, // Use comment as description for AI-BOARD assist
      branch: inputs.branch || null,
      githubOwner: owner,
      githubRepo: repo,
      jobId: parseInt(inputs.job_id, 10),
    };

    // Enqueue the job
    const job = await workflowQueue.add(`ai-board-assist`, jobData, {
      jobId: inputs.job_id,
      priority: 2, // Higher priority for user-initiated AI-BOARD requests
    });

    console.log(`[dispatch-ai-board] Enqueued AI-BOARD assist job ${job.id} for ticket ${inputs.ticket_id}`);
  } catch (error) {
    console.error('[dispatch-ai-board] Failed to enqueue job:', error);
    throw new Error(
      `Failed to enqueue AI-BOARD workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
