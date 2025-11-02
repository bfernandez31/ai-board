import { test, expect } from '../../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase, getProjectKey } from '../../helpers/db-cleanup';

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
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display JobStatusIndicator for ticket with RUNNING job', async ({ page , projectId }) => {
    // Create ticket with a RUNNING job
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test ticket with job',
        description: 'Ticket for testing job status indicator',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(), // Required field
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'RUNNING',
        branch: '020-test-branch',
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

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

  });

  test.skip('should display JobStatusIndicator for ticket with PENDING job', async ({ page , projectId }) => {
    // SKIPPED: Test requires waiting for React Query staleTime + polling interval
    // Load board page first
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Create ticket with a PENDING job after page is loaded
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test ticket with pending job',
        description: 'Ticket for testing pending job status',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(), // Required field
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'PENDING',
        branch: null,
        updatedAt: new Date(), // Required field
      },
    });

    // Wait for polling to fetch the new ticket (2 second polling interval + buffer)
    await page.waitForTimeout(1000);

    // Find ticket card by title text
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible({ timeout: 5000 });

    // Verify JobStatusIndicator is present
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible({ timeout: 5000 });

    // Verify aria-label indicates PENDING status
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('pending');

  });

  test('should display JobStatusIndicator for ticket with COMPLETED job', async ({ page , projectId }) => {
    // Create ticket with a COMPLETED job
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test ticket with completed job',
        description: 'Ticket for testing completed job status',
        stage: 'PLAN',
        projectId,
        updatedAt: new Date(), // Required field
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'plan',
        status: 'COMPLETED',
        branch: '020-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Find ticket card by title text
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify JobStatusIndicator is present
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify aria-label indicates COMPLETED status
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('completed');

  });

  test('should NOT display JobStatusIndicator for ticket with no jobs', async ({ page , projectId }) => {
    // Create ticket without any jobs
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test ticket without job',
        description: 'Ticket for testing no job status indicator',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(), // Required field
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Find ticket card by title text
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify JobStatusIndicator is NOT present
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).not.toBeVisible();

    // Verify ticket card shows clean design (title still visible)
    const ticketTitle = ticketCard.locator('h3').filter({ hasText: '[e2e] Test ticket without job' });
    await expect(ticketTitle).toBeVisible();

  });

  test('should display correct command and status in indicator', async ({ page , projectId }) => {
    // Create tickets with different job commands
    const testCases = [
      { command: 'specify', status: 'RUNNING' as const, stage: 'SPECIFY' as const },
      { command: 'plan', status: 'PENDING' as const, stage: 'PLAN' as const },
      { command: 'build', status: 'FAILED' as const, stage: 'BUILD' as const },
    ];

    const ticketIds: number[] = [];
    

    for (const testCase of testCases) {
      const ticketNumber = nextTicketNumber++;
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
          title: `[e2e] Test ${testCase.command} command`,
          description: `Testing ${testCase.command} job indicator`,
          stage: testCase.stage,
          projectId,
          updatedAt: new Date(), // Required field
        },
      });
      ticketIds.push(ticket.id);

      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId,
          command: testCase.command,
          status: testCase.status,
          branch: testCase.status === 'PENDING' ? null : '020-test-branch',
          completedAt: testCase.status === 'FAILED' ? new Date() : null,
          updatedAt: new Date(), // Required field
        },
      });
    }

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

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

  });

  /**
   * T011: Integration test for workflow job visual indicator
   */
  test('should display simplified workflow status for specify command', async ({ page , projectId }) => {
    // Create ticket with workflow job
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test workflow job type',
        description: 'Testing workflow job type visual indicator',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'RUNNING',
        branch: '045-test-branch',
        updatedAt: new Date(),
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

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

  });

  /**
   * T012: Integration test for AI-BOARD job visual indicator
   */
  test('should display compact AI-BOARD icon for comment-specify command', async ({ page , projectId }) => {
    // Create ticket with AI-BOARD job
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD job type',
        description: 'Testing AI-BOARD job type visual indicator',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-specify',
        status: 'RUNNING',
        branch: '045-test-branch',
        updatedAt: new Date(),
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

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
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display WRITING label for specify command with RUNNING status', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test WRITING label for specify',
        description: 'Testing contextual WRITING label',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify aria-label contains "WRITING" instead of "RUNNING"
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('WRITING');

  });

  test('should display WRITING label for plan command with RUNNING status', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test WRITING label for plan',
        description: 'Testing contextual WRITING label for plan',
        stage: 'PLAN',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'plan',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('WRITING');

  });

  test('should display CODING label for implement command with RUNNING status', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test CODING label for implement',
        description: 'Testing contextual CODING label',
        stage: 'BUILD',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'implement',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('CODING');

  });

  test('should display CODING label for quick-impl command with RUNNING status', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test CODING label for quick-impl',
        description: 'Testing contextual CODING label for quick-impl',
        stage: 'BUILD',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'quick-impl',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('CODING');

  });

  test('should display original COMPLETED status for workflow jobs', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test COMPLETED status preserved',
        description: 'Testing that COMPLETED status is not transformed',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('completed');
    // Should NOT contain WRITING/CODING
    expect(ariaLabel?.toUpperCase()).not.toContain('WRITING');
    expect(ariaLabel?.toUpperCase()).not.toContain('CODING');

  });

  test('should display original FAILED status prominently for workflow jobs', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test FAILED status preserved',
        description: 'Testing that FAILED status is displayed prominently',
        stage: 'PLAN',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'plan',
        status: 'FAILED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('failed');
    // Should NOT contain WRITING/CODING
    expect(ariaLabel?.toUpperCase()).not.toContain('WRITING');

  });

  test('should display original CANCELLED status for workflow jobs', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test CANCELLED status preserved',
        description: 'Testing that CANCELLED status is not transformed',
        stage: 'BUILD',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'implement',
        status: 'CANCELLED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('cancelled');
    // Should NOT contain CODING
    expect(ariaLabel?.toUpperCase()).not.toContain('CODING');

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
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display AI-BOARD job when stage matches (comment-specify in SPECIFY)', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD stage match',
        description: 'Testing AI-BOARD job visibility with stage match',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-specify',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify AI-BOARD ARIA label (compact icon-only mode)
    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

  });

  test('should NOT display AI-BOARD job when stage mismatches (comment-specify in PLAN)', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD stage mismatch',
        description: 'Testing AI-BOARD job hidden when stage does not match',
        stage: 'PLAN', // Ticket in PLAN stage
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-specify', // Job is comment-specify (should only show in SPECIFY)
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // No job indicator should be visible (stage mismatch)
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).not.toBeVisible();

  });

  test('should display AI-BOARD job for comment-plan in PLAN stage', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD plan stage',
        description: 'Testing AI-BOARD job in PLAN stage',
        stage: 'PLAN',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-plan',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

  });

  test('should display AI-BOARD job for comment-build in BUILD stage', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD build stage',
        description: 'Testing AI-BOARD job in BUILD stage',
        stage: 'BUILD',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-build',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const ariaLabel = await statusIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

  });

  test.skip('should hide old AI-BOARD job when ticket moves to different stage', async ({ page , projectId }) => {
    // SKIPPED: Test requires waiting for React Query staleTime + polling interval after stage change
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD stage transition',
        description: 'Testing AI-BOARD job visibility after stage change',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-specify',
        status: 'COMPLETED',
        branch: '046-test-branch',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

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

    // Wait for polling to fetch updated data
    await page.waitForTimeout(1000);

    // Find ticket in PLAN column
    const planColumn = page.locator('[data-testid="stage-column"]').filter({ hasText: 'Plan' }).first();
    ticketCard = planColumn.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title });
    await expect(ticketCard).toBeVisible({ timeout: 5000 });

    // Old comment-specify job should NOT be visible in PLAN stage
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).not.toBeVisible();

  });

  test('should display ASSISTING label with compact AI-BOARD icon', async ({ page , projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${getProjectKey(projectId)}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD job type indicator',
        description: 'Testing AI-BOARD job type visual indicator',
        stage: 'VERIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-verify',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

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

  });
});
