import { test, expect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, cleanupDatabase } from '../helpers/db-cleanup';

/**
 * E2E Tests: Rollback from BUILD to INBOX
 * Feature: 051-897-rollback-quick
 * Tests rollback functionality for failed/cancelled workflows
 */

test.describe('Rollback Quick-Impl Workflow', () => {
  const BASE_URL = 'http://localhost:3000';
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = getPrismaClient();
  });

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  /**
   * Helper: Perform drag-and-drop with @dnd-kit compatibility
   */
  const dragTicketToColumn = async (page: Page, ticketId: number, targetStage: string) => {
    const ticketCard = page.locator(`[data-ticket-id="${ticketId}"]`);
    const targetColumn = page.locator(`[data-stage="${targetStage}"]`);

    const ticketBox = await ticketCard.boundingBox();
    const targetBox = await targetColumn.boundingBox();

    if (ticketBox && targetBox) {
      await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
      await page.mouse.up();
    }
  };

  /**
   * Helper: Wait for API response after drag-and-drop
   * Accepts both POST /transition (rollback) and PATCH /tickets/[id] (normal transitions)
   */
  const waitForTransitionAPI = async (page: Page, ticketId: number) => {
    return await page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();

        // POST to /transition (rollback)
        const isRollback = url.includes(`/api/projects/1/tickets/${ticketId}/transition`) && method === 'POST';

        // PATCH to /tickets/[id] (normal transitions)
        const isNormalTransition = url.includes(`/api/projects/1/tickets/${ticketId}`) &&
                                   !url.includes('/transition') &&
                                   method === 'PATCH';

        return isRollback || isNormalTransition;
      },
      { timeout: 5000 }
    );
  };

  test('should rollback ticket from BUILD to INBOX with FAILED job', async ({ page }) => {
    // Setup: Create ticket in BUILD stage with FAILED job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - FAILED',
        description: 'Test ticket for rollback',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '123-test-branch',
        version: 3,
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        updatedAt: new Date(),
        command: 'quick-impl',
        status: 'FAILED',
        branch: '123-test-branch',
        startedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from BUILD to INBOX
    await dragTicketToColumn(page, ticket.id, 'INBOX');
    const response = await waitForTransitionAPI(page, ticket.id);

    // Verify API response
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id: ticket.id,
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
    });

    // Verify UI update
    await expect(page.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
    const ticketInInbox = page.locator('[data-stage="INBOX"]').locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketInInbox).toBeVisible();

    // Verify database state
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket).toMatchObject({
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
    });

    // Verify job was deleted
    const jobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });
    expect(jobs).toHaveLength(0);
  });

  test('should rollback ticket from BUILD to INBOX with CANCELLED job', async ({ page }) => {
    // Setup: Create ticket in BUILD stage with CANCELLED job (QUICK workflow)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - CANCELLED',
        description: 'Test ticket for rollback',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '456-cancelled-branch',
        version: 5,
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        updatedAt: new Date(),
        command: 'quick-impl',
        status: 'CANCELLED',
        branch: '456-cancelled-branch',
        startedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from BUILD to INBOX
    await dragTicketToColumn(page, ticket.id, 'INBOX');
    const response = await waitForTransitionAPI(page, ticket.id);

    // Verify rollback succeeded
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('INBOX');
    expect(body.workflowType).toBe('FULL');
  });

  test('should block rollback when job is RUNNING', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - RUNNING',
        description: 'Test ticket with RUNNING job',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '789-running-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        updatedAt: new Date(),
        command: 'quick-impl',
        status: 'RUNNING',
        branch: '789-running-branch',
        startedAt: new Date(),
      },
    });

    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    await dragTicketToColumn(page, ticket.id, 'INBOX');
    const response = await waitForTransitionAPI(page, ticket.id);

    // Verify rollback blocked
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('workflow is still running');

    // Verify ticket stayed in BUILD
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.stage).toBe('BUILD');
  });

  test('should block rollback when job is COMPLETED', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - COMPLETED',
        description: 'Test ticket with COMPLETED job',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '101-completed-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        updatedAt: new Date(),
        command: 'quick-impl',
        status: 'COMPLETED',
        branch: '101-completed-branch',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    await dragTicketToColumn(page, ticket.id, 'INBOX');
    const response = await waitForTransitionAPI(page, ticket.id);

    // Verify rollback blocked
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('completed successfully');
  });

  test('should block rollback for FULL workflow type', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - FULL Workflow',
        description: 'Test ticket with FULL workflow type',
        stage: 'BUILD',
        workflowType: 'FULL',
        branch: '102-full-workflow-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        updatedAt: new Date(),
        command: 'implement',
        status: 'FAILED',
        branch: '102-full-workflow-branch',
        startedAt: new Date(),
      },
    });

    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    await dragTicketToColumn(page, ticket.id, 'INBOX');
    const response = await waitForTransitionAPI(page, ticket.id);

    // Verify rollback blocked
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Rollback only available for quick-impl workflows');

    // Verify ticket stayed in BUILD
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.stage).toBe('BUILD');
  });

  test('should allow normal workflow after rollback', async ({ page }) => {
    // Setup: Ticket that was rolled back
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - Post-Rollback Normal',
        description: 'Test ticket after rollback',
        stage: 'INBOX', // Already rolled back
        workflowType: 'FULL', // Reset to FULL
        branch: null, // Reset to null
        version: 1, // Reset to 1
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Drag to SPECIFY (normal workflow)
    await dragTicketToColumn(page, ticket.id, 'SPECIFY');
    const response = await waitForTransitionAPI(page, ticket.id);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('SPECIFY');
  });

  test('should allow quick-impl workflow after rollback', async ({ page }) => {
    // Setup: Ticket that was rolled back
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - Post-Rollback Quick',
        description: 'Test ticket after rollback',
        stage: 'INBOX',
        workflowType: 'FULL',
        branch: null,
        version: 1,
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Drag to BUILD (quick-impl workflow)
    await dragTicketToColumn(page, ticket.id, 'BUILD');
    const response = await waitForTransitionAPI(page, ticket.id);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('BUILD');
    expect(body.workflowType).toBe('QUICK'); // Should be set to QUICK for quick-impl
  });
});
