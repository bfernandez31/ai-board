import { beforeEach, describe, expect, it } from 'vitest';
import { createAPIClient, getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

describe('AI Credentials API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    process.env.AI_CREDENTIAL_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.userAiCredential.deleteMany({
      where: { userId: 'test-user-id' },
    });
  });

  it('creates and lists a masked Anthropic API credential', async () => {
    const createResponse = await ctx.api.post<{
      credential: {
        provider: string;
        credentialType: string;
        label: string;
        preview: string;
      };
    }>('/api/user/ai-credentials', {
      provider: 'ANTHROPIC',
      credentialType: 'API_KEY',
      label: '[e2e] Ma cle pro',
      secret: 'sk-ant-api03-validtoken123456789',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.data.credential.provider).toBe('ANTHROPIC');
    expect(createResponse.data.credential.credentialType).toBe('API_KEY');
    expect(createResponse.data.credential.preview).toBe('****6789');

    const listResponse = await ctx.api.get<{
      credentials: Array<{
        provider: string;
        label: string;
        preview: string;
      }>;
    }>('/api/user/ai-credentials');

    expect(listResponse.status).toBe(200);
    expect(listResponse.data.credentials).toHaveLength(1);
    expect(listResponse.data.credentials[0]?.label).toBe('[e2e] Ma cle pro');
    expect(listResponse.data.credentials[0]?.preview).toBe('****6789');

    const stored = await prisma.userAiCredential.findFirst({
      where: { userId: 'test-user-id', provider: 'ANTHROPIC' },
    });

    expect(stored).not.toBeNull();
    expect(stored?.encryptedValue).not.toContain('sk-ant-api03');
  });

  it('replaces an existing provider credential instead of creating duplicates', async () => {
    await ctx.api.post('/api/user/ai-credentials', {
      provider: 'ANTHROPIC',
      credentialType: 'API_KEY',
      label: '[e2e] Old label',
      secret: 'sk-ant-api03-oldsecret123456789',
    });

    const replaceResponse = await ctx.api.post<{
      credential: {
        label: string;
        credentialType: string;
        preview: string;
      };
    }>('/api/user/ai-credentials', {
      provider: 'ANTHROPIC',
      credentialType: 'OAUTH_TOKEN',
      label: '[e2e] New OAuth label',
      secret: 'oauth_token_value_1234567890_new',
    });

    expect(replaceResponse.status).toBe(201);
    expect(replaceResponse.data.credential.label).toBe('[e2e] New OAuth label');
    expect(replaceResponse.data.credential.credentialType).toBe('OAUTH_TOKEN');

    const stored = await prisma.userAiCredential.findMany({
      where: { userId: 'test-user-id', provider: 'ANTHROPIC' },
    });

    expect(stored).toHaveLength(1);
  });

  it('validates a credential without persisting it', async () => {
    const response = await ctx.api.post<{ valid: boolean }>(
      '/api/user/ai-credentials/validate',
      {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        secret: 'sk-ant-api03-validateonly123456789',
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.valid).toBe(true);

    const count = await prisma.userAiCredential.count({
      where: { userId: 'test-user-id' },
    });
    expect(count).toBe(0);
  });

  it('rejects malformed credentials with an explicit message', async () => {
    const response = await ctx.api.post<{ error: string }>(
      '/api/user/ai-credentials',
      {
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: '[e2e] Bad key',
        secret: 'bad',
      }
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/Anthropic API keys/i);
  });

  it('deletes a stored provider credential', async () => {
    await ctx.api.post('/api/user/ai-credentials', {
      provider: 'ANTHROPIC',
      credentialType: 'API_KEY',
      label: '[e2e] Delete me',
      secret: 'sk-ant-api03-delete123456789',
    });

    const response = await ctx.api.delete('/api/user/ai-credentials/ANTHROPIC');

    expect(response.status).toBe(200);
    expect(
      await prisma.userAiCredential.findFirst({
        where: { userId: 'test-user-id', provider: 'ANTHROPIC' },
      })
    ).toBeNull();
  });

  it('returns the project owner credential for workflow-authenticated requests only', async () => {
    await ctx.api.post('/api/user/ai-credentials', {
      provider: 'ANTHROPIC',
      credentialType: 'OAUTH_TOKEN',
      label: '[e2e] Workflow secret',
      secret: 'oauth_token_value_1234567890_workflow',
    });

    const unauthorized = await ctx.api.get(`/api/projects/${ctx.projectId}/ai-credentials/owner`);
    expect(unauthorized.status).toBe(401);

    const workflowApi = createAPIClient({
      defaultHeaders: {
        Authorization: `Bearer ${WORKFLOW_TOKEN}`,
      },
    });

    const response = await workflowApi.get<{
      provider: string;
      credentialType: string;
      secret: string;
      envVarName: string;
    }>(`/api/projects/${ctx.projectId}/ai-credentials/owner`);

    expect(response.status).toBe(200);
    expect(response.data.provider).toBe('ANTHROPIC');
    expect(response.data.credentialType).toBe('OAUTH_TOKEN');
    expect(response.data.envVarName).toBe('CLAUDE_CODE_OAUTH_TOKEN');
    expect(response.data.secret).toBe('oauth_token_value_1234567890_workflow');
  });
});
