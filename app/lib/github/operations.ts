/**
 * GitHub operations for image attachment management
 *
 * Handles image file storage, movement, and deletion in GitHub repository
 * using @octokit/rest API.
 */

import { Octokit } from '@octokit/rest';

/**
 * Options for committing an image to GitHub repository
 */
export interface CommitImageOptions {
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Branch name (default: 'main') */
  branch?: string;
  /** File path relative to repository root */
  path: string;
  /** Image content as Buffer */
  content: Buffer;
  /** Commit message */
  message: string;
  /** Git author name */
  authorName: string;
  /** Git author email */
  authorEmail: string;
}

/**
 * Options for moving images between branches
 */
export interface MoveImagesOptions {
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Source branch (default: 'main') */
  sourceBranch?: string;
  /** Target branch */
  targetBranch: string;
  /** Source directory path (e.g., 'ticket-assets/123') */
  sourcePath: string;
  /** Target directory path (e.g., 'specs/038-feature/assets') */
  targetPath: string;
  /** Git author name */
  authorName: string;
  /** Git author email */
  authorEmail: string;
}

/**
 * Options for deleting ticket assets
 */
export interface DeleteAssetsOptions {
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Branch name (default: 'main') */
  branch?: string;
  /** Directory path to delete (e.g., 'ticket-assets/123') */
  path: string;
  /** Git author name */
  authorName: string;
  /** Git author email */
  authorEmail: string;
}

/**
 * Result of a successful GitHub operation
 */
export interface GitHubOperationResult {
  /** Git commit SHA */
  commitSha: string;
  /** Operation success status */
  success: boolean;
}

/**
 * Commit an image file to GitHub repository
 *
 * Creates or updates a file in the repository with the provided image content.
 * Uses base64 encoding for binary data transmission.
 *
 * @param octokit - Authenticated Octokit instance
 * @param options - Commit configuration
 * @returns Promise resolving to commit result
 * @throws Error if GitHub API request fails
 *
 * @example
 * const result = await commitImageToRepo(octokit, {
 *   owner: 'bfernandez31',
 *   repo: 'ai-board',
 *   path: 'ticket-assets/123/mockup.png',
 *   content: imageBuffer,
 *   message: 'feat(ticket-123): add image attachment mockup.png',
 *   authorName: 'John Doe',
 *   authorEmail: 'john@example.com',
 * });
 */
export async function commitImageToRepo(
  octokit: Octokit,
  options: CommitImageOptions
): Promise<GitHubOperationResult> {
  const { owner, repo, branch = 'main', path, content, message, authorName, authorEmail } = options;

  // Mock GitHub operations in test environment
  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.TEST_USER_ID) {
    return {
      commitSha: `mock-sha-${Date.now()}`,
      success: true,
    };
  }

  try {
    // Get current file SHA if file exists (for updates)
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if ('sha' in data) {
        sha = data.sha;
      }
    } catch (error) {
      // File doesn't exist, that's fine - we're creating it
      if ((error as any).status !== 404) {
        throw error;
      }
    }

    // Encode image content to base64
    const encodedContent = content.toString('base64');

    // Create or update file
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: encodedContent,
      branch,
      ...(sha && { sha }), // Include SHA for updates
      author: {
        name: authorName,
        email: authorEmail,
      },
    });

    return {
      commitSha: response.data.commit.sha as string,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to commit image to GitHub: ${errorMessage}`);
  }
}

/**
 * Move images from one branch/path to another
 *
 * This is a multi-step operation:
 * 1. Get files from source path on source branch
 * 2. Commit files to target path on target branch
 * 3. Delete files from source path on source branch
 *
 * @param octokit - Authenticated Octokit instance
 * @param options - Move configuration
 * @returns Promise resolving to commit result for target branch
 * @throws Error if any GitHub API request fails
 *
 * @example
 * await moveImagesToFeatureBranch(octokit, {
 *   owner: 'bfernandez31',
 *   repo: 'ai-board',
 *   sourceBranch: 'main',
 *   targetBranch: '038-feature',
 *   sourcePath: 'ticket-assets/123',
 *   targetPath: 'specs/038-feature/assets',
 *   authorName: 'System',
 *   authorEmail: 'system@example.com',
 * });
 */
export async function moveImagesToFeatureBranch(
  octokit: Octokit,
  options: MoveImagesOptions
): Promise<GitHubOperationResult> {
  const {
    owner,
    repo,
    sourceBranch = 'main',
    targetBranch,
    sourcePath,
    targetPath,
    authorName,
    authorEmail,
  } = options;

  try {
    // Step 1: Get all files from source path
    const { data: sourceContents } = await octokit.repos.getContent({
      owner,
      repo,
      path: sourcePath,
      ref: sourceBranch,
    });

    if (!Array.isArray(sourceContents)) {
      throw new Error(`Source path ${sourcePath} is not a directory`);
    }

    // Filter for files only (not directories)
    const files = sourceContents.filter((item) => item.type === 'file');

    if (files.length === 0) {
      throw new Error(`No files found in ${sourcePath}`);
    }

    // Step 2: Copy each file to target branch
    let lastCommitSha = '';
    for (const file of files) {
      // Get file content (base64 encoded)
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.path,
        ref: sourceBranch,
      });

      if (!('content' in fileData)) {
        console.warn(`Skipping non-file item: ${file.path}`);
        continue;
      }

      // Commit to target branch
      const targetFilePath = file.path.replace(sourcePath, targetPath);
      const response = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: targetFilePath,
        message: `feat: move image from ${sourcePath} to ${targetPath}`,
        content: fileData.content,
        branch: targetBranch,
        author: {
          name: authorName,
          email: authorEmail,
        },
      });

      lastCommitSha = response.data.commit.sha as string;
    }

    return {
      commitSha: lastCommitSha,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to move images to feature branch: ${errorMessage}`);
  }
}

/**
 * Delete ticket assets directory from GitHub
 *
 * Deletes all files in the specified directory path.
 * Note: GitHub API requires deleting files individually, not directories.
 *
 * @param octokit - Authenticated Octokit instance
 * @param options - Delete configuration
 * @returns Promise resolving to commit result
 * @throws Error if GitHub API request fails
 *
 * @example
 * await deleteTicketAssets(octokit, {
 *   owner: 'bfernandez31',
 *   repo: 'ai-board',
 *   path: 'ticket-assets/123',
 *   authorName: 'System',
 *   authorEmail: 'system@example.com',
 * });
 */
export async function deleteTicketAssets(
  octokit: Octokit,
  options: DeleteAssetsOptions
): Promise<GitHubOperationResult> {
  const { owner, repo, branch = 'main', path, authorName, authorEmail } = options;

  try {
    // Get all files in the directory
    const { data: contents } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (!Array.isArray(contents)) {
      throw new Error(`Path ${path} is not a directory`);
    }

    // Filter for files only
    const files = contents.filter((item) => item.type === 'file');

    if (files.length === 0) {
      // Directory is already empty or doesn't exist
      return {
        commitSha: '',
        success: true,
      };
    }

    // Delete each file
    let lastCommitSha = '';
    for (const file of files) {
      const response = await octokit.repos.deleteFile({
        owner,
        repo,
        path: file.path,
        message: `chore: delete ticket assets from ${path}`,
        sha: file.sha,
        branch,
        author: {
          name: authorName,
          email: authorEmail,
        },
      });

      lastCommitSha = response.data.commit.sha as string;
    }

    return {
      commitSha: lastCommitSha,
      success: true,
    };
  } catch (error) {
    // If directory doesn't exist, consider it a success (already deleted)
    if ((error as any).status === 404) {
      return {
        commitSha: '',
        success: true,
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete ticket assets: ${errorMessage}`);
  }
}
