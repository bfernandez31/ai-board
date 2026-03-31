import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCredentialProvider, AiCredentialReadinessStatus, AiCredentialType } from '@prisma/client';
import { encryptSecret, maskSecret } from '@/lib/ai-credentials/crypto';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { getWorkflowHeaders } from '@/tests/helpers/workflow-auth';

describe('workflow owner credential route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    vi.stubEnv('AI_CREDENTIAL_ENCRYPTION_KEY', 'test-ai-credential-encryption-key-32');
    await prisma.userAiCredential.deleteMany({
      where: {
        userId: 'test-user-id',
      },
    });
  });

  it('returns the ready owner credential for workflow-authenticated callers', async () => {
    const secret = 'sk-ant-valid-secret-12345678';
    const encrypted = encryptSecret(secret);

    await prisma.userAiCredential.create({
      data: {
        userId: 'test-user-id',
        provider: AiCredentialProvider.ANTHROPIC,
        credentialType: AiCredentialType.ANTHROPIC_API_KEY,
        label: '[e2e] Owner credential',
        maskedPreview: maskSecret(secret),
        ...encrypted,
        readinessStatus: AiCredentialReadinessStatus.READY,
        lastVerifiedAt: new Date(),
      },
    });

    const response = await ctx.api.fetch(
      `/api/internal/workflows/projects/${ctx.projectId}/providers/anthropic/credential`,
      {
        method: 'POST',
        headers: getWorkflowHeaders(),
        body: JSON.stringify({ command: 'implement' }),
        includeTestUserHeader: false,
        enableTestAuthOverride: false,
      }
    );

    const data = (await response.json()) as {
      ownerUserId: string;
      secret: string;
      authMode: string;
      credentialType: string;
    };

    expect(response.status).toBe(200);
    expect(data.ownerUserId).toBe('test-user-id');
    expect(data.secret).toBe(secret);
    expect(data.authMode).toBe('api-key');
    expect(data.credentialType).toBe('ANTHROPIC_API_KEY');
  });

  it('fails closed when the owner credential is missing', async () => {
    const response = await ctx.api.fetch(
      `/api/internal/workflows/projects/${ctx.projectId}/providers/anthropic/credential`,
      {
        method: 'POST',
        headers: getWorkflowHeaders(),
        body: JSON.stringify({ command: 'implement' }),
        includeTestUserHeader: false,
        enableTestAuthOverride: false,
      }
    );

    const data = (await response.json()) as { code: string; error: string };

    expect(response.status).toBe(404);
    expect(data.code).toBe('OWNER_CREDENTIAL_MISSING');
  });
});
