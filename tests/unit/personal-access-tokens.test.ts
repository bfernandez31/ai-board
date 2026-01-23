/**
 * Unit Test: Personal Access Token Functions
 *
 * Tests for token generation, hashing, and validation logic.
 */

import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from '@/lib/db/personal-access-tokens';

describe('Personal Access Token Generation', () => {
  describe('generateToken', () => {
    it('should generate a token with pat_ prefix', () => {
      const { plainToken } = generateToken();
      expect(plainToken.startsWith('pat_')).toBe(true);
    });

    it('should generate a token with at least 64 characters after prefix', () => {
      const { plainToken } = generateToken();
      const tokenPart = plainToken.slice(4); // Remove "pat_"
      expect(tokenPart.length).toBeGreaterThanOrEqual(64);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { plainToken } = generateToken();
        tokens.add(plainToken);
      }
      expect(tokens.size).toBe(100);
    });

    it('should return tokenHash as SHA-256 hex string', () => {
      const { tokenHash } = generateToken();
      expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return tokenPreview with last 4 characters', () => {
      const { plainToken, tokenPreview } = generateToken();
      const tokenPart = plainToken.slice(4); // Remove "pat_"
      expect(tokenPreview).toBe(`...${tokenPart.slice(-4)}`);
    });
  });

  describe('hashToken', () => {
    it('should produce consistent hash for same input', () => {
      const token = 'pat_test123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('pat_token1');
      const hash2 = hashToken('pat_token2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex string', () => {
      const hash = hashToken('pat_anytoken');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

describe('Token Format Validation', () => {
  it('should generate tokens that match expected format', () => {
    const { plainToken } = generateToken();
    // Format: pat_ + 64 hex chars = 68 total
    expect(plainToken).toMatch(/^pat_[a-f0-9]{64}$/);
  });
});
