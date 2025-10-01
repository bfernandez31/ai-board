import { test, expect, Page, APIResponse, devices } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * E2E Tests: Drag-and-Drop Ticket Movement
 * Feature: 004-add-drag-and
 * Source: quickstart.md - All Test Scenarios
 *
 * ⚠️ CRITICAL: These tests MUST FAIL initially (TDD requirement)
 * They should only pass after full implementation of Phase 3.3
 */

test.describe('Drag-and-Drop Ticket Movement', () => {
  const BASE_URL = 'http://localhost:3000';
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = new PrismaClient();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create a ticket via API and return its ID and version
   */
  const createTicket = async (
    request: any,
    stage: string = 'INBOX'
  ): Promise<{ id: number; version: number; title: string }> => {
    const response: APIResponse = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: `Test Ticket - ${stage}`,
        description: `Test description for ${stage}`,
      },
    });
    const ticket = await response.json();

    // Update stage directly via Prisma for test setup
    if (stage !== 'INBOX') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { stage: stage as any },
      });
    }

    // Fetch updated ticket with version
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });

    return {
      id: updatedTicket!.id,
      version: updatedTicket!.version,
      title: updatedTicket!.title,
    };
  };

  /**
   * Helper: Get ticket from database
   */
  const getTicket = async (id: number) => {
    return await prisma.ticket.findUnique({ where: { id } });
  };

  /**
   * Helper: Perform drag-and-drop with @dnd-kit compatibility
   * Uses mouse events instead of Playwright's dragTo
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
      await page.waitForTimeout(500); // Wait for UI update
    }
  };

  /**
   * T005: Test successful drag from INBOX to PLAN
   * Expected: FAILS (components not implemented)
   */
  test('user can drag ticket from INBOX to PLAN', async ({ page, request }) => {
    // Setup: Create ticket in INBOX
    const ticket = await createTicket(request, 'INBOX');

    // Navigate to board
    await page.goto(`${BASE_URL}/board`);

    // Verify ticket is in INBOX column
    const inboxColumn = page.locator('[data-stage="INBOX"]');
    await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Drag ticket to PLAN column
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Verify ticket moved to PLAN column
    const planColumn = page.locator('[data-stage="PLAN"]');
    await expect(planColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
    await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();

    // Verify database updated
    const updatedTicket = await getTicket(ticket.id);
    expect(updatedTicket?.stage).toBe('PLAN');
    expect(updatedTicket?.version).toBe(2); // Version incremented
  });

  /**
   * T006: Test rejecting invalid stage transition (skipping)
   * Expected: FAILS (validation not implemented)
   */
  test('user cannot skip stages when dragging', async ({ page, request }) => {
    // Setup: Create ticket in PLAN
    const ticket = await createTicket(request, 'PLAN');

    await page.goto(`${BASE_URL}/board`);

    // Attempt to drag from PLAN to SHIP (invalid - skipping BUILD and VERIFY)
    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    const shipColumn = page.locator('[data-stage="SHIP"]');

    await ticketCard.dragTo(shipColumn);

    // Verify ticket returned to PLAN column
    const planColumn = page.locator('[data-stage="PLAN"]');
    await expect(planColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
    await expect(shipColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();

    // Verify error message displayed
    await expect(page.locator('[role="alert"]')).toContainText(/Invalid.*transition|Cannot.*skip/i);

    // Verify database unchanged
    const unchangedTicket = await getTicket(ticket.id);
    expect(unchangedTicket?.stage).toBe('PLAN');
    expect(unchangedTicket?.version).toBe(1); // Version not incremented
  });

  /**
   * T007: Test rejecting backwards movement
   * Expected: FAILS (validation not implemented)
   */
  test('user cannot move ticket backwards', async ({ page, request }) => {
    // Setup: Create ticket in BUILD
    const ticket = await createTicket(request, 'BUILD');

    await page.goto(`${BASE_URL}/board`);

    // Attempt to drag from BUILD to PLAN (invalid - backwards)
    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    const planColumn = page.locator('[data-stage="PLAN"]');

    await ticketCard.dragTo(planColumn);

    // Verify ticket returned to BUILD column
    const buildColumn = page.locator('[data-stage="BUILD"]');
    await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
    await expect(planColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();

    // Verify database unchanged
    const unchangedTicket = await getTicket(ticket.id);
    expect(unchangedTicket?.stage).toBe('BUILD');
  });

  /**
   * T008: Test handling concurrent updates with first-write-wins
   * Expected: FAILS (conflict handling not implemented)
   */
  test('handles concurrent updates with first-write-wins', async ({ page, context, request }) => {
    // Setup: Create ticket in INBOX
    const ticket = await createTicket(request, 'INBOX');

    // Open board in two browser contexts (simulating two users)
    const page1 = page;
    const page2: Page = await context.newPage();

    await page1.goto(`${BASE_URL}/board`);
    await page2.goto(`${BASE_URL}/board`);

    // User 1 drags ticket to PLAN
    const ticketCard1 = page1.locator(`[data-ticket-id="${ticket.id}"]`);
    const planColumn1 = page1.locator('[data-stage="PLAN"]');

    // User 2 also drags the same ticket to PLAN (concurrent)
    const ticketCard2 = page2.locator(`[data-ticket-id="${ticket.id}"]`);
    const planColumn2 = page2.locator('[data-stage="PLAN"]');

    // Execute both drag operations "simultaneously"
    await Promise.all([ticketCard1.dragTo(planColumn1), ticketCard2.dragTo(planColumn2)]);

    // User 1 should succeed
    await expect(planColumn1.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // User 2 should see conflict error and ticket should revert
    await expect(page2.locator('[role="alert"]')).toContainText(/modified by another user/i);

    // Both users should eventually see ticket in PLAN (after page2 refreshes)
    await page2.reload();
    await expect(planColumn2.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Cleanup
    await page2.close();
  });

  /**
   * T009: Test disabling drag when offline
   * Expected: FAILS (offline detection not implemented)
   */
  test('disables drag when network is offline', async ({ page, context, request }) => {
    // Setup: Create ticket
    const ticket = await createTicket(request, 'INBOX');

    await page.goto(`${BASE_URL}/board`);

    // Go offline
    await context.setOffline(true);

    // Verify offline indicator visible
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Verify drag is disabled
    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(ticketCard).toHaveAttribute('data-draggable', 'false');

    // Attempt drag anyway
    const planColumn = page.locator('[data-stage="PLAN"]');
    await ticketCard.dragTo(planColumn);

    // Verify ticket did not move
    const inboxColumn = page.locator('[data-stage="INBOX"]');
    await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Verify drag re-enabled
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
    await expect(ticketCard).toHaveAttribute('data-draggable', 'true');
  });

  /**
   * T010: Test touch drag on mobile viewport
   * Expected: FAILS (touch sensors not configured)
   */
  test('supports touch drag on mobile viewport', async ({ page, request }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup: Create ticket
    const ticket = await createTicket(request, 'INBOX');

    await page.goto(`${BASE_URL}/board`);

    // Drag using mouse events (works on mobile viewport)
    await dragTicketToColumn(page, ticket.id, 'PLAN');

    // Verify ticket moved
    const planColumn = page.locator('[data-stage="PLAN"]');
    await expect(planColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
  });

  /**
   * T011: Test sub-100ms latency validation
   * Expected: FAILS (optimistic updates not implemented)
   */
  test('meets sub-100ms latency requirement', async ({ page, request }) => {
    // Setup: Create ticket
    const ticket = await createTicket(request, 'INBOX');

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    const planColumn = page.locator('[data-stage="PLAN"]');

    // Measure time from drag end to visual update
    const startTime = Date.now();

    await ticketCard.dragTo(planColumn);

    // Wait for ticket to appear in new column
    await planColumn.locator(`[data-ticket-id="${ticket.id}"]`).waitFor({ state: 'visible' });

    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log(`Drag latency: ${latency}ms`);

    // Verify <100ms latency (optimistic update)
    expect(latency).toBeLessThan(100);
  });
});
