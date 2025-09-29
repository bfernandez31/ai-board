import { test, expect } from '@playwright/test';

test.describe('Foundation Validation', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check for main heading
    await expect(page.locator('h1')).toContainText('AI Board');

    // Check for foundation ready message
    await expect(page.locator('h2')).toContainText('Foundation Ready');

    // Check page title
    await expect(page).toHaveTitle(/AI Board/);
  });

  test('no console errors on homepage', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    expect(consoleErrors).toHaveLength(0);
  });

  test('displays constitutional compliance checklist', async ({ page }) => {
    await page.goto('/');

    // Check for all constitutional principles
    await expect(page.getByText('TypeScript Strict Mode Enabled')).toBeVisible();
    await expect(page.getByText('Component Structure Ready')).toBeVisible();
    await expect(page.getByText('Playwright Testing Configured')).toBeVisible();
    await expect(
      page.getByText('Security: Environment Variables Protected')
    ).toBeVisible();
    await expect(
      page.getByText('Database: Prisma Ready for Future Use')
    ).toBeVisible();
  });
});