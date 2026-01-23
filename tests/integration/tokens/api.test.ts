/**
 * Integration Tests: Personal Access Tokens API
 *
 * Tests for token CRUD operations and API authentication using tokens.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('Personal Access Tokens API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/tokens', () => {
    it('should return empty tokens list for new user', async () => {
      const response = await ctx.api.get<{ tokens: unknown[] }>('/api/tokens');

      expect(response.status).toBe(200);
      expect(response.data.tokens).toEqual([]);
    });

    it('should return tokens after creation', async () => {
      // Create a token first
      await ctx.api.post('/api/tokens', { name: '[e2e] Test Token' });

      // Now list tokens
      const response = await ctx.api.get<{
        tokens: Array<{
          id: number;
          name: string;
          tokenPreview: string;
          createdAt: string;
          lastUsedAt: string | null;
        }>;
      }>('/api/tokens');

      expect(response.status).toBe(200);
      expect(response.data.tokens).toHaveLength(1);
      expect(response.data.tokens[0].name).toBe('[e2e] Test Token');
      expect(response.data.tokens[0].tokenPreview).toMatch(/^\.\.\.[a-f0-9]{4}$/);
      expect(response.data.tokens[0].lastUsedAt).toBeNull();
    });
  });

  describe('POST /api/tokens', () => {
    it('should create a new token and return plain token once', async () => {
      const response = await ctx.api.post<{
        token: string;
        id: number;
        name: string;
        tokenPreview: string;
        createdAt: string;
      }>('/api/tokens', { name: '[e2e] My CLI Token' });

      expect(response.status).toBe(201);
      expect(response.data.token).toMatch(/^pat_[a-f0-9]{64}$/);
      expect(response.data.name).toBe('[e2e] My CLI Token');
      expect(response.data.tokenPreview).toMatch(/^\.\.\.[a-f0-9]{4}$/);
      expect(response.data.id).toBeGreaterThan(0);
    });

    it('should reject empty token name', async () => {
      const response = await ctx.api.post('/api/tokens', { name: '' });

      expect(response.status).toBe(400);
    });

    it('should reject token name over 100 characters', async () => {
      const longName = '[e2e] ' + 'a'.repeat(100);
      const response = await ctx.api.post('/api/tokens', { name: longName });

      expect(response.status).toBe(400);
    });

    it('should enforce maximum 10 tokens per user', async () => {
      // Create 10 tokens
      for (let i = 0; i < 10; i++) {
        const res = await ctx.api.post('/api/tokens', { name: `[e2e] Token ${i}` });
        expect(res.status).toBe(201);
      }

      // 11th should fail
      const response = await ctx.api.post('/api/tokens', { name: '[e2e] Token 11' });
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });
  });

  describe('DELETE /api/tokens/:id', () => {
    it('should delete an existing token', async () => {
      // Create a token
      const createRes = await ctx.api.post<{ id: number }>('/api/tokens', {
        name: '[e2e] Token to Delete',
      });
      const tokenId = createRes.data.id;

      // Delete it
      const deleteRes = await ctx.api.delete(`/api/tokens/${tokenId}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.data).toEqual({ success: true });

      // Verify it's gone
      const listRes = await ctx.api.get<{ tokens: Array<{ id: number }> }>('/api/tokens');
      const tokenIds = listRes.data.tokens.map((t) => t.id);
      expect(tokenIds).not.toContain(tokenId);
    });

    it('should return 404 for non-existent token', async () => {
      const response = await ctx.api.delete('/api/tokens/99999');
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid token ID', async () => {
      const response = await ctx.api.delete('/api/tokens/invalid');
      expect(response.status).toBe(400);
    });
  });

  describe('Token Format Validation', () => {
    it('should generate tokens with correct format', async () => {
      // Create a token and verify the format
      const createRes = await ctx.api.post<{ token: string; tokenPreview: string }>('/api/tokens', {
        name: '[e2e] Format Test Token',
      });

      // Token should have pat_ prefix and 64 hex characters
      expect(createRes.data.token).toMatch(/^pat_[a-f0-9]{64}$/);

      // Token preview should be ...XXXX (last 4 chars)
      const last4 = createRes.data.token.slice(-4);
      expect(createRes.data.tokenPreview).toBe(`...${last4}`);
    });

    it('should generate unique tokens', async () => {
      // Create two tokens and verify they are different
      const token1Res = await ctx.api.post<{ token: string }>('/api/tokens', {
        name: '[e2e] Token 1',
      });
      const token2Res = await ctx.api.post<{ token: string }>('/api/tokens', {
        name: '[e2e] Token 2',
      });

      expect(token1Res.data.token).not.toBe(token2Res.data.token);
    });

    it('should store tokens securely (hashed, not retrievable)', async () => {
      // Create a token
      const createRes = await ctx.api.post<{ token: string; id: number }>('/api/tokens', {
        name: '[e2e] Secure Token',
      });
      const plainToken = createRes.data.token;

      // List tokens - plain token should NOT be returned
      const listRes = await ctx.api.get<{
        tokens: Array<{
          id: number;
          name: string;
          tokenPreview: string;
          token?: string;
          tokenHash?: string;
        }>;
      }>('/api/tokens');

      const storedToken = listRes.data.tokens.find((t) => t.id === createRes.data.id);
      expect(storedToken).toBeDefined();
      expect(storedToken?.token).toBeUndefined(); // Plain token not returned
      expect(storedToken?.tokenHash).toBeUndefined(); // Hash not exposed
      expect(storedToken?.tokenPreview).toBe(`...${plainToken.slice(-4)}`);
    });
  });
});
