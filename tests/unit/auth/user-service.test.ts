import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createOrUpdateUser,
  createOrUpdateDevUser,
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

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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
      let capturedCreateData: Record<string, unknown> | null = null;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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

      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database connection error'));

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

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
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

  // User Story 2: Returning User Sign-In Tests
  describe('createOrUpdateUser - existing user scenario', () => {
    it('returns the correct database user ID (not GitHub ID) for existing users', async () => {
      const mockProfile: GitHubProfile = {
        id: 99999, // GitHub ID changed
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '99999',
        access_token: 'token',
      } as Account;

      // Database user has DIFFERENT ID than GitHub ID
      const mockUser = { id: 'database-user-id-12345' };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockResolvedValue(mockUser),
          },
          account: {
            upsert: vi.fn().mockResolvedValue({ id: 'acc-123' }),
          },
        };
        return callback(mockTx);
      });

      const result = await createOrUpdateUser(mockProfile, mockAccount);

      // Should return the DATABASE user ID, not GitHub ID
      expect(result.id).toBe('database-user-id-12345');
      expect(result.id).not.toBe('99999');
    });

    it('updates existing user on return sign-in', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice Updated',
        login: 'alice',
        avatar_url: 'https://github.com/alice-new.png',
        email_verified: true,
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_newtoken456',
        refresh_token: 'ghr_refresh789',
        expires_at: 1234567890,
        token_type: 'bearer',
        scope: 'read:user user:email',
      } as Account;

      const mockUser = { id: '12345', email: 'alice@github.com' };
      let capturedUpdateData: Record<string, unknown> | null = null;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockImplementation(({ update }) => {
              capturedUpdateData = update;
              return Promise.resolve(mockUser);
            }),
          },
          account: {
            upsert: vi.fn().mockResolvedValue({ id: 'acc-123', userId: '12345' }),
          },
        };
        return callback(mockTx);
      });

      const result = await createOrUpdateUser(mockProfile, mockAccount);

      expect(result.id).toBe('12345');
      expect(capturedUpdateData).toBeDefined();
      expect(capturedUpdateData.name).toBe('Alice Updated');
      expect(capturedUpdateData.image).toBe('https://github.com/alice-new.png');
    });

    it('updates User name and image when changed on GitHub', async () => {
      const mockProfile: GitHubProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice Anderson',
        login: 'alice',
        avatar_url: 'https://github.com/alice-professional.png',
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'gho_token123',
      } as Account;

      const mockUser = { id: '12345' };
      let capturedUpdateData: Record<string, unknown> | null = null;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockImplementation(({ update }) => {
              capturedUpdateData = update;
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

      expect(capturedUpdateData.name).toBe('Alice Anderson');
      expect(capturedUpdateData.image).toBe('https://github.com/alice-professional.png');
    });

    it('updates Account access token and refresh token', async () => {
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
        access_token: 'gho_newtoken999',
        refresh_token: 'ghr_newrefresh111',
        expires_at: 9876543210,
        token_type: 'bearer',
        scope: 'read:user user:email repo',
      } as Account;

      const mockUser = { id: '12345' };
      let capturedAccountUpdate: Record<string, unknown> | null = null;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          user: {
            upsert: vi.fn().mockResolvedValue(mockUser),
          },
          account: {
            upsert: vi.fn().mockImplementation(({ update }) => {
              capturedAccountUpdate = update;
              return Promise.resolve({ id: 'acc-123', userId: '12345' });
            }),
          },
        };
        return callback(mockTx);
      });

      await createOrUpdateUser(mockProfile, mockAccount);

      expect(capturedAccountUpdate).toBeDefined();
      expect(capturedAccountUpdate.access_token).toBe('gho_newtoken999');
      expect(capturedAccountUpdate.refresh_token).toBe('ghr_newrefresh111');
      expect(capturedAccountUpdate.expires_at).toBe(9876543210);
    });
  });

  describe('createOrUpdateDevUser', () => {
    it('creates a new dev user with deterministic ID from email', async () => {
      const mockUser = { id: 'dev-user-abc123' };
      const mockUpsert = vi.fn().mockResolvedValue(mockUser);

      (prisma as Record<string, unknown>).user = { upsert: mockUpsert };

      const result = await createOrUpdateDevUser('dev@example.com');

      expect(result.id).toBe('dev-user-abc123');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'dev@example.com' },
          create: expect.objectContaining({
            email: 'dev@example.com',
            name: 'dev',
          }),
        }),
      );
    });

    it('generates consistent ID for same email', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ id: 'consistent-id' });
      (prisma as Record<string, unknown>).user = { upsert: mockUpsert };

      await createOrUpdateDevUser('test@example.com');
      const firstCallArgs = mockUpsert.mock.calls[0][0];

      await createOrUpdateDevUser('test@example.com');
      const secondCallArgs = mockUpsert.mock.calls[1][0];

      expect(firstCallArgs.create.id).toBe(secondCallArgs.create.id);
    });

    it('uses email prefix as display name', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ id: 'user-id' });
      (prisma as Record<string, unknown>).user = { upsert: mockUpsert };

      await createOrUpdateDevUser('alice@company.com');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            name: 'alice',
          }),
        }),
      );
    });
  });
});
