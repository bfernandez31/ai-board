import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '../../fixtures/vitest/setup';
import { getPrismaClient } from '../../helpers/db-cleanup';

describe('Setup API Guards', () => {
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

  describe('non-owner access', () => {
    it('POST returns 403 for non-owner', async () => {
      const nonOwner = await ctx.createUser('guard-nonowner@setup-test.e2e.test');
      const res = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup`,
        { agent: 'CLAUDE' },
        { testUserId: nonOwner.id }
      );
      expect(res.status).toBe(403);
    });

    it('GET returns 403 for non-owner', async () => {
      const nonOwner = await ctx.createUser('guard-nonowner-get@setup-test.e2e.test');
      const res = await ctx.api.get(
        `/api/projects/${ctx.projectId}/setup`,
        { testUserId: nonOwner.id }
      );
      expect(res.status).toBe(403);
    });
  });

  describe('configured project redirect', () => {
    it('POST returns 409 when project already has config', async () => {
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

    it('GET returns hasConfig:true when project has config', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: new Date(), config: { version: 1 } },
      });

      const res = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ hasConfig: true });
    });
  });

  describe('duplicate dispatch rejection', () => {
    it('returns 409 when setup is already in progress', async () => {
      // Create first
      const first = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CLAUDE',
      });
      expect(first.status).toBe(201);

      // Try duplicate
      const second = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CODEX',
      });
      expect(second.status).toBe(409);
      expect(second.data).toMatchObject({ code: 'SETUP_IN_PROGRESS' });
    });
  });

  describe('running state recovery', () => {
    it('GET returns PENDING/RUNNING job for state recovery', async () => {
      // Create a setup job
      await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CLAUDE',
      });

      // GET should return it
      const res = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
      expect(res.status).toBe(200);
      expect(res.data.setupJob).toMatchObject({
        status: 'PENDING',
        selectedAgent: 'CLAUDE',
      });
    });
  });
});
