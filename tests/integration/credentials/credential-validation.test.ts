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

  describe('OPENAI API_KEY format', () => {
    it('should reject OpenAI key without sk- prefix', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'OPENAI',
        credentialType: 'API_KEY',
        label: '[e2e] No Prefix OpenAI',
        value: 'invalid-key-' + 'a'.repeat(40),
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('must start with "sk-"');
    });

    it('should accept OPENAI + OAUTH_TOKEN combination with SKIPPED verification', async () => {
      const response = await ctx.api.post<{
        provider: string;
        credentialType: string;
        readinessStatus: string;
        verificationCode: string;
      }>('/api/credentials', {
        provider: 'OPENAI',
        credentialType: 'OAUTH_TOKEN',
        label: '[e2e] OpenAI OAuth',
        value: 'a'.repeat(40),
      });

      expect(response.status).toBe(201);
      expect(response.data.provider).toBe('OPENAI');
      expect(response.data.credentialType).toBe('OAUTH_TOKEN');
      expect(response.data.readinessStatus).toBe('READY');
      expect(response.data.verificationCode).toBe('SKIPPED');
    });

    it('should reject OpenAI key that is too short', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'OPENAI',
        credentialType: 'API_KEY',
        label: '[e2e] Short OpenAI Key',
        value: 'sk-short',
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('too short');
    });
  });

  describe('MISTRAL API_KEY format', () => {
    it('should reject Mistral key shorter than 32 characters', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'MISTRAL',
        credentialType: 'API_KEY',
        label: '[e2e] Short Mistral Key',
        value: 'a'.repeat(31),
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('too short');
    });

    it('should reject Mistral key containing whitespace', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'MISTRAL',
        credentialType: 'API_KEY',
        label: '[e2e] Whitespace Mistral Key',
        value: 'a'.repeat(16) + ' ' + 'b'.repeat(16),
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('whitespace');
    });

    it('should reject MISTRAL + OAUTH_TOKEN combination (not allowed)', async () => {
      const response = await ctx.api.post<{ error: string }>('/api/credentials', {
        provider: 'MISTRAL',
        credentialType: 'OAUTH_TOKEN',
        label: '[e2e] Mistral OAuth',
        value: 'a'.repeat(50),
      });

      expect(response.status).toBe(400);
    });
  });
});
