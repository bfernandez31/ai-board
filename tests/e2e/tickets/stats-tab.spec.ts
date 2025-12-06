import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';

/**
 * E2E Tests for Ticket Stats Tab
 * Feature: AIB-99 - Add Stats Tab to Ticket Detail Modal
 *
 * Tests:
 * - Stats tab visibility when jobs exist
 * - Stats tab hidden when no jobs
 * - Summary cards display
 * - Jobs timeline display
 * - Tools usage display
 * - Keyboard shortcut (Cmd+4/Ctrl+4)
 * - Job expansion for token breakdown
 */

test.describe('Ticket Stats Tab', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ request, projectId }) => {
    // Clean database before each test
    await cleanupDatabase(projectId);

    // Create test user
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update worker project
    await prisma.project.update({
      where: { id: projectId },
      data: {
        userId: testUser.id,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * US1: Stats tab is visible when ticket has jobs
   */
  test('displays Stats tab when ticket has jobs with telemetry', async ({ page, request, projectId }) => {
    // Create ticket
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Jobs',
        description: 'Test ticket for stats tab',
      },
    });
    const ticket = await ticketResponse.json();

    // Move to BUILD stage
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    // Create a job with telemetry data
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        inputTokens: 5000,
        outputTokens: 2000,
        cacheReadTokens: 1000,
        cacheCreationTokens: 500,
        costUsd: 0.15,
        durationMs: 30000,
        model: 'claude-opus-4-5',
        toolsUsed: ['Read', 'Edit', 'Bash'],
        updatedAt: new Date(),
      },
    });

    // Navigate to board and open ticket detail modal
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Stats tab is visible
    const statsTab = dialog.locator('[data-testid="stats-tab-trigger"]');
    await expect(statsTab).toBeVisible();

    // Verify it shows job count badge
    await expect(statsTab.locator('.bg-blue')).toContainText('1');
  });

  /**
   * US1: Stats tab is hidden when no jobs
   */
  test('hides Stats tab when ticket has no jobs', async ({ page, request, projectId }) => {
    // Create ticket without any jobs
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket without Jobs',
        description: 'Test ticket without jobs',
      },
    });

    // Navigate to board and open ticket detail modal
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Stats tab is NOT visible
    const statsTab = dialog.locator('[data-testid="stats-tab-trigger"]');
    await expect(statsTab).not.toBeVisible();

    // Verify grid is 3 columns (not 4)
    const tabsList = dialog.locator('[role="tablist"]');
    const tabsCount = await tabsList.locator('[role="tab"]').count();
    expect(tabsCount).toBe(3);
  });

  /**
   * US1: Summary cards display correct aggregated values
   */
  test('displays summary cards with aggregated statistics', async ({ page, request, projectId }) => {
    // Create ticket
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket for Summary Cards',
        description: 'Test ticket',
      },
    });
    const ticket = await ticketResponse.json();

    // Move to BUILD stage
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    // Create multiple jobs to test aggregation
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId,
          command: 'specify',
          status: 'COMPLETED',
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadTokens: 200,
          cacheCreationTokens: 100,
          costUsd: 0.10,
          durationMs: 10000,
          model: 'claude-opus-4-5',
          toolsUsed: ['Read'],
          updatedAt: new Date(),
        },
        {
          ticketId: ticket.id,
          projectId,
          command: 'plan',
          status: 'COMPLETED',
          inputTokens: 2000,
          outputTokens: 1000,
          cacheReadTokens: 400,
          cacheCreationTokens: 200,
          costUsd: 0.20,
          durationMs: 20000,
          model: 'claude-opus-4-5',
          toolsUsed: ['Read', 'Edit'],
          updatedAt: new Date(),
        },
      ],
    });

    // Navigate to board and open Stats tab
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click Stats tab
    await dialog.locator('[data-testid="stats-tab-trigger"]').click();

    // Wait for stats content to appear
    const statsContent = dialog.locator('[data-testid="stats-tab-content"]');
    await expect(statsContent).toBeVisible();

    // Verify summary cards are displayed
    const summaryCards = dialog.locator('[data-testid="stats-summary-cards"]');
    await expect(summaryCards).toBeVisible();

    // Verify total cost is displayed (should aggregate both jobs)
    const totalCost = dialog.locator('[data-testid="total-cost"]');
    await expect(totalCost).toBeVisible();
    await expect(totalCost).toContainText('$0.30');

    // Verify total duration
    const totalDuration = dialog.locator('[data-testid="total-duration"]');
    await expect(totalDuration).toBeVisible();
    await expect(totalDuration).toContainText('30s');

    // Verify total tokens (1000+500 + 2000+1000 = 4500 = 4.5K)
    const totalTokens = dialog.locator('[data-testid="total-tokens"]');
    await expect(totalTokens).toBeVisible();
    await expect(totalTokens).toContainText('4.5K');

    // Verify cache efficiency
    const cacheEfficiency = dialog.locator('[data-testid="cache-efficiency"]');
    await expect(cacheEfficiency).toBeVisible();
  });

  /**
   * US2: Jobs timeline displays all jobs in chronological order
   */
  test('displays jobs timeline with all jobs', async ({ page, request, projectId }) => {
    // Create ticket
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket for Jobs Timeline',
        description: 'Test ticket',
      },
    });
    const ticket = await ticketResponse.json();

    // Move to BUILD stage
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    // Create jobs
    const job1 = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        costUsd: 0.10,
        durationMs: 10000,
        model: 'claude-opus-4-5',
        toolsUsed: [],
        updatedAt: new Date(),
        startedAt: new Date('2025-01-01T10:00:00Z'),
      },
    });

    const job2 = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'plan',
        status: 'COMPLETED',
        costUsd: 0.20,
        durationMs: 20000,
        model: 'claude-opus-4-5',
        toolsUsed: [],
        updatedAt: new Date(),
        startedAt: new Date('2025-01-01T11:00:00Z'),
      },
    });

    // Navigate to board and open Stats tab
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[data-testid="stats-tab-trigger"]').click();

    // Verify jobs timeline is visible
    const timeline = dialog.locator('[data-testid="jobs-timeline"]');
    await expect(timeline).toBeVisible();

    // Verify both jobs are displayed
    const job1Row = dialog.locator(`[data-testid="job-row-${job1.id}"]`);
    const job2Row = dialog.locator(`[data-testid="job-row-${job2.id}"]`);
    await expect(job1Row).toBeVisible();
    await expect(job2Row).toBeVisible();

    // Verify job command names are formatted
    await expect(job1Row).toContainText('Specify');
    await expect(job2Row).toContainText('Plan');

    // Verify durations are displayed
    await expect(dialog.locator(`[data-testid="job-duration-${job1.id}"]`)).toContainText('10s');
    await expect(dialog.locator(`[data-testid="job-duration-${job2.id}"]`)).toContainText('20s');

    // Verify costs are displayed
    await expect(dialog.locator(`[data-testid="job-cost-${job1.id}"]`)).toContainText('$0.10');
    await expect(dialog.locator(`[data-testid="job-cost-${job2.id}"]`)).toContainText('$0.20');
  });

  /**
   * US2: Job row expands to show token breakdown
   */
  test('expands job row to show token breakdown', async ({ page, request, projectId }) => {
    // Create ticket
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket for Job Expansion',
        description: 'Test ticket',
      },
    });
    const ticket = await ticketResponse.json();

    // Move to BUILD stage
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    // Create job with token data
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'implement',
        status: 'COMPLETED',
        inputTokens: 5000,
        outputTokens: 2000,
        cacheReadTokens: 1000,
        cacheCreationTokens: 500,
        costUsd: 0.25,
        durationMs: 45000,
        model: 'claude-opus-4-5',
        toolsUsed: ['Read', 'Edit', 'Bash'],
        updatedAt: new Date(),
      },
    });

    // Navigate to board and open Stats tab
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[data-testid="stats-tab-trigger"]').click();

    // Click job row to expand
    const jobRow = dialog.locator(`[data-testid="job-row-${job.id}"]`);
    await jobRow.click();

    // Verify expanded details are visible
    const jobDetails = dialog.locator(`[data-testid="job-details-${job.id}"]`);
    await expect(jobDetails).toBeVisible();

    // Verify token breakdown is displayed
    await expect(jobDetails).toContainText('Input Tokens');
    await expect(jobDetails).toContainText('Output Tokens');
    await expect(jobDetails).toContainText('Cache Read');
    await expect(jobDetails).toContainText('Cache Creation');
  });

  /**
   * US3: Tools usage section displays aggregated tool counts
   */
  test('displays tools usage section with frequency counts', async ({ page, request, projectId }) => {
    // Create ticket
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket for Tools Usage',
        description: 'Test ticket',
      },
    });
    const ticket = await ticketResponse.json();

    // Move to BUILD stage
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    // Create jobs with tool usage
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId,
          command: 'specify',
          status: 'COMPLETED',
          toolsUsed: ['Read', 'Edit', 'Bash'],
          updatedAt: new Date(),
        },
        {
          ticketId: ticket.id,
          projectId,
          command: 'plan',
          status: 'COMPLETED',
          toolsUsed: ['Read', 'Edit'],
          updatedAt: new Date(),
        },
        {
          ticketId: ticket.id,
          projectId,
          command: 'implement',
          status: 'COMPLETED',
          toolsUsed: ['Read', 'Edit', 'Write', 'Bash'],
          updatedAt: new Date(),
        },
      ],
    });

    // Navigate to board and open Stats tab
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[data-testid="stats-tab-trigger"]').click();

    // Verify tools usage section is visible
    const toolsSection = dialog.locator('[data-testid="tools-usage-section"]');
    await expect(toolsSection).toBeVisible();

    // Verify tool badges are displayed with counts
    // Read: 3, Edit: 3, Bash: 2, Write: 1
    await expect(dialog.locator('[data-testid="tool-badge-Read"]')).toContainText('(3)');
    await expect(dialog.locator('[data-testid="tool-badge-Edit"]')).toContainText('(3)');
    await expect(dialog.locator('[data-testid="tool-badge-Bash"]')).toContainText('(2)');
    await expect(dialog.locator('[data-testid="tool-badge-Write"]')).toContainText('(1)');
  });

  /**
   * US3: Shows empty state when no tools recorded
   */
  test('shows empty state message when no tools recorded', async ({ page, request, projectId }) => {
    // Create ticket
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with No Tools',
        description: 'Test ticket',
      },
    });
    const ticket = await ticketResponse.json();

    // Move to BUILD stage
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    // Create job without tool usage
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        toolsUsed: [], // Empty tools
        updatedAt: new Date(),
      },
    });

    // Navigate to board and open Stats tab
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[data-testid="stats-tab-trigger"]').click();

    // Verify "No tools recorded" message is shown
    const noToolsMessage = dialog.locator('[data-testid="no-tools-message"]');
    await expect(noToolsMessage).toBeVisible();
    await expect(noToolsMessage).toContainText('No tools recorded');
  });

  /**
   * US1: Keyboard shortcut Cmd+4 switches to Stats tab
   */
  test('Cmd+4 keyboard shortcut switches to Stats tab', async ({ page, request, projectId }) => {
    // Create ticket with job
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket for Keyboard Shortcut',
        description: 'Test ticket',
      },
    });
    const ticket = await ticketResponse.json();

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    // Navigate to board and open ticket detail modal
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify we start on Details tab
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await expect(detailsTab).toHaveAttribute('data-state', 'active');

    // Press Cmd+4 (or Ctrl+4 on Linux/Windows)
    await page.keyboard.press('Control+4');

    // Verify Stats tab is now active
    const statsTab = dialog.locator('[data-testid="stats-tab-trigger"]');
    await expect(statsTab).toHaveAttribute('data-state', 'active');

    // Verify stats content is visible
    const statsContent = dialog.locator('[data-testid="stats-tab-content"]');
    await expect(statsContent).toBeVisible();
  });

  /**
   * US1: Shows N/A for cards when no telemetry data
   */
  test('shows N/A for summary cards when no telemetry data', async ({ page, request, projectId }) => {
    // Create ticket
    const ticketResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with No Telemetry',
        description: 'Test ticket',
      },
    });
    const ticket = await ticketResponse.json();

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'BUILD', branch: 'test-branch' },
    });

    // Create job WITHOUT telemetry (null values)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'PENDING', // Job not completed, no telemetry
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
        costUsd: null,
        durationMs: null,
        model: null,
        toolsUsed: [],
        updatedAt: new Date(),
      },
    });

    // Navigate to board and open Stats tab
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[data-testid="stats-tab-trigger"]').click();

    // Verify N/A is shown for all summary cards
    const totalCost = dialog.locator('[data-testid="total-cost"]');
    const totalDuration = dialog.locator('[data-testid="total-duration"]');
    const totalTokens = dialog.locator('[data-testid="total-tokens"]');
    const cacheEfficiency = dialog.locator('[data-testid="cache-efficiency"]');

    await expect(totalCost).toContainText('N/A');
    await expect(totalDuration).toContainText('N/A');
    await expect(totalTokens).toContainText('N/A');
    await expect(cacheEfficiency).toContainText('N/A');
  });
});
