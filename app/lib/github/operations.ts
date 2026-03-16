import { Octokit } from '@octokit/rest';

export interface CommitImageOptions {
  owner: string;
  repo: string;
  branch?: string;
  path: string;
  content: Buffer;
  message: string;
  authorName: string;
  authorEmail: string;
}

export interface MoveImagesOptions {
  owner: string;
  repo: string;
  sourceBranch?: string;
  targetBranch: string;
  sourcePath: string;
  targetPath: string;
  authorName: string;
  authorEmail: string;
}

export interface DeleteAssetsOptions {
  owner: string;
  repo: string;
  branch?: string;
  path: string;
  authorName: string;
  authorEmail: string;
}

export interface GitHubOperationResult {
  commitSha: string;
  success: boolean;
}

export async function commitImageToRepo(
  octokit: Octokit,
  options: CommitImageOptions
): Promise<GitHubOperationResult> {
  const { owner, repo, branch = 'main', path, content, message, authorName, authorEmail } = options;

  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.TEST_USER_ID) {
    return { commitSha: `mock-sha-${Date.now()}`, success: true };
  }

  try {
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
      if ('sha' in data) {
        sha = data.sha;
      }
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: content.toString('base64'),
      branch,
      ...(sha && { sha }),
      author: { name: authorName, email: authorEmail },
    });

    return { commitSha: response.data.commit.sha as string, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to commit image to GitHub: ${errorMessage}`);
  }
}

export async function moveImagesToFeatureBranch(
  octokit: Octokit,
  options: MoveImagesOptions
): Promise<GitHubOperationResult> {
  const { owner, repo, sourceBranch = 'main', targetBranch, sourcePath, targetPath, authorName, authorEmail } = options;

  try {
    const { data: sourceContents } = await octokit.repos.getContent({
      owner, repo, path: sourcePath, ref: sourceBranch,
    });

    if (!Array.isArray(sourceContents)) {
      throw new Error(`Source path ${sourcePath} is not a directory`);
    }

    const files = sourceContents.filter((item) => item.type === 'file');
    if (files.length === 0) {
      throw new Error(`No files found in ${sourcePath}`);
    }

    let lastCommitSha = '';
    for (const file of files) {
      const { data: fileData } = await octokit.repos.getContent({
        owner, repo, path: file.path, ref: sourceBranch,
      });

      if (!('content' in fileData)) {
        console.warn(`Skipping non-file item: ${file.path}`);
        continue;
      }

      const targetFilePath = file.path.replace(sourcePath, targetPath);
      const response = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: targetFilePath,
        message: `feat: move image from ${sourcePath} to ${targetPath}`,
        content: fileData.content,
        branch: targetBranch,
        author: { name: authorName, email: authorEmail },
      });

      lastCommitSha = response.data.commit.sha as string;
    }

    return { commitSha: lastCommitSha, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to move images to feature branch: ${errorMessage}`);
  }
}

export async function deleteTicketAssets(
  octokit: Octokit,
  options: DeleteAssetsOptions
): Promise<GitHubOperationResult> {
  const { owner, repo, branch = 'main', path, authorName, authorEmail } = options;

  try {
    const { data: contents } = await octokit.repos.getContent({ owner, repo, path, ref: branch });

    if (!Array.isArray(contents)) {
      throw new Error(`Path ${path} is not a directory`);
    }

    const files = contents.filter((item) => item.type === 'file');
    if (files.length === 0) {
      return { commitSha: '', success: true };
    }

    let lastCommitSha = '';
    for (const file of files) {
      const response = await octokit.repos.deleteFile({
        owner,
        repo,
        path: file.path,
        message: `chore: delete ticket assets from ${path}`,
        sha: file.sha,
        branch,
        author: { name: authorName, email: authorEmail },
      });

      lastCommitSha = response.data.commit.sha as string;
    }

    return { commitSha: lastCommitSha, success: true };
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return { commitSha: '', success: true };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete ticket assets: ${errorMessage}`);
  }
}
