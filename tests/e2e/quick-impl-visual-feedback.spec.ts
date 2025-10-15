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
    await page.waitForTimeout(100); // Wait for drag state to activate

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
    await page.waitForTimeout(100);

    // Verify styling is applied during drag
    const buildColumn = page.locator('[data-testid="column-BUILD"]');
    let buildClasses = await buildColumn.getAttribute('class');
    expect(buildClasses).toContain('border-green-500');

    // End drag
    await page.mouse.up();
    await page.waitForTimeout(100);

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
    await page.waitForTimeout(100);

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
});
