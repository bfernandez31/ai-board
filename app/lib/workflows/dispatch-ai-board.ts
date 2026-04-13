import { Agent } from '@prisma/client';
import { dispatchWorkflow, type ProjectWithConfig } from '@/lib/workflows/dispatch';

export interface AIBoardWorkflowInputs {
  ticket_id: string;
  stage: string;
  branch: string;
  user_id: string;
  user: string;
  comment: string;
  job_id: string;
  project_id: string;
  githubRepository: string;
  agent: string;
}

/**
 * Dispatches the AI-BOARD assist workflow using the consolidated dispatch helper.
 * AI-BOARD assist always requires an ANTHROPIC credential as it uses Claude for orchestration.
 */
export async function dispatchAIBoardWorkflow(
  inputs: AIBoardWorkflowInputs,
  project?: ProjectWithConfig
): Promise<void> {
  const projectId = parseInt(inputs.project_id, 10);

  try {
    await dispatchWorkflow({
      workflowId: 'ai-board-assist.yml',
      projectId: isNaN(projectId) ? 0 : projectId,
      agent: Agent.CLAUDE, // AI-Board assist always uses Claude
      githubRepository: inputs.githubRepository,
      inputs: inputs as unknown as Record<string, string>,
      project,
    });
  } catch (error) {
    console.error('[dispatch-ai-board] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch AI-BOARD workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
