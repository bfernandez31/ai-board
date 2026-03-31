/**
 * Integration Tests: Credential Format Validation
 *
 * Tests that the API correctly validates credential formats
 * before attempting provider verification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Credential Format Validation', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const prisma = getPrismaClient();
    await prisma.userCredential.deleteMany({
      where: {
        user: { email: 'test@e2e.local' },
      },
    });
  });

  describe('API_KEY format', () => {
    it('should reject key missing sk-ant- prefix', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] No Prefix',
        value: 'abcdefgh' + 'a'.repeat(80),
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Invalid Anthropic API key format');
    });

    it('should reject key with wrong prefix pattern', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Wrong Prefix',
        value: 'sk-ant-wrong-' + 'a'.repeat(80),
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Invalid Anthropic API key format');
    });

    it('should reject key with too short random section', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Short Key',
        value: 'sk-ant-api03-short',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('OAUTH_TOKEN format', () => {
    it('should reject empty token', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'OAUTH_TOKEN',
        label: '[e2e] Empty Token',
        value: '',
      });

      expect(response.status).toBe(400);
    });

    it('should reject token shorter than 20 characters', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'OAUTH_TOKEN',
        label: '[e2e] Short Token',
        value: 'tooshort',
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Invalid OAuth token format');
    });
  });
});
