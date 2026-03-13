/**
 * Integration Tests: API Keys CRUD
 *
 * Tests for POST save and GET list API key endpoints.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('API Keys CRUD', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any existing API keys for the test project
    await prisma.projectAPIKey.deleteMany({
      where: { projectId: ctx.projectId },
    });
  });

  describe('POST /api/projects/:id/api-keys', () => {
    it('should save an Anthropic API key with skipValidation', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-test-key-1234',
        skipValidation: true,
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        provider: 'ANTHROPIC',
        configured: true,
        preview: '1234',
        validated: false,
        message: expect.any(String),
      });
    });

    it('should save an OpenAI API key with skipValidation', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'OPENAI',
        apiKey: 'sk-proj-test-key-abcd',
        skipValidation: true,
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        provider: 'OPENAI',
        configured: true,
        preview: 'abcd',
      });
    });

    it('should reject invalid Anthropic key format', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'invalid-key-format',
        skipValidation: true,
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.code).toBe('INVALID_FORMAT');
    });

    it('should reject invalid OpenAI key format', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'OPENAI',
        apiKey: 'invalid-no-prefix',
        skipValidation: true,
      });

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('INVALID_FORMAT');
    });

    it('should replace an existing key (upsert)', async () => {
      // Save first key
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-first-key-aaaa',
        skipValidation: true,
      });

      // Replace with second key
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-second-key-bbbb',
        skipValidation: true,
      });

      expect(response.status).toBe(200);
      expect(response.data.preview).toBe('bbbb');

      // Verify only one key exists
      const keys = await prisma.projectAPIKey.findMany({
        where: { projectId: ctx.projectId, provider: 'ANTHROPIC' },
      });
      expect(keys).toHaveLength(1);
    });

    it('should trim whitespace from key before saving', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: '  sk-ant-api03-trimmed-wxyz  ',
        skipValidation: true,
      });

      expect(response.status).toBe(200);
      expect(response.data.preview).toBe('wxyz');
    });

    it('should reject empty body', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {});

      expect(response.status).toBe(400);
    });

    it('should reject invalid provider', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'INVALID',
        apiKey: 'sk-ant-api03-test',
        skipValidation: true,
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects/:id/api-keys', () => {
    it('should return both providers with configured=false when no keys set', async () => {
      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.status).toBe(200);
      expect(response.data.keys).toHaveLength(2);
      expect(response.data.keys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: 'ANTHROPIC', configured: false }),
          expect.objectContaining({ provider: 'OPENAI', configured: false }),
        ])
      );
    });

    it('should return configured=true with preview after key is saved', async () => {
      // Save a key first
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-preview-test-efgh',
        skipValidation: true,
      });

      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.status).toBe(200);
      const anthropicKey = response.data.keys.find(
        (k: { provider: string }) => k.provider === 'ANTHROPIC'
      );
      expect(anthropicKey).toMatchObject({
        provider: 'ANTHROPIC',
        configured: true,
        preview: 'efgh',
      });
      expect(anthropicKey.updatedAt).toBeTruthy();
    });

    it('should never return the actual encrypted or plaintext key', async () => {
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-api03-secret-key-value',
        skipValidation: true,
      });

      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/api-keys`);
      const responseJson = JSON.stringify(response.data);

      expect(responseJson).not.toContain('sk-ant-api03');
      expect(responseJson).not.toContain('secret-key');
    });
  });
});
