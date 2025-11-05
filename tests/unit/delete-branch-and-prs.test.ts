import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteBranchAndPRs } from '@/lib/github/delete-branch-and-prs';
import { Octokit } from '@octokit/rest';

/**
 * Unit tests for deleteBranchAndPRs function
 *
 * Tests verify:
 * - Successful branch deletion
 * - Handling of 404 errors (branch already deleted)
 * - Handling of "reference does not exist" errors
 * - PR closure before branch deletion
 */

describe('deleteBranchAndPRs', () => {
  let mockOctokit: Octokit;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        pulls: {
          list: vi.fn(),
          update: vi.fn(),
        },
        git: {
          deleteRef: vi.fn(),
        },
      },
    } as unknown as Octokit;
  });

  it('should successfully delete branch and close PRs', async () => {
    // Mock PR list response
    const mockPRs = [
      { number: 1, title: 'Test PR 1' },
      { number: 2, title: 'Test PR 2' },
    ];
    (mockOctokit.rest.pulls.list as any).mockResolvedValue({
      data: mockPRs,
    } as any);

    // Mock PR update responses
    (mockOctokit.rest.pulls.update as any).mockResolvedValue({} as any);

    // Mock successful branch deletion
    (mockOctokit.rest.git.deleteRef as any).mockResolvedValue({} as any);

    const result = await deleteBranchAndPRs(
      mockOctokit,
      'testowner',
      'testrepo',
      '084-feature'
    );

    expect(result).toEqual({
      prsClosed: 2,
      branchDeleted: true,
    });

    // Verify PR list was called
    expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
      owner: 'testowner',
      repo: 'testrepo',
      head: 'testowner:084-feature',
      state: 'open',
    });

    // Verify PRs were closed
    expect(mockOctokit.rest.pulls.update).toHaveBeenCalledTimes(2);

    // Verify branch deletion was called
    expect(mockOctokit.rest.git.deleteRef).toHaveBeenCalledWith({
      owner: 'testowner',
      repo: 'testrepo',
      ref: 'heads/084-feature',
    });
  });

  it('should handle 404 error when branch already deleted', async () => {
    // Mock empty PR list
    (mockOctokit.rest.pulls.list as any).mockResolvedValue({
      data: [],
    } as any);

    // Mock 404 error for branch deletion
    const error404 = new Error('Not Found');
    (error404 as any).status = 404;
    (mockOctokit.rest.git.deleteRef as any).mockRejectedValue(error404);

    const result = await deleteBranchAndPRs(
      mockOctokit,
      'testowner',
      'testrepo',
      '084-feature'
    );

    // Should succeed with branchDeleted = false (idempotent)
    expect(result).toEqual({
      prsClosed: 0,
      branchDeleted: false,
    });
  });

  it('should handle "reference does not exist" error gracefully', async () => {
    // Mock empty PR list
    (mockOctokit.rest.pulls.list as any).mockResolvedValue({
      data: [],
    } as any);

    // Mock error with "reference does not exist" message
    const referenceError = new Error('Reference does not exist');
    (referenceError as any).status = 422;
    (mockOctokit.rest.git.deleteRef as any).mockRejectedValue(referenceError);

    const result = await deleteBranchAndPRs(
      mockOctokit,
      'testowner',
      'testrepo',
      '084-feature'
    );

    // Should succeed with branchDeleted = false
    expect(result).toEqual({
      prsClosed: 0,
      branchDeleted: false,
    });
  });

  it('should handle rate limit errors', async () => {
    // Mock rate limit error
    const rateLimitError = new Error('Rate limit exceeded');
    (rateLimitError as any).status = 429;
    (rateLimitError as any).response = {
      headers: {
        'x-ratelimit-reset': '1609459200',
      },
    };
    (mockOctokit.rest.pulls.list as any).mockRejectedValue(rateLimitError);

    await expect(
      deleteBranchAndPRs(mockOctokit, 'testowner', 'testrepo', '084-feature')
    ).rejects.toThrow(/rate limit/i);
  });

  it('should handle permission errors', async () => {
    // Mock permission denied error
    const permissionError = new Error('Permission denied');
    (permissionError as any).status = 403;
    (mockOctokit.rest.pulls.list as any).mockRejectedValue(permissionError);

    await expect(
      deleteBranchAndPRs(mockOctokit, 'testowner', 'testrepo', '084-feature')
    ).rejects.toThrow(/permission denied/i);
  });

  it('should handle protected branch errors', async () => {
    // Mock empty PR list
    (mockOctokit.rest.pulls.list as any).mockResolvedValue({
      data: [],
    } as any);

    // Mock 422 error for protected branch
    const protectedError = new Error('Cannot delete protected branch');
    (protectedError as any).status = 422;
    (mockOctokit.rest.git.deleteRef as any).mockRejectedValue(protectedError);

    await expect(
      deleteBranchAndPRs(mockOctokit, 'testowner', 'testrepo', '084-feature')
    ).rejects.toThrow(/protected branch/i);
  });

  it('should close PRs before deleting branch', async () => {
    const callOrder: string[] = [];

    // Mock PR list
    (mockOctokit.rest.pulls.list as any).mockImplementation(async () => {
      callOrder.push('list');
      return { data: [{ number: 1 }] } as any;
    });

    // Mock PR update
    (mockOctokit.rest.pulls.update as any).mockImplementation(async () => {
      callOrder.push('update');
      return {} as any;
    });

    // Mock branch deletion
    (mockOctokit.rest.git.deleteRef as any).mockImplementation(async () => {
      callOrder.push('delete');
      return {} as any;
    });

    await deleteBranchAndPRs(
      mockOctokit,
      'testowner',
      'testrepo',
      '084-feature'
    );

    // Verify correct order: list → update (close PRs) → delete (branch)
    expect(callOrder).toEqual(['list', 'update', 'delete']);
  });
});
