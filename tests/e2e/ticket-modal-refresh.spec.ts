import { test, expect } from '../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, cleanupDatabase, getProjectKey } from '../helpers/db-cleanup';

/**
 * E2E Tests: Ticket Modal Data Refresh (AIB-126)
 *
 * Tests that ticket modal shows up-to-date data when opened,
 * including branch information and Spec button visibility after job completion.
 */

test.describe('Ticket Modal Data Refresh', () => {
  const BASE_URL = 'http://localhost:3000';
  let prisma: PrismaClient;
  let nextTicketNumber = 1;

  test.beforeAll(() => {
    prisma = getPrismaClient();
  });

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test('should show branch and Spec button when opening modal after specify job completes', async ({ page, projectId }) => {
    // Setup: Create ticket in SPECIFY stage with branch and completed specify job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const branchName = `${ticketNumber}-test-branch`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Modal Refresh Test',
        description: 'Test ticket for modal data refresh',
        stage: 'SPECIFY',
        workflowType: 'FULL',
        branch: branchName,
        version: 2,
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create completed specify job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        branch: branchName,
        startedAt: new Date(Date.now() - 60000), // 1 minute ago
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Verify ticket is visible
    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketCard).toBeVisible();

    // Click ticket to open modal
    await ticketCard.click();

    // Wait for modal to open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Wait for network requests to complete after modal opens (invalidation triggers refetch)
    await page.waitForLoadState('networkidle');

    // Verify branch link is visible in modal
    const branchLink = modal.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).toBeVisible({ timeout: 10000 });
    await expect(branchLink).toContainText(branchName);

    // Details tab should be active by default, no need to click
    // Verify "Spec" button is visible (appears after completed specify job)
    // Look for button containing "Spec" text within the modal
    const specButton = modal.getByRole('button', { name: /Spec/i });
    await expect(specButton).toBeVisible({ timeout: 10000 });
  });

  test('should show updated stats when opening Stats tab after job completion', async ({ page, projectId }) => {
    // Setup: Create ticket with completed job that has telemetry data
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Stats Refresh Test',
        description: 'Test ticket for stats refresh',
        stage: 'SPECIFY',
        workflowType: 'FULL',
        branch: `${ticketNumber}-stats-branch`,
        version: 2,
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create completed job with telemetry data
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        branch: `${ticketNumber}-stats-branch`,
        startedAt: new Date(Date.now() - 120000), // 2 minutes ago
        completedAt: new Date(),
        updatedAt: new Date(),
        // Telemetry data
        inputTokens: 10000,
        outputTokens: 5000,
        cacheReadTokens: 2000,
        cacheCreationTokens: 1000,
        costUsd: 0.15,
        durationMs: 45000,
        model: 'claude-sonnet-4-5-20250929',
        toolsUsed: ['Read', 'Write', 'Grep'],
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Click ticket to open modal
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Wait for modal to open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Click Stats tab
    const statsTab = modal.locator('[data-testid="stats-tab-trigger"]');
    await expect(statsTab).toBeVisible();
    await statsTab.click();

    // Wait for stats content to load
    const statsContent = modal.locator('[data-testid="stats-tab-content"]');
    await expect(statsContent).toBeVisible();

    // Verify stats are displayed correctly
    const totalCost = statsContent.locator('[data-testid="total-cost"]');
    await expect(totalCost).toBeVisible();
    await expect(totalCost).not.toContainText('N/A'); // Should show actual cost

    const totalDuration = statsContent.locator('[data-testid="total-duration"]');
    await expect(totalDuration).toBeVisible();
    await expect(totalDuration).not.toContainText('N/A'); // Should show actual duration
  });

  test('should refresh ticket data when modal is reopened', async ({ page, projectId }) => {
    // Setup: Create ticket with branch and completed specify job from the start
    // This test verifies that opening the modal triggers data refresh
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const branchName = `${ticketNumber}-refresh-test-branch`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Reopen Modal Test',
        description: 'Test ticket for modal reopen',
        stage: 'SPECIFY',
        workflowType: 'FULL',
        branch: branchName,
        version: 2,
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create completed specify job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        branch: branchName,
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Open modal first time
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Wait for data to load
    await page.waitForLoadState('networkidle');

    // Verify branch link is visible
    const branchLink = modal.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).toBeVisible({ timeout: 10000 });
    await expect(branchLink).toContainText(branchName);

    // Verify Spec button is visible
    const specButton = modal.getByRole('button', { name: /Spec/i });
    await expect(specButton).toBeVisible({ timeout: 10000 });

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Reopen modal (tests that invalidation on open works)
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();
    await expect(modal).toBeVisible();

    // Wait for network requests to complete after modal opens (invalidation triggers refetch)
    await page.waitForLoadState('networkidle');

    // Verify data is still correctly displayed after reopening
    await expect(branchLink).toBeVisible({ timeout: 10000 });
    await expect(branchLink).toContainText(branchName);
    await expect(specButton).toBeVisible({ timeout: 10000 });
  });

  test('should show Plan and Tasks buttons after plan job completes', async ({ page, projectId }) => {
    // Setup: Create ticket in PLAN stage with completed specify and plan jobs
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const branchName = `${ticketNumber}-plan-test-branch`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Plan Modal Test',
        description: 'Test ticket for plan documentation buttons',
        stage: 'PLAN',
        workflowType: 'FULL',
        branch: branchName,
        version: 3,
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create completed specify job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        branch: branchName,
        startedAt: new Date(Date.now() - 120000),
        completedAt: new Date(Date.now() - 60000),
        updatedAt: new Date(Date.now() - 60000),
      },
    });

    // Create completed plan job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'plan',
        status: 'COMPLETED',
        branch: branchName,
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Click ticket to open modal
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Wait for modal to open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Wait for network requests to complete after modal opens (invalidation triggers refetch)
    await page.waitForLoadState('networkidle');

    // Verify all documentation buttons are visible
    const specButton = modal.getByRole('button', { name: /^Spec$/i });
    await expect(specButton).toBeVisible({ timeout: 10000 });

    const planButton = modal.getByRole('button', { name: /^Plan$/i });
    await expect(planButton).toBeVisible({ timeout: 10000 });

    const tasksButton = modal.getByRole('button', { name: /^Tasks$/i });
    await expect(tasksButton).toBeVisible({ timeout: 10000 });
  });
});
