import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';
import { getGitHubAccessToken } from '@/lib/github/user-client';
import type { OnboardingArtifactDocument, OnboardingArtifactManifestEntry } from './types';

const ONBOARDING_PATHS: Array<{
  path: string;
  kind: OnboardingArtifactManifestEntry['kind'];
  editable: boolean;
}> = [
  { path: '.ai-board/config.yml', kind: 'config', editable: true },
  { path: '.ai-board/memory/constitution.md', kind: 'constitution', editable: true },
  { path: 'CLAUDE.md', kind: 'instructions', editable: true },
  { path: 'AGENTS.md', kind: 'alias', editable: true },
  { path: '.gitignore', kind: 'ignore', editable: true },
  { path: '.ai-board/onboarding/analysis-summary.json', kind: 'analysis', editable: false },
];

async function createOwnerGitHubClient(projectId: number, userId: string): Promise<{
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
}> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      githubOwner: true,
      githubRepo: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error('No GitHub access token found for user');
  }

  const octokit = new Octokit({ auth: token });
  const repoResponse = await octokit.repos.get({
    owner: project.githubOwner,
    repo: project.githubRepo,
  });

  return {
    octokit,
    owner: project.githubOwner,
    repo: project.githubRepo,
    branch: repoResponse.data.default_branch || 'main',
  };
}

export async function getOnboardingArtifacts(
  projectId: number,
  userId: string
): Promise<OnboardingArtifactDocument[]> {
  if (process.env.TEST_MODE === 'true') {
    return ONBOARDING_PATHS.map((artifact) => ({
      path: artifact.path,
      kind: artifact.kind,
      status: artifact.path === '.ai-board/config.yml' ? 'generated' : 'missing',
      content: artifact.path === '.ai-board/config.yml' ? 'version: 1\nproject:\n  name: test\n' : '',
      editable: artifact.editable,
      sha: artifact.path === '.ai-board/config.yml' ? 'mock-sha' : null,
    }));
  }

  const { octokit, owner, repo, branch } = await createOwnerGitHubClient(projectId, userId);

  const results = await Promise.all(
    ONBOARDING_PATHS.map(async (artifact) => {
      try {
        const response = await octokit.repos.getContent({
          owner,
          repo,
          path: artifact.path,
          ref: branch,
        });

        if (!('content' in response.data) || !response.data.content) {
          return {
            path: artifact.path,
            kind: artifact.kind,
            status: 'missing' as const,
            content: '',
            editable: artifact.editable,
            sha: null,
          };
        }

        return {
          path: artifact.path,
          kind: artifact.kind,
          status: 'generated' as const,
          content: Buffer.from(response.data.content, 'base64').toString('utf8'),
          editable: artifact.editable,
          sha: response.data.sha,
        };
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          return {
            path: artifact.path,
            kind: artifact.kind,
            status: 'missing' as const,
            content: '',
            editable: artifact.editable,
            sha: null,
          };
        }

        throw error;
      }
    })
  );

  return results;
}

export async function updateOnboardingArtifacts(
  projectId: number,
  userId: string,
  artifacts: Array<{ path: string; content: string }>
): Promise<{ commitSha: string; updatedPaths: string[] }> {
  if (process.env.TEST_MODE === 'true') {
    return {
      commitSha: `mock-commit-${Date.now()}`,
      updatedPaths: artifacts.map((artifact) => artifact.path),
    };
  }

  const { octokit, owner, repo, branch } = await createOwnerGitHubClient(projectId, userId);

  let commitSha = '';
  for (const artifact of artifacts) {
    let sha: string | undefined;

    try {
      const existing = await octokit.repos.getContent({
        owner,
        repo,
        path: artifact.path,
        ref: branch,
      });
      if ('sha' in existing.data) {
        sha = existing.data.sha;
      }
    } catch (error) {
      if ((error as { status?: number }).status !== 404) {
        throw error;
      }
    }

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: artifact.path,
      message: `docs(onboarding): update ${artifact.path}`,
      content: Buffer.from(artifact.content, 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    });

    commitSha = response.data.commit.sha ?? commitSha;
  }

  return {
    commitSha,
    updatedPaths: artifacts.map((artifact) => artifact.path),
  };
}
