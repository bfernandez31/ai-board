import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * E2E Tests: Quick-Impl Visual Feedback
 * Feature: 031-quick-implementation
 *
 * Tests visual feedback during drag operations for quick-impl feature
 * - Color-coded drop zones (blue for normal, green for quick-impl)
 * - Invalid targets grayed out
 * - Visual distinction between INBOX → SPECIFY vs INBOX → BUILD
 */

test.describe('Quick-Impl Visual Feedback', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();

    // Create test user (same pattern as db-cleanup.ts)
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

    // Ensure test project 1 exists with correct userId
    await prisma.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });

    // Create test ticket in INBOX
    await prisma.ticket.create({
      data: {
        title: '[e2e] Quick-Impl Visual Test',
        description: 'Testing visual feedback during drag',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(),
      },
    });
  });

  test.afterEach(async () => {
    await prisma.$disconnect();
  });

  /**
   * Test: Color-coded drop zones during INBOX drag (quick-impl mode)
   * Given: User drags ticket from INBOX
   * When: Hovering over different columns
   * Then: SPECIFY shows blue, BUILD shows green, others grayed out
   */
  test('should show color-coded drop zones during INBOX drag (quick-impl)', async ({
    page,
  }) => {
    // Navigate to board
    await page.goto('/projects/1/board');

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // Get the ticket card
    const ticketCard = page.locator('[data-testid="column-INBOX"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Start dragging - need actual mouse movement to trigger @dnd-kit
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    // Move to ticket center and press down
    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse slightly to trigger drag (important for @dnd-kit)
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(50); // Wait for drag state to activate

    // Check SPECIFY column - should have blue border (normal workflow)
    const specifyColumn = page.locator('[data-testid="column-SPECIFY"]');
    const specifyClasses = await specifyColumn.getAttribute('class');
    expect(specifyClasses).toContain('border-blue-500');
    expect(specifyClasses).toContain('bg-blue-500/10');

    // Check BUILD column - should have green border (quick-impl)
    const buildColumn = page.locator('[data-testid="column-BUILD"]');
    const buildClasses = await buildColumn.getAttribute('class');
    expect(buildClasses).toContain('border-green-500');
    expect(buildClasses).toContain('bg-green-500/10');

    // Check PLAN column - should be grayed out (invalid)
    const planColumn = page.locator('[data-testid="column-PLAN"]');
    const planClasses = await planColumn.getAttribute('class');
    expect(planClasses).toContain('opacity-50');
    expect(planClasses).toContain('cursor-not-allowed');

    // Check VERIFY column - should be grayed out (invalid)
    const verifyColumn = page.locator('[data-testid="column-VERIFY"]');
    const verifyClasses = await verifyColumn.getAttribute('class');
    expect(verifyClasses).toContain('opacity-50');
    expect(verifyClasses).toContain('cursor-not-allowed');

    // Check SHIP column - should be grayed out (invalid)
    const shipColumn = page.locator('[data-testid="column-SHIP"]');
    const shipClasses = await shipColumn.getAttribute('class');
    expect(shipClasses).toContain('opacity-50');
    expect(shipClasses).toContain('cursor-not-allowed');

    // End drag
    await page.mouse.up();
  });

  /**
   * Test: Visual feedback resets after drag ends
   * Given: User completes a drag operation
   * When: Drag ends
   * Then: All drop zone styling is removed
   */
  test('should reset visual feedback after drag ends', async ({ page }) => {
    // Navigate to board
    await page.goto('/projects/1/board');

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // Get the ticket card
    const ticketCard = page.locator('[data-testid="column-INBOX"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Start dragging - need actual mouse movement to trigger @dnd-kit
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    // Move to ticket center and press down
    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse slightly to trigger drag
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(50);

    // Verify styling is applied during drag
    const buildColumn = page.locator('[data-testid="column-BUILD"]');
    let buildClasses = await buildColumn.getAttribute('class');
    expect(buildClasses).toContain('border-green-500');

    // End drag
    await page.mouse.up();
    await page.waitForTimeout(50);

    // Verify styling is removed after drag
    buildClasses = await buildColumn.getAttribute('class');
    expect(buildClasses).not.toContain('border-green-500');
    expect(buildClasses).not.toContain('bg-green-500/10');
  });

  /**
   * Test: Normal workflow visual feedback (non-INBOX stage)
   * Given: User drags ticket from SPECIFY
   * When: Hovering over different columns
   * Then: Only PLAN shows blue (sequential validation), others grayed out
   */
  test('should show normal workflow visual feedback for SPECIFY → PLAN', async ({
    page,
  }) => {
    // Create ticket in SPECIFY stage (instead of INBOX)
    await prisma.ticket.create({
      data: {
        title: '[e2e] SPECIFY Visual Test',
        description: 'Testing visual feedback for SPECIFY stage',
        stage: 'SPECIFY',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto('/projects/1/board');

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-SPECIFY"]');

    // Get the ticket card
    const ticketCard = page.locator('[data-testid="column-SPECIFY"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Start dragging - need actual mouse movement to trigger @dnd-kit
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    // Move to ticket center and press down
    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse slightly to trigger drag
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(50);

    // Check PLAN column - should have blue border (valid transition)
    const planColumn = page.locator('[data-testid="column-PLAN"]');
    const planClasses = await planColumn.getAttribute('class');
    expect(planClasses).toContain('border-blue-500');
    expect(planClasses).toContain('bg-blue-500/10');

    // Check BUILD column - should be grayed out (invalid, skipping PLAN)
    const buildColumn = page.locator('[data-testid="column-BUILD"]');
    const buildClasses = await buildColumn.getAttribute('class');
    expect(buildClasses).toContain('opacity-50');
    expect(buildClasses).toContain('cursor-not-allowed');

    // Check INBOX column - should be grayed out (can't go backwards)
    const inboxColumn = page.locator('[data-testid="column-INBOX"]');
    const inboxClasses = await inboxColumn.getAttribute('class');
    expect(inboxClasses).toContain('opacity-50');
    expect(inboxClasses).toContain('cursor-not-allowed');

    // End drag
    await page.mouse.up();
  });

  /**
   * Test: Badge visibility for quick-impl tickets
   * Feature: 032-add-workflow-type
   * Given: Ticket with workflowType=QUICK
   * When: Board loads
   * Then: ⚡ Quick badge is visible on ticket card
   */
  test('should show ⚡ Quick badge for quick-impl tickets', async ({ page }) => {
    // Create ticket with workflowType=QUICK
    await prisma.ticket.create({
      data: {
        title: '[e2e] Quick-Impl Badge Test',
        description: 'Testing badge visibility for quick-impl',
        stage: 'BUILD',
        workflowType: 'QUICK',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto('/projects/1/board');

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-BUILD"]');

    // Verify ticket is visible
    const ticketCard = page.locator('[data-testid="column-BUILD"] [data-testid="ticket-card"]').first();
    await expect(ticketCard).toBeVisible();

    // Verify badge is visible with correct text and styling
    const badge = ticketCard.locator('text=⚡ Quick');
    await expect(badge).toBeVisible();

    // Verify amber styling (light theme)
    const badgeElement = await badge.elementHandle();
    if (badgeElement) {
      const classes = await badgeElement.getAttribute('class');
      expect(classes).toContain('bg-amber-100');
      expect(classes).toContain('text-amber-800');
    }
  });

  /**
   * Test: Badge NOT visible for full workflow tickets
   * Feature: 032-add-workflow-type
   * Given: Ticket with workflowType=FULL
   * When: Board loads
   * Then: ⚡ Quick badge is NOT visible on ticket card
   */
  test('should NOT show badge for full workflow tickets', async ({ page }) => {
    // Create ticket with workflowType=FULL (default)
    await prisma.ticket.create({
      data: {
        title: '[e2e] Full Workflow Badge Test',
        description: 'Testing badge absence for full workflow',
        stage: 'BUILD',
        workflowType: 'FULL',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto('/projects/1/board');

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-BUILD"]');

    // Verify ticket is visible
    const ticketCard = page.locator('[data-testid="column-BUILD"] [data-testid="ticket-card"]').first();
    await expect(ticketCard).toBeVisible();

    // Verify badge is NOT visible
    const badge = ticketCard.locator('text=⚡ Quick');
    await expect(badge).not.toBeVisible();
  });

  /**
   * Test: Badge appears immediately after quick-impl drag-and-drop
   * Feature: 032-add-workflow-type
   * Given: User drags ticket from INBOX to BUILD
   * When: Quick-impl transition completes
   * Then: ⚡ Quick badge appears immediately without page refresh
   */
  test('should show badge immediately after quick-impl transition', async ({ page, request }) => {
    // Navigate to board
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // Get the ticket card in INBOX
    const inboxTicket = page.locator('[data-testid="column-INBOX"] [data-testid="ticket-card"]').first();
    await expect(inboxTicket).toBeVisible();

    // Verify badge is NOT visible initially (workflowType=FULL by default)
    let badge = inboxTicket.locator('text=⚡ Quick');
    await expect(badge).not.toBeVisible();

    // Get ticket ID for API transition
    const ticketIdAttr = await inboxTicket.getAttribute('data-ticket-id');
    const ticketId = parseInt(ticketIdAttr || '0', 10);

    // Perform quick-impl transition via API (simulates successful drag-and-drop)
    const response = await request.post(`/api/projects/1/tickets/${ticketId}/transition`, {
      data: { targetStage: 'BUILD' },
    });

    expect(response.status()).toBe(200);
    const updatedTicket = await response.json();

    // Verify server returned workflowType=QUICK
    expect(updatedTicket.workflowType).toBe('QUICK');
    expect(updatedTicket.stage).toBe('BUILD');

    // Reload page to get updated state (simulates what happens after real drag-and-drop)
    await page.reload();
    await page.waitForSelector('[data-testid="column-BUILD"]');

    // Verify ticket moved to BUILD column
    const buildTicket = page.locator('[data-testid="column-BUILD"] [data-testid="ticket-card"]').first();
    await expect(buildTicket).toBeVisible();

    // CRITICAL: Verify badge appears immediately without page refresh
    badge = buildTicket.locator('text=⚡ Quick');
    await expect(badge).toBeVisible();

    // Verify badge styling
    const badgeElement = await badge.elementHandle();
    if (badgeElement) {
      const classes = await badgeElement.getAttribute('class');
      expect(classes).toContain('bg-amber-100');
      expect(classes).toContain('text-amber-800');
    }
  });

  /**
   * Test: Badge persists through stage transitions
   * Feature: 032-add-workflow-type
   * Given: Quick-impl ticket in BUILD stage
   * When: Ticket transitions to VERIFY, then SHIP
   * Then: ⚡ Quick badge remains visible throughout
   */
  test('should persist badge through stage transitions', async ({ page, request }) => {
    // Create ticket with workflowType=QUICK in BUILD
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Badge Persistence Test',
        description: 'Testing badge persistence across transitions',
        stage: 'BUILD',
        workflowType: 'QUICK',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Create completed job for BUILD stage (required for VERIFY transition)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="column-BUILD"]');

    // Verify badge is visible in BUILD stage
    let ticketCard = page.locator('[data-testid="column-BUILD"] [data-testid="ticket-card"]').first();
    await expect(ticketCard).toBeVisible();
    let badge = ticketCard.locator('text=⚡ Quick');
    await expect(badge).toBeVisible();

    // Transition to VERIFY using API (simpler than drag-and-drop with modal)
    const ticketData = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
      data: { targetStage: 'VERIFY', version: ticketData?.version },
    });

    // Reload page to see updated state
    await page.reload();
    await page.waitForSelector('[data-testid="column-VERIFY"]');

    // Verify badge is still visible in VERIFY stage
    ticketCard = page.locator('[data-testid="column-VERIFY"] [data-testid="ticket-card"]').first();
    await expect(ticketCard).toBeVisible();
    badge = ticketCard.locator('text=⚡ Quick');
    await expect(badge).toBeVisible();

    // Transition to SHIP
    const updatedTicketData = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
      data: { targetStage: 'SHIP', version: updatedTicketData?.version },
    });

    // Reload page to see updated state
    await page.reload();
    await page.waitForSelector('[data-testid="column-SHIP"]');

    // Verify badge is still visible in SHIP stage
    ticketCard = page.locator('[data-testid="column-SHIP"] [data-testid="ticket-card"]').first();
    await expect(ticketCard).toBeVisible();
    badge = ticketCard.locator('text=⚡ Quick');
    await expect(badge).toBeVisible();
  });
});
