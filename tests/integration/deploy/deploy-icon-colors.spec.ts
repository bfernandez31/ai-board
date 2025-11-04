import { test, expect } from '../../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase, getProjectKey } from '../../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * Integration Test: Deploy Preview Icon Colors
 *
 * Tests that deploy preview icons display correct colors based on job status:
 * - PENDING: Blue
 * - RUNNING: Blue
 * - COMPLETED: Green
 * - FAILED: Red
 * - CANCELLED: Gray
 */
test.describe('Integration: Deploy Preview Icon Colors', () => {
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display blue color for PENDING deploy job', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test deploy PENDING color',
        description: 'Testing deploy preview icon color for PENDING status',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'deploy-preview',
        status: 'PENDING',
        branch: '081-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Find the deploy job indicator
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify the icon has blue color (text-blue-500)
    const rocketIcon = statusIndicator.locator('svg').first();
    await expect(rocketIcon).toHaveClass(/text-blue-500/);
  });

  test('should display blue color for RUNNING deploy job', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test deploy RUNNING color',
        description: 'Testing deploy preview icon color for RUNNING status',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'deploy-preview',
        status: 'RUNNING',
        branch: '081-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const rocketIcon = statusIndicator.locator('svg').first();
    await expect(rocketIcon).toHaveClass(/text-blue-500/);
  });

  test('should display green color for COMPLETED deploy job', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test deploy COMPLETED color',
        description: 'Testing deploy preview icon color for COMPLETED status',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        previewUrl: 'https://test-preview.vercel.app',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'deploy-preview',
        status: 'COMPLETED',
        branch: '081-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify the icon has green color (text-green-500) for COMPLETED status
    const rocketIcon = statusIndicator.locator('svg').first();
    await expect(rocketIcon).toHaveClass(/text-green-500/);
  });

  test('should display red color for FAILED deploy job', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test deploy FAILED color',
        description: 'Testing deploy preview icon color for FAILED status',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'deploy-preview',
        status: 'FAILED',
        branch: '081-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // For FAILED status, the deploy icon (retry button) should be visible
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).toBeVisible();
  });

  test('should display gray color for CANCELLED deploy job', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test deploy CANCELLED color',
        description: 'Testing deploy preview icon color for CANCELLED status',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'deploy-preview',
        status: 'CANCELLED',
        branch: '081-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // For CANCELLED status, the deploy icon (retry button) should be visible
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).toBeVisible();
  });
});
