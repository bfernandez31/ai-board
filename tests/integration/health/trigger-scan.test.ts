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

describe('Trigger Scan POST Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number, body: Record<string, unknown>) {
    return POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('creates a scan in PENDING status', async () => {
    const response = await makeRequest(ctx.projectId, { scanType: 'SECURITY' });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.scan.status).toBe('PENDING');
    expect(data.scan.scanType).toBe('SECURITY');
    expect(data.scan.projectId).toBe(ctx.projectId);
  });

  it('prevents concurrent scans of the same type (409)', async () => {
    // Create a RUNNING scan
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
      },
    });

    const response = await makeRequest(ctx.projectId, { scanType: 'SECURITY' });
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.code).toBe('SCAN_IN_PROGRESS');
  });

  it('allows concurrent scans of different types', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
      },
    });

    const response = await makeRequest(ctx.projectId, { scanType: 'TESTS' });
    expect(response.status).toBe(201);
  });

  it('returns 400 for invalid scan type', async () => {
    const response = await makeRequest(ctx.projectId, { scanType: 'INVALID' });
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/projects/invalid/health/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType: 'SECURITY' }),
      }),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
