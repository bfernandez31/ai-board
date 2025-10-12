/**
 * E2E Tests: Project Specifications Feature
 *
 * Tests that the project specifications link in the site header
 * correctly redirects to GitHub specs/specifications directory.
 */

import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

test.describe('Project Specifications', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('T002: Navigate to board and verify GitHub link in header', async ({ page }) => {
    // Navigate to project 3 board
    await page.goto('/projects/3/board');

    // Wait for board to load
    await page.waitForSelector('[data-testid="board-grid"]', { timeout: 10000 });

    // Wait for project info to load in header (client-side fetch)
    await page.waitForTimeout(1000);

    // Verify project name is visible in site header
    const projectName = page.locator('header span:has-text("AI Board Development")');
    await expect(projectName).toBeVisible();

    // Verify document icon is visible in site header
    const docIcon = page.locator('header a[aria-label="View project specifications on GitHub"]');
    await expect(docIcon).toBeVisible();

    // Verify icon has correct attributes
    await expect(docIcon).toHaveAttribute('target', '_blank');
    await expect(docIcon).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify link points to GitHub specs/specifications
    const href = await docIcon.getAttribute('href');
    expect(href).toContain('github.com');
    expect(href).toContain('bfernandez31/ai-board');
    expect(href).toContain('tree/main/specs/specifications');
  });

  test('Accessibility: Keyboard navigation to document icon', async ({ page }) => {
    // Navigate to project 3 board
    await page.goto('/projects/3/board');

    // Wait for board to load
    await page.waitForSelector('[data-testid="board-grid"]', { timeout: 10000 });

    // Wait for project info to load in header
    await page.waitForTimeout(1000);

    // Focus on the icon link in site header
    const docIcon = page.locator('header a[aria-label="View project specifications on GitHub"]');
    await docIcon.focus();

    // Verify icon is focused
    await expect(docIcon).toBeFocused();
  });
});
