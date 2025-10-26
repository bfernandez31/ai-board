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

    // Verify project name is displayed (at least one instance visible)
    await expect(header.getByText('[e2e] Test Project').first()).toBeVisible();

    // Verify GitHub specs link is visible (desktop version in header)
    const specsLink = header.locator('a[href*="github.com"][href*="/specs/specifications"]').first();
    await expect(specsLink).toBeVisible();
  });

  test('should show only logo on mobile, full header on desktop', async ({ page }) => {
    // Test mobile viewport (375px width - iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/projects/1/board');

    const header = page.locator('header');

    // Verify logo is visible
    await expect(header.locator('img[alt="AI-BOARD Logo"]')).toBeVisible();

    // Verify "AI-BOARD" text is hidden on mobile
    const aiBoardText = header.getByText('AI-BOARD');
    await expect(aiBoardText).toBeHidden();

    // Verify mobile project name (truncate class) is visible
    const mobileProjectName = header.locator('.truncate').getByText('[e2e] Test Project');
    await expect(mobileProjectName).toBeVisible();

    // Verify desktop project name (text-lg) is hidden on mobile
    const desktopProjectName = header.locator('.text-lg').getByText('[e2e] Test Project');
    await expect(desktopProjectName).toBeHidden();

    // Test desktop viewport (1280px width)
    await page.setViewportSize({ width: 1280, height: 720 });

    // Verify "AI-BOARD" text is visible on desktop
    await expect(aiBoardText).toBeVisible();

    // Verify desktop project name is visible
    await expect(desktopProjectName).toBeVisible();

    // Verify mobile project name is hidden on desktop
    await expect(mobileProjectName).toBeHidden();
  });

  test('should show specs link in mobile menu', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/projects/1/board');

    // Open mobile menu
    const menuButton = page.locator('button[aria-label="Toggle menu"], button:has(svg):has-text("Toggle menu")').first();
    await menuButton.click();

    // Wait for menu to be visible
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();

    // Verify project name in menu
    await expect(sheet.getByText('[e2e] Test Project')).toBeVisible();

    // Verify specs link in menu
    const specsLink = sheet.locator('a[href*="github.com"][href*="/specs/specifications"]');
    await expect(specsLink).toBeVisible();
    await expect(specsLink).toHaveAttribute('aria-label', 'View project specifications on GitHub');
  });
});
