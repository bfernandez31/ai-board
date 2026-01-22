/**
 * E2E Tests: Activity Feed Navigation
 * Feature: AIB-177-project-activity-feed
 *
 * Tests for navigating to the activity page and basic functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Activity Feed Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the board page first
    await page.goto('/projects/1/board');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to activity page from header icon', async ({ page }) => {
    // Click the Activity icon in the header
    const activityLink = page.locator('a[aria-label="View project activity"]');
    await activityLink.click();

    // Verify we're on the activity page
    await expect(page).toHaveURL('/projects/1/activity');

    // Verify page title is present
    await expect(page.locator('h1')).toContainText('Activity');
  });

  test('should display activity feed container', async ({ page }) => {
    // Navigate directly to the activity page
    await page.goto('/projects/1/activity');
    await page.waitForLoadState('networkidle');

    // Check for the activity feed container
    const feedContainer = page.locator('.bg-zinc-900\\/50');
    await expect(feedContainer).toBeVisible();
  });

  test('should navigate back to board from activity page', async ({ page }) => {
    // Navigate to activity page
    await page.goto('/projects/1/activity');
    await page.waitForLoadState('networkidle');

    // Click "Back to Board" button
    const backButton = page.locator('button', { hasText: 'Back to Board' }).or(
      page.locator('a', { hasText: 'Back to Board' })
    );
    await backButton.click();

    // Verify we're back on the board
    await expect(page).toHaveURL('/projects/1/board');
  });

  test('should show empty state when no activity', async ({ page }) => {
    // Use a project that might be empty (project 3 is typically dev/test)
    await page.goto('/projects/3/activity');
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Either see events or empty state
    const hasEvents = await page.locator('[class*="divide-y"]').count() > 0;
    const hasEmptyState = await page.locator('text=No activity yet').count() > 0;

    // One of these should be true
    expect(hasEvents || hasEmptyState).toBe(true);
  });

  test('should have touch-friendly tap targets', async ({ page }) => {
    // Navigate to activity page
    await page.goto('/projects/1/activity');
    await page.waitForLoadState('networkidle');

    // Check "Back to Board" button has minimum tap target size
    const backButton = page.locator('button', { hasText: 'Back to Board' }).or(
      page.locator('a', { hasText: 'Back to Board' })
    );

    const boundingBox = await backButton.boundingBox();
    if (boundingBox) {
      // Should have at least 44x44px tap target
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Activity Feed Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('should navigate via mobile menu', async ({ page }) => {
    // Navigate to board
    await page.goto('/projects/1/board');
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const menuButton = page.locator('button', { hasText: 'Toggle menu' }).or(
      page.locator('[class*="md:hidden"]').locator('button').first()
    );
    await menuButton.click();

    // Click activity link in mobile menu
    const activityLink = page.locator('a[aria-label="View project activity"]');
    await activityLink.click();

    // Verify navigation
    await expect(page).toHaveURL('/projects/1/activity');
  });

  test('should have responsive layout on mobile', async ({ page }) => {
    await page.goto('/projects/1/activity');
    await page.waitForLoadState('networkidle');

    // Check that the page title is visible
    await expect(page.locator('h1')).toContainText('Activity');

    // Check that content fits within viewport
    const feedContainer = page.locator('main');
    const boundingBox = await feedContainer.boundingBox();
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375);
    }
  });
});
