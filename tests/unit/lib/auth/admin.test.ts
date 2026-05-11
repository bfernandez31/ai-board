import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAdminAllowlist, isUserAdmin } from '@/app/lib/auth/admin';

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
});
