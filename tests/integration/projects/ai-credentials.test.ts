import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { addProjectMember, createTestMemberUser } from '@/tests/helpers/db-setup';

describe('Project AI credentials', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    process.env.PROJECT_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('lists, saves, validates, replaces, and deletes provider credentials', async () => {
    const listBefore = await ctx.api.get<{ providers: Array<{ provider: string; status: string }> }>(
      `/api/projects/${ctx.projectId}/ai-credentials`
    );

    expect(listBefore.status).toBe(200);
    expect(listBefore.data.providers).toEqual([
      expect.objectContaining({ provider: 'ANTHROPIC', status: 'NOT_CONFIGURED' }),
      expect.objectContaining({ provider: 'OPENAI', status: 'NOT_CONFIGURED' }),
    ]);

    const saveResponse = await ctx.api.fetch(
      `/api/projects/${ctx.projectId}/ai-credentials/ANTHROPIC`,
      {
        method: 'PUT',
        body: JSON.stringify({ apiKey: 'anthropic-valid-1234' }),
      }
    );
    const savePayload = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(savePayload.lastFour).toBe('1234');
    expect(savePayload.validationStatus).toBe('VALID');
    expect(JSON.stringify(savePayload)).not.toContain('anthropic-valid-1234');

    const validateResponse = await ctx.api.post<{ validationStatus: string }>(
      `/api/projects/${ctx.projectId}/ai-credentials/ANTHROPIC/validate`
    );
    expect(validateResponse.status).toBe(200);
    expect(validateResponse.data.validationStatus).toBe('VALID');

    const replaceResponse = await ctx.api.fetch(
      `/api/projects/${ctx.projectId}/ai-credentials/ANTHROPIC`,
      {
        method: 'PUT',
        body: JSON.stringify({ apiKey: 'anthropic-invalid-9999' }),
      }
    );
    const replacePayload = await replaceResponse.json();
    expect(replaceResponse.status).toBe(200);
    expect(replacePayload.lastFour).toBe('9999');
    expect(replacePayload.validationStatus).toBe('INVALID');
    expect(replacePayload.message).not.toContain('anthropic-invalid-9999');

    const deleteResponse = await ctx.api.delete<{ provider: string; status: string }>(
      `/api/projects/${ctx.projectId}/ai-credentials/ANTHROPIC`
    );
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.data.status).toBe('NOT_CONFIGURED');
  });

  it('returns masked-only provider status to members', async () => {
    await ctx.api.fetch(`/api/projects/${ctx.projectId}/ai-credentials/OPENAI`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey: 'openai-valid-5555' }),
    });

    const member = await createTestMemberUser();
    await addProjectMember(ctx.projectId, member.id);
    const memberApi = createAPIClient({ testUserId: member.id });

    const response = await memberApi.get<{ providers: Array<{ provider: string; canManage: boolean; lastFour: string | null }> }>(
      `/api/projects/${ctx.projectId}/ai-credentials`
    );

    expect(response.status).toBe(200);
    expect(response.data.providers.find((provider) => provider.provider === 'OPENAI')).toEqual(
      expect.objectContaining({
        canManage: false,
        lastFour: null,
      })
    );
  });

  it('stores encrypted values instead of plaintext', async () => {
    await ctx.api.fetch(`/api/projects/${ctx.projectId}/ai-credentials/OPENAI`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey: 'openai-valid-1111' }),
    });

    const stored = await prisma.projectAiCredential.findUnique({
      where: {
        projectId_provider: {
          projectId: ctx.projectId,
          provider: 'OPENAI',
        },
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.encryptedKey).not.toContain('openai-valid-1111');
    expect(stored?.lastFour).toBe('1111');
  });
});
