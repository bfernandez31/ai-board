import { Octokit } from '@octokit/rest';
import type { Agent } from '@prisma/client';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

export interface ProjectOnboardingWorkflowInputs {
  projectId: number;
  jobId: number;
  githubRepository: string;
  agent: Agent;
}

export async function dispatchProjectOnboardingWorkflow(
  inputs: ProjectOnboardingWorkflowInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    return;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured - required for workflow dispatch');
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER and GITHUB_REPO environment variables required');
  }

  const octokit = new Octokit({ auth: githubToken });

  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: 'project-onboarding.yml',
    ref: 'main',
    inputs: {
      job_id: String(inputs.jobId),
      project_id: String(inputs.projectId),
      githubRepository: inputs.githubRepository,
      agent: inputs.agent,
    },
  });
}
