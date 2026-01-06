/**
 * Unit Tests: closePRsForBranch
 *
 * Tests for the GitHub PR closing utility function.
 * Uses mocked Octokit to test various edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { closePRsForBranch } from '@/lib/github/close-prs';
import { Octokit } from '@octokit/rest';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      pulls: {
        list: vi.fn(),
        update: vi.fn(),
      },
      issues: {
        createComment: vi.fn(),
      },
    },
  })),
}));

describe('closePRsForBranch', () => {
  let mockOctokit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = {
      rest: {
        pulls: {
          list: vi.fn(),
          update: vi.fn(),
        },
        issues: {
          createComment: vi.fn(),
        },
      },
    };
  });

  describe('T031: No open PRs', () => {
    it('should return zero counts when no PRs exist', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({ data: [] });

      const result = await closePRsForBranch(
        mockOctokit as unknown as Octokit,
        'owner',
        'repo',
        'feature-branch',
        'Test comment'
      );

      expect(result.prsClosed).toBe(0);
      expect(result.prsAlreadyClosed).toBe(0);
      expect(mockOctokit.rest.pulls.update).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('T032: Already closed PR (idempotent)', () => {
    it('should handle 404 error as idempotent (already closed)', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [{ number: 123 }],
      });
      mockOctokit.rest.issues.createComment.mockRejectedValue({
        status: 404,
      });

      const result = await closePRsForBranch(
        mockOctokit as unknown as Octokit,
        'owner',
        'repo',
        'feature-branch',
        'Test comment'
      );

      expect(result.prsClosed).toBe(0);
      expect(result.prsAlreadyClosed).toBe(1);
    });

    it('should handle 422 error as idempotent (validation failed)', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [{ number: 123 }],
      });
      mockOctokit.rest.issues.createComment.mockRejectedValue({
        status: 422,
      });

      const result = await closePRsForBranch(
        mockOctokit as unknown as Octokit,
        'owner',
        'repo',
        'feature-branch',
        'Test comment'
      );

      expect(result.prsClosed).toBe(0);
      expect(result.prsAlreadyClosed).toBe(1);
    });
  });

  describe('T033: Multiple PRs', () => {
    it('should close all open PRs for branch', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [{ number: 123 }, { number: 456 }],
      });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});
      mockOctokit.rest.pulls.update.mockResolvedValue({});

      const result = await closePRsForBranch(
        mockOctokit as unknown as Octokit,
        'owner',
        'repo',
        'feature-branch',
        'Test comment'
      );

      expect(result.prsClosed).toBe(2);
      expect(result.prsAlreadyClosed).toBe(0);
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(2);
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and already-closed PRs', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [{ number: 123 }, { number: 456 }],
      });
      mockOctokit.rest.issues.createComment
        .mockResolvedValueOnce({}) // First PR succeeds
        .mockRejectedValueOnce({ status: 404 }); // Second PR already closed
      mockOctokit.rest.pulls.update.mockResolvedValue({});

      const result = await closePRsForBranch(
        mockOctokit as unknown as Octokit,
        'owner',
        'repo',
        'feature-branch',
        'Test comment'
      );

      expect(result.prsClosed).toBe(1);
      expect(result.prsAlreadyClosed).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should throw on non-idempotent errors', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [{ number: 123 }],
      });
      mockOctokit.rest.issues.createComment.mockRejectedValue({
        status: 500,
        message: 'Internal server error',
      });

      await expect(
        closePRsForBranch(
          mockOctokit as unknown as Octokit,
          'owner',
          'repo',
          'feature-branch',
          'Test comment'
        )
      ).rejects.toMatchObject({ status: 500 });
    });
  });
});
