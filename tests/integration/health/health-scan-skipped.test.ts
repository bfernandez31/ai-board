import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PATCH } from '@/app/api/projects/[projectId]/health/scans/[scanId]/status/route';

vi.mock('@/app/lib/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

describe('Health Scan SKIPPED Status', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createScan(status: 'PENDING' | 'RUNNING' = 'PENDING', scanType: 'SECURITY' | 'REVIEW_QUALITY' = 'SECURITY') {
    return prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType,
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

  it('transitions PENDING → SKIPPED', async () => {
    const scan = await createScan('PENDING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'SKIPPED' });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('SKIPPED');
    expect(data.scan.score).toBeNull();

    const updated = await prisma.healthScan.findUnique({ where: { id: scan.id } });
    expect(updated!.completedAt).not.toBeNull();
  });

  it('transitions RUNNING → SKIPPED', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'SKIPPED' });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('SKIPPED');
    expect(data.scan.score).toBeNull();
  });

  it('rejects SKIPPED → any transition with 409', async () => {
    const scan = await createScan('PENDING');
    // First transition to SKIPPED
    await makeRequest(ctx.projectId, scan.id, { status: 'SKIPPED' });

    // Try to transition from SKIPPED
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('Invalid status transition');
  });

  it('rejects SKIPPED with score (400)', async () => {
    const scan = await createScan('PENDING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'SKIPPED',
      score: 100,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Score must not be provided for skipped scans');
  });

  it('does not update HealthScore aggregate when SKIPPED', async () => {
    // Seed a HealthScore with a previous score
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 80,
        globalScore: 80,
        lastSecurityScan: new Date('2026-03-20T00:00:00Z'),
      },
    });

    const scan = await createScan('RUNNING', 'SECURITY');
    await makeRequest(ctx.projectId, scan.id, { status: 'SKIPPED' });

    // HealthScore should be unchanged
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(80);
    expect(healthScore!.globalScore).toBe(80);
    expect(healthScore!.lastSecurityScan!.toISOString()).toBe('2026-03-20T00:00:00.000Z');
  });

  it('SKIPPED scan appears in scan history', async () => {
    const scan = await createScan('PENDING', 'REVIEW_QUALITY');
    await makeRequest(ctx.projectId, scan.id, { status: 'SKIPPED' });

    const scans = await prisma.healthScan.findMany({
      where: { projectId: ctx.projectId },
    });
    expect(scans).toHaveLength(1);
    expect(scans[0].status).toBe('SKIPPED');
    expect(scans[0].score).toBeNull();
  });
});
