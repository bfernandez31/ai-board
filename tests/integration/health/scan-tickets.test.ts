import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/scans/[scanId]/tickets/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Scan Tickets GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number, scanId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans/${scanId}/tickets`),
      { params: Promise.resolve({ projectId: String(projectId), scanId: String(scanId) }) }
    );
  }

  it('returns tickets generated after scan completion', async () => {
    const completedAt = new Date(Date.now() - 3600000);

    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        completedAt,
      },
    });

    // Create a CLEAN ticket after scan completion
    await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE' + ctx.projectId}-100`,
        ticketNumber: 100,
        title: '[e2e] Fix vulnerability',
        workflowType: 'CLEAN',
        stage: 'BUILD',
        createdAt: new Date(completedAt.getTime() + 60000),
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.tickets).toHaveLength(1);
    expect(data.tickets[0].title).toBe('[e2e] Fix vulnerability');
    expect(data.tickets[0].stage).toBe('BUILD');
  });

  it('returns empty array for scan with no generated tickets', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'COMPLIANCE',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.tickets).toEqual([]);
  });

  it('returns empty array for incomplete scan', async () => {
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
      },
    });

    const response = await makeRequest(ctx.projectId, scan.id);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.tickets).toEqual([]);
  });

  it('returns 404 for non-existent scan', async () => {
    const response = await makeRequest(ctx.projectId, 99999);
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid scan ID', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/projects/${ctx.projectId}/health/scans/invalid/tickets`),
      { params: Promise.resolve({ projectId: String(ctx.projectId), scanId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
