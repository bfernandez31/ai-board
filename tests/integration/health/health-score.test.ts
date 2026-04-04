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
    expect(data.modules.reviewQuality.score).toBeNull();
    expect(data.modules.qualityGate.passive).toBe(true);
    expect(Object.keys(data.modules)).toHaveLength(6);
    expect(data.modules).not.toHaveProperty('lastClean');
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

  it('auto-fails stale scans stuck for over 65 minutes', async () => {
    const staleDate = new Date(Date.now() - 70 * 60 * 1000); // 70 min ago
    const staleScan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
        startedAt: staleDate,
        createdAt: staleDate,
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    // Stale scan should NOT appear in activeScans
    expect(data.activeScans).toHaveLength(0);

    // Verify it was marked FAILED in the database
    const updated = await prisma.healthScan.findUnique({
      where: { id: staleScan.id },
    });
    expect(updated!.status).toBe('FAILED');
    expect(updated!.errorMessage).toBe('Scan timed out — workflow did not report back');
    expect(updated!.completedAt).not.toBeNull();
  });

  it('does not auto-fail recent active scans', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'COMPLIANCE',
        status: 'RUNNING',
        startedAt: new Date(), // just now
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.activeScans).toHaveLength(1);
    expect(data.activeScans[0].status).toBe('RUNNING');
  });

  it('returns correct module status when latest scan is SKIPPED', async () => {
    // Seed a HealthScore with a previous security score
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 75,
        lastSecurityScan: new Date('2026-03-20T00:00:00Z'),
      },
    });

    // Create a SKIPPED scan as the latest for SECURITY
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'SKIPPED',
        completedAt: new Date('2026-03-28T00:00:00Z'),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Score comes from HealthScore (not overwritten)
    expect(data.modules.security.score).toBe(75);
    expect(data.modules.security.scanStatus).toBe('SKIPPED');
    expect(data.modules.security.summary).toBe('Nothing to evaluate');
  });

  it('global score is unaffected by SKIPPED scans', async () => {
    // Seed HealthScore with security and compliance scores
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 80,
        complianceScore: 90,
        lastSecurityScan: new Date('2026-03-20T00:00:00Z'),
        lastComplianceScan: new Date('2026-03-20T00:00:00Z'),
      },
    });

    // Create a SKIPPED scan for SECURITY (should not affect global score)
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'SKIPPED',
        completedAt: new Date('2026-03-28T00:00:00Z'),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Global score from HealthScore: (80 + 90) / 2 = 85
    expect(data.globalScore).toBe(85);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health'),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
