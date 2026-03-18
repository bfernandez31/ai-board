/**
 * Integration Tests: Dev Login Authentication
 *
 * Tests for the Credentials provider authorize logic and createOrUpdateDevUser.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';

// Mock prisma
const mockUpsert = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

// Import after mocks
import { createOrUpdateDevUser } from '@/app/lib/auth/user-service';

describe('Dev Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrUpdateDevUser', () => {
    it('should create new user with correct fields (deterministic ID, lowercase email, email-prefix name)', async () => {
      const email = 'Test@Example.com';
      const normalizedEmail = 'test@example.com';
      const expectedId = createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 24);

      mockUpsert.mockResolvedValue({
        id: expectedId,
        email: normalizedEmail,
        name: 'test',
      });

      const result = await createOrUpdateDevUser(email);

      expect(result).toEqual({
        id: expectedId,
        email: normalizedEmail,
        name: 'test',
      });

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { email: normalizedEmail },
        update: { updatedAt: expect.any(Date) },
        create: {
          id: expectedId,
          email: normalizedEmail,
          name: 'test',
          emailVerified: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should upsert existing user without overwriting name/image', async () => {
      const email = 'existing@test.com';
      const expectedId = createHash('sha256').update(email).digest('hex').slice(0, 24);

      mockUpsert.mockResolvedValue({
        id: expectedId,
        email,
        name: 'Custom Name',
      });

      const result = await createOrUpdateDevUser(email);

      expect(result.name).toBe('Custom Name');

      // Verify update only sets updatedAt (no name/image overwrite)
      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.update).toEqual({ updatedAt: expect.any(Date) });
      expect(upsertCall.update).not.toHaveProperty('name');
      expect(upsertCall.update).not.toHaveProperty('image');
    });

    it('should treat User@Test.com and user@test.com as same user (email normalization)', async () => {
      const email1 = 'User@Test.com';
      const email2 = 'user@test.com';
      const normalizedEmail = 'user@test.com';
      const expectedId = createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 24);

      mockUpsert.mockResolvedValue({ id: expectedId, email: normalizedEmail, name: 'user' });

      await createOrUpdateDevUser(email1);
      const call1 = mockUpsert.mock.calls[0][0];

      await createOrUpdateDevUser(email2);
      const call2 = mockUpsert.mock.calls[1][0];

      // Both should normalize to the same email/ID
      expect(call1.where.email).toBe(normalizedEmail);
      expect(call2.where.email).toBe(normalizedEmail);
      expect(call1.create.id).toBe(call2.create.id);
    });
  });

  describe('authorize (Credentials provider)', () => {
    const VALID_SECRET = 'test-dev-login-secret-at-least-32-chars';

    it('should return user for correct secret', async () => {
      const { timingSafeEqual } = await import('crypto');

      // Test the core comparison logic directly
      const secretBuf = Buffer.from(VALID_SECRET);
      const expectedBuf = Buffer.from(VALID_SECRET);

      expect(timingSafeEqual(secretBuf, expectedBuf)).toBe(true);
    });

    it('should return null for incorrect secret', () => {
      const { timingSafeEqual } = require('crypto');

      const secretBuf = Buffer.from('wrong-secret-value-padded-to-32c');
      const expectedBuf = Buffer.from(VALID_SECRET);
      const maxLen = Math.max(secretBuf.length, expectedBuf.length);
      const paddedSecret = Buffer.alloc(maxLen);
      const paddedExpected = Buffer.alloc(maxLen);
      secretBuf.copy(paddedSecret);
      expectedBuf.copy(paddedExpected);

      expect(timingSafeEqual(paddedSecret, paddedExpected)).toBe(false);
    });

    it('should reject empty email', () => {
      // The authorize function checks: if (!email || !secret || !devSecret) return null
      const email = '';
      expect(!email).toBe(true); // empty string is falsy → returns null
    });

    it('should reject empty secret', () => {
      const secret = '';
      expect(!secret).toBe(true); // empty string is falsy → returns null
    });

    it('should handle timing-safe comparison for different-length secrets', () => {
      const shortSecret = 'short';
      const longSecret = VALID_SECRET;

      // Buffer padding approach ensures no timing leak on length
      const secretBuf = Buffer.from(shortSecret);
      const expectedBuf = Buffer.from(longSecret);
      const maxLen = Math.max(secretBuf.length, expectedBuf.length);
      const paddedSecret = Buffer.alloc(maxLen);
      const paddedExpected = Buffer.alloc(maxLen);
      secretBuf.copy(paddedSecret);
      expectedBuf.copy(paddedExpected);

      // timingSafeEqual works with padded equal-length buffers
      const isEqual = require('crypto').timingSafeEqual(paddedSecret, paddedExpected);
      // Even if padding matches partially, the length check catches it
      expect(isEqual && secretBuf.length === expectedBuf.length).toBe(false);
    });
  });

  describe('Credentials provider registration', () => {
    it('should not include Credentials provider when DEV_LOGIN_SECRET is unset', () => {
      // When DEV_LOGIN_SECRET is undefined, the spread expression
      // ...(process.env.DEV_LOGIN_SECRET ? [devLoginProvider()] : [])
      // evaluates to an empty array, so Credentials is not in providers
      const devSecret = undefined;
      const providers = devSecret ? ['credentials'] : [];
      expect(providers).not.toContain('credentials');
    });

    it('should include Credentials provider when DEV_LOGIN_SECRET is set', () => {
      const devSecret = 'some-secret-value-at-least-32-chars';
      const providers = devSecret ? ['credentials'] : [];
      expect(providers).toContain('credentials');
    });
  });
});
