/**
 * Integration Tests: Workflow Credential Retrieval (Internal)
 *
 * Tests for GET /api/internal/credentials
 * - Workflow token authentication
 * - Owner credential resolution and decryption
 * - Error cases (missing token, missing credential, missing projectId)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import { encryptCredential } from '@/lib/ai-credentials/crypto';

describe('Workflow Credential Retrieval API', () => {
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

  function createWorkflowClient() {
    // The test server uses this hardcoded token from run-integration-tests.sh
    const workflowToken = 'test-workflow-token-for-e2e-tests-only';
    return createAPIClient({
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
      defaultHeaders: {
        Authorization: `Bearer ${workflowToken}`,
      },
    });
  }

  function createUnauthenticatedClient() {
    return createAPIClient({
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });
  }

  it('should return 401 without workflow token', async () => {
    const client = createUnauthenticatedClient();
    const response = await client.get(`/api/internal/credentials?projectId=${ctx.projectId}`);
    expect(response.status).toBe(401);
  });

  it('should return 400 when projectId is missing', async () => {
    const client = createWorkflowClient();
    const response = await client.get('/api/internal/credentials');
    expect(response.status).toBe(400);
  });

  it('should return 400 when projectId is not a valid number', async () => {
    const client = createWorkflowClient();
    const response = await client.get('/api/internal/credentials?projectId=abc');
    expect(response.status).toBe(400);
  });

  it('should return 404 when owner has no credential', async () => {
    const client = createWorkflowClient();
    const response = await client.get<{ error: string }>(
      `/api/internal/credentials?projectId=${ctx.projectId}`
    );
    expect(response.status).toBe(404);
    expect(response.data.error).toContain('credential configured');
  });

  it('should return decrypted API_KEY credential with correct envVar', async () => {
    const prisma = getPrismaClient();
    const testKey = 'sk-ant-api03-' + 'a'.repeat(80);
    const { encryptedValue, iv, authTag } = encryptCredential(testKey);

    await prisma.userCredential.create({
      data: {
        userId: 'test-user-id',
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Workflow Test Key',
        encryptedValue,
        iv,
        authTag,
        preview: testKey.slice(-4),
        readinessStatus: 'READY',
      },
    });

    const client = createWorkflowClient();
    const response = await client.get<{
      envVar: string;
      value: string;
      encoding: string;
      credentialType: string;
    }>(`/api/internal/credentials?projectId=${ctx.projectId}`);

    expect(response.status).toBe(200);
    expect(response.data.envVar).toBe('ANTHROPIC_API_KEY');
    expect(response.data.encoding).toBe('base64');
    expect(Buffer.from(response.data.value, 'base64').toString()).toBe(testKey);
    expect(response.data.credentialType).toBe('API_KEY');
  });

  it('should return OPENAI_API_KEY when provider=OPENAI', async () => {
    const prisma = getPrismaClient();
    const testKey = 'sk-proj-' + 'a'.repeat(40);
    const { encryptedValue, iv, authTag } = encryptCredential(testKey);

    await prisma.userCredential.create({
      data: {
        userId: 'test-user-id',
        provider: 'OPENAI',
        credentialType: 'API_KEY',
        label: '[e2e] OpenAI Workflow Key',
        encryptedValue,
        iv,
        authTag,
        preview: testKey.slice(-4),
        readinessStatus: 'READY',
      },
    });

    const client = createWorkflowClient();
    const response = await client.get<{
      envVar: string;
      value: string;
      encoding: string;
      credentialType: string;
    }>(`/api/internal/credentials?projectId=${ctx.projectId}&provider=OPENAI`);

    expect(response.status).toBe(200);
    expect(response.data.envVar).toBe('OPENAI_API_KEY');
    expect(response.data.encoding).toBe('base64');
    expect(Buffer.from(response.data.value, 'base64').toString()).toBe(testKey);
    expect(response.data.credentialType).toBe('API_KEY');
  });

  it('should default to ANTHROPIC when no provider param is given (backward compat)', async () => {
    const prisma = getPrismaClient();
    const testKey = 'sk-ant-api03-' + 'a'.repeat(80);
    const { encryptedValue, iv, authTag } = encryptCredential(testKey);

    await prisma.userCredential.create({
      data: {
        userId: 'test-user-id',
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Anthropic Default Key',
        encryptedValue,
        iv,
        authTag,
        preview: testKey.slice(-4),
        readinessStatus: 'READY',
      },
    });

    const client = createWorkflowClient();
    const response = await client.get<{
      envVar: string;
      credentialType: string;
    }>(`/api/internal/credentials?projectId=${ctx.projectId}`);

    expect(response.status).toBe(200);
    expect(response.data.envVar).toBe('ANTHROPIC_API_KEY');
  });

  it('should return provider-specific 404 error message', async () => {
    const client = createWorkflowClient();
    const response = await client.get<{ error: string }>(
      `/api/internal/credentials?projectId=${ctx.projectId}&provider=OPENAI`
    );

    expect(response.status).toBe(404);
    expect(response.data.error).toContain('OpenAI');
    expect(response.data.error).toContain('credential configured');
  });

  it('should return decrypted OAUTH_TOKEN credential with correct envVar', async () => {
    const prisma = getPrismaClient();
    const testToken = 'oauth-token-value-' + 'b'.repeat(40);
    const { encryptedValue, iv, authTag } = encryptCredential(testToken);

    await prisma.userCredential.create({
      data: {
        userId: 'test-user-id',
        provider: 'ANTHROPIC',
        credentialType: 'OAUTH_TOKEN',
        label: '[e2e] Workflow Test OAuth',
        encryptedValue,
        iv,
        authTag,
        preview: testToken.slice(-4),
        readinessStatus: 'READY',
      },
    });

    const client = createWorkflowClient();
    const response = await client.get<{
      envVar: string;
      value: string;
      encoding: string;
      credentialType: string;
    }>(`/api/internal/credentials?projectId=${ctx.projectId}`);

    expect(response.status).toBe(200);
    expect(response.data.envVar).toBe('CLAUDE_CODE_OAUTH_TOKEN');
    expect(response.data.encoding).toBe('base64');
    expect(Buffer.from(response.data.value, 'base64').toString()).toBe(testToken);
    expect(response.data.credentialType).toBe('OAUTH_TOKEN');
  });
});
