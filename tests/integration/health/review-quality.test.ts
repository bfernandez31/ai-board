import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST, GET } from '@/app/api/projects/[projectId]/health/scans/route';
import { PATCH } from '@/app/api/projects/[projectId]/health/scans/[scanId]/status/route';
import { GET as GET_HEALTH } from '@/app/api/projects/[projectId]/health/route';

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

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

describe('Review Quality Health Scan', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makePostRequest(projectId: number, body: Record<string, unknown>) {
    return POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  function makePatchRequest(projectId: number, scanId: number, body: Record<string, unknown>) {
    return PATCH(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/scans/${scanId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ projectId: String(projectId), scanId: String(scanId) }) }
    );
  }

  function makeGetScansRequest(projectId: number, type?: string) {
    const url = type
      ? `http://localhost/api/projects/${projectId}/health/scans?type=${type}`
      : `http://localhost/api/projects/${projectId}/health/scans`;
    return GET(
      new NextRequest(url),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  function makeGetHealthRequest(projectId: number) {
    return GET_HEALTH(
      new NextRequest(`http://localhost/api/projects/${projectId}/health`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('POST creates a REVIEW_QUALITY scan in PENDING status', async () => {
    const response = await makePostRequest(ctx.projectId, { scanType: 'REVIEW_QUALITY' });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.scan.status).toBe('PENDING');
    expect(data.scan.scanType).toBe('REVIEW_QUALITY');
    expect(data.scan.projectId).toBe(ctx.projectId);
  });

  it('PATCH COMPLETED with score and report updates HealthScore', async () => {
    // Create a RUNNING scan directly in DB
    const scan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'REVIEW_QUALITY',
        status: 'RUNNING',
      },
    });

    const report = {
      type: 'REVIEW_QUALITY',
      summary: {
        prsAnalyzed: 3,
        totalMissedFindings: 8,
        coverageScore: 72,
        scoreBreakdown: {
          base: 100,
          highPenalty: -15,
          mediumPenalty: -8,
          lowPenalty: -6,
        },
      },
      missedFindings: [
        {
          id: 'f1a2b3c4',
          prNumber: 360,
          source: 'codex',
          category: 'error-handling',
          severity: 'high',
          description: 'Missing error boundary',
          file: 'src/components/dashboard.tsx',
          line: 142,
        },
      ],
      cumulativeAnalysis: {
        windowDays: 30,
        reportsAnalyzed: 5,
        recurringPatterns: [],
      },
      generatedTickets: [],
    };

    const response = await makePatchRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 72,
      issuesFound: 8,
      issuesFixed: 0,
      headCommit: 'b'.repeat(40),
      durationMs: 32000,
      report: JSON.stringify(report),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('COMPLETED');
    expect(data.scan.score).toBe(72);

    // Verify HealthScore was upserted with reviewQualityScore
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore).not.toBeNull();
    expect(healthScore!.reviewQualityScore).toBe(72);
    expect(healthScore!.globalScore).toBe(72); // Only one module scored
  });

  it('GET health returns reviewQuality module in response', async () => {
    // Seed a HealthScore with reviewQualityScore
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        reviewQualityScore: 72,
        lastReviewQualityScan: new Date('2026-04-01T10:00:00Z'),
      },
    });

    const response = await makeGetHealthRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.modules.reviewQuality).toBeDefined();
    expect(data.modules.reviewQuality.score).toBe(72);
    expect(data.modules.reviewQuality.label).toBe('Good');
    expect(data.modules.reviewQuality.lastScanDate).toBe('2026-04-01T10:00:00.000Z');
  });

  it('GET scans filters by REVIEW_QUALITY type', async () => {
    // Create scans of different types
    await prisma.healthScan.createMany({
      data: [
        { projectId: ctx.projectId, scanType: 'SECURITY', status: 'COMPLETED', score: 80 },
        { projectId: ctx.projectId, scanType: 'REVIEW_QUALITY', status: 'COMPLETED', score: 72 },
        { projectId: ctx.projectId, scanType: 'REVIEW_QUALITY', status: 'COMPLETED', score: 68 },
      ],
    });

    const response = await makeGetScansRequest(ctx.projectId, 'REVIEW_QUALITY');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scans).toHaveLength(2);
    expect(data.scans.every((s: { scanType: string }) => s.scanType === 'REVIEW_QUALITY')).toBe(true);
  });

  it('prevents concurrent REVIEW_QUALITY scans (409)', async () => {
    // Create a RUNNING REVIEW_QUALITY scan
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'REVIEW_QUALITY',
        status: 'RUNNING',
      },
    });

    const response = await makePostRequest(ctx.projectId, { scanType: 'REVIEW_QUALITY' });
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.code).toBe('SCAN_IN_PROGRESS');
  });
});
