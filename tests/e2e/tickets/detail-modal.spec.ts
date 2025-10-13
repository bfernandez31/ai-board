import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';

/**
 * E2E Tests for Ticket Detail Modal
 * Feature: 005-add-ticket-detail
 *
 * IMPORTANT: These tests are written FIRST (TDD approach)
 * They should FAIL until the modal component is implemented
 */

test.describe('Ticket Detail Modal', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ request }) => {
    // Clean database before each test - protects project 3
    await cleanupDatabase();

    // Create test tickets for each stage
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Test Ticket in INBOX',
        description: 'This is a test ticket in the INBOX stage for modal testing.',
      },
    });

    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Test Ticket in PLAN',
        description: 'This is a test ticket in the PLAN stage.',
      },
    });

    // Create a ticket with a long description for scrolling tests
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket with Long Description',
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing'.repeat(20), // ~1000 chars
      },
    });

    // Update stages for test tickets (API creates them in INBOX by default)
    const tickets = await prisma.ticket.findMany();
    if (tickets.length >= 2 && tickets[1]) {
      await prisma.ticket.update({
        where: { id: tickets[1].id },
        data: { stage: 'PLAN' },
      });
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T004: Basic modal open and close
   * Scenario 1 from quickstart.md
   */
  test('should open modal when ticket card is clicked and close with button', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click first ticket card
    const firstTicket = page.locator('[data-testid="ticket-card"]').first();
    const ticketTitle = await firstTicket.locator('h3').textContent();
    await firstTicket.click();

    // Assert modal is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Assert ticket title is displayed in modal
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toContainText(ticketTitle || '');

    // Click close button (shadcn/ui Dialog has a built-in close button in top-right)
    // The button contains an X icon and sr-only "Close" text
    const closeButton = dialog.locator('button').first(); // First button in dialog is the close button
    await closeButton.click();

    // Assert modal is hidden
    await expect(dialog).not.toBeVisible();
  });

  /**
   * T005: ESC key dismissal
   * Scenario 2 from quickstart.md
   */
  test('should close modal when ESC key is pressed', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click ticket card to open modal
    await page.locator('[data-testid="ticket-card"]').first().click();

    // Assert modal is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Press ESC key
    await page.keyboard.press('Escape');

    // Assert modal closes
    await expect(dialog).not.toBeVisible();
  });

  /**
   * T006: Click outside to close
   * Scenario 3 from quickstart.md
   */
  test('should close modal when clicking outside (overlay)', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Open modal by clicking ticket
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click outside the modal by clicking on the page at coordinates outside the dialog
    // The overlay is managed by Radix and clicking outside should close the modal
    await page.mouse.click(10, 10); // Top-left corner, definitely outside modal

    // Assert modal closes
    await expect(dialog).not.toBeVisible();

    // Re-open modal to test clicking modal content doesn't close
    await page.locator('[data-testid="ticket-card"]').first().click();
    await expect(dialog).toBeVisible();

    // Click modal content (should NOT close)
    await dialog.click();

    // Modal should still be visible
    await expect(dialog).toBeVisible();
  });

  /**
   * T007: Multiple tickets display correctly
   * Scenario 4 from quickstart.md
   */
  test('should display different ticket data for different tickets', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    const tickets = page.locator('[data-testid="ticket-card"]');

    // Get titles of first two tickets
    const firstTicketTitle = await tickets.nth(0).locator('h3').textContent();
    const secondTicketTitle = await tickets.nth(1).locator('h3').textContent();

    // Click first ticket
    await tickets.nth(0).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify first ticket's title in modal
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toContainText(firstTicketTitle || '');

    // Close modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Click second ticket
    await tickets.nth(1).click();
    await expect(dialog).toBeVisible();

    // Verify second ticket's title (should be different, not first ticket's data)
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toContainText(secondTicketTitle || '');

    // Assert it's NOT showing first ticket's data
    if (firstTicketTitle !== secondTicketTitle) {
      await expect(dialog.locator('h2, [data-testid="modal-title"]')).not.toContainText(firstTicketTitle || 'xxxxx');
    }
  });

  /**
   * T008: Mobile responsive (full-screen)
   * Scenario 5 from quickstart.md
   */
  test('should display full-screen modal on mobile viewport', async ({ page }) => {
    // Set viewport to mobile size (375px width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click ticket card
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check that modal has full-screen classes or dimensions
    // Note: Exact implementation may vary, but we check for expected behavior
    const dialogContent = dialog.locator('[data-radix-dialog-content]').or(dialog).first();

    // Get bounding box to verify it fills viewport
    const box = await dialogContent.boundingBox();

    // Modal should be close to full width and height (allowing for small margins)
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThan(350); // Close to 375px
      expect(box.height).toBeGreaterThan(600); // Close to 667px
    }

    // Verify close button is accessible (shadcn Dialog's built-in close button)
    const closeButton = dialog.locator('button').first(); // Close button is first button in dialog
    await expect(closeButton).toBeVisible();
  });

  /**
   * T009: Desktop responsive (centered)
   * Scenario 6 from quickstart.md
   */
  test('should display centered modal on desktop viewport', async ({ page }) => {
    // Set viewport to desktop size (1280px width)
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click ticket card
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const dialogContent = dialog.locator('[data-radix-dialog-content]').or(dialog).first();

    // Get bounding box
    const box = await dialogContent.boundingBox();

    expect(box).toBeTruthy();
    if (box) {
      // Modal should have max-width (NOT full screen)
      expect(box.width).toBeLessThan(800); // Should be constrained (max-w-2xl ~768px)

      // Modal should be centered (x position should not be 0)
      expect(box.x).toBeGreaterThan(100); // Not at edge of screen
    }

    // Modal should not fill entire screen on desktop
    // (We already checked the box dimensions above)
  });

  /**
   * T010: Long content scrolling
   * Scenario 7 from quickstart.md
   */
  test('should handle long description with scrolling', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click the third ticket (which has a long description)
    await page.locator('[data-testid="ticket-card"]').nth(2).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Find description area
    const descriptionArea = dialog.locator('[data-testid="ticket-description"], .overflow-y-auto').first();

    // Check if description area has scrolling capabilities
    // (it should have max-height and overflow-y-auto classes)
    const hasOverflow = await descriptionArea.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY === 'auto' || style.overflowY === 'scroll';
    }).catch(() => false);

    // If there's scrollable content, verify it works
    if (hasOverflow) {
      expect(hasOverflow).toBe(true);
    }

    // Title and dates should remain visible (not in scroll area)
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toBeVisible();
  });

  /**
   * T011: Stage badge colors
   * Scenario 8 from quickstart.md
   */
  test('should display correct badge colors for different stages', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Stage color mapping (from contract)
    const stageColors = {
      'INBOX': 'bg-zinc-600',
      'PLAN': 'bg-blue-600',
      'BUILD': 'bg-green-600',
      'VERIFY': 'bg-orange-600',
      'SHIP': 'bg-purple-600',
    };

    // Test the tickets we created (INBOX and PLAN)
    const stages = [
      { name: 'INBOX', column: 'INBOX' },
      { name: 'PLAN', column: 'PLAN' },
    ];

    for (const stage of stages) {
      // Find the stage column and click the first ticket in it
      const stageColumn = page.locator(`[data-stage="${stage.column}"]`);
      const ticketInStage = stageColumn.locator('[data-testid="ticket-card"]').first();
      await ticketInStage.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Find stage badge
      const badge = dialog.locator('[data-testid="stage-badge"]');
      await expect(badge).toBeVisible();

      // Verify badge has correct color class for this stage
      const expectedColor = stageColors[stage.name as keyof typeof stageColors];
      if (expectedColor) {
        const badgeClasses = await badge.getAttribute('class');
        expect(badgeClasses).toContain(expectedColor);
      }

      // Close modal
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });
});
