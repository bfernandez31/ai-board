import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * E2E Test: Project-Scoped Board Access (T005)
 * User Story: As a user, I want to see only tickets from the current project on the board
 * Source: quickstart.md - Step 3
 *
 * This test MUST FAIL until project-scoped API is implemented
 */

test.describe('Project-Scoped Board Access', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should display only project 1 tickets on /projects/1/board', async ({ page, request }) => {
    // Create ticket in project 1
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Ticket in project 1',
        description: 'Should be visible'
      }
    });

    // Navigate to project 1 board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Verify ticket is visible
    await expect(page.getByText('Ticket in project 1')).toBeVisible();
  });

  test('should show all stages on project board', async ({ page }) => {
    // Navigate to project board
    await page.goto(`${BASE_URL}/projects/1/board`);

    // Verify all 6 stages are visible
    const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'];

    for (const stage of stages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      await expect(column).toBeVisible();
    }
  });

  test('should not display tickets from other projects', async ({ page, request }) => {
    // Create ticket in project 1
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Ticket in project 1',
        description: 'Should be visible'
      }
    });

    // Try to create ticket in project 2 (may fail if project doesn't exist, that's ok)
    try {
      await request.post(`${BASE_URL}/api/projects/2/tickets`, {
        data: {
          title: 'Ticket in project 2',
          description: 'Should NOT be visible on project 1 board'
        }
      });
    } catch {
      // If project 2 doesn't exist, that's fine for this test
    }

    // Navigate to project 1 board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Verify project 1 ticket is visible
    await expect(page.getByText('Ticket in project 1')).toBeVisible();

    // Verify project 2 ticket is NOT visible
    await expect(page.getByText('Ticket in project 2')).not.toBeVisible();
  });
});
