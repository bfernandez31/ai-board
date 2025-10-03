import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * E2E Test: Create Ticket with Project Context (T009)
 * User Story: As a user, when I create a ticket, it should use the project from the URL
 * Source: quickstart.md - Step 5
 *
 * This test MUST FAIL until project-scoped create API is implemented
 */

test.describe('Create Ticket with Project Context', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should POST to /api/projects/1/tickets when creating ticket', async ({ page }) => {
    // Set up request listener
    const requestPromise = page.waitForRequest(
      req => req.url().includes('/api/projects/1/tickets') && req.method() === 'POST'
    );

    // Navigate to project 1 board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Click "New Ticket" button
    const newTicketButton = page.getByRole('button', { name: /new ticket/i });
    await newTicketButton.click();

    // Fill form
    const titleInput = page.getByPlaceholder(/title/i);
    const descriptionInput = page.getByPlaceholder(/description/i);

    await titleInput.fill('Test ticket with project context');
    await descriptionInput.fill('Verify ticket is created in correct project');

    // Submit form
    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    // Verify POST request was made to project-scoped endpoint
    const capturedRequest = await requestPromise;
    expect(capturedRequest.url()).toContain('/api/projects/1/tickets');
    expect(capturedRequest.method()).toBe('POST');
  });

  test('should create ticket with projectId=1 from URL context', async ({ page, request }) => {
    // Navigate to project 1 board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Open new ticket modal
    const newTicketButton = page.getByRole('button', { name: /new ticket/i });
    await newTicketButton.click();

    // Fill and submit form
    await page.getByPlaceholder(/title/i).fill('Ticket for project 1');
    await page.getByPlaceholder(/description/i).fill('Should have projectId=1');

    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    // Wait for ticket to appear
    await page.waitForTimeout(500);

    // Verify ticket appears on project 1 board
    await expect(page.getByText('Ticket for project 1')).toBeVisible();

    // Verify via API that ticket has projectId=1
    const getResponse = await request.get(`${BASE_URL}/api/projects/1/tickets`);
    expect(getResponse.status()).toBe(200);

    const tickets = await getResponse.json();
    const createdTicket = tickets.INBOX.find((t: any) => t.title === 'Ticket for project 1');

    expect(createdTicket).toBeDefined();
    expect(createdTicket.description).toBe('Should have projectId=1');
  });

  test('should display created ticket in INBOX column', async ({ page }) => {
    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Create ticket via UI
    const newTicketButton = page.getByRole('button', { name: /new ticket/i });
    await newTicketButton.click();

    await page.getByPlaceholder(/title/i).fill('New inbox ticket');
    await page.getByPlaceholder(/description/i).fill('Should appear in INBOX');

    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    // Wait for modal to close and ticket to appear
    await page.waitForTimeout(500);

    // Verify ticket appears in INBOX column
    const inboxColumn = page.locator('[data-testid="column-INBOX"]');
    await expect(inboxColumn.getByText('New inbox ticket')).toBeVisible();
  });

  test('should not send projectId in request body', async ({ page }) => {
    let requestBody: any = null;

    // Intercept POST request to capture body
    await page.route('**/api/projects/*/tickets', async (route, request) => {
      if (request.method() === 'POST') {
        requestBody = request.postDataJSON();
      }
      await route.continue();
    });

    // Navigate and create ticket
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    const newTicketButton = page.getByRole('button', { name: /new ticket/i });
    await newTicketButton.click();

    await page.getByPlaceholder(/title/i).fill('Test ticket');
    await page.getByPlaceholder(/description/i).fill('Test description');

    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    await page.waitForTimeout(500);

    // Verify projectId is NOT in request body (it comes from URL)
    expect(requestBody).toBeDefined();
    expect(requestBody).not.toHaveProperty('projectId');
    expect(requestBody).toHaveProperty('title');
    expect(requestBody).toHaveProperty('description');
  });
});
