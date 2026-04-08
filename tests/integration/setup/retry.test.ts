import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '../../fixtures/vitest/setup';
import { getPrismaClient } from '../../helpers/db-cleanup';

describe('Setup Error Recovery and Retry', () => {
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

  it('shows FAILED status with error message', async () => {
    const prisma = getPrismaClient();
    // Create a failed job directly
    await prisma.setupJob.create({
      data: {
        projectId: ctx.projectId,
        selectedAgent: 'CLAUDE',
        status: 'FAILED',
        errorMessage: 'Workflow timed out',
        completedAt: new Date(),
      },
    });

    const res = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
    expect(res.status).toBe(200);
    expect(res.data.setupJob).toMatchObject({
      status: 'FAILED',
      errorMessage: 'Workflow timed out',
    });
  });

  it('allows retry after FAILED job (creates new SetupJob)', async () => {
    const prisma = getPrismaClient();
    // Create a failed job
    await prisma.setupJob.create({
      data: {
        projectId: ctx.projectId,
        selectedAgent: 'CLAUDE',
        status: 'FAILED',
        errorMessage: 'Previous failure',
        completedAt: new Date(),
      },
    });

    // Retry should succeed (creates new PENDING job)
    const res = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      agent: 'CLAUDE',
    });
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('PENDING');
  });

  it('shows partial completion with isPartial flag', async () => {
    const prisma = getPrismaClient();
    await prisma.setupJob.create({
      data: {
        projectId: ctx.projectId,
        selectedAgent: 'CLAUDE',
        status: 'COMPLETED',
        isPartial: true,
        completedFiles: ['.ai-board/config.yml', '.ai-board/analysis.json'],
        completedAt: new Date(),
      },
    });

    const res = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
    expect(res.status).toBe(200);
    expect(res.data.setupJob).toMatchObject({
      status: 'COMPLETED',
      isPartial: true,
      completedFiles: ['.ai-board/config.yml', '.ai-board/analysis.json'],
    });
  });
});
