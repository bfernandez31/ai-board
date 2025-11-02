import { test, expect } from '../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase, getProjectKey } from '../helpers/db-cleanup';

const prisma = new PrismaClient();

let nextTicketNumber = 1;

/**
 * T017: E2E test for User Story 1 - View Workflow Job Status
 *
 * Tests the complete user workflow of dragging a ticket to SPECIFY
 * and verifying the "WRITING" workflow job indicator appears with real-time updates.
 */
test.describe('E2E: Dual Job Display - User Story 1', () => {
  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Reset ticket counter
    nextTicketNumber = 1;

  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('user drags ticket to SPECIFY and sees WRITING workflow job indicator', async ({ page , projectId }) => {
    // Step 1: Create a ticket in INBOX stage (BEFORE navigating to board)
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test workflow job with WRITING label',
        description: 'E2E test for viewing workflow job status',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Step 2: Navigate to board (after ticket creation)
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Step 3: Verify ticket appears on board (anywhere)
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible({ timeout: 3000 });

    // Step 4: Verify no job indicator initially (ticket has no jobs yet)
    const initialJobIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(initialJobIndicator).not.toBeVisible();

    // Step 5: Simulate the workflow by creating a RUNNING job
    // (In real scenario, this would happen when user drags ticket to SPECIFY and workflow dispatches)
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'SPECIFY' },
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

    // Step 6: Reload page to see updated ticket with job
    await page.reload();

    // Step 7: Find ticket on board (should be in SPECIFY now)
    const ticketInSpecify = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketInSpecify).toBeVisible({ timeout: 3000 });

    // Step 8: Verify workflow job indicator appears with WRITING label
    const jobIndicator = ticketInSpecify.locator('[data-testid="job-status-indicator"]');
    await expect(jobIndicator).toBeVisible({ timeout: 5000 });

    // Step 9: Verify aria-label contains "WRITING" (contextual label transformation)
    const ariaLabel = await jobIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('WRITING');

    // Step 10: Verify workflow job does NOT show stage prefix (simplified display)
    await expect(jobIndicator).not.toContainText('SPECIFY :');

    // Clean up
  });

  test('workflow job updates from RUNNING to COMPLETED in real-time', async ({ page , projectId }) => {
    // Create ticket with RUNNING job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test workflow job real-time update',
        description: 'E2E test for job status updates',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date(),
      },
    });

    // Load board page
    await page.goto(`/projects/${projectId}/board`);

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify initial RUNNING status with WRITING label
    const jobIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(jobIndicator).toBeVisible();
    let ariaLabel = await jobIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('WRITING');

    // Simulate job completion (in real scenario, workflow updates job status)
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Wait for polling to detect the change (2-second polling interval)
    await page.waitForTimeout(1000);

    // Verify status updated to COMPLETED (no longer WRITING)
    ariaLabel = await jobIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('completed');
    expect(ariaLabel?.toUpperCase()).not.toContain('WRITING');

    // Clean up
  });

  test('workflow job shows FAILED status prominently without transformation', async ({ page , projectId }) => {
    // Create ticket with FAILED job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test workflow job FAILED status',
        description: 'E2E test for FAILED job display',
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

    // Load board page
    await page.goto(`/projects/${projectId}/board`);

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify FAILED status is displayed prominently
    const jobIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(jobIndicator).toBeVisible();

    const ariaLabel = await jobIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('failed');
    // FAILED status should NOT be transformed to WRITING
    expect(ariaLabel?.toUpperCase()).not.toContain('WRITING');

    // Clean up
  });
});

/**
 * T026: E2E test for User Story 2 - View AI-BOARD Assistance Status
 *
 * Tests the complete user workflow of mentioning @ai-board in a ticket
 * and verifying the "ASSISTING" indicator appears with stage filtering.
 */
test.describe('E2E: Dual Job Display - User Story 2', () => {
  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Reset ticket counter
    nextTicketNumber = 1;

  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('user mentions @ai-board in SPECIFY ticket and sees ASSISTING indicator', async ({ page , projectId }) => {
    // Step 1: Create a ticket in SPECIFY stage (BEFORE navigating to board)
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD assistance in SPECIFY',
        description: 'E2E test for viewing AI-BOARD job status',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Step 2: Simulate AI-BOARD mention by creating a comment-specify job
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

    // Step 3: Navigate to board (after ticket and job creation)
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Step 4: Find ticket on board (should be in SPECIFY)
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible({ timeout: 3000 });

    // Step 5: Verify AI-BOARD job indicator appears with ASSISTING label
    const jobIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(jobIndicator).toBeVisible({ timeout: 5000 });

    // Step 6: Verify aria-label contains "AI-BOARD" (compact icon-only mode)
    const ariaLabel = await jobIndicator.getAttribute('aria-label');
    expect(ariaLabel?.toUpperCase()).toContain('AI-BOARD');

    // Step 7: Verify AI-BOARD job is icon-only (no text label)
    await expect(jobIndicator).not.toContainText('AI-BOARD :');

    // Note: Cleanup handled by beforeEach cleanupDatabase(projectId)
  });

  test('AI-BOARD job disappears when ticket moves to different stage', async ({ page , projectId }) => {
    // Step 1: Create ticket in SPECIFY with AI-BOARD job (BEFORE navigating to board)
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test AI-BOARD stage filtering',
        description: 'E2E test for AI-BOARD job visibility after stage change',
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

    // Step 2: Load board and verify AI-BOARD job is visible in SPECIFY
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    let ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    let jobIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(jobIndicator).toBeVisible();

    // Step 3: Move ticket to PLAN stage (simulate stage transition)
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'PLAN' },
    });

    // Step 4: Reload page to see updated state
    await page.reload();

    // Step 5: Find ticket on board (should be in PLAN now)
    ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible({ timeout: 3000 });

    // Step 6: Verify AI-BOARD job is NO LONGER visible (stage mismatch)
    jobIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(jobIndicator).not.toBeVisible();

    // Clean up
  });

  test('dual job display shows both workflow and AI-BOARD jobs simultaneously', async ({ page , projectId }) => {
    // Step 1: Create ticket with BOTH workflow and AI-BOARD jobs
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test dual job display',
        description: 'E2E test for simultaneous workflow and AI-BOARD jobs',
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
        updatedAt: new Date('2024-01-01'),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-plan',
        status: 'RUNNING',
        branch: '046-test-branch',
        updatedAt: new Date('2024-01-02'),
      },
    });

    // Step 2: Load board
    await page.goto(`/projects/${projectId}/board`);

    // Step 3: Find ticket
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Step 4: Verify BOTH job indicators are visible
    const jobIndicators = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(jobIndicators).toHaveCount(2);

    // Step 5: Verify workflow job shows WRITING label
    const firstIndicator = jobIndicators.first();
    const firstAriaLabel = await firstIndicator.getAttribute('aria-label');
    expect(firstAriaLabel?.toUpperCase()).toContain('WRITING');

    // Step 6: Verify AI-BOARD job shows expected label
    const secondIndicator = jobIndicators.last();
    const secondAriaLabel = await secondIndicator.getAttribute('aria-label');
    expect(secondAriaLabel?.toUpperCase()).toContain('AI-BOARD IS WORKING ON THIS TICKET');

    // Note: Step 7 removed - workflow jobs no longer show stage prefix (US1 simplification)
    // AI-BOARD jobs show icon-only with tooltip, no text content verification needed

    // Clean up
  });
});
