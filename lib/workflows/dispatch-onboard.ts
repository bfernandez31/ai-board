import { Agent } from '@prisma/client';
import { dispatchWorkflow } from './dispatch';

export interface OnboardDispatchInputs {
  project_id: string;
  job_id: string;
  githubRepository: string;
  agent: Agent;
}

/**
 * Dispatches the onboard workflow using the consolidated dispatch helper.
 */
export async function dispatchOnboardWorkflow(
  inputs: OnboardDispatchInputs
): Promise<void> {
  const projectId = parseInt(inputs.project_id, 10);

  try {
    await dispatchWorkflow({
      workflowId: 'onboard.yml',
      projectId: isNaN(projectId) ? 0 : projectId,
      agent: inputs.agent,
      githubRepository: inputs.githubRepository,
      inputs: {
        project_id: inputs.project_id,
        job_id: inputs.job_id,
        githubRepository: inputs.githubRepository,
        agent: inputs.agent,
      },
    });
  } catch (error) {
    console.error('[onboard-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch onboard workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
