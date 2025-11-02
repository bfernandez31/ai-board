import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';

/**
 * E2E Test: Project-Scoped Board Access (T005)
 * User Story: As a user, I want to see only tickets from the current project on the board
 * Source: quickstart.md - Step 3
 *
 * This test MUST FAIL until project-scoped API is implemented
 */

test.describe('Project-Scoped Board Access', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ page , projectId }) => {
    // Clean database before each test
    await cleanupDatabase(projectId);

    // Mock SSE endpoint to prevent connection timeouts
    await page.route('**/api/sse**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      });
    });
  });

  test('should display only project 1 tickets on /projects/1/board', async ({ page, request , projectId }) => {
    // Create ticket in project 1
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket in project 1',
        description: 'Should be visible'
      }
    });

    // Navigate to project 1 board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('domcontentloaded');

    // Verify ticket is visible
    await expect(page.getByText('Ticket in project 1')).toBeVisible();
  });

  test('should show all stages on project board', async ({ page , projectId }) => {
    // Navigate to project board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);

    // Verify all 6 stages are visible
    const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'];

    for (const stage of stages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      await expect(column).toBeVisible();
    }
  });

  test('should not display tickets from other projects', async ({ page, request , projectId }) => {
    // Create ticket in this worker's project
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket in project 1',
        description: 'Should be visible'
      }
    });

    // Use a different project for the "other" ticket (project 3 is always available - dev project)
    // But we need to skip this test if projectId is 3, or use a different safe project
    const otherProjectId = projectId === 3 ? 8 : 3; // Use project 8 if we're on project 3, otherwise use 3

    // Try to create ticket in the other project (may fail if project doesn't exist, that's ok)
    try {
      await request.post(`${BASE_URL}/api/projects/${otherProjectId}/tickets`, {
        data: {
          title: '[e2e] Ticket in project 2',
          description: 'Should NOT be visible on project 1 board'
        }
      });
    } catch {
      // If the other project doesn't exist, that's fine for this test
    }

    // Navigate to this worker's project board
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await page.waitForLoadState('domcontentloaded');

    // Verify this project's ticket is visible
    await expect(page.getByText('Ticket in project 1')).toBeVisible();

    // Verify other project's ticket is NOT visible
    await expect(page.getByText('Ticket in project 2')).not.toBeVisible();
  });
});
