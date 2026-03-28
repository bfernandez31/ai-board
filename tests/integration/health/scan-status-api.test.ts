import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { prisma } from '@/lib/db/client';

function getWorkflowHeaders() {
  return {
    Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN ?? 'test-workflow-token'}`,
  };
}

describe('PATCH /api/projects/[projectId]/health/scans/[scanId]/status', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('transitions PENDING -> RUNNING', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'PENDING',
      },
    });

    const response = await ctx.api.patch<{ scan: { status: string; startedAt: string } }>(
      `/api/projects/${ctx.projectId}/health/scans/${scan.id}/status`,
      { status: 'RUNNING' },
      { headers: getWorkflowHeaders() }
    );

    expect(response.status).toBe(200);
    expect(response.data.scan.status).toBe('RUNNING');
    expect(response.data.scan.startedAt).toBeTruthy();
  });

  it('transitions RUNNING -> COMPLETED with score', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const response = await ctx.api.patch<{ scan: { status: string; score: number } }>(
      `/api/projects/${ctx.projectId}/health/scans/${scan.id}/status`,
      {
        status: 'COMPLETED',
        score: 90,
        report: { vulnerabilities: [] },
        issuesFound: 2,
        issuesFixed: 1,
        durationMs: 45000,
      },
      { headers: getWorkflowHeaders() }
    );

    expect(response.status).toBe(200);
    expect(response.data.scan.status).toBe('COMPLETED');
    expect(response.data.scan.score).toBe(90);

    // Verify HealthScore was updated
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore?.securityScore).toBe(90);
    expect(healthScore?.globalScore).toBe(90); // Only module, so 100% weight
  });

  it('transitions RUNNING -> FAILED with error message', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'TESTS',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const response = await ctx.api.patch<{ scan: { status: string; errorMessage: string } }>(
      `/api/projects/${ctx.projectId}/health/scans/${scan.id}/status`,
      {
        status: 'FAILED',
        errorMessage: 'Workflow timed out after 10 minutes',
      },
      { headers: getWorkflowHeaders() }
    );

    expect(response.status).toBe(200);
    expect(response.data.scan.status).toBe('FAILED');
    expect(response.data.scan.errorMessage).toBe('Workflow timed out after 10 minutes');
  });

  it('rejects invalid state transition', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 90,
        completedAt: new Date(),
      },
    });

    const response = await ctx.api.patch(
      `/api/projects/${ctx.projectId}/health/scans/${scan.id}/status`,
      { status: 'RUNNING' },
      { headers: getWorkflowHeaders() }
    );

    expect(response.status).toBe(400);
  });

  it('rejects COMPLETED without score', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const response = await ctx.api.patch(
      `/api/projects/${ctx.projectId}/health/scans/${scan.id}/status`,
      { status: 'COMPLETED' },
      { headers: getWorkflowHeaders() }
    );

    expect(response.status).toBe(400);
  });
});
