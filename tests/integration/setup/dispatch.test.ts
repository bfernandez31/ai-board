import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '../../fixtures/vitest/setup';
import { getPrismaClient } from '../../helpers/db-cleanup';

describe('POST /api/projects/[projectId]/setup', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any setup jobs from previous tests
    const prisma = getPrismaClient();
    await prisma.setupJob.deleteMany({ where: { projectId: ctx.projectId } });
    // Ensure project has no configSyncedAt (needs setup)
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: null, config: null },
    });
  });

  it('creates a setup job and returns 201', async () => {
    const res = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      agent: 'CLAUDE',
    });

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      projectId: ctx.projectId,
      selectedAgent: 'CLAUDE',
      status: 'PENDING',
    });
    expect(res.data).toHaveProperty('id');
    expect(res.data).toHaveProperty('createdAt');
  });

  it('returns 403 for non-owner', async () => {
    const nonOwner = await ctx.createUser('nonowner@setup-test.e2e.test');
    const res = await ctx.api.post(
      `/api/projects/${ctx.projectId}/setup`,
      { agent: 'CLAUDE' },
      { testUserId: nonOwner.id }
    );

    expect(res.status).toBe(403);
  });

  it('returns 409 when project already has config', async () => {
    const prisma = getPrismaClient();
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: new Date(), config: { version: 1 } },
    });

    const res = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      agent: 'CLAUDE',
    });

    expect(res.status).toBe(409);
    expect(res.data).toMatchObject({ code: 'ALREADY_CONFIGURED' });
  });

  it('returns 409 when setup job is already in progress', async () => {
    // Create first job
    const first = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      agent: 'CLAUDE',
    });
    expect(first.status).toBe(201);

    // Try to create duplicate
    const second = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      agent: 'CODEX',
    });

    expect(second.status).toBe(409);
    expect(second.data).toMatchObject({ code: 'SETUP_IN_PROGRESS' });
  });

  it('returns 400 for invalid agent', async () => {
    const res = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      agent: 'INVALID',
    });

    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
