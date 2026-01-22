import { test, expect } from '../helpers/worker-isolation';
import type { APIResponse } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * E2E Tests: Activity Feed Navigation
 * Feature: AIB-181-copy-of-project
 *
 * Tests navigation from activity feed to ticket modal on board page
 */

test.describe('Activity Feed Navigation', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
  });

  /**
   * Helper: Create a ticket via API
   */
  const createTicket = async (
    request: any,
    projectId: number,
    title: string = '[e2e] Test Ticket'
  ): Promise<{ id: number; ticketKey: string; title: string }> => {
    const response: APIResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title,
        description: 'Test description for activity navigation',
      },
    });

    if (!response.ok()) {
      const error = await response.json();
      throw new Error(`Failed to create ticket: ${JSON.stringify(error)}`);
    }

    return response.json();
  };

  test('should navigate to activity page from board', async ({ page, request, projectId }) => {
    // Create a ticket to ensure there's activity
    await createTicket(request, projectId, '[e2e] Navigation Test Ticket');

    // Navigate to board first
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);
    await expect(page.locator('h1')).toBeVisible();

    // Navigate to activity page directly
    await page.goto(`${BASE_URL}/projects/${projectId}/activity`);

    // Verify activity page loaded
    await expect(page.locator('h1')).toHaveText('Activity');
    await expect(page.locator('text=Recent activity')).toBeVisible();
  });

  test('should display activity events when tickets exist', async ({ page, request, projectId }) => {
    // Create a ticket
    const ticket = await createTicket(request, projectId, '[e2e] Activity Events Test');

    // Navigate to activity page
    await page.goto(`${BASE_URL}/projects/${projectId}/activity`);

    // Wait for activity feed to load
    await expect(page.locator('h1')).toHaveText('Activity');

    // Should show the ticket_created event with the ticket key
    await expect(page.locator(`text=${ticket.ticketKey}`)).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to board with ticket modal when clicking ticket reference', async ({ page, request, projectId }) => {
    // Create a ticket
    const ticket = await createTicket(request, projectId, '[e2e] Modal Navigation Test');

    // Navigate to activity page
    await page.goto(`${BASE_URL}/projects/${projectId}/activity`);

    // Wait for activity to load
    await expect(page.locator(`text=${ticket.ticketKey}`)).toBeVisible({ timeout: 10000 });

    // Click the ticket key link
    await page.locator(`text=${ticket.ticketKey}`).first().click();

    // Should navigate to board with ticket modal query params
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/board\\?ticket=${ticket.ticketKey}&modal=open`));

    // Modal should be visible with ticket content
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${ticket.title}`)).toBeVisible();
  });

  test('should show empty state when no activity', async ({ page, projectId }) => {
    // Navigate to activity page (no tickets created)
    await page.goto(`${BASE_URL}/projects/${projectId}/activity`);

    // Should show empty state
    await expect(page.locator('text=No activity yet')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=No activity in the last 30 days')).toBeVisible();
  });

  test('should have Back to Board button that navigates correctly', async ({ page, request, projectId }) => {
    // Create a ticket to have content
    await createTicket(request, projectId, '[e2e] Back Button Test');

    // Navigate to activity page
    await page.goto(`${BASE_URL}/projects/${projectId}/activity`);

    // Click Back to Board button
    await page.locator('text=Back to Board').click();

    // Should navigate to board
    await expect(page).toHaveURL(`${BASE_URL}/projects/${projectId}/board`);
  });

  test('should show multiple event types in activity feed', async ({ page, request, projectId }) => {
    // Create a ticket
    const ticket = await createTicket(request, projectId, '[e2e] Multiple Events Test');

    // Add a comment to the ticket
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${ticket.id}/comments`, {
      data: {
        content: 'Test comment for activity feed',
      },
    });

    // Navigate to activity page
    await page.goto(`${BASE_URL}/projects/${projectId}/activity`);

    // Wait for activity to load
    await expect(page.locator('h1')).toHaveText('Activity');

    // Should show both ticket creation and comment events
    // Multiple instances of ticket key may exist (one for creation, one for comment)
    const ticketKeyElements = page.locator(`text=${ticket.ticketKey}`);
    await expect(ticketKeyElements.first()).toBeVisible({ timeout: 10000 });

    // Comment content should be visible (truncated)
    await expect(page.locator('text=Test comment for activity feed')).toBeVisible();
  });
});
