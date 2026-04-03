import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the module
vi.mock('@/lib/db/client', () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/client';
import {
  getGitHubAccessToken,
  hasRepoScope,
  createUserGitHubClient,
  requireRepoScope,
} from '@/lib/github/user-client';

const mockFindFirst = vi.mocked(prisma.account.findFirst);

describe('lib/github/user-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGitHubAccessToken', () => {
    it('returns the access token when Account exists', async () => {
      mockFindFirst.mockResolvedValue({
        access_token: 'gho_test_token_123',
      } as never);

      const token = await getGitHubAccessToken('user-1');

      expect(token).toBe('gho_test_token_123');
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', provider: 'github' },
        select: { access_token: true },
      });
    });

    it('returns null when no Account exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const token = await getGitHubAccessToken('user-1');

      expect(token).toBeNull();
    });

    it('returns null when access_token is null', async () => {
      mockFindFirst.mockResolvedValue({
        access_token: null,
      } as never);

      const token = await getGitHubAccessToken('user-1');

      expect(token).toBeNull();
    });
  });

  describe('hasRepoScope', () => {
    it('returns true when scope includes repo (comma-separated)', async () => {
      mockFindFirst.mockResolvedValue({
        scope: 'read:user,user:email,repo',
      } as never);

      expect(await hasRepoScope('user-1')).toBe(true);
    });

    it('returns true when scope includes repo (space-separated)', async () => {
      mockFindFirst.mockResolvedValue({
        scope: 'read:user user:email repo',
      } as never);

      expect(await hasRepoScope('user-1')).toBe(true);
    });

    it('returns false when scope does not include repo', async () => {
      mockFindFirst.mockResolvedValue({
        scope: 'read:user,user:email',
      } as never);

      expect(await hasRepoScope('user-1')).toBe(false);
    });

    it('returns false when scope is null', async () => {
      mockFindFirst.mockResolvedValue({
        scope: null,
      } as never);

      expect(await hasRepoScope('user-1')).toBe(false);
    });

    it('returns false when no Account exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      expect(await hasRepoScope('user-1')).toBe(false);
    });
  });

  describe('createUserGitHubClient', () => {
    it('returns an Octokit instance when token exists', async () => {
      mockFindFirst.mockResolvedValue({
        access_token: 'gho_test_token',
      } as never);

      const client = await createUserGitHubClient('user-1');

      expect(client).toBeDefined();
      expect(typeof client.repos).toBe('object');
    });

    it('throws when no token exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(createUserGitHubClient('user-1')).rejects.toThrow(
        'No GitHub access token found for user'
      );
    });
  });

  describe('requireRepoScope', () => {
    it('resolves when scope includes repo', async () => {
      mockFindFirst.mockResolvedValue({
        scope: 'read:user,user:email,repo',
      } as never);

      await expect(requireRepoScope('user-1')).resolves.toBeUndefined();
    });

    it('throws with MISSING_SCOPE code when scope lacks repo', async () => {
      mockFindFirst.mockResolvedValue({
        scope: 'read:user,user:email',
      } as never);

      try {
        await requireRepoScope('user-1');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('GitHub token lacks repo scope');
        expect((error as Error & { code: string }).code).toBe('MISSING_SCOPE');
      }
    });
  });
});
