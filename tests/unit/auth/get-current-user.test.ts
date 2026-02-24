import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('@/lib/tokens/validate', () => ({
  extractBearerToken: vi.fn(),
  validateToken: vi.fn(),
}));

import { getCurrentUser } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

describe('getCurrentUser - x-test-user-id security guard', () => {
  const mockHeadersMap = new Map<string, string>();
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeadersMap.clear();
    originalNodeEnv = process.env.NODE_ENV;
    (headers as any).mockResolvedValue({
      get: (key: string) => mockHeadersMap.get(key) ?? null,
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('accepts x-test-user-id header in test environment', async () => {
    process.env.NODE_ENV = 'test';
    mockHeadersMap.set('x-test-user-id', 'test-user-id');

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'test-user-id',
      email: 'test@e2e.local',
      name: 'Test User',
    });

    const user = await getCurrentUser();

    expect(user.id).toBe('test-user-id');
    expect(user.email).toBe('test@e2e.local');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'test-user-id' },
    });
    expect(auth).not.toHaveBeenCalled();
  });

  it('accepts x-test-user-id header in development environment', async () => {
    process.env.NODE_ENV = 'development';
    mockHeadersMap.set('x-test-user-id', 'dev-user-id');

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'dev-user-id',
      email: 'dev@local.test',
      name: 'Dev User',
    });

    const user = await getCurrentUser();

    expect(user.id).toBe('dev-user-id');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'dev-user-id' },
    });
    expect(auth).not.toHaveBeenCalled();
  });

  it('ignores x-test-user-id header in production environment', async () => {
    process.env.NODE_ENV = 'production';
    mockHeadersMap.set('x-test-user-id', 'attacker-supplied-id');

    (auth as any).mockResolvedValue({
      user: { id: 'real-session-user', email: 'legit@example.com', name: 'Legit User' },
    });

    const user = await getCurrentUser();

    // Should use session auth, NOT the header
    expect(user.id).toBe('real-session-user');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(auth).toHaveBeenCalled();
  });

  it('throws Unauthorized when x-test-user-id is sent in production with no session', async () => {
    process.env.NODE_ENV = 'production';
    mockHeadersMap.set('x-test-user-id', 'attacker-supplied-id');

    (auth as any).mockResolvedValue(null);

    await expect(getCurrentUser()).rejects.toThrow('Unauthorized');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('falls through to session auth when no test header is present', async () => {
    process.env.NODE_ENV = 'test';
    // No x-test-user-id header set

    (auth as any).mockResolvedValue({
      user: { id: 'session-user', email: 'user@example.com', name: 'Session User' },
    });

    const user = await getCurrentUser();

    expect(user.id).toBe('session-user');
    expect(auth).toHaveBeenCalled();
  });

  it('throws Unauthorized when no header and no valid session', async () => {
    process.env.NODE_ENV = 'test';
    // No header, no session

    (auth as any).mockResolvedValue(null);

    await expect(getCurrentUser()).rejects.toThrow('Unauthorized');
  });

  it('falls through to session when test header user not found in DB', async () => {
    process.env.NODE_ENV = 'test';
    mockHeadersMap.set('x-test-user-id', 'nonexistent-user');

    (prisma.user.findUnique as any).mockResolvedValue(null);
    (auth as any).mockResolvedValue({
      user: { id: 'session-user', email: 'user@example.com', name: 'Session User' },
    });

    const user = await getCurrentUser();

    expect(user.id).toBe('session-user');
    expect(auth).toHaveBeenCalled();
  });
});
