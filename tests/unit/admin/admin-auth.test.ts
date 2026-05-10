import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';
import {
  getAdminAllowlistEmails,
  isAdminEmail,
  requireAdmin,
  AdminAccessDenied,
} from '@/lib/admin/admin-auth';

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe('getAdminAllowlistEmails', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns empty Set when env unset', () => {
    vi.stubEnv('ADMIN_ALLOWLIST_EMAILS', '');
    expect(getAdminAllowlistEmails().size).toBe(0);
  });

  it('returns empty Set when env is whitespace-only', () => {
    vi.stubEnv('ADMIN_ALLOWLIST_EMAILS', '   ,  , ');
    expect(getAdminAllowlistEmails().size).toBe(0);
  });

  it('parses comma-separated trimmed lower-cased entries', () => {
    vi.stubEnv('ADMIN_ALLOWLIST_EMAILS', '  Alice@Example.COM , bob@example.com ');
    const set = getAdminAllowlistEmails();
    expect(set.has('alice@example.com')).toBe(true);
    expect(set.has('bob@example.com')).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe('isAdminEmail', () => {
  it('returns false for null/undefined', () => {
    expect(isAdminEmail(null, new Set(['a@example.com']))).toBe(false);
    expect(isAdminEmail(undefined, new Set(['a@example.com']))).toBe(false);
  });

  it('matches case-insensitively', () => {
    const set = new Set(['alice@example.com']);
    expect(isAdminEmail('Alice@Example.com', set)).toBe(true);
  });

  it('matches with surrounding whitespace', () => {
    const set = new Set(['alice@example.com']);
    expect(isAdminEmail('  alice@example.com  ', set)).toBe(true);
  });

  it('rejects non-allowlisted emails', () => {
    const set = new Set(['alice@example.com']);
    expect(isAdminEmail('eve@example.com', set)).toBe(false);
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_ALLOWLIST_EMAILS', 'alice@example.com');
    mockedAuth.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws AdminAccessDenied when no session', async () => {
    mockedAuth.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessDenied);
  });

  it('throws AdminAccessDenied when session lacks email', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } });
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessDenied);
  });

  it('throws AdminAccessDenied for non-allowlisted email', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', email: 'eve@example.com' } });
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessDenied);
  });

  it('returns user when allowlisted', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: 'u1', email: 'alice@example.com' },
    });
    await expect(requireAdmin()).resolves.toEqual({
      id: 'u1',
      email: 'alice@example.com',
    });
  });

  it('matches allowlist case-insensitively', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: 'u1', email: 'Alice@Example.COM' },
    });
    await expect(requireAdmin()).resolves.toEqual({
      id: 'u1',
      email: 'Alice@Example.COM',
    });
  });
});
