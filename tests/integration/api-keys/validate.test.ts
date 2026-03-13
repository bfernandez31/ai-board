/**
 * Integration Tests: API Key Validation Endpoint
 *
 * Tests for POST /api/projects/:id/api-keys/validate endpoint.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('API Key Validation Endpoint', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('POST /api/projects/:id/api-keys/validate', () => {
    it('should reject invalid Anthropic key format', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/api-keys/validate`,
        {
          provider: 'ANTHROPIC',
          apiKey: 'not-a-valid-key',
        }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('sk-ant-');
    });

    it('should reject invalid OpenAI key format', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/api-keys/validate`,
        {
          provider: 'OPENAI',
          apiKey: 'not-a-valid-key',
        }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('sk-');
    });

    it('should reject empty key', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/api-keys/validate`,
        {
          provider: 'ANTHROPIC',
          apiKey: '',
        }
      );

      expect(response.status).toBe(400);
    });

    it('should reject invalid provider', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/api-keys/validate`,
        {
          provider: 'INVALID',
          apiKey: 'sk-ant-api03-test',
        }
      );

      expect(response.status).toBe(400);
    });

    it('should trim whitespace before validation', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/api-keys/validate`,
        {
          provider: 'ANTHROPIC',
          apiKey: '  not-valid  ',
        }
      );

      // Format should still be rejected (no sk-ant- prefix)
      expect(response.status).toBe(400);
      expect(response.data.error).toContain('sk-ant-');
    });
  });
});
