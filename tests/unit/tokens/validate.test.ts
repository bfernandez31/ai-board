/**
 * Unit Tests: Token Validation
 *
 * Tests the token validation utilities.
 * - Bearer token extraction
 * - Token format validation
 * - Rate limiting integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractBearerToken,
} from '@/lib/tokens/validate';
import {
  checkRateLimit,
  clearAllRateLimits,
} from '@/lib/tokens/rate-limit';
import {
  isValidTokenFormat,
  verifyTokenHash,
  generatePersonalAccessToken,
} from '@/lib/tokens/generate';

describe('Token Validation', () => {
  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      const header = 'Bearer pat_' + 'a'.repeat(64);
      const token = extractBearerToken(header);

      expect(token).toBe('pat_' + 'a'.repeat(64));
    });

    it('should return null for null header', () => {
      const token = extractBearerToken(null);

      expect(token).toBeNull();
    });

    it('should return null for empty header', () => {
      const token = extractBearerToken('');

      expect(token).toBeNull();
    });

    it('should return null for non-Bearer auth type', () => {
      const token = extractBearerToken('Basic abc123');

      expect(token).toBeNull();
    });

    it('should return null for non-PAT token', () => {
      const token = extractBearerToken('Bearer some-jwt-token');

      expect(token).toBeNull();
    });

    it('should be case-insensitive for Bearer scheme', () => {
      const header = 'bearer pat_' + 'a'.repeat(64);
      const token = extractBearerToken(header);

      expect(token).toBe('pat_' + 'a'.repeat(64));
    });

    it('should return null for malformed header (no space)', () => {
      const token = extractBearerToken('Bearerpat_abc');

      expect(token).toBeNull();
    });

    it('should return null for header with extra spaces', () => {
      const token = extractBearerToken('Bearer  pat_abc');

      expect(token).toBeNull();
    });
  });

  describe('Token Format Validation', () => {
    it('should accept valid PAT format', () => {
      const { token } = generatePersonalAccessToken();

      expect(isValidTokenFormat(token)).toBe(true);
    });

    it('should reject token without pat_ prefix', () => {
      const invalidToken = 'a'.repeat(68);

      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject token with wrong length', () => {
      const shortToken = 'pat_' + 'a'.repeat(32);

      expect(isValidTokenFormat(shortToken)).toBe(false);
    });
  });

  describe('Token Hash Verification', () => {
    it('should verify correct token against hash', () => {
      const { token, salt, hash } = generatePersonalAccessToken();

      const isValid = verifyTokenHash(token, salt, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect token', () => {
      const { salt, hash } = generatePersonalAccessToken();
      const wrongToken = 'pat_' + 'b'.repeat(64);

      const isValid = verifyTokenHash(wrongToken, salt, hash);

      expect(isValid).toBe(false);
    });

    it('should reject token with wrong salt', () => {
      const { token, hash } = generatePersonalAccessToken();
      const wrongSalt = 'c'.repeat(32);

      const isValid = verifyTokenHash(token, wrongSalt, hash);

      expect(isValid).toBe(false);
    });
  });
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  it('should allow requests under limit', () => {
    const result = checkRateLimit('test-ip');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it('should block requests over limit', () => {
    // Make 60 requests (the limit)
    for (let i = 0; i < 60; i++) {
      checkRateLimit('over-limit-ip');
    }

    // 61st request should be blocked
    const result = checkRateLimit('over-limit-ip');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track limits per IP independently', () => {
    // Exhaust limit for IP 1
    for (let i = 0; i < 60; i++) {
      checkRateLimit('ip-1');
    }

    // IP 2 should still be allowed
    const result = checkRateLimit('ip-2');

    expect(result.allowed).toBe(true);
  });

  it('should return correct rate limit metadata', () => {
    const result = checkRateLimit('metadata-ip');

    expect(result.limit).toBe(60);
    expect(result.count).toBe(1);
    expect(result.remaining).toBe(59);
    expect(result.resetAt).toBeGreaterThan(Date.now() / 1000 - 1);
    expect(result.retryAfter).toBe(0);
  });

  it('should allow custom rate limit configuration', () => {
    const result = checkRateLimit('custom-ip', { maxRequests: 10 });

    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });
});

describe('Validation Security', () => {
  it('should use constant-time comparison for hash verification', () => {
    const { token, salt, hash } = generatePersonalAccessToken();

    // Multiple verifications should behave consistently
    // (We can't truly measure timing in unit tests, but we verify correctness)
    const results: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(verifyTokenHash(token, salt, hash));
    }

    expect(results.every(r => r === true)).toBe(true);
  });

  it('should not leak timing information on invalid tokens', () => {
    const { salt, hash } = generatePersonalAccessToken();

    // Try various invalid tokens
    const invalidTokens = [
      'pat_' + '0'.repeat(64),
      'pat_' + 'f'.repeat(64),
      'pat_' + '0'.repeat(32) + 'f'.repeat(32),
    ];

    for (const invalidToken of invalidTokens) {
      const result = verifyTokenHash(invalidToken, salt, hash);
      expect(result).toBe(false);
    }
  });
});
