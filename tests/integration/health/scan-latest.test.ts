import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/scans/latest/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Latest Scan GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number, queryParams = '') {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans/latest${queryParams ? '?' + queryParams : ''}`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('returns latest scan for given type', async () => {
    // Create older scan
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 60,
        createdAt: new Date(Date.now() - 86400000),
      },
    });

    // Create newer scan
    const newerScan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 85,
        report: '## Latest Report',
      },
    });

    const response = await makeRequest(ctx.projectId, 'type=SECURITY');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scan).toBeDefined();
    expect(data.scan.id).toBe(newerScan.id);
    expect(data.scan.score).toBe(85);
    expect(data.scan.report).toBe('## Latest Report');
  });

  it('returns null when no scans exist for type', async () => {
    const response = await makeRequest(ctx.projectId, 'type=COMPLIANCE');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scan).toBeNull();
  });

  it('returns 400 when type parameter is missing', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid type parameter', async () => {
    const response = await makeRequest(ctx.projectId, 'type=INVALID');
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health/scans/latest?type=SECURITY'),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
