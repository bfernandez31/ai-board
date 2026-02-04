import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBranchFrom, BranchNotFoundError, GitHubPermissionError } from '@/lib/github/create-branch-from';
import { Octokit } from '@octokit/rest';

/**
 * Unit tests for createBranchFrom function
 *
 * Tests verify:
 * - Successful branch creation from source branch
 * - Handling of 404 errors (source branch not found)
 * - Handling of 403 errors (permission denied)
 * - Handling of 422 errors (branch already exists)
 */

describe('createBranchFrom', () => {
  let mockOctokit: Octokit;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        repos: {
          getBranch: vi.fn(),
        },
        git: {
          createRef: vi.fn(),
        },
      },
    } as unknown as Octokit;
  });

  it('should successfully create a new branch from source branch', async () => {
    const sourceSha = 'abc123def456';

    // Mock getBranch response
    (mockOctokit.rest.repos.getBranch as any).mockResolvedValue({
      data: {
        commit: {
          sha: sourceSha,
        },
      },
    });

    // Mock createRef response
    (mockOctokit.rest.git.createRef as any).mockResolvedValue({
      data: {
        ref: 'refs/heads/125-clone-of-feature',
        object: {
          sha: sourceSha,
        },
      },
    });

    const result = await createBranchFrom(
      mockOctokit,
      'testowner',
      'testrepo',
      '123-feature',
      '125-clone-of-feature'
    );

    expect(result).toEqual({
      sha: sourceSha,
      ref: 'refs/heads/125-clone-of-feature',
    });

    // Verify getBranch was called with correct parameters
    expect(mockOctokit.rest.repos.getBranch).toHaveBeenCalledWith({
      owner: 'testowner',
      repo: 'testrepo',
      branch: '123-feature',
    });

    // Verify createRef was called with correct parameters
    expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
      owner: 'testowner',
      repo: 'testrepo',
      ref: 'refs/heads/125-clone-of-feature',
      sha: sourceSha,
    });
  });

  it('should throw BranchNotFoundError when source branch does not exist (404)', async () => {
    const error404 = new Error('Not Found');
    (error404 as any).status = 404;
    (mockOctokit.rest.repos.getBranch as any).mockRejectedValue(error404);

    await expect(
      createBranchFrom(
        mockOctokit,
        'testowner',
        'testrepo',
        'non-existent-branch',
        '125-clone'
      )
    ).rejects.toThrow(BranchNotFoundError);

    await expect(
      createBranchFrom(
        mockOctokit,
        'testowner',
        'testrepo',
        'non-existent-branch',
        '125-clone'
      )
    ).rejects.toThrow('Source branch not found');
  });

  it('should throw GitHubPermissionError when permission denied (403)', async () => {
    const error403 = new Error('Permission denied');
    (error403 as any).status = 403;
    (mockOctokit.rest.repos.getBranch as any).mockRejectedValue(error403);

    await expect(
      createBranchFrom(
        mockOctokit,
        'testowner',
        'testrepo',
        '123-feature',
        '125-clone'
      )
    ).rejects.toThrow(GitHubPermissionError);

    await expect(
      createBranchFrom(
        mockOctokit,
        'testowner',
        'testrepo',
        '123-feature',
        '125-clone'
      )
    ).rejects.toThrow('Permission denied');
  });

  it('should throw error when branch creation fails with 422 (branch exists)', async () => {
    const sourceSha = 'abc123def456';

    // Mock successful getBranch
    (mockOctokit.rest.repos.getBranch as any).mockResolvedValue({
      data: {
        commit: {
          sha: sourceSha,
        },
      },
    });

    // Mock 422 error for createRef (branch already exists)
    const error422 = new Error('Reference already exists');
    (error422 as any).status = 422;
    (mockOctokit.rest.git.createRef as any).mockRejectedValue(error422);

    await expect(
      createBranchFrom(
        mockOctokit,
        'testowner',
        'testrepo',
        '123-feature',
        '125-clone'
      )
    ).rejects.toThrow('Reference already exists');
  });

  it('should throw GitHubPermissionError when createRef fails with 403', async () => {
    const sourceSha = 'abc123def456';

    // Mock successful getBranch
    (mockOctokit.rest.repos.getBranch as any).mockResolvedValue({
      data: {
        commit: {
          sha: sourceSha,
        },
      },
    });

    // Mock 403 error for createRef
    const error403 = new Error('Permission denied');
    (error403 as any).status = 403;
    (mockOctokit.rest.git.createRef as any).mockRejectedValue(error403);

    await expect(
      createBranchFrom(
        mockOctokit,
        'testowner',
        'testrepo',
        '123-feature',
        '125-clone'
      )
    ).rejects.toThrow(GitHubPermissionError);
  });

  it('should re-throw unexpected errors', async () => {
    const unexpectedError = new Error('Unexpected server error');
    (unexpectedError as any).status = 500;
    (mockOctokit.rest.repos.getBranch as any).mockRejectedValue(unexpectedError);

    await expect(
      createBranchFrom(
        mockOctokit,
        'testowner',
        'testrepo',
        '123-feature',
        '125-clone'
      )
    ).rejects.toThrow('Unexpected server error');
  });
});
