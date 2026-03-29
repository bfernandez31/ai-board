import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PATCH } from '@/app/api/projects/[projectId]/health/scans/[scanId]/status/route';

vi.mock('@/app/lib/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

describe('Scan Status PATCH Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createScan(status: 'PENDING' | 'RUNNING' = 'PENDING') {
    return prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status,
      },
    });
  }

  function makeRequest(projectId: number, scanId: number, body: Record<string, unknown>) {
    return PATCH(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans/${scanId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ projectId: String(projectId), scanId: String(scanId) }) }
    );
  }

  it('transitions PENDING → RUNNING', async () => {
    const scan = await createScan('PENDING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('RUNNING');
  });

  it('transitions RUNNING → COMPLETED with score and updates HealthScore', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 85,
      issuesFound: 3,
      issuesFixed: 1,
      headCommit: 'a'.repeat(40),
      durationMs: 45000,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('COMPLETED');
    expect(data.scan.score).toBe(85);

    // Verify HealthScore was upserted
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore).not.toBeNull();
    expect(healthScore!.securityScore).toBe(85);
    expect(healthScore!.globalScore).toBe(85); // Only one module
  });

  it('transitions RUNNING → FAILED', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'FAILED',
      errorMessage: 'Workflow timeout',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('FAILED');
  });

  it('rejects invalid transitions (COMPLETED → RUNNING)', async () => {
    const scan = await createScan('RUNNING');
    // First complete it
    await makeRequest(ctx.projectId, scan.id, { status: 'COMPLETED', score: 90 });

    // Try to transition back
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });
    expect(response.status).toBe(409);
  });

  it('returns idempotent response for same status', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });
    expect(response.status).toBe(200);
  });

  it('requires score for COMPLETED status', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'COMPLETED' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for non-existent scan', async () => {
    const response = await makeRequest(ctx.projectId, 99999, { status: 'RUNNING' });
    expect(response.status).toBe(404);
  });

  it('stores telemetry fields on COMPLETED status', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 75,
      issuesFound: 5,
      issuesFixed: 2,
      headCommit: 'b'.repeat(40),
      durationMs: 60000,
      tokensUsed: 150000,
      costUsd: 1.23,
    });

    expect(response.status).toBe(200);

    const updatedScan = await prisma.healthScan.findUnique({
      where: { id: scan.id },
    });
    expect(updatedScan!.durationMs).toBe(60000);
    expect(updatedScan!.tokensUsed).toBe(150000);
    expect(updatedScan!.costUsd).toBe(1.23);
    expect(updatedScan!.headCommit).toBe('b'.repeat(40));
  });

  it('stores durationMs on FAILED status', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'FAILED',
      errorMessage: 'Scan command failed',
      durationMs: 5000,
    });

    expect(response.status).toBe(200);

    const updatedScan = await prisma.healthScan.findUnique({
      where: { id: scan.id },
    });
    expect(updatedScan!.status).toBe('FAILED');
    expect(updatedScan!.durationMs).toBe(5000);
    expect(updatedScan!.errorMessage).toBe('Scan command failed');
  });

  it('recalculates globalScore across multiple modules', async () => {
    // Create existing HealthScore with one module
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        complianceScore: 70,
        globalScore: 70,
      },
    });

    // Complete a security scan
    const scan = await createScan('RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 90,
    });

    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(90);
    expect(healthScore!.complianceScore).toBe(70);
    expect(healthScore!.globalScore).toBe(80); // (90 + 70) / 2
  });
});
