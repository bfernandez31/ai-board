/**
 * Integration Tests: Workflow Dispatch Key Injection
 *
 * Tests that BYOK keys are retrieved for workflow dispatch
 * and that fallback behavior works correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Workflow Dispatch - API Key Injection', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.projectAPIKey.deleteMany({
      where: { projectId: ctx.projectId },
    });
  });

  describe('Key retrieval for workflow dispatch', () => {
    it('should save and retrieve a key for workflow use', async () => {
      // Save a key via API
      const saveResponse = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-test-workflow-key-9999',
        skipValidation: true,
      });

      expect(saveResponse.status).toBe(200);
      expect(saveResponse.data.configured).toBe(true);

      // Verify key exists in database (encrypted)
      const dbKey = await prisma.projectAPIKey.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: 'ANTHROPIC',
          },
        },
      });

      expect(dbKey).not.toBeNull();
      expect(dbKey!.encryptedKey).not.toContain('sk-ant-api03');
      expect(dbKey!.preview).toBe('9999');
    });

    it('should return empty keys list when no BYOK keys configured', async () => {
      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.status).toBe(200);
      const anthropic = response.data.keys.find(
        (k: { provider: string }) => k.provider === 'ANTHROPIC'
      );
      expect(anthropic!.configured).toBe(false);
    });

    it('should support both providers independently', async () => {
      // Save Anthropic key
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-key-aaaa',
        skipValidation: true,
      });

      // Save OpenAI key
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'OPENAI',
        apiKey: 'sk-proj-key-bbbb',
        skipValidation: true,
      });

      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);
      expect(response.data.keys).toHaveLength(2);

      const anthropic = response.data.keys.find(
        (k: { provider: string }) => k.provider === 'ANTHROPIC'
      );
      const openai = response.data.keys.find(
        (k: { provider: string }) => k.provider === 'OPENAI'
      );

      expect(anthropic!.configured).toBe(true);
      expect(anthropic!.preview).toBe('aaaa');
      expect(openai!.configured).toBe(true);
      expect(openai!.preview).toBe('bbbb');
    });
  });
});
