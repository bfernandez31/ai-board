/**
 * E2E Tests: Auto-transition mode (AIB-682)
 *
 * Verifies the happy-path chain INBOX → SPECIFY → PLAN → BUILD with one confirmation
 * click and zero drags. Uses TEST_MODE so no real GitHub dispatch occurs — we
 * short-circuit each PENDING job by flipping it to COMPLETED via the worker API,
 * which fires the auto-mode hook and advances the ticket.
 */

import { test, expect, type APIRequestContext } from '../../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, cleanupDatabase } from '../../helpers/db-cleanup';

test.describe('Auto-mode chain — INBOX → BUILD with one click', () => {
  const BASE_URL = 'http://localhost:3000';
  const WORKFLOW_TOKEN =
    process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = getPrismaClient();
  });

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);

    // PRO plan so ticket creation doesn't hit FREE quota
    await prisma.subscription.upsert({
      where: { userId: 'test-user-id' },
      update: { plan: 'PRO', status: 'ACTIVE' },
      create: {
        userId: 'test-user-id',
        stripeSubscriptionId: `sub_e2e_auto_mode_${projectId}`,
        stripePriceId: 'price_e2e_pro',
        plan: 'PRO',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  async function completeLatestStageJob(
    request: APIRequestContext,
    ticketId: number
  ): Promise<void> {
    const job = await prisma.job.findFirst({
      where: {
        ticketId,
        status: { in: ['PENDING', 'RUNNING'] },
        NOT: { command: { startsWith: 'comment-' } },
      },
      orderBy: { id: 'desc' },
    });
    if (!job) return;

    if (job.status === 'PENDING') {
      const runningResp = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${WORKFLOW_TOKEN}` },
        data: { status: 'RUNNING' },
      });
      expect(runningResp.ok()).toBe(true);
    }

    const completedResp = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      headers: { Authorization: `Bearer ${WORKFLOW_TOKEN}` },
      data: { status: 'COMPLETED' },
    });
    expect(completedResp.ok()).toBe(true);
  }

  async function waitForStage(
    ticketId: number,
    stage: string,
    { timeoutMs = 8000, intervalMs = 100 } = {}
  ) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (t?.stage === stage) return t;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    const final = await prisma.ticket.findUnique({ where: { id: ticketId } });
    throw new Error(
      `Ticket ${ticketId} did not reach stage ${stage} (last seen ${final?.stage})`
    );
  }

  test('enables auto-mode with one confirm click and chains through SPECIFY → PLAN → BUILD', async ({
    page,
    request,
    projectId,
  }) => {
    const createResp = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Auto-mode happy path',
        description: 'Chain INBOX → BUILD',
      },
    });
    expect(createResp.ok()).toBe(true);
    const { id: ticketId } = await createResp.json();

    await page.goto(`${BASE_URL}/projects/${projectId}/board`);

    const card = page.locator(`[data-ticket-id="${ticketId}"]`);
    await expect(card).toBeVisible({ timeout: 10000 });

    // Hover the card to reveal hover-only icons (fast-forward + cancel)
    await card.hover();

    const icon = card.locator('[data-testid="auto-mode-icon"]');
    await expect(icon).toBeVisible();

    await icon.click();

    // Confirmation modal must appear before anything is dispatched (FR-008/012)
    const preview = page.locator('[data-testid="auto-mode-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText('SPECIFY → PLAN → BUILD will run automatically.');

    await page.locator('[data-testid="auto-mode-confirm"]').click();

    // SPECIFY job should be dispatched
    await waitForStage(ticketId, 'SPECIFY');

    // Complete each pending stage job to drive the chain
    await completeLatestStageJob(request, ticketId);
    await waitForStage(ticketId, 'PLAN');

    await completeLatestStageJob(request, ticketId);
    await waitForStage(ticketId, 'BUILD');

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: { orderBy: { id: 'asc' } } },
    });

    expect(ticket?.stage).toBe('BUILD');
    expect(ticket?.autoMode).toBe(true);
    const commands = ticket?.jobs.map((j) => j.command) ?? [];
    expect(commands).toEqual(expect.arrayContaining(['specify', 'plan', 'implement']));
  });
});
