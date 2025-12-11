/**
 * GitHub API Integration for Documentation Retrieval
 *
 * Generic fetcher for documentation files (spec.md, plan.md, tasks.md) from GitHub repository using Octokit.
 * Supports test mode detection for E2E testing.
 */

import { Octokit } from '@octokit/rest';

/**
 * Supported documentation types for viewing
 */
export type DocumentType = 'spec' | 'plan' | 'tasks' | 'summary';

/**
 * File names for documentation types
 * Used to construct GitHub API file paths
 */
export const DocumentTypeFiles: Record<DocumentType, string> = {
  spec: 'spec.md',
  plan: 'plan.md',
  tasks: 'tasks.md',
  summary: 'summary.md',
};

/**
 * Parameters for fetching documentation from GitHub
 */
export interface DocumentFetchParams {
  /** GitHub repository owner/organization */
  owner: string;

  /** GitHub repository name */
  repo: string;

  /** Git branch or commit ref to read from (e.g., 'main' for SHIP tickets, feature branch otherwise) */
  branch: string;

  /** Original ticket branch name (used to construct file path in specs/ directory) */
  ticketBranch: string;

  /** Document type to fetch (spec, plan, or tasks) */
  docType: DocumentType;
}

/**
 * Fetches documentation content from GitHub repository
 *
 * @param params - Repository, branch, and document type information
 * @returns Markdown content of the documentation file
 * @throws Error if file not found or GitHub API fails
 *
 * @example
 * const content = await fetchDocumentContent({
 *   owner: 'myorg',
 *   repo: 'myrepo',
 *   branch: '035-view-plan-and',
 *   docType: 'plan'
 * });
 */
export async function fetchDocumentContent(params: DocumentFetchParams): Promise<string> {
  const githubToken = process.env.GITHUB_TOKEN;

  // Use custom TEST_MODE variable since Next.js always runs in development mode with npm run dev
  const isTestEnvironment = process.env.TEST_MODE === 'true';

  if (isTestEnvironment) {
    // Return mock content for E2E tests
    return `# Test Mode ${params.docType}

This is mock content for ${params.docType}.md in test mode.

## Test Section
- Test item 1
- Test item 2

\`\`\`typescript
const test = 'example for ${params.docType}';
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
    const fileName = DocumentTypeFiles[params.docType];

    const response = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: `specs/${params.ticketBranch}/${fileName}`,
      ref: params.branch,
    });

    // Check if response contains content (not a directory)
    if ('content' in response.data && response.data.content) {
      // Decode base64 content
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }

    throw new Error(`${fileName} not found - response does not contain content`);
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      if (error.message.includes('Not Found')) {
        const fileName = DocumentTypeFiles[params.docType];
        throw new Error(`${fileName} not found at specs/${params.ticketBranch}/${fileName}`);
      }
      if (error.message.includes('rate limit')) {
        throw new Error('GitHub API rate limit exceeded');
      }
      throw error;
    }
    throw new Error(`Failed to fetch ${params.docType} from GitHub`);
  }
}
