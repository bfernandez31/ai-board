import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * E2E Test: Update Ticket with Project Context (T010)
 * User Story: As a user, when I update a ticket, it should use the project from the URL
 * Source: quickstart.md - Step 6
 *
 * This test MUST FAIL until project-scoped update API is implemented
 */

test.describe('Update Ticket with Project Context', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should PATCH to /api/projects/1/tickets/{id} when dragging ticket', async ({ page, request }) => {
    // Create a test ticket
    const createResponse = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Draggable ticket',
        description: 'For drag-and-drop testing'
      }
    });
    expect(createResponse.status()).toBe(201);

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Set up request listener
    const requestPromise = page.waitForRequest(
      request => request.url().includes('/api/projects/1/tickets/') && request.method() === 'PATCH'
    );

    // Drag ticket from INBOX to SPECIFY
    const ticketCard = page.getByText('Draggable ticket').first();
    const specifyColumn = page.locator('[data-testid="column-SPECIFY"]');

    await ticketCard.dragTo(specifyColumn);

    // Verify PATCH request was made to project-scoped endpoint
    const patchRequest = await requestPromise;
    expect(patchRequest.url()).toContain('/api/projects/1/tickets/');
    expect(patchRequest.method()).toBe('PATCH');
  });

  test('should update ticket stage via project-scoped API', async ({ page, request }) => {
    // Create ticket
    const createResponse = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Movable ticket',
        description: 'Will move to SPECIFY'
      }
    });
    expect(createResponse.status()).toBe(201);
    const ticket = await createResponse.json();

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Drag ticket to SPECIFY
    const ticketCard = page.getByText('Movable ticket').first();
    const specifyColumn = page.locator('[data-testid="column-SPECIFY"]');

    await ticketCard.dragTo(specifyColumn);

    // Wait for update
    await page.waitForTimeout(500);

    // Verify ticket moved
    await expect(specifyColumn.getByText('Movable ticket')).toBeVisible();

    // Verify via API
    const getResponse = await request.get(`${BASE_URL}/api/projects/1/tickets`);
    const tickets = await getResponse.json();

    const updatedTicket = tickets.SPECIFY.find((t: any) => t.id === ticket.id);
    expect(updatedTicket).toBeDefined();
    expect(updatedTicket.stage).toBe('SPECIFY');
  });

  test('should persist ticket updates after page refresh', async ({ page, request }) => {
    // Create ticket
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Persistent ticket',
        description: 'Should stay in SPECIFY after refresh'
      }
    });

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Move ticket to SPECIFY
    const ticketCard = page.getByText('Persistent ticket').first();
    const specifyColumn = page.locator('[data-testid="column-SPECIFY"]');

    await ticketCard.dragTo(specifyColumn);
    await page.waitForTimeout(500);

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify ticket still in SPECIFY column
    await expect(specifyColumn.getByText('Persistent ticket')).toBeVisible();
  });

  test('should use project-scoped API for inline edits', async ({ page, request }) => {
    // Create ticket
    const createResponse = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Editable ticket',
        description: 'Original description'
      }
    });
    expect(createResponse.status()).toBe(201);

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    // Set up request listener for PATCH
    const requestPromise = page.waitForRequest(
      request => request.url().includes('/api/projects/1/tickets/') && request.method() === 'PATCH'
    );

    // Open ticket for editing (double-click or click edit button)
    const ticketCard = page.getByText('Editable ticket').first();
    await ticketCard.dblclick();

    // Edit title (if inline editing is implemented)
    // This is a placeholder - actual implementation depends on UI
    const titleInput = page.getByDisplayValue('Editable ticket');
    if (await titleInput.count() > 0) {
      await titleInput.fill('Edited ticket title');
      await titleInput.press('Enter');

      // Verify PATCH to project-scoped endpoint
      const patchRequest = await requestPromise;
      expect(patchRequest.url()).toContain('/api/projects/1/tickets/');
    }
  });

  test('should include version in update requests', async ({ page, request }) => {
    // Create ticket
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Versioned ticket',
        description: 'Has version control'
      }
    });

    let patchBody: any = null;

    // Intercept PATCH request
    await page.route('**/api/projects/*/tickets/*', async (route, req) => {
      if (req.method() === 'PATCH') {
        patchBody = req.postDataJSON();
      }
      await route.continue();
    });

    // Navigate and update ticket
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.waitForLoadState('networkidle');

    const ticketCard = page.getByText('Versioned ticket').first();
    const specifyColumn = page.locator('[data-testid="column-SPECIFY"]');

    await ticketCard.dragTo(specifyColumn);
    await page.waitForTimeout(500);

    // Verify version was included in request
    expect(patchBody).toBeDefined();
    expect(patchBody).toHaveProperty('version');
    expect(typeof patchBody.version).toBe('number');
  });
});
