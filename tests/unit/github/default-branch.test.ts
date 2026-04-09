/**
 * Unit Tests: getDefaultBranch
 *
 * Tests the shared utility for resolving a repository's default branch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDefaultBranch } from '@/lib/github/default-branch';
import type { Octokit } from '@octokit/rest';

describe('getDefaultBranch', () => {
  let mockOctokit: { repos: { get: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = {
      repos: {
        get: vi.fn(),
      },
    };
  });

  it('returns "main" when that is the default branch', async () => {
    mockOctokit.repos.get.mockResolvedValue({
      data: { default_branch: 'main' },
    });

    const result = await getDefaultBranch(
      mockOctokit as unknown as Octokit,
      'owner',
      'repo'
    );

    expect(result).toBe('main');
    expect(mockOctokit.repos.get).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('returns "master" when that is the default branch', async () => {
    mockOctokit.repos.get.mockResolvedValue({
      data: { default_branch: 'master' },
    });

    const result = await getDefaultBranch(
      mockOctokit as unknown as Octokit,
      'owner',
      'repo'
    );

    expect(result).toBe('master');
  });

  it('returns a custom default branch name', async () => {
    mockOctokit.repos.get.mockResolvedValue({
      data: { default_branch: 'develop' },
    });

    const result = await getDefaultBranch(
      mockOctokit as unknown as Octokit,
      'owner',
      'repo'
    );

    expect(result).toBe('develop');
  });

  it('propagates GitHub API errors', async () => {
    mockOctokit.repos.get.mockRejectedValue(new Error('Not Found'));

    await expect(
      getDefaultBranch(mockOctokit as unknown as Octokit, 'owner', 'repo')
    ).rejects.toThrow('Not Found');
  });
});
