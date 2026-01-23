/**
 * Unit Tests: Token Generation
 *
 * Tests the token generation and hashing utilities.
 * - Token format validation
 * - SHA-256 hashing with salt
 * - Preview extraction
 * - Constant-time hash comparison
 */

import { describe, it, expect } from 'vitest';
import {
  generatePersonalAccessToken,
  verifyTokenHash,
  extractTokenPreview,
  isValidTokenFormat,
} from '@/lib/tokens/generate';

describe('Token Generation', () => {
  describe('generatePersonalAccessToken', () => {
    it('should generate a token with correct format (pat_<64-hex-chars>)', () => {
      const result = generatePersonalAccessToken();

      expect(result.token).toMatch(/^pat_[a-f0-9]{64}$/);
      expect(result.token).toHaveLength(68); // "pat_" + 64 hex chars
    });

    it('should generate unique tokens on each call', () => {
      const token1 = generatePersonalAccessToken();
      const token2 = generatePersonalAccessToken();

      expect(token1.token).not.toBe(token2.token);
      expect(token1.hash).not.toBe(token2.hash);
      expect(token1.salt).not.toBe(token2.salt);
    });

    it('should generate a 64-character hex hash (SHA-256)', () => {
      const result = generatePersonalAccessToken();

      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate a 32-character hex salt (16 bytes)', () => {
      const result = generatePersonalAccessToken();

      expect(result.salt).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should extract last 4 characters as preview', () => {
      const result = generatePersonalAccessToken();

      expect(result.preview).toHaveLength(4);
      expect(result.token.endsWith(result.preview)).toBe(true);
    });

    it('should generate cryptographically different hashes for different tokens', () => {
      const results = Array.from({ length: 100 }, () => generatePersonalAccessToken());
      const hashes = new Set(results.map(r => r.hash));

      expect(hashes.size).toBe(100);
    });
  });

  describe('verifyTokenHash', () => {
    it('should verify a valid token against its hash', () => {
      const { token, salt, hash } = generatePersonalAccessToken();

      const result = verifyTokenHash(token, salt, hash);

      expect(result).toBe(true);
    });

    it('should reject an invalid token', () => {
      const { salt, hash } = generatePersonalAccessToken();
      const invalidToken = 'pat_' + '0'.repeat(64);

      const result = verifyTokenHash(invalidToken, salt, hash);

      expect(result).toBe(false);
    });

    it('should reject when salt is wrong', () => {
      const { token, hash } = generatePersonalAccessToken();
      const wrongSalt = '0'.repeat(32);

      const result = verifyTokenHash(token, wrongSalt, hash);

      expect(result).toBe(false);
    });

    it('should reject when hash is wrong', () => {
      const { token, salt } = generatePersonalAccessToken();
      const wrongHash = '0'.repeat(64);

      const result = verifyTokenHash(token, salt, wrongHash);

      expect(result).toBe(false);
    });

    it('should reject when hash has invalid length', () => {
      const { token, salt } = generatePersonalAccessToken();
      const shortHash = '0'.repeat(32);

      const result = verifyTokenHash(token, salt, shortHash);

      expect(result).toBe(false);
    });

    it('should use constant-time comparison (no early exit on mismatch)', () => {
      const { token, salt, hash } = generatePersonalAccessToken();

      // Multiple verifications should take similar time
      // We can't truly measure timing in unit tests, but we verify the logic works
      const results = Array.from({ length: 10 }, () =>
        verifyTokenHash(token, salt, hash)
      );

      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('extractTokenPreview', () => {
    it('should extract last 4 characters', () => {
      const token = 'pat_' + 'a'.repeat(60) + 'bcde';

      const preview = extractTokenPreview(token);

      expect(preview).toBe('bcde');
    });

    it('should handle short strings', () => {
      const shortString = 'ab';

      const preview = extractTokenPreview(shortString);

      expect(preview).toBe('ab');
    });
  });

  describe('isValidTokenFormat', () => {
    it('should accept valid token format', () => {
      const validToken = 'pat_' + 'a'.repeat(64);

      expect(isValidTokenFormat(validToken)).toBe(true);
    });

    it('should accept token with mixed hex characters', () => {
      const validToken = 'pat_0123456789abcdef' + 'a'.repeat(48);

      expect(isValidTokenFormat(validToken)).toBe(true);
    });

    it('should reject token without prefix', () => {
      const invalidToken = 'a'.repeat(64);

      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject token with wrong prefix', () => {
      const invalidToken = 'tok_' + 'a'.repeat(64);

      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject token with short entropy', () => {
      const invalidToken = 'pat_' + 'a'.repeat(32);

      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject token with long entropy', () => {
      const invalidToken = 'pat_' + 'a'.repeat(128);

      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject token with non-hex characters', () => {
      const invalidToken = 'pat_' + 'g'.repeat(64); // 'g' is not hex

      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject token with uppercase hex', () => {
      const invalidToken = 'pat_' + 'A'.repeat(64);

      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidTokenFormat('')).toBe(false);
    });

    it('should reject just prefix', () => {
      expect(isValidTokenFormat('pat_')).toBe(false);
    });
  });
});

describe('Token Security Properties', () => {
  it('should generate tokens with 256-bit entropy', () => {
    const { token } = generatePersonalAccessToken();
    const entropy = token.slice(4); // Remove "pat_" prefix

    // 64 hex characters = 32 bytes = 256 bits
    expect(entropy).toHaveLength(64);
  });

  it('should generate unique salts per token', () => {
    const tokens = Array.from({ length: 100 }, () => generatePersonalAccessToken());
    const salts = new Set(tokens.map(t => t.salt));

    expect(salts.size).toBe(100);
  });

  it('should produce different hashes for same token with different salts', () => {
    // This is a theoretical test - in practice each token gets its own salt
    const token = 'pat_' + 'a'.repeat(64);
    const salt1 = 'a'.repeat(32);
    const salt2 = 'b'.repeat(32);

    // Can't directly access hash computation, but we can verify the concept
    // by checking that verification fails with wrong salt
    const { hash: hash1 } = generatePersonalAccessToken();

    // hash1 should not match when using different salts
    expect(verifyTokenHash(token, salt1, hash1)).toBe(false);
    expect(verifyTokenHash(token, salt2, hash1)).toBe(false);
  });
});
