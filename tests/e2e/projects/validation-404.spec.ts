import { test, expect } from '../../fixtures/auth';
import { cleanupDatabase } from '../../helpers/db-cleanup';

/**
 * E2E Test: Invalid Project ID Returns 404 (T006)
 * User Story: As a user, I should get a clear error when accessing a non-existent project
 * Source: quickstart.md - Step 4
 *
 * This test MUST FAIL until project validation is implemented
 */

test.describe('Project Validation - 404 Errors', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Clean database before each test
    await cleanupDatabase();

    // Mock SSE endpoint to prevent connection timeouts
    await page.route('**/api/sse**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      });
    });
  });

  test('should return 404 for non-existent project ID', async ({ page }) => {
    // Navigate to board with non-existent project
    const response = await page.goto(`${BASE_URL}/projects/999999/board`);

    // Verify response is 404 or page shows error
    // Next.js may show 404 page or error boundary
    expect(response?.status()).toBe(404);
  });

  test('should display error message for non-existent project', async ({ page }) => {
    // Navigate to non-existent project
    await page.goto(`${BASE_URL}/projects/999999/board`);

    // Look for error indicators
    // Could be "404", "Not Found", "Project not found", etc.
    const bodyText = await page.textContent('body');
    const hasError = bodyText?.includes('404') ||
                     bodyText?.includes('Not Found') ||
                     bodyText?.includes('not found') ||
                     bodyText?.includes('Project not found');

    expect(hasError).toBe(true);
  });

  test('should not display tickets for non-existent project', async ({ page, request }) => {
    // Create a ticket in project 1
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Test ticket in project 1',
        description: 'Should not appear when viewing invalid project'
      }
    });

    // Try to navigate to non-existent project
    await page.goto(`${BASE_URL}/projects/999999/board`, { waitUntil: 'domcontentloaded' });

    // Verify the ticket from project 1 is NOT visible
    await expect(page.getByText('Test ticket in project 1')).not.toBeVisible();

    // Verify no ticket cards are visible
    const ticketCards = page.locator('[data-testid^="ticket-card-"]');
    await expect(ticketCards).toHaveCount(0);
  });

  test('should not crash when accessing invalid project', async ({ page }) => {
    // Navigate to invalid project
    await page.goto(`${BASE_URL}/projects/999999/board`, { waitUntil: 'domcontentloaded' });

    // Verify page has basic structure (not a crash/white screen)
    const html = await page.content();
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(100);
  });
});
