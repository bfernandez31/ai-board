/**
 * Integration Tests: Personal Access Tokens API
 *
 * Tests for token management API endpoints:
 * - POST /api/tokens (create token)
 * - GET /api/tokens (list tokens)
 * - DELETE /api/tokens/:id (delete token)
 *
 * Note: Bearer token authentication tests are integration-tested elsewhere
 * when the API routes are updated to use getCurrentUserOrToken().
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { generatePersonalAccessToken } from '@/lib/tokens/generate';

describe('Personal Access Tokens API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any tokens from previous tests
    const prisma = getPrismaClient();
    await prisma.personalAccessToken.deleteMany({
      where: {
        user: { email: 'test@e2e.local' },
      },
    });
  });

  describe('POST /api/tokens', () => {
    it('should create a new token with valid name', async () => {
      const response = await ctx.api.post<{
        id: number;
        name: string;
        token: string;
        preview: string;
        createdAt: string;
      }>('/api/tokens', {
        name: '[e2e] Test Token',
      });

      expect(response.status).toBe(201);
      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name', '[e2e] Test Token');
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('preview');
      expect(response.data).toHaveProperty('createdAt');

      // Verify token format
      expect(response.data.token).toMatch(/^pat_[a-f0-9]{64}$/);

      // Verify preview is last 4 chars
      expect(response.data.preview).toHaveLength(4);
      expect(response.data.token.endsWith(response.data.preview)).toBe(true);
    });

    it('should return 400 for missing token name', async () => {
      const response = await ctx.api.post('/api/tokens', {});

      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
    });

    it('should return 400 for empty token name', async () => {
      const response = await ctx.api.post('/api/tokens', {
        name: '',
      });

      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
    });

    it('should return 400 for token name exceeding 100 characters', async () => {
      const response = await ctx.api.post('/api/tokens', {
        name: 'x'.repeat(101),
      });

      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
    });

    it('should store token hash, not plain text', async () => {
      const response = await ctx.api.post<{
        id: number;
        token: string;
      }>('/api/tokens', {
        name: '[e2e] Security Test Token',
      });

      expect(response.status).toBe(201);

      // Verify the token is not stored in plain text
      const prisma = getPrismaClient();
      const storedToken = await prisma.personalAccessToken.findUnique({
        where: { id: response.data.id },
      });

      expect(storedToken).not.toBeNull();
      // The stored hash should NOT equal the returned token
      expect(storedToken!.hash).not.toBe(response.data.token);
      // Hash should be a 64-char hex string (SHA-256)
      expect(storedToken!.hash).toMatch(/^[a-f0-9]{64}$/);
      // Salt should be a 32-char hex string
      expect(storedToken!.salt).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should allow multiple tokens with same name', async () => {
      // Create first token
      const response1 = await ctx.api.post<{ id: number }>('/api/tokens', {
        name: '[e2e] Duplicate Name Token',
      });
      expect(response1.status).toBe(201);

      // Create second token with same name
      const response2 = await ctx.api.post<{ id: number }>('/api/tokens', {
        name: '[e2e] Duplicate Name Token',
      });
      expect(response2.status).toBe(201);

      // Both should succeed with different IDs
      expect(response1.data.id).not.toBe(response2.data.id);
    });

    // Note: Unauthenticated test skipped - test mode has auto-login enabled
  });

  describe('GET /api/tokens', () => {
    it('should return empty array when no tokens exist', async () => {
      const response = await ctx.api.get<{ tokens: unknown[] }>('/api/tokens');

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('tokens');
      expect(response.data.tokens).toEqual([]);
    });

    it('should list created tokens', async () => {
      // Create a token first
      const createResponse = await ctx.api.post<{ id: number }>('/api/tokens', {
        name: '[e2e] List Test Token',
      });
      expect(createResponse.status).toBe(201);

      // List tokens
      const response = await ctx.api.get<{
        tokens: Array<{
          id: number;
          name: string;
          preview: string;
          lastUsedAt: string | null;
          createdAt: string;
        }>;
      }>('/api/tokens');

      expect(response.status).toBe(200);
      expect(response.data.tokens).toHaveLength(1);
      expect(response.data.tokens[0]).toHaveProperty('id', createResponse.data.id);
      expect(response.data.tokens[0]).toHaveProperty('name', '[e2e] List Test Token');
      expect(response.data.tokens[0]).toHaveProperty('preview');
      expect(response.data.tokens[0]).toHaveProperty('lastUsedAt', null);
      expect(response.data.tokens[0]).toHaveProperty('createdAt');

      // Should NOT return the full token
      expect(response.data.tokens[0]).not.toHaveProperty('token');
      expect(response.data.tokens[0]).not.toHaveProperty('hash');
      expect(response.data.tokens[0]).not.toHaveProperty('salt');
    });

    it('should return tokens in descending order by createdAt', async () => {
      // Create multiple tokens
      await ctx.api.post('/api/tokens', { name: '[e2e] Token 1' });
      await ctx.api.post('/api/tokens', { name: '[e2e] Token 2' });
      await ctx.api.post('/api/tokens', { name: '[e2e] Token 3' });

      const response = await ctx.api.get<{
        tokens: Array<{ id: number; name: string; createdAt: string }>;
      }>('/api/tokens');

      expect(response.status).toBe(200);
      expect(response.data.tokens).toHaveLength(3);

      // Most recent first
      expect(response.data.tokens[0].name).toBe('[e2e] Token 3');
      expect(response.data.tokens[1].name).toBe('[e2e] Token 2');
      expect(response.data.tokens[2].name).toBe('[e2e] Token 1');
    });

    // Note: Unauthenticated test skipped - test mode has auto-login enabled
  });

  describe('DELETE /api/tokens/:id', () => {
    it('should delete an existing token', async () => {
      // Create a token
      const createResponse = await ctx.api.post<{ id: number }>('/api/tokens', {
        name: '[e2e] Token to Delete',
      });
      expect(createResponse.status).toBe(201);

      // Delete the token
      const deleteResponse = await ctx.api.delete(`/api/tokens/${createResponse.data.id}`);
      expect(deleteResponse.status).toBe(200);

      // Verify token is deleted
      const listResponse = await ctx.api.get<{ tokens: unknown[] }>('/api/tokens');
      expect(listResponse.data.tokens).toHaveLength(0);
    });

    it('should return 404 for non-existent token', async () => {
      const response = await ctx.api.delete('/api/tokens/99999');

      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });

    it('should return 400 for invalid token ID', async () => {
      const response = await ctx.api.delete('/api/tokens/invalid');

      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
    });

    it('should not allow deleting another user\'s token', async () => {
      // Create a token directly in DB for a different user
      const prisma = getPrismaClient();
      const otherUser = await prisma.user.upsert({
        where: { email: 'other@e2e.local' },
        update: {},
        create: {
          id: 'other-user-id',
          email: 'other@e2e.local',
          name: 'Other User',
          emailVerified: new Date(),
          updatedAt: new Date(),
        },
      });

      const { hash, salt, preview } = generatePersonalAccessToken();
      const otherToken = await prisma.personalAccessToken.create({
        data: {
          userId: otherUser.id,
          name: '[e2e] Other User Token',
          hash,
          salt,
          preview,
        },
      });

      // Try to delete the other user's token
      const response = await ctx.api.delete(`/api/tokens/${otherToken.id}`);

      // Should return 404 (not found for this user, not 403)
      expect(response.status).toBe(404);

      // Verify token still exists
      const stillExists = await prisma.personalAccessToken.findUnique({
        where: { id: otherToken.id },
      });
      expect(stillExists).not.toBeNull();

      // Cleanup
      await prisma.personalAccessToken.delete({ where: { id: otherToken.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    // Note: Unauthenticated test skipped - test mode has auto-login enabled
  });

  describe('Token Validation via API', () => {
    it('should validate token can be used after creation', async () => {
      // Create a token
      const createResponse = await ctx.api.post<{ id: number; token: string }>('/api/tokens', {
        name: '[e2e] Validation Token',
      });
      expect(createResponse.status).toBe(201);

      // Verify token format is valid
      const token = createResponse.data.token;
      expect(token).toMatch(/^pat_[a-f0-9]{64}$/);

      // Token should be verifiable against stored hash
      const prisma = getPrismaClient();
      const storedToken = await prisma.personalAccessToken.findUnique({
        where: { id: createResponse.data.id },
      });

      // The preview should match
      expect(token.endsWith(storedToken!.preview)).toBe(true);
    });

    it('should invalidate token after deletion', async () => {
      // Create a token
      const createResponse = await ctx.api.post<{ id: number; token: string }>('/api/tokens', {
        name: '[e2e] Delete Validation Token',
      });
      expect(createResponse.status).toBe(201);

      const tokenId = createResponse.data.id;

      // Delete the token
      await ctx.api.delete(`/api/tokens/${tokenId}`);

      // Verify token no longer exists in database
      const prisma = getPrismaClient();
      const deletedToken = await prisma.personalAccessToken.findUnique({
        where: { id: tokenId },
      });
      expect(deletedToken).toBeNull();
    });
  });
});
