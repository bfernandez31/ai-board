import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '../../fixtures/vitest/setup';
import { getPrismaClient } from '../../helpers/db-cleanup';

describe('GET /api/projects/[projectId]/setup/credential-check', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any credentials
    const prisma = getPrismaClient();
    await prisma.userCredential.deleteMany({
      where: { userId: 'test-user-id' },
    });
  });

  it('returns available=false with guidance when no credential exists', async () => {
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/setup/credential-check?agent=CLAUDE`
    );

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      available: false,
      provider: 'ANTHROPIC',
    });
    expect(res.data).toHaveProperty('guidance');
  });

  it('returns available=true when READY credential exists for CLAUDE', async () => {
    const prisma = getPrismaClient();
    await prisma.userCredential.create({
      data: {
        userId: 'test-user-id',
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: 'Test Key',
        encryptedValue: 'encrypted',
        iv: 'iv1234567890123456789012',
        authTag: 'tag123456789012345678901',
        preview: 'sk-t',
        readinessStatus: 'READY',
      },
    });

    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/setup/credential-check?agent=CLAUDE`
    );

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      available: true,
      provider: 'ANTHROPIC',
      readinessStatus: 'READY',
    });
  });

  it('maps CODEX agent to OPENAI provider', async () => {
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/setup/credential-check?agent=CODEX`
    );

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      available: false,
      provider: 'OPENAI',
    });
  });

  it('returns 400 for invalid agent', async () => {
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/setup/credential-check?agent=INVALID`
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing agent parameter', async () => {
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/setup/credential-check`
    );

    expect(res.status).toBe(400);
  });

  it('returns 403 for non-owner', async () => {
    const nonOwner = await ctx.createUser('cred-nonowner@setup-test.e2e.test');
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/setup/credential-check?agent=CLAUDE`,
      { testUserId: nonOwner.id }
    );

    expect(res.status).toBe(403);
  });
});
