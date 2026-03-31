import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/trends/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Health Trends GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number, queryParams = '') {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/trends${queryParams ? '?' + queryParams : ''}`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('returns trend data for all 4 module types', async () => {
    // Seed one completed scan per module type
    for (const scanType of ['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC'] as const) {
      await prisma.healthScan.create({
        data: {
          projectId: ctx.projectId,
          scanType,
          status: 'COMPLETED',
          score: 80,
          completedAt: new Date(),
        },
      });
    }

    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.trends.SECURITY).toHaveLength(1);
    expect(data.trends.COMPLIANCE).toHaveLength(1);
    expect(data.trends.TESTS).toHaveLength(1);
    expect(data.trends.SPEC_SYNC).toHaveLength(1);
    expect(data.trends.SECURITY[0]).toHaveProperty('date');
    expect(data.trends.SECURITY[0]).toHaveProperty('score', 80);
  });

  it('only includes COMPLETED scans with non-null scores', async () => {
    // COMPLETED with score - should be included
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 85,
        completedAt: new Date(),
      },
    });

    // FAILED - should be excluded
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'FAILED',
        score: null,
      },
    });

    // COMPLETED without score - should be excluded
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: null,
        completedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();
    expect(data.trends.SECURITY).toHaveLength(1);
    expect(data.trends.SECURITY[0].score).toBe(85);
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await prisma.healthScan.create({
        data: {
          projectId: ctx.projectId,
          scanType: 'SECURITY',
          status: 'COMPLETED',
          score: 70 + i,
          completedAt: new Date(Date.now() - i * 86400000),
        },
      });
    }

    const response = await makeRequest(ctx.projectId, 'limit=3');
    const data = await response.json();
    expect(data.trends.SECURITY).toHaveLength(3);
  });

  it('returns trend data in chronological order (oldest first)', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await prisma.healthScan.create({
        data: {
          projectId: ctx.projectId,
          scanType: 'SECURITY',
          status: 'COMPLETED',
          score: 70 + i * 10,
          completedAt: new Date(now - (2 - i) * 86400000), // oldest first: 70, 80, 90
        },
      });
    }

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();
    const scores = data.trends.SECURITY.map((p: { score: number }) => p.score);
    expect(scores).toEqual([70, 80, 90]);
  });

  it('returns empty arrays for modules with no qualifying scans', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.trends.SECURITY).toEqual([]);
    expect(data.trends.COMPLIANCE).toEqual([]);
    expect(data.trends.TESTS).toEqual([]);
    expect(data.trends.SPEC_SYNC).toEqual([]);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/abc/health/trends'),
      { params: Promise.resolve({ projectId: 'abc' }) }
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid limit', async () => {
    const response = await makeRequest(ctx.projectId, 'limit=0');
    expect(response.status).toBe(400);
  });
});
