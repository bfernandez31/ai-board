import { test, expect, Page } from '../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, cleanupDatabase, getProjectKey } from '../helpers/db-cleanup';

/**
 * E2E Tests: Rollback from VERIFY to PLAN
 * Feature: AIB-75 - Rollback VERIFY to PLAN
 * Tests rollback functionality for FULL workflow tickets in VERIFY stage
 */

test.describe('Rollback VERIFY to PLAN', () => {
  const BASE_URL = 'http://localhost:3000';
  let prisma: PrismaClient;
  let nextTicketNumber = 1;

  test.beforeAll(() => {
    prisma = getPrismaClient();
  });

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Reset ticket counter
    nextTicketNumber = 1;
  });

  /**
   * Helper: Perform drag-and-drop with @dnd-kit compatibility
   * Uses dispatchEvent for reliable pointer events that @dnd-kit recognizes
   */
  const dragTicketToColumn = async (page: Page, ticketId: number, targetStage: string) => {
    const ticketCard = page.locator(`[data-ticket-id="${ticketId}"]`);
    const targetColumn = page.locator(`[data-stage="${targetStage}"]`);

    // Ensure both elements are visible
    await expect(ticketCard).toBeVisible();
    await expect(targetColumn).toBeVisible();

    // Get bounding boxes
    const ticketBox = await ticketCard.boundingBox();
    const targetBox = await targetColumn.boundingBox();

    if (!ticketBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    // Calculate coordinates
    const startX = ticketBox.x + ticketBox.width / 2;
    const startY = ticketBox.y + ticketBox.height / 2;
    const endX = targetBox.x + targetBox.width / 2;
    const endY = targetBox.y + targetBox.height / 2;

    // Use dispatchEvent to fire proper pointer events that @dnd-kit recognizes
    await ticketCard.dispatchEvent('pointerdown', {
      clientX: startX,
      clientY: startY,
      button: 0,
      pointerId: 1,
      isPrimary: true,
    });

    // Small delay for event processing
    await page.waitForTimeout(50);

    // Move slightly to activate drag (>8px threshold)
    await page.mouse.move(startX + 15, startY);
    await page.waitForTimeout(100);

    // Move to target
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.waitForTimeout(50);

    // Release on target column
    await targetColumn.dispatchEvent('pointerup', {
      clientX: endX,
      clientY: endY,
      button: 0,
      pointerId: 1,
      isPrimary: true,
    });

    await page.waitForTimeout(300); // Wait for UI update
  };

  /**
   * Helper: Wait for API response after drag-and-drop
   */
  const waitForTransitionAPI = async (page: Page, ticketId: number, projectId: number) => {
    return await page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        return url.includes(`/api/projects/${projectId}/tickets/${ticketId}/transition`) && method === 'POST';
      },
      { timeout: 5000 }
    );
  };

  test('should show rollback confirmation modal when dragging VERIFY ticket to PLAN', async ({ page, projectId }) => {
    // Setup: Create ticket in VERIFY stage with COMPLETED job (FULL workflow)
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - Modal',
        description: 'Test ticket for rollback modal',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '123-test-branch',
        version: 5,
        projectId,
        previewUrl: 'https://preview.example.com/test',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'COMPLETED',
        branch: '123-test-branch',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Verify ticket is in VERIFY column
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    const ticketInVerify = verifyColumn.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketInVerify).toBeVisible();

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait for rollback confirmation modal
    const modal = page.locator('[data-testid="rollback-verify-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Verify modal content
    await expect(modal.locator('text=Rollback to PLAN Stage')).toBeVisible();
    await expect(modal.locator('text=Reset the ticket to PLAN stage')).toBeVisible();
    await expect(modal.locator('text=Clear the preview deployment URL')).toBeVisible();
  });

  test('should rollback ticket from VERIFY to PLAN with COMPLETED job', async ({ page, projectId }) => {
    // Setup: Create ticket in VERIFY stage with COMPLETED job (FULL workflow)
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - COMPLETED',
        description: 'Test ticket for rollback',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '123-test-branch',
        version: 5,
        projectId,
        previewUrl: 'https://preview.example.com/test',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'COMPLETED',
        branch: '123-test-branch',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait for and confirm rollback modal
    const modal = page.locator('[data-testid="rollback-verify-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Click confirm button and wait for API response in parallel
    const confirmButton = modal.locator('button[data-action="confirm"]');
    const [response] = await Promise.all([
      waitForTransitionAPI(page, ticket.id, projectId),
      confirmButton.click(),
    ]);

    // Verify API response
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id: ticket.id,
      stage: 'PLAN',
      workflowType: 'FULL',
      branch: '123-test-branch', // Branch should be preserved
      previewUrl: null, // Preview URL should be cleared
    });
    expect(body.version).toBe(6); // Version should be incremented

    // Verify UI update
    await expect(page.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
    const ticketInPlan = page.locator('[data-stage="PLAN"]').locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketInPlan).toBeVisible();

    // Verify database state
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket).toMatchObject({
      stage: 'PLAN',
      workflowType: 'FULL',
      branch: '123-test-branch',
      previewUrl: null,
    });
    expect(updatedTicket?.version).toBe(6);

    // Verify old verify job was deleted but rollback-reset job was created
    const jobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.command).toBe('rollback-reset');
    expect(jobs[0]?.status).toBe('PENDING');
  });

  test('should rollback ticket from VERIFY to PLAN with FAILED job', async ({ page, projectId }) => {
    // Setup: Create ticket in VERIFY stage with FAILED job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - FAILED',
        description: 'Test ticket for rollback',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '456-failed-branch',
        version: 3,
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'FAILED',
        branch: '456-failed-branch',
        startedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait for and confirm rollback modal
    const modal = page.locator('[data-testid="rollback-verify-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Click confirm and wait for API response in parallel
    const [response] = await Promise.all([
      waitForTransitionAPI(page, ticket.id, projectId),
      modal.locator('button[data-action="confirm"]').click(),
    ]);

    // Verify rollback succeeded
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('PLAN');
  });

  test('should rollback ticket from VERIFY to PLAN with CANCELLED job', async ({ page, projectId }) => {
    // Setup: Create ticket in VERIFY stage with CANCELLED job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - CANCELLED',
        description: 'Test ticket for rollback',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '789-cancelled-branch',
        version: 4,
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'CANCELLED',
        branch: '789-cancelled-branch',
        startedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait for and confirm rollback modal
    const modal = page.locator('[data-testid="rollback-verify-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Click confirm and wait for API response in parallel
    const [response] = await Promise.all([
      waitForTransitionAPI(page, ticket.id, projectId),
      modal.locator('button[data-action="confirm"]').click(),
    ]);

    // Verify rollback succeeded
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('PLAN');
  });

  test('should cancel rollback when modal is dismissed', async ({ page, projectId }) => {
    // Setup: Create ticket in VERIFY stage with COMPLETED job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - Cancel',
        description: 'Test ticket for cancel',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '101-cancel-branch',
        version: 2,
        projectId,
        previewUrl: 'https://preview.example.com/cancel-test',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'COMPLETED',
        branch: '101-cancel-branch',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait for rollback modal
    const modal = page.locator('[data-testid="rollback-verify-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Click cancel button
    const cancelButton = modal.locator('button[data-action="cancel"]');
    await cancelButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Ticket should remain in VERIFY
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    const ticketInVerify = verifyColumn.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketInVerify).toBeVisible();

    // Verify database state unchanged
    const unchangedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(unchangedTicket?.stage).toBe('VERIFY');
    expect(unchangedTicket?.previewUrl).toBe('https://preview.example.com/cancel-test');
  });

  test('should block rollback for QUICK workflow type', async ({ page, projectId }) => {
    // Setup: Create QUICK workflow ticket in VERIFY stage
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - QUICK Workflow',
        description: 'Test ticket with QUICK workflow type',
        stage: 'VERIFY',
        workflowType: 'QUICK',
        branch: '102-quick-branch',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'quick-impl',
        status: 'COMPLETED',
        branch: '102-quick-branch',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Verify ticket is in VERIFY column
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    const ticketInVerify = verifyColumn.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketInVerify).toBeVisible();

    // Attempt drag to PLAN - isValidTransition should block this
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait a moment for any potential UI updates
    await page.waitForTimeout(500);

    // Verify ticket is still in VERIFY column (drag was blocked)
    await expect(ticketInVerify).toBeVisible();
    const planColumn = page.locator('[data-stage="PLAN"]');
    const ticketInPlan = planColumn.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketInPlan).not.toBeVisible();

    // Verify database state hasn't changed
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.stage).toBe('VERIFY');
    expect(updatedTicket?.workflowType).toBe('QUICK');
  });

  test('should block rollback when job is RUNNING', async ({ page, projectId }) => {
    // Setup: Create ticket with RUNNING job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - RUNNING',
        description: 'Test ticket with RUNNING job',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '103-running-branch',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'RUNNING',
        branch: '103-running-branch',
        startedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Modal should appear but validation should fail when confirmed
    // Actually, since we have visual feedback via getDropZoneStyle,
    // the drop zone should show as disabled and the modal shouldn't appear
    // Wait briefly for any modal
    await page.waitForTimeout(500);

    // The modal should not appear for ineligible tickets
    const modal = page.locator('[data-testid="rollback-verify-modal"]');
    const isModalVisible = await modal.isVisible();

    if (isModalVisible) {
      // If modal appeared, confirm and expect API to reject
      const [response] = await Promise.all([
        waitForTransitionAPI(page, ticket.id, projectId),
        modal.locator('button[data-action="confirm"]').click(),
      ]);
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('workflow is still running');
    }

    // Verify ticket stayed in VERIFY
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.stage).toBe('VERIFY');
  });

  test('should block rollback when job is PENDING', async ({ page, projectId }) => {
    // Setup: Create ticket with PENDING job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - PENDING',
        description: 'Test ticket with PENDING job',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '104-pending-branch',
        projectId,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'PENDING',
        branch: '104-pending-branch',
        startedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait briefly
    await page.waitForTimeout(500);

    // Verify ticket stayed in VERIFY
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.stage).toBe('VERIFY');
  });

  test('should allow normal workflow progression after rollback', async ({ page, projectId }) => {
    // Setup: Ticket that was rolled back to PLAN with completed plan job
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - Post-Rollback',
        description: 'Test ticket after rollback to PLAN',
        stage: 'PLAN',
        workflowType: 'FULL',
        branch: '105-post-rollback-branch',
        version: 6,
        previewUrl: null, // Cleared by rollback
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create completed plan job (required to transition to BUILD)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'plan',
        status: 'COMPLETED',
        branch: '105-post-rollback-branch',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Ensure ticket is visible in PLAN
    await expect(page.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Set up response listener BEFORE dragging
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        return url.includes(`/tickets/${ticket.id}/transition`) && response.request().method() === 'POST';
      },
      { timeout: 10000 }
    );

    // Drag to BUILD (normal workflow progression)
    await dragTicketToColumn(page, ticket.id, 'BUILD');

    // Wait for transition API response
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Verify ticket moved to BUILD
    const buildColumn = page.locator('[data-stage="BUILD"]');
    const ticketInBuild = buildColumn.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketInBuild).toBeVisible();
  });

  test('should dispatch rollback-reset workflow after rollback', async ({ page, projectId }) => {
    // Setup: Create ticket in VERIFY stage with COMPLETED job (FULL workflow)
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Verify Rollback Test - Reset Job',
        description: 'Test ticket for rollback-reset job creation',
        stage: 'VERIFY',
        workflowType: 'FULL',
        branch: '106-reset-job-branch',
        version: 5,
        projectId,
        previewUrl: 'https://preview.example.com/reset-test',
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        updatedAt: new Date(),
        command: 'verify',
        status: 'COMPLETED',
        branch: '106-reset-job-branch',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket from VERIFY to PLAN
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Wait for and confirm rollback modal
    const modal = page.locator('[data-testid="rollback-verify-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Click confirm and wait for API response in parallel
    const [response] = await Promise.all([
      waitForTransitionAPI(page, ticket.id, projectId),
      modal.locator('button[data-action="confirm"]').click(),
    ]);

    // Verify API response includes resetJobId
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id: ticket.id,
      stage: 'PLAN',
      branch: '106-reset-job-branch',
    });
    expect(body.resetJobId).toBeDefined();
    expect(typeof body.resetJobId).toBe('number');

    // Verify rollback-reset job was created
    const resetJob = await prisma.job.findFirst({
      where: {
        ticketId: ticket.id,
        command: 'rollback-reset',
      },
    });
    expect(resetJob).toBeDefined();
    expect(resetJob?.status).toBe('PENDING');
    expect(resetJob?.branch).toBe('106-reset-job-branch');
    expect(resetJob?.id).toBe(body.resetJobId);
  });
});
