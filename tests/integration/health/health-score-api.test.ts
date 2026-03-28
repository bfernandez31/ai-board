import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { prisma } from '@/lib/db/client';

describe('GET /api/projects/[projectId]/health', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns global score null and 6 modules when no scans exist', async () => {
    const response = await ctx.api.get<{
      globalScore: number | null;
      globalLabel: string | null;
      modules: Array<{ type: string; status: string; isPassive: boolean }>;
      lastScanAt: string | null;
    }>(`/api/projects/${ctx.projectId}/health`);

    expect(response.status).toBe(200);
    expect(response.data.globalScore).toBeNull();
    expect(response.data.globalLabel).toBeNull();
    expect(response.data.lastScanAt).toBeNull();
    expect(response.data.modules).toHaveLength(6);

    const types = response.data.modules.map((m) => m.type);
    expect(types).toContain('SECURITY');
    expect(types).toContain('COMPLIANCE');
    expect(types).toContain('TESTS');
    expect(types).toContain('SPEC_SYNC');
    expect(types).toContain('QUALITY_GATE');
    expect(types).toContain('LAST_CLEAN');

    // Active modules should be never_scanned
    const activeModules = response.data.modules.filter((m) => !m.isPassive);
    for (const m of activeModules) {
      expect(m.status).toBe('never_scanned');
    }
  });

  it('returns global score and module scores when health score exists', async () => {
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        globalScore: 85,
        securityScore: 90,
        testsScore: 80,
        lastScanAt: new Date('2026-03-28T10:00:00Z'),
        lastSecurityScanAt: new Date('2026-03-28T10:00:00Z'),
        lastTestsScanAt: new Date('2026-03-28T09:00:00Z'),
      },
    });

    // Create completed scans to provide status
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 90,
        issuesFound: 1,
        issuesFixed: 0,
        completedAt: new Date('2026-03-28T10:00:00Z'),
      },
    });

    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'TESTS',
        status: 'COMPLETED',
        score: 80,
        issuesFound: 0,
        issuesFixed: 0,
        completedAt: new Date('2026-03-28T09:00:00Z'),
      },
    });

    const response = await ctx.api.get<{
      globalScore: number;
      globalLabel: string;
      modules: Array<{ type: string; score: number | null; status: string }>;
      lastScanAt: string;
    }>(`/api/projects/${ctx.projectId}/health`);

    expect(response.status).toBe(200);
    expect(response.data.globalScore).toBe(85);
    expect(response.data.globalLabel).toBe('Good');
    expect(response.data.lastScanAt).toBeTruthy();

    const securityModule = response.data.modules.find((m) => m.type === 'SECURITY');
    expect(securityModule?.score).toBe(90);
    expect(securityModule?.status).toBe('completed');

    const testsModule = response.data.modules.find((m) => m.type === 'TESTS');
    expect(testsModule?.score).toBe(80);
    expect(testsModule?.status).toBe('completed');
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await ctx.api.get('/api/projects/invalid/health');
    expect(response.status).toBe(400);
  });

  it('returns scanning status when a scan is in progress', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
      },
    });

    const response = await ctx.api.get<{
      modules: Array<{ type: string; status: string }>;
    }>(`/api/projects/${ctx.projectId}/health`);

    expect(response.status).toBe(200);
    const securityModule = response.data.modules.find((m) => m.type === 'SECURITY');
    expect(securityModule?.status).toBe('scanning');
  });
});
