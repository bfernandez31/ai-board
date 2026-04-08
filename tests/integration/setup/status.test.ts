import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '../../fixtures/vitest/setup';
import { getPrismaClient } from '../../helpers/db-cleanup';

describe('GET /api/projects/[projectId]/setup', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const prisma = getPrismaClient();
    await prisma.setupJob.deleteMany({ where: { projectId: ctx.projectId } });
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: null, config: null },
    });
  });

  it('returns null setupJob when no jobs exist', async () => {
    const res = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      setupJob: null,
      hasConfig: false,
    });
  });

  it('returns hasConfig: true when project has config', async () => {
    const prisma = getPrismaClient();
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: new Date(), config: { version: 1 } },
    });

    const res = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      setupJob: null,
      hasConfig: true,
    });
  });

  it('returns the latest setup job', async () => {
    // Create a setup job via POST first
    const postRes = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      agent: 'CLAUDE',
    });
    expect(postRes.status).toBe(201);

    const res = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);

    expect(res.status).toBe(200);
    expect(res.data.setupJob).toMatchObject({
      projectId: ctx.projectId,
      selectedAgent: 'CLAUDE',
      status: 'PENDING',
      isPartial: false,
      completedFiles: [],
      errorMessage: null,
    });
    expect(res.data.hasConfig).toBe(false);
  });

  it('returns 403 for non-owner', async () => {
    const nonOwner = await ctx.createUser('nonowner-status@setup-test.e2e.test');
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/setup`,
      { testUserId: nonOwner.id }
    );

    expect(res.status).toBe(403);
  });
});
