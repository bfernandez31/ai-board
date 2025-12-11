/**
 * GitHub API Integration for Constitution File
 *
 * Fetches the constitution markdown file from `.specify/memory/constitution.md`.
 * Uses the same pattern as doc-fetcher.ts but with a fixed file path.
 */

import { Octokit } from '@octokit/rest';
import { CONSTITUTION_PATH, type ConstitutionContent } from '@/lib/types/constitution';

/**
 * Parameters for fetching constitution from GitHub
 */
export interface ConstitutionFetchParams {
  /** GitHub repository owner/organization */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Git branch to read from (defaults to 'main') */
  branch?: string;
}

/**
 * Fetches constitution content from GitHub repository
 *
 * @param params - Repository and optional branch information
 * @returns Constitution content with metadata
 * @throws Error if file not found or GitHub API fails
 *
 * @example
 * const constitution = await fetchConstitutionContent({
 *   owner: 'myorg',
 *   repo: 'myrepo',
 * });
 */
export async function fetchConstitutionContent(
  params: ConstitutionFetchParams
): Promise<ConstitutionContent> {
  const { owner, repo, branch = 'main' } = params;

  // Use custom TEST_MODE variable since Next.js always runs in development mode with npm run dev
  const isTestEnvironment = process.env.TEST_MODE === 'true';

  if (isTestEnvironment) {
    // Return mock content for E2E tests
    return {
      content: `# Project Constitution

This is mock content for the constitution in test mode.

## Core Principles

1. Test principle 1
2. Test principle 2

## Guidelines

- Guideline A
- Guideline B

\`\`\`typescript
const example = 'mock constitution example';
\`\`\``,
      sha: 'mock-sha-' + Date.now(),
      path: CONSTITUTION_PATH,
      updatedAt: new Date().toISOString(),
    };
  }

  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  if (githubToken.includes('test') || githubToken.includes('placeholder')) {
    throw new Error('GITHUB_TOKEN is using a placeholder value');
  }

  try {
    const octokit = new Octokit({ auth: githubToken });

    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: CONSTITUTION_PATH,
      ref: branch,
    });

    // Check if response contains content (not a directory)
    if (!('content' in response.data) || !response.data.content) {
      throw new Error('Constitution file not found - response does not contain content');
    }

    // Decode base64 content
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

    return {
      content,
      sha: response.data.sha,
      path: CONSTITUTION_PATH,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Re-throw with more context
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

/**
 * Updates constitution content in GitHub repository
 *
 * @param params - Update parameters including content and optional commit message
 * @returns Commit SHA and update timestamp
 * @throws Error if update fails
 */
export async function updateConstitutionContent(params: {
  owner: string;
  repo: string;
  branch?: string;
  content: string;
  sha: string;
  commitMessage?: string;
}): Promise<{ commitSha: string; updatedAt: string }> {
  const { owner, repo, branch = 'main', content, sha, commitMessage } = params;

  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  const octokit = new Octokit({ auth: githubToken });

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
