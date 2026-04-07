import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PATCH } from '@/app/api/projects/[projectId]/health/scans/[scanId]/status/route';

vi.mock('@/app/lib/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

describe('Scan Status PATCH Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createScan(status: 'PENDING' | 'RUNNING' = 'PENDING') {
    return prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
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

  it('transitions PENDING → RUNNING', async () => {
    const scan = await createScan('PENDING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('RUNNING');
  });

  it('transitions RUNNING → COMPLETED with score and updates HealthScore', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 85,
      issuesFound: 3,
      issuesFixed: 1,
      headCommit: 'a'.repeat(40),
      durationMs: 45000,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('COMPLETED');
    expect(data.scan.score).toBe(85);

    // Verify HealthScore was upserted
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore).not.toBeNull();
    expect(healthScore!.securityScore).toBe(85);
    expect(healthScore!.globalScore).toBe(85); // Only one module
  });

  it('transitions RUNNING → FAILED', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'FAILED',
      errorMessage: 'Workflow timeout',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('FAILED');
  });

  it('rejects invalid transitions (COMPLETED → RUNNING)', async () => {
    const scan = await createScan('RUNNING');
    // First complete it
    await makeRequest(ctx.projectId, scan.id, { status: 'COMPLETED', score: 90 });

    // Try to transition back
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });
    expect(response.status).toBe(409);
  });

  it('returns idempotent response for same status', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'RUNNING' });
    expect(response.status).toBe(200);
  });

  it('requires score for COMPLETED status', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, { status: 'COMPLETED' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for non-existent scan', async () => {
    const response = await makeRequest(ctx.projectId, 99999, { status: 'RUNNING' });
    expect(response.status).toBe(404);
  });

  it('transitions RUNNING → SKIPPED', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'SKIPPED',
      skipReason: 'No qualifying PRs since last scan',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scan.status).toBe('SKIPPED');
    expect(data.scan.score).toBeNull();

    // Verify completedAt was set
    const updated = await prisma.healthScan.findUnique({ where: { id: scan.id } });
    expect(updated!.completedAt).not.toBeNull();
  });

  it('rejects PENDING → SKIPPED (invalid transition)', async () => {
    const scan = await createScan('PENDING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'SKIPPED',
    });
    expect(response.status).toBe(409);
  });

  it('rejects SKIPPED status when score is provided', async () => {
    const scan = await createScan('RUNNING');
    const response = await makeRequest(ctx.projectId, scan.id, {
      status: 'SKIPPED',
      score: 100,
    });
    expect(response.status).toBe(400);
  });

  it('does NOT update HealthScore aggregate on SKIPPED', async () => {
    // Seed HealthScore with a previous COMPLETED score
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 75,
        globalScore: 75,
      },
    });

    const scan = await createScan('RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'SKIPPED',
      skipReason: 'No changed files to scan',
    });

    // HealthScore should be unchanged
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(75);
    expect(healthScore!.globalScore).toBe(75);
  });

  it('preserves existing COMPLETED scans after SKIPPED enum is added', async () => {
    // Create a historical COMPLETED scan with score 100
    const historicalScan = await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'COMPLETED',
        score: 100,
        completedAt: new Date('2026-03-01T10:00:00Z'),
      },
    });

    // Query it back — should be unchanged
    const scan = await prisma.healthScan.findUnique({ where: { id: historicalScan.id } });
    expect(scan!.status).toBe('COMPLETED');
    expect(scan!.score).toBe(100);
  });

  it('recalculates globalScore across multiple modules', async () => {
    // Create existing HealthScore with one module
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        complianceScore: 70,
        globalScore: 70,
      },
    });

    // Complete a security scan
    const scan = await createScan('RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 90,
    });

    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(90);
    expect(healthScore!.complianceScore).toBe(70);
    expect(healthScore!.globalScore).toBe(80); // (90 + 70) / 2
  });

  it('persists Quality Gate score and includes it in globalScore on scan completion', async () => {
    // Create a FULL-workflow ticket in SHIP stage with a completed verify job
    const { id: ticketId } = await ctx.createTicket({
      title: '[e2e] Quality Gate test ticket',
      description: 'Test ticket for Quality Gate persistence',
      stage: 'SHIP',
    });
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { workflowType: 'FULL' },
    });
    const ticket = { id: ticketId };

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: 72,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Seed existing HealthScore with one module
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        complianceScore: 80,
        globalScore: 80,
      },
    });

    // Complete a security scan — should also compute and persist Quality Gate
    const scan = await createScan('RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 90,
    });

    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(90);
    expect(healthScore!.complianceScore).toBe(80);
    expect(healthScore!.qualityGate).toBe(72);
    // globalScore = (90 + 80 + 72) / 3 = 80.67 → 81
    expect(healthScore!.globalScore).toBe(81);
  });

  it('sets qualityGate to null when no verify jobs exist', async () => {
    const scan = await createScan('RUNNING');
    await makeRequest(ctx.projectId, scan.id, {
      status: 'COMPLETED',
      score: 85,
    });

    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(healthScore!.securityScore).toBe(85);
    expect(healthScore!.qualityGate).toBeNull();
    expect(healthScore!.globalScore).toBe(85); // Only security module
  });
});
