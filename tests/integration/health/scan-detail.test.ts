import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/scans/[scanId]/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Scan Detail GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number, scanId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans/${scanId}`),
      { params: Promise.resolve({ projectId: String(projectId), scanId: String(scanId) }) }
    );
  }

  it('returns scan detail for existing scan', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 85,
        report: '## Security Report\n\nAll clear.',
        issuesFound: 3,
        issuesFixed: 1,
        baseCommit: 'abc1234',
        headCommit: 'def5678',
        durationMs: 30000,
        completedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scan).toBeDefined();
    expect(data.scan.id).toBe(scan.id);
    expect(data.scan.scanType).toBe('SECURITY');
    expect(data.scan.score).toBe(85);
    expect(data.scan.report).toBe('## Security Report\n\nAll clear.');
    expect(data.scan.issuesFound).toBe(3);
    expect(data.scan.issuesFixed).toBe(1);
    expect(data.scan.baseCommit).toBe('abc1234');
    expect(data.scan.headCommit).toBe('def5678');
  });

  it('returns 404 for non-existent scan', async () => {
    const response = await makeRequest(ctx.projectId, 99999);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('Scan not found');
  });

  it('returns 404 for scan belonging to different project', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 75,
      },
    });

    // Request with a different projectId
    const response = await makeRequest(ctx.projectId + 100, scan.id);
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid scan ID', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/projects/${ctx.projectId}/health/scans/invalid`),
      { params: Promise.resolve({ projectId: String(ctx.projectId), scanId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health/scans/1'),
      { params: Promise.resolve({ projectId: 'invalid', scanId: '1' }) }
    );
    expect(response.status).toBe(400);
  });
});
