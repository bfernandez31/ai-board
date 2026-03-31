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

  function makeRequest(projectId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/trends`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('returns correct response shape with empty arrays', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('security');
    expect(data).toHaveProperty('compliance');
    expect(data).toHaveProperty('tests');
    expect(data).toHaveProperty('specSync');
    expect(Array.isArray(data.security)).toBe(true);
    expect(Array.isArray(data.compliance)).toBe(true);
    expect(Array.isArray(data.tests)).toBe(true);
    expect(Array.isArray(data.specSync)).toBe(true);
  });

  it('returns empty arrays when no qualifying scans exist', async () => {
    // Create non-qualifying scans (PENDING, no score)
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'PENDING',
        score: null,
      },
    });
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

    expect(data.security).toEqual([]);
    expect(data.compliance).toEqual([]);
    expect(data.tests).toEqual([]);
    expect(data.specSync).toEqual([]);
  });

  it('filters only COMPLETED scans with non-null scores', async () => {
    // COMPLETED with score - should be included
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 85,
        completedAt: new Date('2026-03-28T10:00:00Z'),
      },
    });
    // FAILED with score - should be excluded
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'FAILED',
        score: 50,
        completedAt: new Date('2026-03-27T10:00:00Z'),
      },
    });
    // RUNNING - should be excluded
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
        score: null,
      },
    });
    // COMPLETED with null score - should be excluded
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: null,
        completedAt: new Date('2026-03-26T10:00:00Z'),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.security).toHaveLength(1);
    expect(data.security[0].score).toBe(85);
    expect(data.security[0].date).toBe('2026-03-28T10:00:00.000Z');
  });

  it('caps at 20 data points per module', async () => {
    // Create 25 qualifying scans
    for (let i = 0; i < 25; i++) {
      await prisma.healthScan.create({
        data: {
          projectId: ctx.projectId,
          scanType: 'COMPLIANCE',
          status: 'COMPLETED',
          score: 60 + i,
          completedAt: new Date(Date.now() - (25 - i) * 86400000),
        },
      });
    }

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.compliance).toHaveLength(20);
    // Should be chronological order (oldest first)
    for (let i = 1; i < data.compliance.length; i++) {
      expect(new Date(data.compliance[i].date).getTime())
        .toBeGreaterThan(new Date(data.compliance[i - 1].date).getTime());
    }
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health/trends'),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });

  it('returns data per module type independently', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 80,
        completedAt: new Date('2026-03-28T10:00:00Z'),
      },
    });
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'TESTS',
        status: 'COMPLETED',
        score: 95,
        completedAt: new Date('2026-03-28T11:00:00Z'),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.security).toHaveLength(1);
    expect(data.security[0].score).toBe(80);
    expect(data.tests).toHaveLength(1);
    expect(data.tests[0].score).toBe(95);
    expect(data.compliance).toHaveLength(0);
    expect(data.specSync).toHaveLength(0);
  });
});
