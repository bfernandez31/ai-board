import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Last Clean Derivation + API Response', () => {
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

  async function createCleanJob(completedAt: Date, logs?: string) {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: `[e2e] Clean Ticket`,
        description: 'Test cleanup',
        stage: 'SHIP',
        workflowType: 'CLEAN',
        ticketKey: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        updatedAt: new Date(),
      },
    });
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'clean',
        status: 'COMPLETED',
        completedAt,
        logs: logs ?? JSON.stringify({ filesCleaned: 10, remainingIssues: 1, summary: 'Cleaned 10 files' }),
        updatedAt: new Date(),
      },
    });
    return { ticket, job };
  }

  it('shows OK state with correct counts for recent cleanup', async () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    await createCleanJob(fiveDaysAgo, JSON.stringify({
      filesCleaned: 12,
      remainingIssues: 2,
      summary: 'Cleaned 12 files',
    }));

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    const lc = data.modules.lastClean;
    expect(lc.passive).toBe(true);
    expect(lc.status).toBe('ok');
    expect(lc.isOverdue).toBe(false);
    expect(lc.filesCleaned).toBe(12);
    expect(lc.remainingIssues).toBe(2);
    expect(lc.daysAgo).toBeGreaterThanOrEqual(4);
    expect(lc.daysAgo).toBeLessThanOrEqual(6);
    expect(lc.label).toBe('OK');
    expect(lc.detail).not.toBeNull();
    expect(lc.detail.history).toHaveLength(1);
  });

  it('shows overdue state for old cleanup (>30 days)', async () => {
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    await createCleanJob(fortyFiveDaysAgo);

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    const lc = data.modules.lastClean;
    expect(lc.status).toBe('overdue');
    expect(lc.isOverdue).toBe(true);
    expect(lc.label).toBe('Overdue');
  });

  it('shows never state when no cleanup jobs exist', async () => {
    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    const lc = data.modules.lastClean;
    expect(lc.status).toBe('never');
    expect(lc.isOverdue).toBe(false);
    expect(lc.summary).toBe('No cleanup yet');
    expect(lc.detail).toBeNull();
    expect(lc.filesCleaned).toBe(0);
    expect(lc.remainingIssues).toBe(0);
  });

  it('returns up to 10 history entries', async () => {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      await createCleanJob(
        new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000),
        JSON.stringify({ filesCleaned: i + 1, remainingIssues: 0, summary: `Cleaned ${i + 1} files` }),
      );
    }

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    const lc = data.modules.lastClean;
    expect(lc.detail.history.length).toBeLessThanOrEqual(10);
  });

  it('does NOT affect global score', async () => {
    const now = new Date();
    await createCleanJob(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000));

    // Add a security score so globalScore is not null
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 80,
        lastSecurityScan: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    // Global score should only include security (80), not Last Clean
    expect(data.globalScore).toBe(80);
    // Last Clean score field should be null
    expect(data.modules.lastClean.score).toBeNull();
  });
});
