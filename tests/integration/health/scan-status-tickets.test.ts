import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PATCH } from '@/app/api/projects/[projectId]/health/scans/[scanId]/status/route';

vi.mock('@/app/lib/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

describe('Scan Status Callback Flow (US1/US3/US4/US5/US6)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createScan(
    scanType: 'SECURITY' | 'COMPLIANCE' | 'TESTS' | 'SPEC_SYNC' = 'SECURITY',
    status: 'PENDING' | 'RUNNING' = 'PENDING'
  ) {
    return prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType,
        status,
      },
    });
  }

  function makeRequest(projectId: number, scanId: number, body: Record<string, unknown>) {
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

  // --- US1: PENDING → RUNNING → COMPLETED flow ---

  it('transitions PENDING → RUNNING → COMPLETED with score and report', async () => {
    const scan = await createScan('SECURITY', 'PENDING');

    // Step 1: PENDING → RUNNING
    const runningRes = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });
    expect(runningRes.status).toBe(200);
    const runningData = await runningRes.json();
    expect(runningData.scan.status).toBe('RUNNING');

    // Step 2: RUNNING → COMPLETED with score, report, issues
    const completedRes = await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 75,
      report: JSON.stringify({ type: 'SECURITY', issues: [], generatedTickets: [] }),
      issuesFound: 5,
      issuesFixed: 2,
      headCommit: 'b'.repeat(40),
    });
    expect(completedRes.status).toBe(200);
    const completedData = await completedRes.json();
    expect(completedData.scan.status).toBe('COMPLETED');
    expect(completedData.scan.score).toBe(75);
  });

  // --- US3: Incremental scan with baseCommit/headCommit ---

  it('stores headCommit on COMPLETED status for incremental scan support', async () => {
    const scan = await createScan('COMPLIANCE', 'RUNNING');
    const headCommit = 'c'.repeat(40);

    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 80,
      headCommit,
    });

    const updatedScan = await prisma.healthScan.findUnique({ where: { id: scan.id } });
    expect(updatedScan!.headCommit).toBe(headCommit);
    expect(updatedScan!.status).toBe('COMPLETED');
  });

  // --- US4: Score recalculation ---

  it('upserts HealthScore and recalculates globalScore on COMPLETED', async () => {
    // Pre-existing score for another module
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        testsScore: 60,
        globalScore: 60,
      },
    });

    const scan = await createScan('SECURITY', 'RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 80,
    });

    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(80);
    expect(healthScore!.testsScore).toBe(60);
    expect(healthScore!.globalScore).toBe(70); // (80 + 60) / 2
  });

  it('creates HealthScore on first COMPLETED scan', async () => {
    const scan = await createScan('TESTS', 'RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 95,
    });

    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore).not.toBeNull();
    expect(healthScore!.testsScore).toBe(95);
    expect(healthScore!.globalScore).toBe(95);
  });

  // --- US5: FAILED status handling ---

  it('transitions to FAILED with errorMessage and no HealthScore changes', async () => {
    // Pre-existing score
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 90,
        globalScore: 90,
      },
    });

    const scan = await createScan('SECURITY', 'RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'FAILED',
      errorMessage: 'Clone failed: repository not accessible',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('FAILED');

    // Verify error message stored
    const updatedScan = await prisma.healthScan.findUnique({ where: { id: scan.id } });
    expect(updatedScan!.errorMessage).toBe('Clone failed: repository not accessible');

    // Verify HealthScore unchanged
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(90);
    expect(healthScore!.globalScore).toBe(90);
  });

  it('transitions PENDING → FAILED directly', async () => {
    const scan = await createScan('SECURITY', 'PENDING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'FAILED',
      errorMessage: 'Dispatch error',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('FAILED');
  });

  // --- US6: Telemetry recording ---

  it('records durationMs on COMPLETED status', async () => {
    const scan = await createScan('SECURITY', 'RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 85,
      durationMs: 45000,
      tokensUsed: 12000,
      costUsd: 0.35,
    });

    const updatedScan = await prisma.healthScan.findUnique({ where: { id: scan.id } });
    expect(updatedScan!.durationMs).toBe(45000);
    expect(updatedScan!.tokensUsed).toBe(12000);
    expect(updatedScan!.costUsd).toBeCloseTo(0.35);
  });

  it('records durationMs on FAILED status', async () => {
    const scan = await createScan('SECURITY', 'RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'FAILED',
      errorMessage: 'Command timed out',
      durationMs: 120000,
    });

    const updatedScan = await prisma.healthScan.findUnique({ where: { id: scan.id } });
    expect(updatedScan!.durationMs).toBe(120000);
    expect(updatedScan!.status).toBe('FAILED');
  });
});
