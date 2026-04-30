import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/scans/[scanId]/route';
import * as authHelpers from '@/lib/db/auth-helpers';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

const verifyProjectAccessMock = vi.mocked(authHelpers.verifyProjectAccess);

describe('Scan By ID GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    verifyProjectAccessMock.mockReset();
    verifyProjectAccessMock.mockResolvedValue(undefined as never);
  });

  function makeRequest(projectId: string | number, scanId: string | number) {
    return GET(
      new NextRequest(
        `http://localhost/api/projects/${projectId}/health/scans/${scanId}`
      ),
      {
        params: Promise.resolve({
          projectId: String(projectId),
          scanId: String(scanId),
        }),
      }
    );
  }

  it('returns 200 with the scan and report for an owner request', async () => {
    const reportJson = JSON.stringify({
      type: 'COMPLIANCE',
      issues: [{ id: 'comp-1', severity: 'low', description: 'Minor issue' }],
      generatedTickets: [],
    });

    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'COMPLIANCE',
        status: 'COMPLETED',
        score: 87,
        issuesFound: 2,
        issuesFixed: 1,
        report: reportJson,
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scan).toBeDefined();
    expect(data.scan.id).toBe(scan.id);
    expect(data.scan.scanType).toBe('COMPLIANCE');
    expect(data.scan.score).toBe(87);
    expect(data.scan.issuesFound).toBe(2);
    expect(data.scan.report).toBe(reportJson);
    expect(data.scan).not.toHaveProperty('projectId');
  });

  it('returns 200 with report=null for a scan with no report', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'SKIPPED',
        score: null,
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scan.id).toBe(scan.id);
    expect(data.scan.report).toBeNull();
  });

  it('returns 401 when the caller is unauthenticated', async () => {
    verifyProjectAccessMock.mockRejectedValueOnce(new Error('Unauthorized'));

    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'TESTS',
        status: 'COMPLETED',
        score: 70,
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when authenticated caller is not a project member', async () => {
    verifyProjectAccessMock.mockRejectedValueOnce(new Error('Project not found'));

    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SPEC_SYNC',
        status: 'COMPLETED',
        score: 95,
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Forbidden');
  });

  it('returns 404 when the scan id does not exist', async () => {
    const response = await makeRequest(ctx.projectId, 99999999);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Scan not found');
  });

  it('returns 404 when the scan belongs to a different project (cross-project guard)', async () => {
    const ownerProject = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { userId: true },
    });
    const otherProject = await prisma.project.create({
      data: {
        name: '[e2e] Other Project Scan By Id',
        description: '[e2e] Cross-project guard test',
        key: 'OPS',
        githubOwner: 'test',
        githubRepo: 'other',
        userId: ownerProject!.userId,
        updatedAt: new Date(),
      },
    });

    const scan = await prisma.healthScan.create({
      data: {
        projectId: otherProject.id,
        scanType: 'COMPLIANCE',
        status: 'COMPLETED',
        score: 60,
      },
    });

    try {
      const response = await makeRequest(ctx.projectId, scan.id);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Scan not found');
    } finally {
      await prisma.healthScan.delete({ where: { id: scan.id } });
      await prisma.project.delete({ where: { id: otherProject.id } });
    }
  });

  it('returns 400 for a non-numeric scanId', async () => {
    const response = await makeRequest(ctx.projectId, 'not-a-number');
    expect(response.status).toBe(400);
  });
});
