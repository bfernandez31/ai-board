import { Octokit } from '@octokit/rest';
import { CONSTITUTION_PATH, type ConstitutionContent } from '@/lib/types/constitution';

export interface ConstitutionFetchParams {
  owner: string;
  repo: string;
  branch?: string;
}

function getValidatedToken(): string {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN not configured');
  }
  if (token.includes('test') || token.includes('placeholder')) {
    throw new Error('GITHUB_TOKEN is using a placeholder value');
  }

  return token;
}

const MOCK_CONSTITUTION_CONTENT = `# Project Constitution

This is mock content for the constitution in test mode.

## Core Principles

1. Test principle 1
2. Test principle 2

## Guidelines

- Guideline A
- Guideline B

\`\`\`typescript
const example = 'mock constitution example';
\`\`\``;

export async function fetchConstitutionContent(
  params: ConstitutionFetchParams
): Promise<ConstitutionContent> {
  const { owner, repo, branch = 'main' } = params;

  // TEST_MODE is custom since Next.js always runs in development mode with `bun run dev`
  if (process.env.TEST_MODE === 'true') {
    return {
      content: MOCK_CONSTITUTION_CONTENT,
      sha: 'mock-sha-' + Date.now(),
      path: CONSTITUTION_PATH,
      updatedAt: new Date().toISOString(),
    };
  }

  const token = getValidatedToken();
  const octokit = new Octokit({ auth: token });

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: CONSTITUTION_PATH,
      ref: branch,
    });

    if (!('content' in response.data) || !response.data.content) {
      throw new Error('Constitution file not found - response does not contain content');
    }

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

    return {
      content,
      sha: response.data.sha,
      path: CONSTITUTION_PATH,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Not Found')) {
        throw new Error(`Constitution file not found at ${CONSTITUTION_PATH}`);
      }
      if (error.message.includes('rate limit')) {
        throw new Error('GitHub API rate limit exceeded');
      }
      throw error;
    }
    throw new Error('Failed to fetch constitution from GitHub');
  }
}

export async function updateConstitutionContent(params: {
  owner: string;
  repo: string;
  branch?: string;
  content: string;
  sha: string;
  commitMessage?: string;
}): Promise<{ commitSha: string; updatedAt: string }> {
  const { owner, repo, branch = 'main', content, sha, commitMessage } = params;

  const token = getValidatedToken();
  const octokit = new Octokit({ auth: token });
  const message = commitMessage || 'docs(constitution): Update project constitution';

  try {
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: CONSTITUTION_PATH,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch,
    });

    return {
      commitSha: response.data.commit.sha ?? '',
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('does not match')) {
        throw new Error('Another user has modified the constitution. Please refresh and try again.');
      }
      if (error.message.includes('Not Found')) {
        throw new Error(`Branch ${branch} not found in repository`);
      }
      throw error;
    }
    throw new Error('Failed to update constitution in GitHub');
  }
}
