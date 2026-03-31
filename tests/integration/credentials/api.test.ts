/**
 * Integration Tests: API Credentials (BYOK)
 *
 * Tests for credential management API endpoints:
 * - POST /api/credentials (create/replace credential)
 * - GET /api/credentials (list credentials)
 * - DELETE /api/credentials/:id (delete credential)
 * - POST /api/credentials/validate (validate key format)
 * - POST /api/workflows/credentials (workflow fetch, workflow-token auth)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';

// Set encryption key for tests
process.env.BYOK_ENCRYPTION_KEY = 'a'.repeat(64);

describe('API Credentials (BYOK)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any credentials from previous tests
    const prisma = getPrismaClient();
    await prisma.apiCredential.deleteMany({
      where: { user: { email: 'test@e2e.local' } },
    });
  });

  describe('POST /api/credentials', () => {
    it('should create a new credential', async () => {
      const response = await ctx.api.post<{
        id: number;
        provider: string;
        credentialType: string;
        label: string;
        preview: string;
      }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] My Anthropic Key',
        apiKey: 'sk-ant-api03-test-key-1234567890abcdef',
      });

      expect(response.status).toBe(201);
      expect(response.data.provider).toBe('ANTHROPIC');
      expect(response.data.credentialType).toBe('API_KEY');
      expect(response.data.label).toBe('[e2e] My Anthropic Key');
      expect(response.data.preview).toBe('cdef');
      // API key should NOT be returned
      expect(response.data).not.toHaveProperty('apiKey');
      expect(response.data).not.toHaveProperty('encryptedKey');
    });

    it('should replace existing credential for same provider (upsert)', async () => {
      // Create first
      await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Key v1',
        apiKey: 'sk-ant-api03-first-key-12345678',
      });

      // Replace
      const response = await ctx.api.post<{
        preview: string;
        label: string;
      }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'OAUTH_TOKEN',
        label: '[e2e] Key v2',
        apiKey: 'oauth-token-new-value-here',
      });

      expect(response.status).toBe(201);
      expect(response.data.label).toBe('[e2e] Key v2');
      expect(response.data.preview).toBe('here');

      // Should only be one credential
      const listResp = await ctx.api.get<{ credentials: unknown[] }>('/api/credentials');
      expect(listResp.data.credentials).toHaveLength(1);
    });

    it('should reject invalid API key format', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Bad Key',
        apiKey: 'not-a-valid-key',
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing label', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        apiKey: 'sk-ant-api03-test-key-1234567890',
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid provider', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'OPENAI',
        credentialType: 'API_KEY',
        label: '[e2e] Invalid Provider',
        apiKey: 'sk-test-123',
      });

      expect(response.status).toBe(400);
    });

    it('should store encrypted key, not plaintext', async () => {
      const apiKey = 'sk-ant-api03-test-verify-encryption-12345';

      const response = await ctx.api.post<{ id: number }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Encryption Test',
        apiKey,
      });

      expect(response.status).toBe(201);

      const prisma = getPrismaClient();
      const stored = await prisma.apiCredential.findUnique({
        where: { id: response.data.id },
      });

      expect(stored).not.toBeNull();
      expect(stored!.encryptedKey).not.toBe(apiKey);
      expect(stored!.iv).toMatch(/^[a-f0-9]{24}$/);
      expect(stored!.authTag).toMatch(/^[a-f0-9]{32}$/);
      expect(stored!.preview).toBe('2345');
    });
  });

  describe('GET /api/credentials', () => {
    it('should return empty array when no credentials exist', async () => {
      const response = await ctx.api.get<{ credentials: unknown[] }>('/api/credentials');
      expect(response.status).toBe(200);
      expect(response.data.credentials).toEqual([]);
    });

    it('should list credentials without sensitive data', async () => {
      await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] List Test',
        apiKey: 'sk-ant-api03-list-test-key-abcd',
      });

      const response = await ctx.api.get<{
        credentials: Array<{
          id: number;
          provider: string;
          credentialType: string;
          label: string;
          preview: string;
        }>;
      }>('/api/credentials');

      expect(response.status).toBe(200);
      expect(response.data.credentials).toHaveLength(1);
      expect(response.data.credentials[0].provider).toBe('ANTHROPIC');
      expect(response.data.credentials[0].preview).toBe('abcd');
      // No sensitive data
      expect(response.data.credentials[0]).not.toHaveProperty('encryptedKey');
      expect(response.data.credentials[0]).not.toHaveProperty('iv');
      expect(response.data.credentials[0]).not.toHaveProperty('authTag');
    });
  });

  describe('DELETE /api/credentials/:id', () => {
    it('should delete an existing credential', async () => {
      const createResp = await ctx.api.post<{ id: number }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] To Delete',
        apiKey: 'sk-ant-api03-delete-me-key-1234',
      });

      const deleteResp = await ctx.api.delete(`/api/credentials/${createResp.data.id}`);
      expect(deleteResp.status).toBe(200);

      const listResp = await ctx.api.get<{ credentials: unknown[] }>('/api/credentials');
      expect(listResp.data.credentials).toHaveLength(0);
    });

    it('should return 404 for non-existent credential', async () => {
      const response = await ctx.api.delete('/api/credentials/99999');
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid ID', async () => {
      const response = await ctx.api.delete('/api/credentials/invalid');
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/workflows/credentials', () => {
    it('should reject requests without workflow token', async () => {
      // The endpoint checks for workflow Bearer token, not session auth.
      // Request goes through with test-auth-override headers (NextAuth bypass),
      // but the endpoint itself rejects because no valid workflow token.
      const response = await ctx.api.post('/api/workflows/credentials', {
        projectId: ctx.projectId,
        provider: 'ANTHROPIC',
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when no credential is configured', async () => {
      const workflowToken = process.env.WORKFLOW_API_TOKEN;

      if (!workflowToken) {
        return;
      }

      // Ensure no credentials exist for the project owner
      const prisma = getPrismaClient();
      await prisma.apiCredential.deleteMany({
        where: { userId: 'test-user-id' },
      });

      // In dev/test mode, NextAuth requires session headers for all API routes.
      // The workflow endpoint itself validates the Bearer token independently.
      const workflowClient = createAPIClient({
        defaultHeaders: {
          Authorization: `Bearer ${workflowToken}`,
        },
      });

      const response = await workflowClient.post('/api/workflows/credentials', {
        projectId: ctx.projectId,
        provider: 'ANTHROPIC',
      });

      expect(response.status).toBe(404);
    });

    it('should return credential when configured', async () => {
      const workflowToken = process.env.WORKFLOW_API_TOKEN;

      if (!workflowToken) {
        return;
      }

      // Create a credential first
      await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Workflow Fetch Test',
        apiKey: 'sk-ant-api03-workflow-test-key-9876',
      });

      const workflowClient = createAPIClient({
        defaultHeaders: {
          Authorization: `Bearer ${workflowToken}`,
        },
      });

      const response = await workflowClient.post<{
        credentialType: string;
        apiKey: string;
      }>('/api/workflows/credentials', {
        projectId: ctx.projectId,
        provider: 'ANTHROPIC',
      });

      expect(response.status).toBe(200);
      expect(response.data.credentialType).toBe('API_KEY');
      expect(response.data.apiKey).toBe('sk-ant-api03-workflow-test-key-9876');
    });
  });
});
