/**
 * E2E Tests: Ticket Duplication Dropdown
 * Feature: AIB-219-full-clone-option
 *
 * Tests for dropdown visibility and stage-based options
 */

import { test, expect } from '@playwright/test';

test.describe('Ticket Duplication Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the board page first
    await page.goto('/projects/1/board');
    await page.waitForLoadState('networkidle');
  });

  test('should show duplicate dropdown button on ticket modal', async ({ page }) => {
    // Find a ticket card and click on it
    const ticketCard = page.locator('[data-testid^="ticket-card-"]').first();
    await expect(ticketCard).toBeVisible({ timeout: 10000 });
    await ticketCard.click();

    // Wait for modal to open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Check for the duplicate button
    const duplicateButton = page.locator('[data-testid="duplicate-ticket-button"]');
    await expect(duplicateButton).toBeVisible();
    await expect(duplicateButton).toContainText('Duplicate');
  });

  test('should show dropdown menu with options on click', async ({ page }) => {
    // Find and click a ticket to open modal
    const ticketCard = page.locator('[data-testid^="ticket-card-"]').first();
    await expect(ticketCard).toBeVisible({ timeout: 10000 });
    await ticketCard.click();

    // Wait for modal and click duplicate button
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    const duplicateButton = page.locator('[data-testid="duplicate-ticket-button"]');
    await duplicateButton.click();

    // Verify dropdown menu appears
    const dropdownMenu = page.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible();

    // Verify "Simple copy" option is always visible
    await expect(dropdownMenu.locator('text=Simple copy')).toBeVisible();
  });

  test('should show only Simple copy for INBOX tickets', async ({ page }) => {
    // Find a ticket in INBOX column
    const inboxColumn = page.locator('[data-testid="column-INBOX"]');
    const inboxTicket = inboxColumn.locator('[data-testid^="ticket-card-"]').first();

    // Skip if no INBOX tickets exist
    const count = await inboxTicket.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await inboxTicket.click();

    // Wait for modal and click duplicate button
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    const duplicateButton = page.locator('[data-testid="duplicate-ticket-button"]');
    await duplicateButton.click();

    // Verify dropdown menu
    const dropdownMenu = page.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible();

    // Verify "Simple copy" is visible
    await expect(dropdownMenu.locator('text=Simple copy')).toBeVisible();

    // Verify "Full clone" is NOT visible for INBOX tickets
    await expect(dropdownMenu.locator('text=Full clone')).not.toBeVisible();
  });

  test('should show Full clone option for tickets with branches (SPECIFY/PLAN/BUILD/VERIFY)', async ({ page }) => {
    // Look for tickets in stages that should show Full clone
    // These stages typically have branches: SPECIFY, PLAN, BUILD, VERIFY
    const stagesWithFullClone = ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'];

    for (const stage of stagesWithFullClone) {
      const column = page.locator(`[data-testid="column-${stage}"]`);
      const ticket = column.locator('[data-testid^="ticket-card-"]').first();

      const count = await ticket.count();
      if (count > 0) {
        // Found a ticket in a full-clone-eligible stage
        await ticket.click();

        // Wait for modal
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Click duplicate button
        const duplicateButton = page.locator('[data-testid="duplicate-ticket-button"]');
        await duplicateButton.click();

        // Verify dropdown menu shows Full clone option
        const dropdownMenu = page.locator('[role="menu"]');
        await expect(dropdownMenu).toBeVisible();
        await expect(dropdownMenu.locator('text=Simple copy')).toBeVisible();
        await expect(dropdownMenu.locator('text=Full clone')).toBeVisible();

        // Close modal and return
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        return; // Test passed
      }
    }

    // If no tickets found in eligible stages, skip the test
    test.skip();
  });

  test('should NOT show Full clone for SHIP stage tickets', async ({ page }) => {
    // Find a ticket in SHIP column
    const shipColumn = page.locator('[data-testid="column-SHIP"]');
    const shipTicket = shipColumn.locator('[data-testid^="ticket-card-"]').first();

    // Skip if no SHIP tickets exist
    const count = await shipTicket.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await shipTicket.click();

    // Wait for modal and click duplicate button
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    const duplicateButton = page.locator('[data-testid="duplicate-ticket-button"]');
    await duplicateButton.click();

    // Verify dropdown menu
    const dropdownMenu = page.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible();

    // Verify "Simple copy" is visible
    await expect(dropdownMenu.locator('text=Simple copy')).toBeVisible();

    // Verify "Full clone" is NOT visible for SHIP tickets
    await expect(dropdownMenu.locator('text=Full clone')).not.toBeVisible();
  });

  test('should show loading state during duplication', async ({ page }) => {
    // Find a ticket and open modal
    const ticketCard = page.locator('[data-testid^="ticket-card-"]').first();
    await expect(ticketCard).toBeVisible({ timeout: 10000 });
    await ticketCard.click();

    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Open dropdown
    const duplicateButton = page.locator('[data-testid="duplicate-ticket-button"]');
    await duplicateButton.click();

    // Click Simple copy
    const simpleCopyOption = page.locator('[role="menuitem"]', { hasText: 'Simple copy' });
    await simpleCopyOption.click();

    // Verify loading state (button should show "Duplicating...")
    await expect(duplicateButton).toContainText('Duplicating');
  });
});
