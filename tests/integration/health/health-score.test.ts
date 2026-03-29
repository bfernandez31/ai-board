import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Health Score GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('returns empty health data when no scans exist', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.globalScore).toBeNull();
    expect(data.label).toBe('No data yet');
    expect(data.color.text).toBe('text-muted-foreground');
    expect(data.modules.security.score).toBeNull();
    expect(data.modules.security.summary).toBe('No scan yet');
    expect(data.modules.compliance.score).toBeNull();
    expect(data.modules.tests.score).toBeNull();
    expect(data.modules.specSync.score).toBeNull();
    expect(data.modules.qualityGate.passive).toBe(true);
    expect(data.modules.lastClean.passive).toBe(true);
    expect(data.activeScans).toEqual([]);
    expect(data.lastFullScanDate).toBeNull();
  });

  it('returns partial scores when some modules are scanned', async () => {
    // Seed a HealthScore with some sub-scores
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 80,
        testsScore: 60,
        lastSecurityScan: new Date('2026-03-27T14:30:00Z'),
        lastTestsScan: new Date('2026-03-26T10:00:00Z'),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.globalScore).toBe(70); // (80 + 60) / 2
    expect(data.label).toBe('Good');
    expect(data.modules.security.score).toBe(80);
    expect(data.modules.tests.score).toBe(60);
    expect(data.modules.compliance.score).toBeNull();
    expect(data.lastFullScanDate).toBe('2026-03-27T14:30:00.000Z');
  });

  it('returns full scores when all modules are scanned', async () => {
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 90,
        complianceScore: 85,
        testsScore: 75,
        specSyncScore: 70,
        qualityGate: 80,
        lastSecurityScan: new Date(),
        lastComplianceScan: new Date(),
        lastTestsScan: new Date(),
        lastSpecSyncScan: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.globalScore).toBe(80); // (90+85+75+70+80)/5
    expect(data.label).toBe('Good');
    expect(data.color.text).toBe('text-ctp-blue');
  });

  it('includes active scans in response', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.activeScans).toHaveLength(1);
    expect(data.activeScans[0].scanType).toBe('SECURITY');
    expect(data.activeScans[0].status).toBe('RUNNING');
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health'),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
