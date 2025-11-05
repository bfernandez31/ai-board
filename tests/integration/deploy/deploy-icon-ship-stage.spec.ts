import { test, expect } from '../../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase, getProjectKey } from '../../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * Integration Test: Deploy Icon Should Not Appear in SHIP Stage
 *
 * Tests that deploy button is NOT shown on tickets in SHIP stage,
 * even if they have a branch and completed verify job.
 *
 * Bug: AIB-63 - Deploy button incorrectly showing on SHIP stage
 */
test.describe('Integration: Deploy Icon SHIP Stage', () => {
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should NOT show deploy button on SHIP stage ticket', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] SHIP stage ticket',
        description: 'Testing that deploy button is not shown on SHIP stage',
        stage: 'SHIP',
        projectId,
        branch: '087-test-branch',
        updatedAt: new Date(),
      },
    });

    // Create a completed verify job (would make it deployable if it was VERIFY stage)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '087-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify deploy button is NOT visible
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).not.toBeVisible();
  });

  test('should NOT show deploy button on SHIP stage ticket with preview URL', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] SHIP stage with preview',
        description: 'Testing deploy button not shown on SHIP even with preview',
        stage: 'SHIP',
        projectId,
        branch: '087-test-branch',
        previewUrl: 'https://test-preview.vercel.app',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '087-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Preview icon should be visible
    const previewIcon = ticketCard.locator('[data-testid="preview-icon"]');
    await expect(previewIcon).toBeVisible();

    // Deploy button should NOT be visible
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).not.toBeVisible();
  });

  test('should show deploy button on VERIFY stage but NOT on SHIP stage', async ({ page, projectId }) => {
    // Create ticket in VERIFY stage
    const verifyTicketNumber = nextTicketNumber++;
    const verifyTicket = await prisma.ticket.create({
      data: {
        ticketNumber: verifyTicketNumber,
        ticketKey: `${getProjectKey(projectId)}-${verifyTicketNumber}`,
        title: '[e2e] VERIFY stage ticket',
        description: 'Ticket in VERIFY stage should show deploy button',
        stage: 'VERIFY',
        projectId,
        branch: '087-verify-branch',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: verifyTicket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '087-verify-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create ticket in SHIP stage
    const shipTicketNumber = nextTicketNumber++;
    const shipTicket = await prisma.ticket.create({
      data: {
        ticketNumber: shipTicketNumber,
        ticketKey: `${getProjectKey(projectId)}-${shipTicketNumber}`,
        title: '[e2e] SHIP stage ticket',
        description: 'Ticket in SHIP stage should NOT show deploy button',
        stage: 'SHIP',
        projectId,
        branch: '087-ship-branch',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: shipTicket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '087-ship-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Verify VERIFY stage ticket shows deploy button
    const verifyCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: verifyTicket.title }).first();
    await expect(verifyCard).toBeVisible();
    const verifyDeployIcon = verifyCard.locator('[data-testid="deploy-icon"]');
    await expect(verifyDeployIcon).toBeVisible();

    // Verify SHIP stage ticket does NOT show deploy button
    const shipCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: shipTicket.title }).first();
    await expect(shipCard).toBeVisible();
    const shipDeployIcon = shipCard.locator('[data-testid="deploy-icon"]');
    await expect(shipDeployIcon).not.toBeVisible();
  });

  test('should NOT show retry deploy button on SHIP stage ticket with FAILED deploy job', async ({ page, projectId }) => {
    // This is the actual bug: if a ticket was deployed in VERIFY, failed,
    // then moved to SHIP, it should NOT show the retry button
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] SHIP with failed deploy',
        description: 'Ticket in SHIP stage should NOT show retry button',
        stage: 'SHIP',
        projectId,
        branch: '087-ship-failed',
        updatedAt: new Date(),
      },
    });

    // Ticket has a FAILED deploy job from when it was in VERIFY stage
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'deploy-preview',
        status: 'FAILED',
        branch: '087-ship-failed',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Deploy button should NOT be visible (no retry in SHIP stage)
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).not.toBeVisible();
  });

  test('should NOT show retry deploy button on SHIP stage ticket with COMPLETED deploy job', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] SHIP with completed deploy',
        description: 'Ticket in SHIP stage should NOT show retry button even with completed deploy',
        stage: 'SHIP',
        projectId,
        branch: '087-ship-completed',
        previewUrl: 'https://test-preview.vercel.app',
        updatedAt: new Date(),
      },
    });

    // Ticket has a COMPLETED deploy job from when it was in VERIFY stage
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'deploy-preview',
        status: 'COMPLETED',
        branch: '087-ship-completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Preview icon should be visible
    const previewIcon = ticketCard.locator('[data-testid="preview-icon"]');
    await expect(previewIcon).toBeVisible();

    // Deploy button should NOT be visible (no retry in SHIP stage)
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).not.toBeVisible();
  });
});
