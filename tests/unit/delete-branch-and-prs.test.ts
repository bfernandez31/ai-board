import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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

interface MockOctokit {
  rest: {
    pulls: {
      list: Mock;
      update: Mock;
    };
    git: {
      deleteRef: Mock;
    };
  };
}

describe('deleteBranchAndPRs', () => {
  let mockOctokit: MockOctokit;

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
    };
  });

  it('should successfully delete branch and close PRs', async () => {
    // Mock PR list response
    const mockPRs = [
      { number: 1, title: 'Test PR 1' },
      { number: 2, title: 'Test PR 2' },
    ];
    mockOctokit.rest.pulls.list.mockResolvedValue({
      data: mockPRs,
    });

    // Mock PR update responses
    mockOctokit.rest.pulls.update.mockResolvedValue({});

    // Mock successful branch deletion
    mockOctokit.rest.git.deleteRef.mockResolvedValue({});

    const result = await deleteBranchAndPRs(
      mockOctokit as unknown as Octokit,
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
    mockOctokit.rest.pulls.list.mockResolvedValue({
      data: [],
    });

    // Mock 404 error for branch deletion
    const error404 = Object.assign(new Error('Not Found'), { status: 404 });
    mockOctokit.rest.git.deleteRef.mockRejectedValue(error404);

    const result = await deleteBranchAndPRs(
      mockOctokit as unknown as Octokit,
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

  it('should handle 404 error from pulls.list when branch does not exist', async () => {
    // Mock 404 error from pulls.list (branch doesn't exist)
    const error404 = Object.assign(new Error('Not Found'), { status: 404 });
    mockOctokit.rest.pulls.list.mockRejectedValue(error404);

    // Mock 404 error for branch deletion (branch doesn't exist)
    mockOctokit.rest.git.deleteRef.mockRejectedValue(error404);

    const result = await deleteBranchAndPRs(
      mockOctokit as unknown as Octokit,
      'testowner',
      'testrepo',
      'non-existent-branch'
    );

    // Should succeed with branchDeleted = false (branch never existed)
    expect(result).toEqual({
      prsClosed: 0,
      branchDeleted: false,
    });
  });

  it('should handle "reference does not exist" error gracefully', async () => {
    // Mock empty PR list
    mockOctokit.rest.pulls.list.mockResolvedValue({
      data: [],
    });

    // Mock error with "reference does not exist" message
    const referenceError = Object.assign(new Error('Reference does not exist'), { status: 422 });
    mockOctokit.rest.git.deleteRef.mockRejectedValue(referenceError);

    const result = await deleteBranchAndPRs(
      mockOctokit as unknown as Octokit,
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
    const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
      status: 429,
      response: {
        headers: {
          'x-ratelimit-reset': '1609459200',
        },
      },
    });
    mockOctokit.rest.pulls.list.mockRejectedValue(rateLimitError);

    await expect(
      deleteBranchAndPRs(mockOctokit as unknown as Octokit, 'testowner', 'testrepo', '084-feature')
    ).rejects.toThrow(/rate limit/i);
  });

  it('should handle permission errors', async () => {
    // Mock permission denied error
    const permissionError = Object.assign(new Error('Permission denied'), { status: 403 });
    mockOctokit.rest.pulls.list.mockRejectedValue(permissionError);

    await expect(
      deleteBranchAndPRs(mockOctokit as unknown as Octokit, 'testowner', 'testrepo', '084-feature')
    ).rejects.toThrow(/permission denied/i);
  });

  it('should handle protected branch errors', async () => {
    // Mock empty PR list
    mockOctokit.rest.pulls.list.mockResolvedValue({
      data: [],
    });

    // Mock 422 error for protected branch
    const protectedError = Object.assign(new Error('Cannot delete protected branch'), { status: 422 });
    mockOctokit.rest.git.deleteRef.mockRejectedValue(protectedError);

    await expect(
      deleteBranchAndPRs(mockOctokit as unknown as Octokit, 'testowner', 'testrepo', '084-feature')
    ).rejects.toThrow(/protected branch/i);
  });

  it('should close PRs before deleting branch', async () => {
    const callOrder: string[] = [];

    // Mock PR list
    mockOctokit.rest.pulls.list.mockImplementation(async () => {
      callOrder.push('list');
      return { data: [{ number: 1 }] };
    });

    // Mock PR update
    mockOctokit.rest.pulls.update.mockImplementation(async () => {
      callOrder.push('update');
      return {};
    });

    // Mock branch deletion
    mockOctokit.rest.git.deleteRef.mockImplementation(async () => {
      callOrder.push('delete');
      return {};
    });

    await deleteBranchAndPRs(
      mockOctokit as unknown as Octokit,
      'testowner',
      'testrepo',
      '084-feature'
    );

    // Verify correct order: list → update (close PRs) → delete (branch)
    expect(callOrder).toEqual(['list', 'update', 'delete']);
  });
});
