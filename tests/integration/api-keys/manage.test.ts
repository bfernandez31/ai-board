/**
 * Integration Tests: API Key Management (Delete/Replace)
 *
 * Tests for DELETE endpoint and key replacement flow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('API Key Management', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.projectAPIKey.deleteMany({
      where: { projectId: ctx.projectId },
    });
  });

  describe('DELETE /api/projects/:id/api-keys/:provider', () => {
    it('should delete an existing API key', async () => {
      // First save a key
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-delete-me-1234',
        skipValidation: true,
      });

      // Verify it exists
      const listBefore = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);
      const before = listBefore.data.keys.find(
        (k: { provider: string }) => k.provider === 'ANTHROPIC'
      );
      expect(before.configured).toBe(true);

      // Delete it
      const response = await ctx.api.delete(
        `/api/projects/${ctx.projectId}/api-keys/ANTHROPIC`
      );

      expect(response.status).toBe(200);
      expect(response.data.provider).toBe('ANTHROPIC');
      expect(response.data.message).toContain('deleted');

      // Verify it's gone
      const listAfter = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);
      const after = listAfter.data.keys.find(
        (k: { provider: string }) => k.provider === 'ANTHROPIC'
      );
      expect(after.configured).toBe(false);
    });

    it('should return 404 when deleting non-existent key', async () => {
      const response = await ctx.api.delete(
        `/api/projects/${ctx.projectId}/api-keys/OPENAI`
      );

      expect(response.status).toBe(404);
    });

    it('should only delete the specified provider', async () => {
      // Save both keys
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-keep-me-aaaa',
        skipValidation: true,
      });
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'OPENAI',
        apiKey: 'sk-proj-delete-me-bbbb',
        skipValidation: true,
      });

      // Delete only OpenAI
      await ctx.api.delete(`/api/projects/${ctx.projectId}/api-keys/OPENAI`);

      // Verify Anthropic still exists
      const list = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);
      const anthropic = list.data.keys.find(
        (k: { provider: string }) => k.provider === 'ANTHROPIC'
      );
      const openai = list.data.keys.find(
        (k: { provider: string }) => k.provider === 'OPENAI'
      );
      expect(anthropic.configured).toBe(true);
      expect(openai.configured).toBe(false);
    });
  });

  describe('Key replacement flow', () => {
    it('should replace an existing key with a new one', async () => {
      // Save initial key
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-original-aaaa',
        skipValidation: true,
      });

      // Replace with new key
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-replacement-zzzz',
        skipValidation: true,
      });

      expect(response.status).toBe(200);
      expect(response.data.preview).toBe('zzzz');

      // Verify only one key exists in database
      const keys = await prisma.projectAPIKey.findMany({
        where: { projectId: ctx.projectId, provider: 'ANTHROPIC' },
      });
      expect(keys).toHaveLength(1);
    });
  });
});
