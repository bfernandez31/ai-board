import { test, expect } from '../fixtures/auth';

test.describe('Application Header', () => {
  test('should display header on all pages', async ({ page }) => {
    // Test 1: Header visibility on home page
    await page.goto('/');
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Verify logo and title
    await expect(header.locator('img[alt="AI-BOARD Logo"]')).toBeVisible();
    await expect(header.getByText('AI-BOARD')).toBeVisible();

    // Verify desktop buttons visible on desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(header.getByRole('button', { name: 'Log In' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Contact' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Sign Up' })).toBeVisible();

    // Test 2: Site-wide presence - verify on projects page
    await page.goto('/projects');
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('header').getByText('AI-BOARD')).toBeVisible();

    // Test 3: Site-wide presence - verify on board page
    await page.goto('/projects/3/board');
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('header').getByText('AI-BOARD')).toBeVisible();
  });

  test('should trigger toast notification when clicking buttons', async ({
    page,
  }) => {
    await page.goto('/');

    // Ensure desktop viewport for button visibility
    await page.setViewportSize({ width: 1024, height: 768 });

    // Click "Log In" button
    const logInButton = page
      .locator('header')
      .getByRole('button', { name: 'Log In' });
    await logInButton.click();

    // Verify toast notification appears with correct message
    const toast = page
      .locator('[role="region"]')
      .getByText('This feature is not yet implemented')
      .first();
    await expect(toast).toBeVisible();
  });
});
