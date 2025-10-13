import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../../helpers/db-cleanup';

/**
 * E2E Test: Non-Numeric Project ID Returns 404 (T007)
 * User Story: As a user, invalid project ID formats should return clear errors
 * Source: quickstart.md - Step 4
 *
 * This test MUST FAIL until format validation is implemented
 */

test.describe('Project Validation - Format Errors', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should return 404 for non-numeric project ID', async ({ page }) => {
    // Navigate with non-numeric project ID
    const response = await page.goto(`${BASE_URL}/projects/abc/board`);

    // Verify 404 response
    expect(response?.status()).toBe(404);
  });

  test('should not crash with alphabetic project ID', async ({ page }) => {
    // Navigate with invalid format
    await page.goto(`${BASE_URL}/projects/abc/board`, { waitUntil: 'domcontentloaded' });

    // Verify page loaded (not crashed)
    const html = await page.content();
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(100);
  });

  test('should not crash with special characters in project ID', async ({ page }) => {
    // Navigate with special characters
    await page.goto(`${BASE_URL}/projects/@#$/board`, { waitUntil: 'domcontentloaded' });

    // Verify page loaded (not crashed)
    const html = await page.content();
    expect(html).toBeTruthy();
  });

  test('should not crash with decimal project ID', async ({ page }) => {
    // Navigate with decimal number
    await page.goto(`${BASE_URL}/projects/1.5/board`, { waitUntil: 'domcontentloaded' });

    // Verify page loaded (should fail validation but not crash)
    const html = await page.content();
    expect(html).toBeTruthy();
  });

  test('should not crash with negative project ID', async ({ page }) => {
    // Navigate with negative number
    await page.goto(`${BASE_URL}/projects/-1/board`, { waitUntil: 'domcontentloaded' });

    // Verify page loaded
    const html = await page.content();
    expect(html).toBeTruthy();
  });

  test('should display error message for invalid format', async ({ page }) => {
    // Navigate with invalid format
    await page.goto(`${BASE_URL}/projects/abc/board`);

    // Look for error message
    const bodyText = await page.textContent('body');
    const hasError = bodyText?.includes('404') ||
                     bodyText?.includes('Not Found') ||
                     bodyText?.includes('not found');

    expect(hasError).toBe(true);
  });
});
