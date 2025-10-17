/**
 * GitHub API Integration for Specification Retrieval
 *
 * Fetches spec.md files from GitHub repository using Octokit.
 * Supports test mode detection for E2E testing.
 */

import { Octokit } from '@octokit/rest';

/**
 * Parameters for fetching specification content from GitHub
 */
export interface FetchSpecParams {
  /** GitHub repository owner */
  owner: string;

  /** GitHub repository name */
  repo: string;

  /** Git branch name where spec.md is located */
  branch: string;
}

/**
 * Fetches spec.md content from GitHub repository
 *
 * @param params - Repository and branch information
 * @returns Markdown content of spec.md file
 * @throws Error if file not found or GitHub API fails
 *
 * @example
 * const content = await fetchSpecContent({
 *   owner: 'myorg',
 *   repo: 'myrepo',
 *   branch: '022-feature-branch'
 * });
 */
export async function fetchSpecContent(params: FetchSpecParams): Promise<string> {
  const githubToken = process.env.GITHUB_TOKEN;

  // Use custom TEST_MODE variable since Next.js always runs in development mode with npm run dev
  const isTestEnvironment = process.env.TEST_MODE === 'true';

  if (isTestEnvironment) {
    // Return mock content for E2E tests
    return `# Test Mode Specification

This is mock content returned in test mode.

## Test Requirements
- Test requirement 1
- Test requirement 2

\`\`\`typescript
const test = 'example';
\`\`\``;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  if (githubToken.includes('test') || githubToken.includes('placeholder')) {
    throw new Error('GITHUB_TOKEN is using a placeholder value');
  }

  try {
    const octokit = new Octokit({ auth: githubToken });

    const response = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: `specs/${params.branch}/spec.md`,
      ref: params.branch,
    });

    // Check if response contains content (not a directory)
    if ('content' in response.data && response.data.content) {
      // Decode base64 content
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }

    throw new Error('Spec file not found - response does not contain content');
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      if (error.message.includes('Not Found')) {
        throw new Error(`Spec file not found at specs/${params.branch}/spec.md`);
      }
      if (error.message.includes('rate limit')) {
        throw new Error('GitHub API rate limit exceeded');
      }
      throw error;
    }
    throw new Error('Failed to fetch specification from GitHub');
  }
}
