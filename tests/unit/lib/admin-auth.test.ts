import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { verifyAdminAccess } from '@/lib/db/admin-auth';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';

const mockRequireAuth = vi.mocked(requireAuth);
const mockFindUnique = vi.mocked(prisma.user.findUnique);

describe('verifyAdminAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ADMIN_EMAILS;
  });

  it('returns user info when email is on the allowlist', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com, other@example.com';
    mockRequireAuth.mockResolvedValue('user-1');
    mockFindUnique.mockResolvedValue({ email: 'admin@example.com' } as never);

    const result = await verifyAdminAccess();
    expect(result).toEqual({ userId: 'user-1', email: 'admin@example.com' });
  });

  it('throws "Not found" when email is NOT on the allowlist', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    mockRequireAuth.mockResolvedValue('user-2');
    mockFindUnique.mockResolvedValue({ email: 'nobody@example.com' } as never);

    await expect(verifyAdminAccess()).rejects.toThrow('Not found');
  });

  it('throws "Not found" when ADMIN_EMAILS is empty (fail-closed)', async () => {
    process.env.ADMIN_EMAILS = '';
    mockRequireAuth.mockResolvedValue('user-1');
    mockFindUnique.mockResolvedValue({ email: 'admin@example.com' } as never);

    await expect(verifyAdminAccess()).rejects.toThrow('Not found');
  });

  it('throws "Not found" when ADMIN_EMAILS is missing (fail-closed)', async () => {
    mockRequireAuth.mockResolvedValue('user-1');
    mockFindUnique.mockResolvedValue({ email: 'admin@example.com' } as never);

    await expect(verifyAdminAccess()).rejects.toThrow('Not found');
  });

  it('matches emails case-insensitively', async () => {
    process.env.ADMIN_EMAILS = 'ADMIN@EXAMPLE.COM';
    mockRequireAuth.mockResolvedValue('user-1');
    mockFindUnique.mockResolvedValue({ email: 'admin@example.com' } as never);

    const result = await verifyAdminAccess();
    expect(result).toEqual({ userId: 'user-1', email: 'admin@example.com' });
  });

  it('trims whitespace in env var parsing', async () => {
    process.env.ADMIN_EMAILS = '  admin@example.com  ,  other@test.com  ';
    mockRequireAuth.mockResolvedValue('user-1');
    mockFindUnique.mockResolvedValue({ email: 'admin@example.com' } as never);

    const result = await verifyAdminAccess();
    expect(result).toEqual({ userId: 'user-1', email: 'admin@example.com' });
  });

  it('throws "Not found" when user is not found in DB', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    mockRequireAuth.mockResolvedValue('user-1');
    mockFindUnique.mockResolvedValue(null);

    await expect(verifyAdminAccess()).rejects.toThrow('Not found');
  });
});
