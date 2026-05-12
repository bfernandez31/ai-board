import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { getAdminAllowlist, isUserAdmin, getViewerIsAdmin } from '@/app/lib/auth/admin';
import * as usersDb from '@/lib/db/users';

describe('admin auth helpers (AIB-791)', () => {
  const originalAllowlist = process.env.ADMIN_ALLOWLIST;

  beforeEach(() => {
    delete process.env.ADMIN_ALLOWLIST;
  });

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.ADMIN_ALLOWLIST;
    } else {
      process.env.ADMIN_ALLOWLIST = originalAllowlist;
    }
  });

  describe('getAdminAllowlist', () => {
    it('returns empty array when ADMIN_ALLOWLIST is unset', () => {
      expect(getAdminAllowlist()).toEqual([]);
    });

    it('returns empty array when ADMIN_ALLOWLIST is empty string', () => {
      process.env.ADMIN_ALLOWLIST = '';
      expect(getAdminAllowlist()).toEqual([]);
    });

    it('parses comma-separated, trimmed, lowercased entries', () => {
      process.env.ADMIN_ALLOWLIST = ' Alice@example.com , BOB@example.com ';
      expect(getAdminAllowlist()).toEqual([
        'alice@example.com',
        'bob@example.com',
      ]);
    });

    it('filters empty entries', () => {
      process.env.ADMIN_ALLOWLIST = 'a@a.com,, ,b@b.com';
      expect(getAdminAllowlist()).toEqual(['a@a.com', 'b@b.com']);
    });

    it('re-reads env on every call (SC-009 — no module-level caching)', () => {
      process.env.ADMIN_ALLOWLIST = 'first@example.com';
      expect(getAdminAllowlist()).toEqual(['first@example.com']);

      process.env.ADMIN_ALLOWLIST = 'second@example.com';
      expect(getAdminAllowlist()).toEqual(['second@example.com']);

      delete process.env.ADMIN_ALLOWLIST;
      expect(getAdminAllowlist()).toEqual([]);
    });
  });

  describe('isUserAdmin', () => {
    it('returns false for null', () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      expect(isUserAdmin(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      expect(isUserAdmin(undefined)).toBe(false);
    });

    it('returns false when allowlist is empty', () => {
      process.env.ADMIN_ALLOWLIST = '';
      expect(isUserAdmin('alice@example.com')).toBe(false);
    });

    it('matches case-insensitively', () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      expect(isUserAdmin('ALICE@example.com')).toBe(true);
      expect(isUserAdmin('Alice@Example.com')).toBe(true);
    });

    it('applies trimming to caller email', () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      expect(isUserAdmin('  alice@example.com  ')).toBe(true);
    });

    it('returns false for non-matching email', () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      expect(isUserAdmin('mallory@example.com')).toBe(false);
    });

    it('honors fresh env reads (SC-009)', () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      expect(isUserAdmin('alice@example.com')).toBe(true);

      process.env.ADMIN_ALLOWLIST = 'bob@example.com';
      expect(isUserAdmin('alice@example.com')).toBe(false);
      expect(isUserAdmin('bob@example.com')).toBe(true);
    });
  });

  describe('getViewerIsAdmin (AIB-796)', () => {
    const request = {} as unknown as NextRequest;
    let spy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      spy?.mockRestore();
    });

    it('returns true for an allowlisted email', async () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      spy = vi
        .spyOn(usersDb, 'getCurrentUserOrNull')
        .mockResolvedValue({ email: 'alice@example.com' } as never);

      expect(await getViewerIsAdmin(request)).toBe(true);
    });

    it('returns false for a non-allowlisted email', async () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      spy = vi
        .spyOn(usersDb, 'getCurrentUserOrNull')
        .mockResolvedValue({ email: 'mallory@example.com' } as never);

      expect(await getViewerIsAdmin(request)).toBe(false);
    });

    it('returns false for an anonymous (null) viewer', async () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      spy = vi
        .spyOn(usersDb, 'getCurrentUserOrNull')
        .mockResolvedValue(null);

      expect(await getViewerIsAdmin(request)).toBe(false);
    });

    it('returns false when the session resolver throws', async () => {
      process.env.ADMIN_ALLOWLIST = 'alice@example.com';
      spy = vi
        .spyOn(usersDb, 'getCurrentUserOrNull')
        .mockRejectedValue(new Error('boom'));

      expect(await getViewerIsAdmin(request)).toBe(false);
    });

    it('returns false when ADMIN_ALLOWLIST is empty', async () => {
      delete process.env.ADMIN_ALLOWLIST;
      spy = vi
        .spyOn(usersDb, 'getCurrentUserOrNull')
        .mockResolvedValue({ email: 'alice@example.com' } as never);

      expect(await getViewerIsAdmin(request)).toBe(false);
    });
  });
});
