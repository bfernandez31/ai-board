import { Octokit } from '@octokit/rest';

// Re-export types from contracts
export type {
  CreateBranchFromSourceInput,
  CreateBranchResult,
  BranchOperationError,
  GenerateBranchNameInput,
} from '@/specs/AIB-219-full-clone-option/contracts/branch-operations';

/**
 * Generates a branch name following project convention: {ticketNumber}-{slug}
 * Slug is derived from title: first 3 words, lowercase, hyphenated
 *
 * @param ticketNumber - Ticket number (e.g., 219)
 * @param title - Ticket title for slug extraction
 * @returns Branch name string
 *
 * @example
 * generateBranchName(219, "Add Full Clone Option");
 * // Returns: "219-add-full-clone"
 */
export function generateBranchName(ticketNumber: number, title: string): string {
  // Extract first 3 words, convert to lowercase, replace non-alphanumeric with space
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('-');

  return `${ticketNumber}-${slug}`;
}

/**
 * Creates a new Git branch from an existing source branch
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner (e.g., "bfernandez31")
 * @param repo - Repository name (e.g., "ai-board")
 * @param sourceBranch - Source branch name to copy from
 * @param newBranchName - New branch name to create
 * @returns Result with commit SHA and ref name
 *
 * @throws Error with specific messages for known failure cases
 */
export async function createBranchFromSource(
  octokit: Octokit,
  owner: string,
  repo: string,
  sourceBranch: string,
  newBranchName: string
): Promise<{ commitSha: string; ref: string }> {
  try {
    // Step 1: Get source branch commit SHA
    const { data: sourceBranchData } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: sourceBranch,
    });
    const sourceSha = sourceBranchData.commit.sha;

    // Step 2: Create new branch pointing to same commit
    const { data: newRef } = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: sourceSha,
    });

    return {
      commitSha: sourceSha,
      ref: newRef.ref,
    };
  } catch (error: unknown) {
    // Type guard for Octokit errors
    const octokitError = error as { status?: number; message?: string };

    // Log error for debugging
    console.error('Branch creation failed:', {
      owner,
      repo,
      sourceBranch,
      newBranchName,
      error: octokitError.message,
      status: octokitError.status,
    });

    // Provide specific error messages for common failures
    if (octokitError.status === 404) {
      throw new Error(`Source branch '${sourceBranch}' not found on GitHub`);
    }

    if (octokitError.status === 422) {
      // Check if branch already exists
      if (octokitError.message?.includes('Reference already exists')) {
        throw new Error(`Branch '${newBranchName}' already exists`);
      }
      throw new Error(`Invalid branch name or operation: ${octokitError.message}`);
    }

    if (octokitError.status === 403) {
      throw new Error(
        `GitHub API permission denied. Check token scope includes 'repo' access.`
      );
    }

    if (octokitError.status === 429) {
      throw new Error(`GitHub API rate limit exceeded. Please try again later.`);
    }

    // Re-throw with original error message for other cases
    throw new Error(
      `Branch creation failed: ${octokitError.message || 'Unknown error'}`
    );
  }
}
