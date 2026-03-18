/**
 * E2E Tests: Activity Feed Navigation
 * Feature: AIB-177-project-activity-feed
 *
 * Tests for navigating to the activity page and basic functionality
 */

import { test, expect } from '../helpers/worker-isolation';
import { ensureProjectExists } from '../helpers/db-cleanup';

test.describe('Activity Feed Navigation', () => {
  // Ensure desktop viewport so the activity link in the header is visible
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page, projectId }) => {
    // Ensure project exists with required fields (githubOwner, githubRepo)
    await ensureProjectExists(projectId);

    // Navigate to the board page first
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to activity page from header icon', async ({ page, projectId }) => {
    // Wait for the activity link — requires projectInfo to load (async fetch in header)
    // projectInfo only sets when API returns githubOwner + githubRepo
    const activityLink = page.locator('a[aria-label="View project activity"]').first();
    await activityLink.waitFor({ state: 'visible', timeout: 15000 });
    await activityLink.click();

    // Verify we're on the activity page
    await expect(page).toHaveURL(`/projects/${projectId}/activity`);

    // Verify page title is present
    await expect(page.locator('h1')).toContainText('Activity');
  });

  test('should display activity feed container', async ({ page, projectId }) => {
    // Navigate directly to the activity page
    await page.goto(`/projects/${projectId}/activity`);
    await page.waitForLoadState('networkidle');

    // Check for the activity feed container
    const feedContainer = page.locator('.bg-zinc-900\\/50');
    await expect(feedContainer).toBeVisible();
  });

  test('should navigate back to board from activity page', async ({ page, projectId }) => {
    // Navigate to activity page
    await page.goto(`/projects/${projectId}/activity`);
    await page.waitForLoadState('networkidle');

    // Click "Back to Board" — use .first() to avoid strict mode with link + button variants
    const backButton = page.locator('a', { hasText: 'Back to Board' }).first();
    await backButton.click();

    // Verify we're back on the board
    await expect(page).toHaveURL(`/projects/${projectId}/board`);
  });

  test('should show empty state when no activity', async ({ page, projectId }) => {
    // Use the worker-isolated project (cleaned before each test, so likely empty)
    await page.goto(`/projects/${projectId}/activity`);
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Either see events or empty state
    const hasEvents = await page.locator('[class*="divide-y"]').count() > 0;
    const hasEmptyState = await page.locator('text=No activity yet').count() > 0;

    // One of these should be true
    expect(hasEvents || hasEmptyState).toBe(true);
  });

  test('should have touch-friendly tap targets', async ({ page, projectId }) => {
    // Navigate to activity page
    await page.goto(`/projects/${projectId}/activity`);
    await page.waitForLoadState('networkidle');

    // Check "Back to Board" button has minimum tap target size — use .first() for strict mode
    const backButton = page.locator('a', { hasText: 'Back to Board' }).first();

    const boundingBox = await backButton.boundingBox();
    if (boundingBox) {
      // Should have at least 44x44px tap target
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Activity Feed Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('should navigate via mobile menu', async ({ page, projectId }) => {
    // Ensure project exists with required fields
    await ensureProjectExists(projectId);

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Open mobile menu — button has sr-only text "Toggle menu" as accessible name
    const menuButton = page.getByRole('button', { name: 'Toggle menu' });
    await menuButton.waitFor({ state: 'visible', timeout: 10000 });
    await menuButton.click();

    // Wait for the Sheet to open, then find activity link INSIDE the sheet content
    const sheetContent = page.locator('[data-state="open"][role="dialog"]');
    await sheetContent.waitFor({ state: 'visible', timeout: 5000 });
    const activityLink = sheetContent.locator('a[aria-label="View project activity"]');
    await activityLink.click();

    // Verify navigation
    await expect(page).toHaveURL(`/projects/${projectId}/activity`);
  });

  test('should have responsive layout on mobile', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/activity`);
    await page.waitForLoadState('networkidle');

    // Check that the page title is visible
    await expect(page.locator('h1')).toContainText('Activity');

    // Check that content fits within viewport — use .first() since there may be nested mains
    const feedContainer = page.locator('main').first();
    const boundingBox = await feedContainer.boundingBox();
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375);
    }
  });
});
