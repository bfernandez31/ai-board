import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase } from '../../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * Integration Test: JobStatusIndicator in TicketCard (T027)
 *
 * Tests that ticket cards correctly display job status indicators
 * based on the current job state.
 *
 * Success Criteria:
 * - Ticket with RUNNING job shows JobStatusIndicator
 * - Ticket with no job shows clean card (no status indicator)
 * - JobStatusIndicator receives correct props (status, command)
 */
test.describe('Integration: JobStatusIndicator in TicketCard', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display JobStatusIndicator for ticket with RUNNING job', async ({ page }) => {
    // Create ticket with a RUNNING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test ticket with job',
        description: 'Ticket for testing job status indicator',
        stage: 'SPECIFY',
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

    // Find ticket card by title text
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify JobStatusIndicator is present
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify aria-label contains status information
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel).toContain('specify');
    expect(ariaLabel?.toLowerCase()).toContain('running');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display JobStatusIndicator for ticket with PENDING job', async ({ page }) => {
    // Create ticket with a PENDING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test ticket with pending job',
        description: 'Ticket for testing pending job status',
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

    // Find ticket card by title text
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify JobStatusIndicator is present
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify aria-label indicates PENDING status
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('pending');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display JobStatusIndicator for ticket with COMPLETED job', async ({ page }) => {
    // Create ticket with a COMPLETED job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test ticket with completed job',
        description: 'Ticket for testing completed job status',
        stage: 'PLAN',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'plan',
        status: 'COMPLETED',
        branch: '020-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card by title text
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify JobStatusIndicator is present
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify aria-label indicates COMPLETED status
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('completed');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should NOT display JobStatusIndicator for ticket with no jobs', async ({ page }) => {
    // Create ticket without any jobs
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test ticket without job',
        description: 'Ticket for testing no job status indicator',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card by title text
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify JobStatusIndicator is NOT present
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).not.toBeVisible();

    // Verify ticket card shows clean design (title still visible)
    const ticketTitle = ticketCard.locator('h3').filter({ hasText: '[e2e] Test ticket without job' });
    await expect(ticketTitle).toBeVisible();

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display correct command and status in indicator', async ({ page }) => {
    // Create tickets with different job commands
    const testCases = [
      { command: 'specify', status: 'RUNNING' as const, stage: 'SPECIFY' as const },
      { command: 'plan', status: 'PENDING' as const, stage: 'PLAN' as const },
      { command: 'build', status: 'FAILED' as const, stage: 'BUILD' as const },
    ];

    const ticketIds: number[] = [];
    const jobIds: number[] = [];

    for (const testCase of testCases) {
      const ticket = await prisma.ticket.create({
        data: {
          title: `[e2e] Test ${testCase.command} command`,
          description: `Testing ${testCase.command} job indicator`,
          stage: testCase.stage,
          projectId: 1,
          updatedAt: new Date(), // Required field
        },
      });
      ticketIds.push(ticket.id);

      const job = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: testCase.command,
          status: testCase.status,
          branch: testCase.status === 'PENDING' ? null : '020-test-branch',
          completedAt: testCase.status === 'FAILED' ? new Date() : null,
          updatedAt: new Date(), // Required field
        },
      });
      jobIds.push(job.id);
    }

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify each ticket shows correct job status indicator
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]!;
      const ticketTitle = `[e2e] Test ${testCase.command} command`;

      const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticketTitle }).first();
      await expect(ticketCard).toBeVisible();

      const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
      await expect(statusIndicator).toBeVisible();

      // Verify aria-label contains command and status
      const ariaLabel = await statusIndicator.getAttribute('aria-label');
      expect(ariaLabel).toContain(testCase.command);
      expect(ariaLabel?.toLowerCase()).toContain(testCase.status.toLowerCase());
    }

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  });

  /**
   * T011: Integration test for workflow job visual indicator
   */
  test('should display workflow icon for specify command', async ({ page }) => {
    // Create ticket with workflow job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test workflow job type',
        description: 'Testing workflow job type visual indicator',
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

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify job type indicator exists
    const jobTypeIndicator = ticketCard.locator('[data-testid="job-type-indicator"]');
    await expect(jobTypeIndicator).toBeVisible();

    // Verify job type indicator contains "Workflow" label
    await expect(jobTypeIndicator).toContainText('Workflow');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  /**
   * T012: Integration test for AI-BOARD job visual indicator
   */
  test('should display AI-BOARD icon for comment-specify command', async ({ page }) => {
    // Create ticket with AI-BOARD job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test AI-BOARD job type',
        description: 'Testing AI-BOARD job type visual indicator',
        stage: 'SPECIFY',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-specify',
        status: 'RUNNING',
        branch: '045-test-branch',
        updatedAt: new Date(),
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify job type indicator exists
    const jobTypeIndicator = ticketCard.locator('[data-testid="job-type-indicator"]');
    await expect(jobTypeIndicator).toBeVisible();

    // Verify job type indicator contains "AI-BOARD" label
    await expect(jobTypeIndicator).toContainText('AI-BOARD');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
