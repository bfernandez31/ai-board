import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase } from '../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * E2E Tests: Job Type Visual Distinction
 *
 * Tests user-facing behavior for job type indicators.
 */
test.describe('Job Type Visual Distinction - E2E', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T013: Test visibility without hover interaction
   */
  test('should display visual distinction without hover', async ({ page }) => {
    // Create ticket with workflow job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Visual Distinction Test',
        description: 'Testing no-hover visibility',
        stage: 'SPECIFY',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
        branch: '045-test-branch',
        updatedAt: new Date(),
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="job-type-indicator"]');

    // Verify visibility without hover (no mouse movement)
    const indicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(indicator).toBeVisible();

    // Verify indicator is visible immediately (no hover required)
    const isVisible = await indicator.isVisible();
    expect(isVisible).toBe(true);

    // Verify text content is visible
    await expect(indicator).toContainText('Workflow');

    // Clean up
    await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  /**
   * T014: Test real-time job status indicator updates
   * Note: Job commands don't change in real workflows - testing status updates instead
   */
  test('should update job status indicator in real-time when status changes', async ({ page }) => {
    // Create ticket with running workflow job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Real-time Update Test',
        description: 'Testing real-time indicator updates',
        stage: 'SPECIFY',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
        branch: '045-test-branch',
        updatedAt: new Date(),
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="job-status-indicator"]');

    // Verify initial state (RUNNING + Workflow)
    const statusIndicator = page.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toContainText('RUNNING');

    const typeIndicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(typeIndicator).toContainText('Workflow');

    // Update job status to COMPLETED
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Wait for updated status (polling will detect change within 2 seconds)
    await expect(statusIndicator).toContainText('COMPLETED', { timeout: 5000 });

    // Job type should remain Workflow
    await expect(typeIndicator).toContainText('Workflow');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  /**
   * Additional test: Multiple tickets with different job types
   */
  test('should distinguish multiple job types on same board', async ({ page }) => {
    // Create workflow ticket
    const workflowTicket = await prisma.ticket.create({
      data: {
        title: '[e2e] Workflow Ticket',
        description: 'Workflow job',
        stage: 'SPECIFY',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: workflowTicket.id,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
        branch: '045-workflow',
        updatedAt: new Date(),
      },
    });

    // Create AI-BOARD ticket
    const aiBoardTicket = await prisma.ticket.create({
      data: {
        title: '[e2e] AI-BOARD Ticket',
        description: 'AI-BOARD job',
        stage: 'PLAN',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: aiBoardTicket.id,
        projectId: 1,
        command: 'comment-plan',
        status: 'RUNNING',
        branch: '045-ai-board',
        updatedAt: new Date(),
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify both tickets display correct job types
    const workflowCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'Workflow Ticket' });
    const workflowIndicator = workflowCard.locator('[data-testid="job-type-indicator"]');
    await expect(workflowIndicator).toContainText('Workflow');

    const aiBoardCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'AI-BOARD Ticket' });
    const aiBoardIndicator = aiBoardCard.locator('[data-testid="job-type-indicator"]');
    await expect(aiBoardIndicator).toContainText('AI-BOARD');

    // Clean up
    await prisma.job.deleteMany({ where: { ticketId: { in: [workflowTicket.id, aiBoardTicket.id] } } });
    await prisma.ticket.deleteMany({ where: { id: { in: [workflowTicket.id, aiBoardTicket.id] } } });
  });

  /**
   * T017: Test job type indicators in ticket detail modal
   * Note: This test verifies the current job indicator on ticket cards.
   * Full job history display in modal is not yet implemented.
   */
  test('should display job type indicator on ticket card (modal not yet implemented)', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Modal Job Type Test',
        description: 'Testing job type in context of modal',
        stage: 'SPECIFY',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-specify',
        status: 'RUNNING',
        branch: '045-modal-test',
        updatedAt: new Date(),
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify job type indicator on card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'Modal Job Type Test' });
    const indicator = ticketCard.locator('[data-testid="job-type-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('AI-BOARD');

    // Clean up
    await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  /**
   * T018: Test mixed job history display
   * Note: This test documents expected behavior for future implementation.
   * Currently validates that current job indicator works correctly.
   */
  test('should handle tickets with mixed job history', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Mixed Job History',
        description: 'Testing multiple job types over time',
        stage: 'BUILD',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Create completed workflow job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'COMPLETED',
        branch: '045-mixed-1',
        completedAt: new Date(Date.now() - 3600000), // 1 hour ago
        updatedAt: new Date(Date.now() - 3600000),
      },
    });

    // Create current AI-BOARD job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-build',
        status: 'RUNNING',
        branch: '045-mixed-2',
        updatedAt: new Date(),
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify current job (most recent) shows AI-BOARD indicator
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: 'Mixed Job History' });
    const indicator = ticketCard.locator('[data-testid="job-type-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('AI-BOARD');

    // Clean up
    await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  /**
   * T019: Accessibility tests for job type indicators
   */
  test.describe('Accessibility', () => {
    test('should have correct ARIA labels for workflow jobs', async ({ page }) => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] ARIA Test Workflow',
          description: 'Testing ARIA labels for workflow',
          stage: 'SPECIFY',
          projectId: 1,
          updatedAt: new Date(),
        },
      });

      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'RUNNING',
          branch: '045-aria-workflow',
          updatedAt: new Date(),
        },
      });

      await page.goto('http://localhost:3000/projects/1/board');

      const statusIndicator = page.locator('[data-testid="job-status-indicator"]').first();
      const ariaLabel = await statusIndicator.getAttribute('aria-label');

      expect(ariaLabel).toContain('specify');
      expect(ariaLabel).toContain('running');
      expect(ariaLabel).toContain('Automated workflow job');

      await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    test('should have correct ARIA labels for AI-BOARD jobs', async ({ page }) => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] ARIA Test AI-BOARD',
          description: 'Testing ARIA labels for AI-BOARD',
          stage: 'PLAN',
          projectId: 1,
          updatedAt: new Date(),
        },
      });

      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'comment-plan',
          status: 'RUNNING',
          branch: '045-aria-aiboard',
          updatedAt: new Date(),
        },
      });

      await page.goto('http://localhost:3000/projects/1/board');

      const statusIndicator = page.locator('[data-testid="job-status-indicator"]').first();
      const ariaLabel = await statusIndicator.getAttribute('aria-label');

      expect(ariaLabel).toContain('comment-plan');
      expect(ariaLabel).toContain('running');
      expect(ariaLabel).toContain('AI-BOARD assistance job');

      await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    test('should maintain responsive layout on mobile viewport', async ({ page }) => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] Responsive Test',
          description: 'Testing responsive layout',
          stage: 'SPECIFY',
          projectId: 1,
          updatedAt: new Date(),
        },
      });

      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'RUNNING',
          branch: '045-responsive',
          updatedAt: new Date(),
        },
      });

      // Set mobile viewport (320px minimum width)
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('http://localhost:3000/projects/1/board');

      // Verify indicator is visible and within viewport
      const indicator = page.locator('[data-testid="job-type-indicator"]').first();
      await expect(indicator).toBeVisible();

      const boundingBox = await indicator.boundingBox();
      expect(boundingBox).not.toBeNull();
      expect(boundingBox!.width).toBeLessThanOrEqual(320);

      await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });
});
