import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, cleanupDatabase } from '../../helpers/db-cleanup';

/**
 * E2E Tests: Board Real-Time Update on Workflow Stage Transitions
 * Feature: 068-923-update-the
 *
 * Tests verify that the board automatically updates when workflows complete
 * and transition tickets between stages, without requiring manual page refresh.
 */

test.describe('Board - Workflow-Initiated Stage Transitions', () => {
  const BASE_URL = 'http://localhost:3000';
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = getPrismaClient();
  });

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('should update board when workflow transitions ticket to VERIFY', async ({ page }) => {
    // Create ticket in BUILD stage with associated job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Workflow transition test',
        description: 'Test workflow-initiated stage transition',
        stage: 'BUILD',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Create a RUNNING job for this ticket
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'test-workflow',
        status: 'RUNNING',
        branch: 'test-branch',
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);

    // Verify ticket in BUILD column
    const buildColumn = page.locator('[data-stage="BUILD"]');
    await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Simulate workflow completion: Update ticket stage and mark job as COMPLETED
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { stage: 'VERIFY' },
      }),
      prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
    ]);

    // Wait for board to update (within 3 seconds - 2s polling + buffer)
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    await expect(verifyColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible({
      timeout: 3000,
    });

    // Verify ticket no longer in BUILD column
    await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();
  });

  test('should update board when quick-impl workflow completes', async ({ page }) => {
    // Create ticket in INBOX stage
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Quick-impl workflow test',
        description: 'Test quick-impl workflow completion',
        stage: 'INBOX',
        projectId: 1,
        workflowType: 'QUICK',
        updatedAt: new Date(),
      },
    });

    await page.goto(`${BASE_URL}/projects/1/board`);

    // Verify ticket in INBOX column
    const inboxColumn = page.locator('[data-stage="INBOX"]');
    await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Create a RUNNING job for quick-impl
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'RUNNING',
        branch: 'test-branch',
        updatedAt: new Date(),
      },
    });

    // Simulate quick-impl completion: Transition ticket to BUILD and complete job
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { stage: 'BUILD' },
      }),
      prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
    ]);

    // Wait for board to update (ticket should appear in BUILD after workflow)
    const buildColumn = page.locator('[data-stage="BUILD"]');
    await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible({
      timeout: 3000,
    });

    // Verify ticket no longer in INBOX column
    await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();
  });

  test('should not break manual drag-and-drop transitions', async ({ page }) => {
    // Regression test: Ensure cache invalidation doesn't interfere with manual transitions
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Manual transition test',
        description: 'Verify manual transitions still work',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await page.goto(`${BASE_URL}/projects/1/board`);

    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    const specifyColumn = page.locator('[data-stage="SPECIFY"]');

    // Drag ticket from INBOX to SPECIFY
    await ticketCard.dragTo(specifyColumn);

    // Verify immediate optimistic update (should be visible quickly)
    // Note: We use a generous timeout because drag-and-drop may take a moment
    await expect(specifyColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible({
      timeout: 2000,
    });

    // Verify ticket no longer in INBOX
    const inboxColumn = page.locator('[data-stage="INBOX"]');
    await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();
  });
});
