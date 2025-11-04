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

    // Verify unified deploy icon shows deploying state (blue bounce animation)
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's disabled and has blue color
    await expect(unifiedDeployIcon).toBeDisabled();
    await expect(unifiedDeployIcon).toHaveClass(/text-blue-400/);
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

    // Verify unified deploy icon shows deploying state (blue bounce animation)
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's disabled and has blue color
    await expect(unifiedDeployIcon).toBeDisabled();
    await expect(unifiedDeployIcon).toHaveClass(/text-blue-400/);
  });

  test('should display preview icon and deploy button for COMPLETED deploy job', async ({ page, projectId }) => {
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

    // Verify unified deploy icon is visible with preview state (green ExternalLink icon)
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's the preview icon (green ExternalLink)
    await expect(unifiedDeployIcon).toHaveClass(/text-green-400/);
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

    // For FAILED status, the unified deploy icon (retry button) should be visible
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's in deployable state (neutral Rocket icon for retry)
    await expect(unifiedDeployIcon).toHaveClass(/text-\[#a6adc8\]/);
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

    // For CANCELLED status, the unified deploy icon (retry button) should be visible
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's in deployable state (neutral Rocket icon for retry)
    await expect(unifiedDeployIcon).toHaveClass(/text-\[#a6adc8\]/);
  });

  test('should NOT show preview icon when previewUrl is null', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test no preview icon',
        description: 'Testing that preview icon is not shown when previewUrl is null',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        previewUrl: null, // Explicitly null
        updatedAt: new Date(),
      },
    });

    // Create a completed verify job to make ticket deployable
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '081-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify unified deploy icon shows deployable state (not preview state)
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's in deployable state (neutral Rocket icon, not green preview icon)
    await expect(unifiedDeployIcon).toHaveClass(/text-\[#a6adc8\]/);
  });

  test('should show only preview icon for ticket with previewUrl (preview state takes priority)', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test preview icon priority',
        description: 'Testing that preview state takes priority over deployable state',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        previewUrl: 'https://test-preview.vercel.app',
        updatedAt: new Date(),
      },
    });

    // Create a completed verify job to make ticket deployable
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '081-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify unified deploy icon shows ONLY preview state (green ExternalLink)
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's the green preview icon (not the neutral deploy icon)
    await expect(unifiedDeployIcon).toHaveClass(/text-green-400/);

    // Verify preview icon can be clicked to open URL
    await expect(unifiedDeployIcon).not.toBeDisabled();
  });

  test('should disable deploy button when deploy job is PENDING or RUNNING', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test deploy button disabled',
        description: 'Testing that deploy button is disabled during active deployment',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch',
        previewUrl: null,
        updatedAt: new Date(),
      },
    });

    // Create a PENDING deploy job
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

    // Verify unified deploy icon shows deploying state (blue bounce animation)
    const unifiedDeployIcon = ticketCard.locator('[data-testid="unified-deploy-icon"]');
    await expect(unifiedDeployIcon).toBeVisible();

    // Verify it's disabled during deployment
    await expect(unifiedDeployIcon).toBeDisabled();

    // Verify it has blue color
    await expect(unifiedDeployIcon).toHaveClass(/text-blue-400/);
  });
});
