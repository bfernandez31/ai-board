import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getAdminAllowlist,
  isAdminEmail,
} from '@/lib/auth/admin';

const ENV_VAR = 'ADMIN_USER_EMAILS';

describe('admin allowlist helpers', () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    delete process.env[ENV_VAR];
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
  });

  describe('getAdminAllowlist', () => {
    it('returns an empty array when the env var is unset', () => {
      expect(getAdminAllowlist()).toEqual([]);
    });

    it('returns an empty array when the env var is blank', () => {
      process.env[ENV_VAR] = '   ';
      expect(getAdminAllowlist()).toEqual([]);
    });

    it('splits comma-separated emails, trims, lowercases and dedupes', () => {
      process.env[ENV_VAR] = ' Alice@example.com,bob@Example.com , alice@example.com ';
      expect(getAdminAllowlist()).toEqual([
        'alice@example.com',
        'bob@example.com',
      ]);
    });
  });

  describe('isAdminEmail', () => {
    it('returns false when the allowlist is empty', () => {
      expect(isAdminEmail('alice@example.com')).toBe(false);
    });

    it('returns false for null or undefined email', () => {
      process.env[ENV_VAR] = 'alice@example.com';
      expect(isAdminEmail(null)).toBe(false);
      expect(isAdminEmail(undefined)).toBe(false);
      expect(isAdminEmail('')).toBe(false);
    });

    it('matches allowlist entries case-insensitively', () => {
      process.env[ENV_VAR] = 'alice@example.com';
      expect(isAdminEmail('ALICE@example.com')).toBe(true);
      expect(isAdminEmail('alice@example.com')).toBe(true);
    });

    it('returns false when the email is not on the allowlist', () => {
      process.env[ENV_VAR] = 'alice@example.com';
      expect(isAdminEmail('bob@example.com')).toBe(false);
    });
  });
});
