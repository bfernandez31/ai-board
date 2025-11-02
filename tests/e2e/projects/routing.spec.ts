import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';

/**
 * E2E Test: Project Routing (T004)
 * User Story: As a user, I want the root URL to redirect to the projects list page
 * Source: quickstart.md - Step 2
 */

test.describe('Project Routing', () => {
  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test
    await cleanupDatabase(projectId);
  });

  test('should redirect from root to /projects', async ({ page , projectId }) => {
    // Navigate to root URL
    await page.goto('http://localhost:3000/');

    // Wait for navigation to complete
    await page.waitForURL('**/projects');

    // Verify URL changed to projects list page
    expect(page.url()).toBe('http://localhost:3000/projects');

    // Verify projects page loaded successfully
    const heading = page.getByRole('heading', { name: /projects/i });
    await expect(heading).toBeVisible();
  });

  test('should allow direct access to /projects/1/board', async ({ page , projectId }) => {
    // Navigate directly to project board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify page loaded by waiting for board content
    const column = page.locator('[data-testid="column-INBOX"]').first();
    await expect(column).toBeVisible();

    // Verify URL didn't change
    expect(page.url()).toBe('http://localhost:3000/projects/1/board');
  });

  test('should maintain project context in URL', async ({ page , projectId }) => {
    // Navigate to board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify projectId remains in URL throughout interactions
    expect(page.url()).toContain('/projects/1/');

    // Interact with the board (if any interactive elements exist)
    // The URL should still contain the project context
    await page.waitForTimeout(100);
    expect(page.url()).toContain('/projects/1/');
  });
});
