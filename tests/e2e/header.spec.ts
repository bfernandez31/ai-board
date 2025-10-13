import { test, expect } from '@playwright/test';

test.describe('Application Header', () => {
  test('should display header on all pages', async ({ page }) => {
    // Test 1: Header visibility on home page
    await page.goto('/');
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Verify logo and title (core header elements)
    await expect(header.locator('img[alt="AI-BOARD Logo"]')).toBeVisible();
    await expect(header.getByText('AI-BOARD')).toBeVisible();

    // Test 2: Site-wide presence - verify on projects page
    await page.goto('/projects');
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('header').getByText('AI-BOARD')).toBeVisible();

    // Test 3: Site-wide presence - verify on board page
    await page.goto('/projects/3/board');
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('header').getByText('AI-BOARD')).toBeVisible();
  });

  test('should display project info in header on project pages', async ({ page }) => {
    // Navigate to a project board
    await page.goto('/projects/1/board');

    const header = page.locator('header');

    // Verify header is visible
    await expect(header).toBeVisible();

    // Verify project name is displayed
    await expect(header.getByText('[e2e] Test Project')).toBeVisible();

    // Verify GitHub specs link is visible
    const specsLink = header.locator('a[href*="github.com"][href*="/specs/specifications"]');
    await expect(specsLink).toBeVisible();
  });
});
