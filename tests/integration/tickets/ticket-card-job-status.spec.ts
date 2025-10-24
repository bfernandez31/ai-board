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

    // Verify aria-label contains status information (RUNNING → WRITING for specify)
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel).toContain('specify');
    expect(ariaLabel?.toLowerCase()).toContain('writing');

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

      // Verify aria-label contains command and contextual status
      const ariaLabel = await statusIndicator.getAttribute('aria-label');
      expect(ariaLabel).toContain(testCase.command);

      // Check contextual label based on command/status
      if (testCase.status === 'RUNNING' && testCase.command === 'specify') {
        expect(ariaLabel?.toLowerCase()).toContain('writing');
      } else if (testCase.status === 'RUNNING' && testCase.command === 'build') {
        expect(ariaLabel?.toLowerCase()).toContain('coding');
      } else {
        expect(ariaLabel?.toLowerCase()).toContain(testCase.status.toLowerCase());
      }
    }

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  });

  /**
   * T011: Integration test for workflow job visual indicator
   */
  test('should display simplified workflow status for specify command', async ({ page }) => {
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

    // Workflow jobs now display simplified (no prefix) - just status
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]').first();
    await expect(statusIndicator).toBeVisible();

    // Should NOT contain stage prefix (US1: simplified display)
    await expect(statusIndicator).not.toContainText('SPECIFY :');

    // Should contain contextual label WRITING
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('WRITING');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  /**
   * T012: Integration test for AI-BOARD job visual indicator
   */
  test('should display compact AI-BOARD icon for comment-specify command', async ({ page }) => {
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

    // AI-BOARD jobs now display as compact icon-only (US2: no text label)
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]').first();
    await expect(statusIndicator).toBeVisible();

    // Should NOT contain text label (icon-only display)
    await expect(statusIndicator).not.toContainText('AI-BOARD');

    // Verify ARIA label contains AI-BOARD information
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});

/**
 * T016: Integration tests for workflow job contextual labels (User Story 1)
 *
 * Tests that workflow jobs display contextual labels:
 * - WRITING for specify/plan commands
 * - CODING for implement/quick-impl commands
 * - Original status for non-RUNNING states (COMPLETED, FAILED, CANCELLED)
 */
test.describe('Integration: Workflow Job Contextual Labels (US1)', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display WRITING label for specify command with RUNNING status', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test WRITING label for specify',
        description: 'Testing contextual WRITING label',
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
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify aria-label contains "WRITING" instead of "RUNNING"
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('WRITING');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display WRITING label for plan command with RUNNING status', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test WRITING label for plan',
        description: 'Testing contextual WRITING label for plan',
        stage: 'PLAN',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'plan',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('WRITING');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display CODING label for implement command with RUNNING status', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test CODING label for implement',
        description: 'Testing contextual CODING label',
        stage: 'BUILD',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'implement',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('CODING');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display CODING label for quick-impl command with RUNNING status', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test CODING label for quick-impl',
        description: 'Testing contextual CODING label for quick-impl',
        stage: 'BUILD',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('CODING');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display original COMPLETED status for workflow jobs', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test COMPLETED status preserved',
        description: 'Testing that COMPLETED status is not transformed',
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
        status: 'COMPLETED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('completed');
    // Should NOT contain WRITING/CODING
    expect(ariaLabel?.toUpperCase()).not.toContain('WRITING');
    expect(ariaLabel?.toUpperCase()).not.toContain('CODING');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display original FAILED status prominently for workflow jobs', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test FAILED status preserved',
        description: 'Testing that FAILED status is displayed prominently',
        stage: 'PLAN',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'plan',
        status: 'FAILED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('failed');
    // Should NOT contain WRITING/CODING
    expect(ariaLabel?.toUpperCase()).not.toContain('WRITING');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display original CANCELLED status for workflow jobs', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test CANCELLED status preserved',
        description: 'Testing that CANCELLED status is not transformed',
        stage: 'BUILD',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'implement',
        status: 'CANCELLED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('cancelled');
    // Should NOT contain CODING
    expect(ariaLabel?.toUpperCase()).not.toContain('CODING');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});

/**
 * T025: Integration tests for AI-BOARD job stage filtering (User Story 2)
 *
 * Tests that AI-BOARD jobs display with stage-filtered visibility:
 * - Visible when stage matches (comment-specify in SPECIFY stage)
 * - Hidden when stage mismatches (comment-specify in PLAN stage)
 * - ASSISTING label displayed correctly
 */
test.describe('Integration: AI-BOARD Job Stage Filtering (US2)', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display AI-BOARD job when stage matches (comment-specify in SPECIFY)', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test AI-BOARD stage match',
        description: 'Testing AI-BOARD job visibility with stage match',
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
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify AI-BOARD ARIA label (compact icon-only mode)
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should NOT display AI-BOARD job when stage mismatches (comment-specify in PLAN)', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test AI-BOARD stage mismatch',
        description: 'Testing AI-BOARD job hidden when stage does not match',
        stage: 'PLAN', // Ticket in PLAN stage
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-specify', // Job is comment-specify (should only show in SPECIFY)
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // No job indicator should be visible (stage mismatch)
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).not.toBeVisible();

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display AI-BOARD job for comment-plan in PLAN stage', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test AI-BOARD plan stage',
        description: 'Testing AI-BOARD job in PLAN stage',
        stage: 'PLAN',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-plan',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display AI-BOARD job for comment-build in BUILD stage', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test AI-BOARD build stage',
        description: 'Testing AI-BOARD job in BUILD stage',
        stage: 'BUILD',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-build',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should hide old AI-BOARD job when ticket moves to different stage', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test AI-BOARD stage transition',
        description: 'Testing AI-BOARD job visibility after stage change',
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
        status: 'COMPLETED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    // Initially in SPECIFY stage with comment-specify job
    let ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Now move ticket to PLAN stage (simulate stage transition)
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'PLAN' },
    });

    // Reload to see updated state
    await page.reload();

    // Find ticket in PLAN column
    const planColumn = page.locator('[data-testid="stage-column"]').filter({ hasText: 'Plan' }).first();
    ticketCard = planColumn.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title });
    await expect(ticketCard).toBeVisible();

    // Old comment-specify job should NOT be visible in PLAN stage
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).not.toBeVisible();

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display ASSISTING label with compact AI-BOARD icon', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test AI-BOARD job type indicator',
        description: 'Testing AI-BOARD job type visual indicator',
        stage: 'VERIFY',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-verify',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // AI-BOARD jobs display as compact icon-only (US2)
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]').first();
    await expect(statusIndicator).toBeVisible();

    // Should NOT contain text label (icon-only)
    await expect(statusIndicator).not.toContainText('AI-BOARD');

    // ARIA label should contain ASSISTING
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
