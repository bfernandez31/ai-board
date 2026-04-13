import { Agent, type HealthScanType } from '@prisma/client';
import { dispatchWorkflow, type ProjectWithConfig } from '@/lib/workflows/dispatch';

export interface HealthScanDispatchInputs {
  scan_id: string;
  project_id: string;
  scan_type: HealthScanType;
  base_commit: string;
  head_commit: string;
  githubRepository: string;
}

/**
 * Dispatches the health scan workflow using the consolidated dispatch helper.
 * Health scans always require an ANTHROPIC credential as they use Claude for analysis.
 */
export async function dispatchHealthScanWorkflow(
  inputs: HealthScanDispatchInputs,
  project?: ProjectWithConfig
): Promise<void> {
  const projectId = parseInt(inputs.project_id, 10);

  try {
    await dispatchWorkflow({
      workflowId: 'health-scan.yml',
      projectId: isNaN(projectId) ? 0 : projectId,
      agent: Agent.CLAUDE, // Health scans always use Claude
      githubRepository: inputs.githubRepository,
      inputs: {
        ...inputs,
      },
      project,
    });
  } catch (error) {
    console.error('[health-scan-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch health scan workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
