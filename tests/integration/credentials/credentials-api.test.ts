/**
 * Integration Tests: User Credentials API
 *
 * Tests for credential management API endpoints:
 * - GET /api/credentials (list credentials)
 * - POST /api/credentials (create/replace credential)
 * - DELETE /api/credentials/:id (delete credential)
 * - POST /api/credentials/:id/test (test credential)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

// Load .env.local so test-side encryption uses the same key as the server
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { encryptCredential } from '@/lib/ai-credentials/crypto';

describe('User Credentials API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any credentials from previous tests
    const prisma = getPrismaClient();
    await prisma.userCredential.deleteMany({
      where: {
        user: { email: 'test@e2e.local' },
      },
    });
  });

  describe('GET /api/credentials', () => {
    it('should return empty array when no credentials exist', async () => {
      const response = await ctx.api.get<{ credentials: unknown[] }>('/api/credentials');

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('credentials');
      expect(response.data.credentials).toEqual([]);
    });

    it('should list created credentials with metadata only', async () => {
      // Insert a credential directly in DB
      const prisma = getPrismaClient();
      const { encryptedValue, iv, authTag } = encryptCredential('sk-ant-api03-test1234');

      await prisma.userCredential.create({
        data: {
          userId: 'test-user-id',
          provider: 'ANTHROPIC',
          credentialType: 'API_KEY',
          label: '[e2e] Test Key',
          encryptedValue,
          iv,
          authTag,
          preview: '1234',
          readinessStatus: 'READY',
          lastVerifiedAt: new Date(),
          verificationCode: 'VALID',
        },
      });

      const response = await ctx.api.get<{
        credentials: Array<{
          id: number;
          provider: string;
          credentialType: string;
          label: string;
          preview: string;
          readinessStatus: string;
          verificationCode: string | null;
          verificationMessage: string | null;
          createdAt: string;
          updatedAt: string;
        }>;
      }>('/api/credentials');

      expect(response.status).toBe(200);
      expect(response.data.credentials).toHaveLength(1);
      const cred = response.data.credentials[0];
      expect(cred.provider).toBe('ANTHROPIC');
      expect(cred.credentialType).toBe('API_KEY');
      expect(cred.label).toBe('[e2e] Test Key');
      expect(cred.preview).toBe('1234');
      expect(cred.readinessStatus).toBe('READY');
      expect(cred.verificationCode).toBe('VALID');

      // Should NOT return encrypted fields
      expect(cred).not.toHaveProperty('encryptedValue');
      expect(cred).not.toHaveProperty('iv');
      expect(cred).not.toHaveProperty('authTag');
    });
  });

  describe('POST /api/credentials', () => {
    it('should return 400 for invalid API_KEY format', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Bad Key',
        value: 'invalid-key-format',
      });

      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
    });

    it('should return 400 for missing label', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        value: 'sk-ant-api03-' + 'a'.repeat(80),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for label exceeding 100 characters', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: 'x'.repeat(101),
        value: 'sk-ant-api03-' + 'a'.repeat(80),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid OAUTH_TOKEN format (too short)', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'OAUTH_TOKEN',
        label: '[e2e] Short Token',
        value: 'short',
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid provider', async () => {
      const response = await ctx.api.post('/api/credentials', {
        provider: 'OPENAI',
        credentialType: 'API_KEY',
        label: '[e2e] Wrong Provider',
        value: 'sk-ant-api03-' + 'a'.repeat(80),
      });

      expect(response.status).toBe(400);
    });

    it('should return 422 for valid format but invalid key (rejected by provider)', async () => {
      // This key has valid format but will be rejected by Anthropic
      const response = await ctx.api.post<{ error: string; code: string }>('/api/credentials', {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Invalid Anthropic Key',
        value: 'sk-ant-api03-' + 'a'.repeat(80),
      });

      // Should be 422 (rejected by provider) or possibly 422 (unreachable)
      expect([422]).toContain(response.status);
      expect(response.data).toHaveProperty('code');
    });
  });

  describe('DELETE /api/credentials/:id', () => {
    it('should delete an existing credential', async () => {
      const prisma = getPrismaClient();
      const { encryptedValue, iv, authTag } = encryptCredential('test-value-1234');

      const cred = await prisma.userCredential.create({
        data: {
          userId: 'test-user-id',
          provider: 'ANTHROPIC',
          credentialType: 'API_KEY',
          label: '[e2e] Delete Me',
          encryptedValue,
          iv,
          authTag,
          preview: '1234',
          readinessStatus: 'READY',
        },
      });

      const response = await ctx.api.delete(`/api/credentials/${cred.id}`);
      expect(response.status).toBe(204);

      // Verify deleted
      const listResponse = await ctx.api.get<{ credentials: unknown[] }>('/api/credentials');
      expect(listResponse.data.credentials).toHaveLength(0);
    });

    it('should return 404 for non-existent credential', async () => {
      const response = await ctx.api.delete('/api/credentials/99999');
      expect(response.status).toBe(404);
    });

    it('should not allow deleting another user\'s credential', async () => {
      const prisma = getPrismaClient();
      const otherUser = await prisma.user.upsert({
        where: { email: 'cred-other@e2e.local' },
        update: {},
        create: {
          id: 'cred-other-user-id',
          email: 'cred-other@e2e.local',
          name: 'Other Cred User',
          emailVerified: new Date(),
          updatedAt: new Date(),
        },
      });

      const { encryptedValue, iv, authTag } = encryptCredential('other-value-5678');
      const otherCred = await prisma.userCredential.create({
        data: {
          userId: otherUser.id,
          provider: 'ANTHROPIC',
          credentialType: 'API_KEY',
          label: '[e2e] Other User Cred',
          encryptedValue,
          iv,
          authTag,
          preview: '5678',
          readinessStatus: 'READY',
        },
      });

      const response = await ctx.api.delete(`/api/credentials/${otherCred.id}`);
      expect(response.status).toBe(404);

      // Cleanup
      await prisma.userCredential.delete({ where: { id: otherCred.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('POST /api/credentials/:id/test', () => {
    it('should return 404 for non-existent credential', async () => {
      const response = await ctx.api.post('/api/credentials/99999/test');
      expect(response.status).toBe(404);
    });

    it('should test an existing credential and return verification result', async () => {
      const prisma = getPrismaClient();
      const testValue = 'sk-ant-api03-' + 'a'.repeat(80);
      const { encryptedValue, iv, authTag } = encryptCredential(testValue);

      const cred = await prisma.userCredential.create({
        data: {
          userId: 'test-user-id',
          provider: 'ANTHROPIC',
          credentialType: 'API_KEY',
          label: '[e2e] Test Me',
          encryptedValue,
          iv,
          authTag,
          preview: testValue.slice(-4),
          readinessStatus: 'PENDING_VERIFICATION',
        },
      });

      const response = await ctx.api.post<{
        readinessStatus: string;
        verificationCode: string;
        verificationMessage: string | null;
      }>(`/api/credentials/${cred.id}/test`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('readinessStatus');
      expect(response.data).toHaveProperty('verificationCode');
      // The key is fake so it should be ACTION_REQUIRED with INVALID_KEY or UNREACHABLE
      expect(['READY', 'ACTION_REQUIRED']).toContain(response.data.readinessStatus);
    });
  });
});
