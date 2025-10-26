import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createOrUpdateUser,
  validateGitHubProfile,
  type GitHubProfile,
} from '@/app/lib/auth/user-service';
import { prisma } from '@/lib/db/client';
import type { Account } from 'next-auth';

// Mock Prisma
vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateGitHubProfile', () => {
    it('returns true for valid profile with all fields', () => {
      const profile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
        email_verified: true,
      };

      expect(validateGitHubProfile(profile)).toBe(true);
    });

    it('returns true for valid profile without optional fields', () => {
      const profile = {
        id: 12345,
        email: 'alice@github.com',
        name: null,
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      expect(validateGitHubProfile(profile)).toBe(true);
    });

    it('returns false when email is missing', () => {
      const profile = {
        id: 12345,
        email: null,
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      expect(validateGitHubProfile(profile)).toBe(false);
    });

    it('returns false when email is empty string', () => {
      const profile = {
        id: 12345,
        email: '',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      expect(validateGitHubProfile(profile)).toBe(false);
    });

    it('returns false when profile is null', () => {
      expect(validateGitHubProfile(null)).toBe(false);
    });

    it('returns false when profile is undefined', () => {
      expect(validateGitHubProfile(undefined)).toBe(false);
    });
  });

  describe('createOrUpdateUser - new user scenario', () => {
    it('creates user on first sign-in with all profile fields', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
        email_verified: true,
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_token123',
        refresh_token: null,
        expires_at: null,
        token_type: 'bearer',
        scope: 'read:user user:email',
        id_token: null,
      } as Account;

      const mockUser = { id: '12345' };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockResolvedValue(mockUser),
          },
          account: {
            upsert: vi.fn().mockResolvedValue({ id: 'acc-123', userId: '12345' }),
          },
        };
        return callback(mockTx);
      });

      const result = await createOrUpdateUser(mockProfile, mockAccount);

      expect(result.id).toBe('12345');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('creates user with login as fallback name when name is null', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: null,
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_token123',
      } as Account;

      const mockUser = { id: '12345' };
      let capturedCreateData: any = null;

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockImplementation(({ create }) => {
              capturedCreateData = create;
              return Promise.resolve(mockUser);
            }),
          },
          account: {
            upsert: vi.fn().mockResolvedValue({ id: 'acc-123' }),
          },
        };
        return callback(mockTx);
      });

      await createOrUpdateUser(mockProfile, mockAccount);

      expect(capturedCreateData.name).toBe('alice');
    });

    it('wraps User and Account operations in transaction', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_token123',
      } as Account;

      const mockTx = {
        user: {
          upsert: vi.fn().mockResolvedValue({ id: '12345' }),
        },
        account: {
          upsert: vi.fn().mockResolvedValue({ id: 'acc-123' }),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await createOrUpdateUser(mockProfile, mockAccount);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.user.upsert).toHaveBeenCalled();
      expect(mockTx.account.upsert).toHaveBeenCalled();
    });
  });

  describe('createOrUpdateUser - transaction rollback', () => {
    it('throws error when transaction fails', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_token123',
      } as Account;

      (prisma.$transaction as any).mockRejectedValue(new Error('Database connection error'));

      await expect(createOrUpdateUser(mockProfile, mockAccount)).rejects.toThrow(
        'Database connection error'
      );
    });

    it('throws error when Account creation fails', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_token123',
      } as Account;

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockResolvedValue({ id: '12345' }),
          },
          account: {
            upsert: vi.fn().mockRejectedValue(new Error('Foreign key constraint failed')),
          },
        };
        return callback(mockTx);
      });

      await expect(createOrUpdateUser(mockProfile, mockAccount)).rejects.toThrow(
        'Foreign key constraint failed'
      );
    });

    it('throws error when User creation fails', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_token123',
      } as Account;

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockRejectedValue(new Error('Unique constraint violation')),
          },
          account: {
            upsert: vi.fn(),
          },
        };
        return callback(mockTx);
      });

      await expect(createOrUpdateUser(mockProfile, mockAccount)).rejects.toThrow(
        'Unique constraint violation'
      );
    });
  });
});
