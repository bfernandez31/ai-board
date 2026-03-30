import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/trend/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Health Trend GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean health scans for this project (not covered by ctx.cleanup)
    await prisma.healthScan.deleteMany({ where: { projectId: ctx.projectId } });
  });

  function makeRequest(projectId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/trend`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  async function createScan(overrides: {
    scanType: 'SECURITY' | 'COMPLIANCE' | 'TESTS' | 'SPEC_SYNC';
    score?: number | null;
    status?: string;
    completedAt?: Date;
  }) {
    return prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: overrides.scanType,
        status: overrides.status ?? 'COMPLETED',
        score: overrides.score !== undefined ? overrides.score : 80,
        completedAt: overrides.completedAt ?? new Date(),
      },
    });
  }

  it('returns 200 with trend data for all 4 modules', async () => {
    // Create scans for each module
    const now = new Date();
    await createScan({ scanType: 'SECURITY', score: 85, completedAt: new Date(now.getTime() - 2000) });
    await createScan({ scanType: 'SECURITY', score: 90, completedAt: now });
    await createScan({ scanType: 'COMPLIANCE', score: 72, completedAt: now });
    await createScan({ scanType: 'TESTS', score: 95, completedAt: now });

    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.trends.security).toHaveLength(2);
    expect(data.trends.security[0].score).toBe(85); // oldest first
    expect(data.trends.security[1].score).toBe(90);
    expect(data.trends.compliance).toHaveLength(1);
    expect(data.trends.tests).toHaveLength(1);
    expect(data.trends.specSync).toHaveLength(0);
  });

  it('returns empty arrays when no completed scans exist', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.trends.security).toEqual([]);
    expect(data.trends.compliance).toEqual([]);
    expect(data.trends.tests).toEqual([]);
    expect(data.trends.specSync).toEqual([]);
  });

  it('excludes scans with null scores', async () => {
    await createScan({ scanType: 'SECURITY', score: null });
    await createScan({ scanType: 'SECURITY', score: 75 });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.trends.security).toHaveLength(1);
    expect(data.trends.security[0].score).toBe(75);
  });

  it('excludes non-COMPLETED scans', async () => {
    await createScan({ scanType: 'SECURITY', score: 80, status: 'PENDING' });
    await createScan({ scanType: 'SECURITY', score: 90, status: 'RUNNING' });
    await createScan({ scanType: 'SECURITY', score: 70, status: 'FAILED' });
    await createScan({ scanType: 'SECURITY', score: 85 });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.trends.security).toHaveLength(1);
    expect(data.trends.security[0].score).toBe(85);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/abc/health/trend'),
      { params: Promise.resolve({ projectId: 'abc' }) }
    );
    expect(response.status).toBe(400);
  });

  it('returns 403 when verifyProjectAccess throws', async () => {
    const { verifyProjectAccess } = await import('@/lib/db/auth-helpers');
    vi.mocked(verifyProjectAccess).mockRejectedValueOnce(new Error('Project not found'));

    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(403);
  });

  it('returns data points ordered oldest first', async () => {
    const base = new Date('2026-03-01T00:00:00Z');
    for (let i = 0; i < 5; i++) {
      await createScan({
        scanType: 'TESTS',
        score: 60 + i * 5,
        completedAt: new Date(base.getTime() + i * 86400000),
      });
    }

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.trends.tests).toHaveLength(5);
    expect(data.trends.tests[0].score).toBe(60);
    expect(data.trends.tests[4].score).toBe(80);
  });
});
