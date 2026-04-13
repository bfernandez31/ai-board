import { Agent } from '@prisma/client';
import { dispatchWorkflow } from './dispatch';

export interface RetroSpecDispatchInputs {
  project_id: string;
  job_id: string;
  githubRepository: string;
  agent: Agent;
  depth: string;
  docUrl?: string | undefined;
  context?: string | undefined;
}

/**
 * Dispatches the retro-spec workflow using the consolidated dispatch helper.
 */
export async function dispatchRetroSpecWorkflow(
  inputs: RetroSpecDispatchInputs
): Promise<void> {
  const projectId = parseInt(inputs.project_id, 10);
  
  try {
    await dispatchWorkflow({
      workflowId: 'retro-spec.yml',
      projectId: isNaN(projectId) ? 0 : projectId,
      agent: inputs.agent,
      githubRepository: inputs.githubRepository,
      inputs: {
        project_id: inputs.project_id,
        job_id: inputs.job_id,
        githubRepository: inputs.githubRepository,
        agent: inputs.agent,
        depth: inputs.depth,
        docUrl: inputs.docUrl ?? '',
        context: inputs.context ?? '',
      },
    });
  } catch (error) {
    console.error('[retro-spec-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch retro-spec workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
