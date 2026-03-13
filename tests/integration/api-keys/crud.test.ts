/**
 * Integration Tests: BYOK API Keys
 *
 * Tests for save, list, delete, and validate API key endpoints.
 * Covers owner-only enforcement, masked preview, and format validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { randomBytes } from 'crypto';

// Set test encryption key before any tests
const TEST_ENCRYPTION_KEY = randomBytes(32).toString('hex');
process.env.API_KEY_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

describe('BYOK API Keys', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Clean up any existing API keys for test project
    await prisma.projectApiKey.deleteMany({
      where: { projectId: ctx.projectId },
    });
  });

  describe('POST /api/projects/:id/api-keys - Save Key', () => {
    it('should save an Anthropic API key and return masked preview', async () => {
      const response = await ctx.api.post<{
        provider: string;
        preview: string;
        configured: boolean;
        updatedAt: string;
      }>(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        key: 'sk-ant-api03-test1234567890abcdef',
      });

      expect(response.status).toBe(200);
      expect(response.data.provider).toBe('ANTHROPIC');
      expect(response.data.preview).toBe('cdef');
      expect(response.data.configured).toBe(true);
      expect(response.data.updatedAt).toBeDefined();
    });

    it('should save an OpenAI API key and return masked preview', async () => {
      const response = await ctx.api.post<{
        provider: string;
        preview: string;
        configured: boolean;
      }>(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'OPENAI',
        key: 'sk-proj-test1234567890abcdef',
      });

      expect(response.status).toBe(200);
      expect(response.data.provider).toBe('OPENAI');
      expect(response.data.preview).toBe('cdef');
      expect(response.data.configured).toBe(true);
    });

    it('should reject invalid Anthropic key format', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/api-keys`,
        { provider: 'ANTHROPIC', key: 'sk-proj-not-anthropic-key12345' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('sk-ant-');
    });

    it('should reject invalid OpenAI key format (Anthropic prefix)', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/api-keys`,
        { provider: 'OPENAI', key: 'sk-ant-api03-wrong-provider-key' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Anthropic');
    });

    it('should reject key shorter than 20 chars', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/api-keys`,
        { provider: 'ANTHROPIC', key: 'sk-ant-short' }
      );

      expect(response.status).toBe(400);
    });

    it('should replace existing key for same provider (upsert)', async () => {
      // Save first key
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        key: 'sk-ant-api03-first-key-1234567890',
      });

      // Save replacement key
      const response = await ctx.api.post<{
        provider: string;
        preview: string;
        configured: boolean;
      }>(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        key: 'sk-ant-api03-second-key-abcdefgh',
      });

      expect(response.status).toBe(200);
      expect(response.data.preview).toBe('efgh');

      // Verify only one record exists
      const count = await prisma.projectApiKey.count({
        where: { projectId: ctx.projectId, provider: 'ANTHROPIC' },
      });
      expect(count).toBe(1);
    });

    it('should store key encrypted in database', async () => {
      const plainKey = 'sk-ant-api03-test1234567890abcdef';

      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        key: plainKey,
      });

      const dbRecord = await prisma.projectApiKey.findUnique({
        where: { projectId_provider: { projectId: ctx.projectId, provider: 'ANTHROPIC' } },
      });

      expect(dbRecord).not.toBeNull();
      // Encrypted key should NOT contain the plaintext
      expect(dbRecord!.encryptedKey).not.toContain(plainKey);
      // Should be in iv:authTag:ciphertext format
      expect(dbRecord!.encryptedKey.split(':')).toHaveLength(3);
      // Preview should be last 4 chars
      expect(dbRecord!.preview).toBe('cdef');
    });
  });

  describe('GET /api/projects/:id/api-keys - List Keys', () => {
    it('should return both providers with unconfigured status', async () => {
      const response = await ctx.api.get<{
        keys: Array<{
          provider: string;
          preview: string | null;
          configured: boolean;
          updatedAt: string | null;
        }>;
      }>(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.status).toBe(200);
      expect(response.data.keys).toHaveLength(2);

      const anthropic = response.data.keys.find((k) => k.provider === 'ANTHROPIC');
      const openai = response.data.keys.find((k) => k.provider === 'OPENAI');

      expect(anthropic?.configured).toBe(false);
      expect(anthropic?.preview).toBeNull();
      expect(openai?.configured).toBe(false);
      expect(openai?.preview).toBeNull();
    });

    it('should show configured key with masked preview', async () => {
      // Save a key first
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        key: 'sk-ant-api03-test1234567890wxyz',
      });

      const response = await ctx.api.get<{
        keys: Array<{
          provider: string;
          preview: string | null;
          configured: boolean;
        }>;
      }>(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.status).toBe(200);

      const anthropic = response.data.keys.find((k) => k.provider === 'ANTHROPIC');
      expect(anthropic?.configured).toBe(true);
      expect(anthropic?.preview).toBe('wxyz');

      // OpenAI should still be unconfigured
      const openai = response.data.keys.find((k) => k.provider === 'OPENAI');
      expect(openai?.configured).toBe(false);
    });

    it('should never return the encrypted key value in list response', async () => {
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        key: 'sk-ant-api03-test1234567890abcdef',
      });

      const response = await ctx.api.get<{ keys: Record<string, unknown>[] }>(
        `/api/projects/${ctx.projectId}/api-keys`
      );

      for (const key of response.data.keys) {
        expect(key).not.toHaveProperty('encryptedKey');
        expect(key).not.toHaveProperty('key');
      }
    });
  });

  describe('DELETE /api/projects/:id/api-keys/:provider - Remove Key', () => {
    it('should delete an existing key', async () => {
      // Save a key first
      await ctx.api.post(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: 'ANTHROPIC',
        key: 'sk-ant-api03-test1234567890abcdef',
      });

      const response = await ctx.api.delete<{
        provider: string;
        configured: boolean;
        message: string;
      }>(`/api/projects/${ctx.projectId}/api-keys/ANTHROPIC`);

      expect(response.status).toBe(200);
      expect(response.data.provider).toBe('ANTHROPIC');
      expect(response.data.configured).toBe(false);
      expect(response.data.message).toContain('blocked');

      // Verify deleted from DB
      const dbRecord = await prisma.projectApiKey.findUnique({
        where: { projectId_provider: { projectId: ctx.projectId, provider: 'ANTHROPIC' } },
      });
      expect(dbRecord).toBeNull();
    });

    it('should return 404 for non-existent key', async () => {
      const response = await ctx.api.delete<{ error: string }>(
        `/api/projects/${ctx.projectId}/api-keys/ANTHROPIC`
      );

      expect(response.status).toBe(404);
      expect(response.data.error).toContain('No API key found');
    });
  });
});
