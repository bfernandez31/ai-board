import { AiCredentialReadinessStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('AI credential settings API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    vi.stubEnv('AI_CREDENTIAL_ENCRYPTION_KEY', 'integration-test-ai-credential-key');
    await prisma.userAiCredential.deleteMany({
      where: {
        user: { email: 'test@e2e.local' },
      },
    });
  });

  it('lists no credentials initially', async () => {
    const response = await ctx.api.get<{ credentials: unknown[] }>('/api/settings/ai-credentials');

    expect(response.status).toBe(200);
    expect(response.data.credentials).toEqual([]);
  });

  it('creates a masked ready Anthropic credential', async () => {
    const response = await ctx.api.fetch('/api/settings/ai-credentials/anthropic', {
      method: 'PUT',
      body: JSON.stringify({
        credentialType: 'ANTHROPIC_API_KEY',
        label: '[e2e] Primary Anthropic',
        secret: 'sk-ant-valid-secret-12345678',
      }),
    });

    const data = (await response.json()) as {
      credential: {
        label: string;
        maskedPreview: string;
        readinessStatus: AiCredentialReadinessStatus;
        credentialType: string;
      };
    };

    expect(response.status).toBe(200);
    expect(data.credential.label).toBe('[e2e] Primary Anthropic');
    expect(data.credential.maskedPreview).toBe('5678');
    expect(data.credential.readinessStatus).toBe('READY');
    expect(data.credential.credentialType).toBe('ANTHROPIC_API_KEY');

    const storedCredential = await prisma.userAiCredential.findFirstOrThrow({
      where: {
        userId: 'test-user-id',
        provider: 'ANTHROPIC',
        deletedAt: null,
      },
    });

    expect(storedCredential.encryptedSecret).not.toBe('sk-ant-valid-secret-12345678');
    expect(storedCredential.maskedPreview).toBe('5678');
  });

  it('rejects invalid submissions', async () => {
    const response = await ctx.api.fetch('/api/settings/ai-credentials/anthropic', {
      method: 'PUT',
      body: JSON.stringify({
        credentialType: 'ANTHROPIC_API_KEY',
        label: '[e2e] Invalid Anthropic',
        secret: 'not-valid',
      }),
    });

    const data = (await response.json()) as { code: string; error: string };

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns masked summaries from the list endpoint', async () => {
    await ctx.api.fetch('/api/settings/ai-credentials/anthropic', {
      method: 'PUT',
      body: JSON.stringify({
        credentialType: 'ANTHROPIC_API_KEY',
        label: '[e2e] Summary Anthropic',
        secret: 'sk-ant-valid-secret-12345678',
      }),
    });

    const response = await ctx.api.get<{
      credentials: Array<{
        label: string;
        maskedPreview: string;
        readinessStatus: string;
      }>;
    }>('/api/settings/ai-credentials');

    expect(response.status).toBe(200);
    expect(response.data.credentials).toHaveLength(1);
    expect(response.data.credentials[0]).toMatchObject({
      label: '[e2e] Summary Anthropic',
      maskedPreview: '5678',
      readinessStatus: 'READY',
    });
    expect(response.data.credentials[0]).not.toHaveProperty('secret');
  });

  it('replaces an existing credential and deletes it without re-exposing the secret', async () => {
    await ctx.api.fetch('/api/settings/ai-credentials/anthropic', {
      method: 'PUT',
      body: JSON.stringify({
        credentialType: 'ANTHROPIC_API_KEY',
        label: '[e2e] First Anthropic',
        secret: 'sk-ant-valid-secret-12345678',
      }),
    });

    const replaceResponse = await ctx.api.fetch('/api/settings/ai-credentials/anthropic', {
      method: 'PUT',
      body: JSON.stringify({
        credentialType: 'ANTHROPIC_API_KEY',
        label: '[e2e] Rotated Anthropic',
        secret: 'sk-ant-valid-secret-87654321',
      }),
    });

    const replaced = (await replaceResponse.json()) as {
      credential: { label: string; maskedPreview: string };
    };

    expect(replaceResponse.status).toBe(200);
    expect(replaced.credential.label).toBe('[e2e] Rotated Anthropic');
    expect(replaced.credential.maskedPreview).toBe('4321');

    const deleteResponse = await ctx.api.delete<{ deleted: boolean }>(
      '/api/settings/ai-credentials/anthropic'
    );

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.data.deleted).toBe(true);

    const listResponse = await ctx.api.get<{ credentials: unknown[] }>('/api/settings/ai-credentials');
    expect(listResponse.status).toBe(200);
    expect(listResponse.data.credentials).toEqual([]);
  });
});
