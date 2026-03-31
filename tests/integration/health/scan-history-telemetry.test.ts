import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/scans/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Scan History Telemetry Fields', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number, queryParams = '') {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans${queryParams ? '?' + queryParams : ''}`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('returns tokensUsed and costUsd fields for scans with telemetry', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 85,
        tokensUsed: 12500,
        costUsd: 0.42,
        completedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId, 'type=SECURITY');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scans).toHaveLength(1);
    expect(data.scans[0].tokensUsed).toBe(12500);
    expect(data.scans[0].costUsd).toBe(0.42);
  });

  it('returns null for scans without telemetry data', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 70,
        completedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId, 'type=SECURITY');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scans).toHaveLength(1);
    expect(data.scans[0].tokensUsed).toBeNull();
    expect(data.scans[0].costUsd).toBeNull();
  });
});
