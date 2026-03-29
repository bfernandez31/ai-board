import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST } from '@/app/api/projects/[projectId]/health/scans/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => ({
    id: 1,
    name: 'Test',
    githubOwner: 'test-owner',
    githubRepo: 'test-repo',
    clarificationPolicy: 'AUTO',
  })),
}));

vi.mock('@/lib/health/scan-dispatch', () => ({
  dispatchHealthScanWorkflow: vi.fn(async () => undefined),
}));

describe('Incremental Scanning', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function triggerScan(projectId: number, scanType: string) {
    return POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType }),
      }),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('first scan has null baseCommit (full scan)', async () => {
    const response = await triggerScan(ctx.projectId, 'SECURITY');
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.scan.baseCommit).toBeNull();
  });

  it('second scan uses prior headCommit as baseCommit', async () => {
    const headCommit = 'a'.repeat(40);

    // Create a completed scan with a headCommit
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 80,
        headCommit,
        completedAt: new Date(),
      },
    });

    const response = await triggerScan(ctx.projectId, 'SECURITY');
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.scan.baseCommit).toBe(headCommit);
  });

  it('scan types are independent — SECURITY does not affect TESTS baseCommit', async () => {
    const securityHead = 'a'.repeat(40);

    // Complete a SECURITY scan
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 90,
        headCommit: securityHead,
        completedAt: new Date(),
      },
    });

    // Trigger a TESTS scan — should have null baseCommit (no prior TESTS scan)
    const response = await triggerScan(ctx.projectId, 'TESTS');
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.scan.baseCommit).toBeNull();
  });
});
