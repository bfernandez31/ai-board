import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/scans/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Scan History GET Endpoint', () => {
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

  async function seedScans(count: number, scanType: 'SECURITY' | 'COMPLIANCE' | 'TESTS' | 'SPEC_SYNC' = 'SECURITY') {
    for (let i = 0; i < count; i++) {
      await prisma.healthScan.create({
        data: {
          projectId: ctx.projectId,
          scanType,
          status: 'COMPLETED',
          score: 50 + i * 5,
          completedAt: new Date(Date.now() - i * 86400000),
        },
      });
    }
  }

  it('returns empty results when no scans exist', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scans).toEqual([]);
    expect(data.hasMore).toBe(false);
    expect(data.nextCursor).toBeNull();
  });

  it('returns scans ordered by most recent first', async () => {
    await seedScans(3);

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.scans).toHaveLength(3);
    // Most recent first (highest score = last created)
    expect(data.scans[0].score).toBeGreaterThanOrEqual(data.scans[1].score);
  });

  it('filters by scan type', async () => {
    await seedScans(2, 'SECURITY');
    await seedScans(3, 'TESTS');

    const response = await makeRequest(ctx.projectId, 'type=TESTS');
    const data = await response.json();

    expect(data.scans).toHaveLength(3);
    expect(data.scans.every((s: { scanType: string }) => s.scanType === 'TESTS')).toBe(true);
  });

  it('supports pagination with limit and cursor', async () => {
    await seedScans(5);

    // First page
    const page1Response = await makeRequest(ctx.projectId, 'limit=2');
    const page1 = await page1Response.json();

    expect(page1.scans).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    // Second page
    const page2Response = await makeRequest(ctx.projectId, `limit=2&cursor=${page1.nextCursor}`);
    const page2 = await page2Response.json();

    expect(page2.scans).toHaveLength(2);
    expect(page2.hasMore).toBe(true);

    // Third page
    const page3Response = await makeRequest(ctx.projectId, `limit=2&cursor=${page2.nextCursor}`);
    const page3 = await page3Response.json();

    expect(page3.scans).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health/scans'),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
