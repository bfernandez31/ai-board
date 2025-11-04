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

    // Verify preview icon is visible (ExternalLink icon)
    const previewIcon = ticketCard.locator('[data-testid="preview-icon"]');
    await expect(previewIcon).toBeVisible();

    // Verify deploy button is visible (for redeployment)
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).toBeVisible();
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

    // Verify preview icon is NOT visible
    const previewIcon = ticketCard.locator('[data-testid="preview-icon"]');
    await expect(previewIcon).not.toBeVisible();

    // Verify deploy button IS visible (since ticket is deployable)
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).toBeVisible();
  });

  test('should show only preview icon for ticket with previewUrl but no current deploy job', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test preview icon only',
        description: 'Testing that preview icon is shown when previewUrl exists',
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

    // Verify preview icon IS visible
    const previewIcon = ticketCard.locator('[data-testid="preview-icon"]');
    await expect(previewIcon).toBeVisible();

    // Verify deploy button IS visible (for redeployment)
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).toBeVisible();
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

    // Verify deploy button (rocket icon) is NOT visible (replaced by status indicator)
    const deployIcon = ticketCard.locator('[data-testid="deploy-icon"]');
    await expect(deployIcon).not.toBeVisible();

    // Verify job status indicator IS visible
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();
  });

  test('should disable deploy icons on other tickets when one ticket has PENDING deployment', async ({ page, projectId }) => {
    // Create ticket A with PENDING deployment
    const ticketNumberA = nextTicketNumber++;
    const ticketA = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumberA,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumberA}`,
        title: '[e2e] Ticket A with PENDING deployment',
        description: 'Ticket with active deployment',
        stage: 'VERIFY',
        projectId,
        branch: '081-test-branch-a',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticketA.id,
        projectId,
        command: 'deploy-preview',
        status: 'PENDING',
        branch: '081-test-branch-a',
        updatedAt: new Date(),
      },
    });

    // Create ticket B (deployable, but should be disabled)
    const ticketNumberB = nextTicketNumber++;
    const ticketB = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumberB,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumberB}`,
        title: '[e2e] Ticket B should be disabled',
        description: 'Ticket that should have disabled deploy icon',
        stage: 'VERIFY',
        projectId,
        branch: '082-test-branch-b',
        updatedAt: new Date(),
      },
    });

    // Make ticket B deployable
    await prisma.job.create({
      data: {
        ticketId: ticketB.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '082-test-branch-b',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Verify ticket B's deploy icon is visible but disabled
    const ticketCardB = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticketB.title }).first();
    await expect(ticketCardB).toBeVisible();

    const deployIconB = ticketCardB.locator('[data-testid="deploy-icon"]');
    await expect(deployIconB).toBeVisible();
    await expect(deployIconB).toBeDisabled();
  });

  test('should re-enable deploy icons when deployment completes', async ({ page, projectId }) => {
    // Create ticket A with RUNNING deployment
    const ticketNumberA = nextTicketNumber++;
    const ticketA = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumberA,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumberA}`,
        title: '[e2e] Ticket A deployment completes',
        description: 'Ticket with deployment that will complete',
        stage: 'VERIFY',
        projectId,
        branch: '083-test-branch-a',
        updatedAt: new Date(),
      },
    });

    const jobA = await prisma.job.create({
      data: {
        ticketId: ticketA.id,
        projectId,
        command: 'deploy-preview',
        status: 'RUNNING',
        branch: '083-test-branch-a',
        updatedAt: new Date(),
      },
    });

    // Create ticket B (deployable)
    const ticketNumberB = nextTicketNumber++;
    const ticketB = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumberB,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumberB}`,
        title: '[e2e] Ticket B should re-enable',
        description: 'Ticket that should have re-enabled deploy icon',
        stage: 'VERIFY',
        projectId,
        branch: '084-test-branch-b',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticketB.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '084-test-branch-b',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Verify ticket B is initially disabled
    const ticketCardB = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticketB.title }).first();
    const deployIconB = ticketCardB.locator('[data-testid="deploy-icon"]');
    await expect(deployIconB).toBeDisabled();

    // Complete the deployment on ticket A
    await prisma.job.update({
      where: { id: jobA.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Wait for polling to detect the change (2 second polling interval + buffer)
    await page.waitForTimeout(3000);

    // Verify ticket B's deploy icon is now enabled
    await expect(deployIconB).not.toBeDisabled();
  });

  test('should keep old preview icon visible during new deployment (seamless transition)', async ({ page, projectId }) => {
    // Create ticket A with existing preview
    const ticketNumberA = nextTicketNumber++;
    const ticketA = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumberA,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumberA}`,
        title: '[e2e] Ticket A with old preview',
        description: 'Ticket with existing preview URL',
        stage: 'VERIFY',
        projectId,
        branch: '085-test-branch-a',
        previewUrl: 'https://old-preview.vercel.app',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticketA.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        branch: '085-test-branch-a',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create ticket B with PENDING deployment
    const ticketNumberB = nextTicketNumber++;
    const ticketB = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumberB,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumberB}`,
        title: '[e2e] Ticket B new deployment',
        description: 'Ticket with new deployment in progress',
        stage: 'VERIFY',
        projectId,
        branch: '086-test-branch-b',
        previewUrl: null,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticketB.id,
        projectId,
        command: 'deploy-preview',
        status: 'PENDING',
        branch: '086-test-branch-b',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Verify old preview icon is still visible on ticket A
    const ticketCardA = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticketA.title }).first();
    const previewIconA = ticketCardA.locator('[data-testid="preview-icon"]');
    await expect(previewIconA).toBeVisible();

    // Verify ticket B shows loading indicator (no preview yet)
    const ticketCardB = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticketB.title }).first();
    const previewIconB = ticketCardB.locator('[data-testid="preview-icon"]');
    await expect(previewIconB).not.toBeVisible();
  });
});
