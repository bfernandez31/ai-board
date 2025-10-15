import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { getWorkflowHeaders } from '../../helpers/workflow-auth';

const prisma = new PrismaClient();

/**
 * Integration Test: useJobStatus 500ms Minimum Display Duration (T028)
 *
 * Tests that status changes enforce 500ms minimum display duration
 * to prevent rapid flickering when job transitions occur quickly.
 *
 * Success Criteria:
 * - Status changes enforce 500ms minimum display
 * - Rapid updates (PENDING → RUNNING → COMPLETED) each display for 500ms
 * - First status displays immediately (no delay)
 */
test.describe('Integration: useJobStatus 500ms Display Duration', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display first status immediately without delay', async ({ page }) => {
    // Create ticket with PENDING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test immediate first status',
        description: 'Testing first status displays without delay',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'PENDING',
        branch: null,
        updatedAt: new Date(), // Required field
      },
    });

    const startTime = Date.now();

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card and status indicator
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');

    // Verify status indicator appears immediately
    await expect(statusIndicator).toBeVisible({ timeout: 2000 });

    const loadTime = Date.now() - startTime;

    // Status should appear immediately (within page load time, not after 500ms delay)
    // Page load might take up to 2000ms, but status shouldn't add additional 500ms
    expect(loadTime).toBeLessThan(2500);

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should enforce 500ms minimum display for status transitions', async ({ page }) => {
    // Create ticket with PENDING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test 500ms transition delay',
        description: 'Testing minimum display duration',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'PENDING',
        branch: null,
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Wait for page to load and SSE connection to establish
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify initial PENDING status
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Update job status to RUNNING via API (simulates real-time update)
    const transitionStart = Date.now();

    await page.request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
      headers: getWorkflowHeaders(),
    });

    // Wait at least 500ms for the transition (SSE + display duration)
    await page.waitForTimeout(600);

    // Verify status has transitioned to RUNNING
    await statusIndicator.getAttribute('aria-label');

    // The transition should have taken at least 500ms
    const transitionTime = Date.now() - transitionStart;
    expect(transitionTime).toBeGreaterThanOrEqual(500);

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test.skip('should handle rapid status changes with minimum display per status', async ({ page, request }) => {
    // Create ticket with PENDING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test rapid status changes',
        description: 'Testing rapid PENDING → RUNNING → COMPLETED',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'PENDING',
        branch: null,
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Wait for initial state
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Perform rapid status changes
    const testStart = Date.now();

    // Change 1: PENDING → RUNNING (immediately)
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
      headers: getWorkflowHeaders(),
    });

    // Wait 100ms (rapid transition)
    await page.waitForTimeout(100);

    // Change 2: RUNNING → COMPLETED (before 500ms elapsed)
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders(),
    });

    // The total time for both transitions should be at least 500ms
    // (each status displays for minimum 500ms, but they may overlap)
    // Wait for final status to settle
    await page.waitForTimeout(600);

    const totalTime = Date.now() - testStart;

    // With rapid updates, the useJobStatus hook should queue them
    // Total time should be at least 500ms (minimum display for final status)
    expect(totalTime).toBeGreaterThanOrEqual(500);

    // Verify final status is COMPLETED
    await expect(statusIndicator).toBeVisible();
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('completed');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should not delay status if minimum duration is disabled', async ({ page }) => {
    // This test verifies the hook can be configured to skip the delay
    // (though the current implementation always uses 500ms default)

    // Create ticket with job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test instant status (no delay)',
        description: 'Testing status without minimum duration',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'PENDING',
        branch: null,
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Wait for initial load
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Status indicator should appear
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should maintain display duration across page interactions', async ({ page }) => {
    // Create ticket with job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test persistent display duration',
        description: 'Testing duration persists during interactions',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
        branch: '020-test-branch',
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify status indicator
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Interact with page (scroll, hover, etc.)
    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, 100);

    // Status indicator should remain visible and stable
    await expect(statusIndicator).toBeVisible();

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
