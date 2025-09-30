import { test, expect } from '@playwright/test';

/**
 * E2E Test: Create Ticket and Display in IDLE Column
 * User Story: As a user, I want to create tickets that appear in the IDLE column
 * Source: quickstart.md - Test Scenario 2
 *
 * This test MUST FAIL until the API and board display are implemented
 */

test.describe('Ticket Creation and Display', () => {
  const BASE_URL = 'http://localhost:3000';

  test('should create ticket via API and appear in IDLE column', async ({ page, request }) => {
    // Step 1: Create ticket via API
    const ticketData = {
      title: 'Fix login bug',
      description: 'Users cannot log in with email'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    expect(response.status()).toBe(201);

    const createdTicket = await response.json();

    expect(createdTicket.id).toBeDefined();
    expect(createdTicket.title).toBe(ticketData.title);
    expect(createdTicket.stage).toBe('IDLE');

    // Step 2: Navigate to board page
    await page.goto(`${BASE_URL}/board`);

    // Step 3: Verify ticket appears in IDLE column
    const idleColumn = page.locator('[data-testid="column-IDLE"]').or(
      page.getByRole('region', { name: /idle/i })
    );

    await expect(idleColumn).toBeVisible();

    // Look for ticket by title in IDLE column
    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      idleColumn.locator(`text="${ticketData.title}"`)
    );

    await expect(ticketCard).toBeVisible();
  });

  test('should create ticket without description and display correctly', async ({ page, request }) => {
    const ticketData = {
      title: 'Add dark mode toggle'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    expect(response.status()).toBe(201);

    const createdTicket = await response.json();
    expect(createdTicket.description).toBeNull();

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text="${ticketData.title}"`).first()
    );

    await expect(ticketCard).toBeVisible();
  });

  test('should update IDLE column ticket count after creation', async ({ page, request }) => {
    await page.goto(`${BASE_URL}/board`);

    // Get initial count
    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const initialCountText = await idleColumn.textContent() || '';
    const initialCountMatch = initialCountText.match(/(\d+)\s*tickets?/i);
    const initialCount = initialCountMatch ? parseInt(initialCountMatch[1]) : 0;

    // Create new ticket
    await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'New ticket for count test',
        description: 'Testing count update'
      }
    });

    // Refresh page
    await page.reload();

    // Verify count increased
    const updatedCountText = await idleColumn.textContent() || '';
    const updatedCountMatch = updatedCountText.match(/(\d+)\s*tickets?/i);
    const updatedCount = updatedCountMatch ? parseInt(updatedCountMatch[1]) : 0;

    expect(updatedCount).toBe(initialCount + 1);
  });

  test('should display newly created ticket with all required fields', async ({ page, request }) => {
    const ticketData = {
      title: 'Implement user dashboard',
      description: 'Create a dashboard showing user statistics'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    // Find the ticket card
    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text="${ticketData.title}"`).first()
    );

    await expect(ticketCard).toBeVisible();

    // Verify ticket contains title (description not shown on card per spec)
    const cardText = await ticketCard.textContent();
    expect(cardText).toContain(ticketData.title);
  });

  test('should handle multiple sequential ticket creations', async ({ page, request }) => {
    const tickets = [
      { title: 'First ticket', description: 'First test ticket' },
      { title: 'Second ticket', description: 'Second test ticket' },
      { title: 'Third ticket', description: 'Third test ticket' }
    ];

    const createdTickets = [];

    // Create tickets sequentially
    for (const ticketData of tickets) {
      const response = await request.post(`${BASE_URL}/api/tickets`, {
        data: ticketData
      });
      expect(response.status()).toBe(201);
      createdTickets.push(await response.json());
    }

    await page.goto(`${BASE_URL}/board`);

    // Verify all tickets are visible in IDLE column
    for (const ticket of createdTickets) {
      const ticketCard = page.locator(`[data-testid="ticket-${ticket.id}"]`).or(
        page.locator(`text="${ticket.title}"`).first()
      );
      await expect(ticketCard).toBeVisible();
    }
  });

  test('should display ticket in correct stage (IDLE) after creation', async ({ page, request }) => {
    const ticketData = {
      title: 'Verify stage assignment',
      description: 'Ticket should be in IDLE stage'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    // Verify ticket is in IDLE column, not in other columns
    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const otherColumns = [
      page.locator('[data-testid="column-PLAN"]'),
      page.locator('[data-testid="column-BUILD"]'),
      page.locator('[data-testid="column-REVIEW"]'),
      page.locator('[data-testid="column-SHIPPED"]'),
      page.locator('[data-testid="column-ERRORED"]')
    ];

    // Ticket should be in IDLE
    const ticketInIdle = idleColumn.locator(`text="${ticketData.title}"`);
    await expect(ticketInIdle).toBeVisible();

    // Ticket should NOT be in other columns
    for (const column of otherColumns) {
      const ticketInOther = column.locator(`text="${ticketData.title}"`);
      await expect(ticketInOther).not.toBeVisible();
    }
  });

  test('should persist ticket after page refresh', async ({ page, request }) => {
    const ticketData = {
      title: 'Persistence test ticket',
      description: 'This ticket should persist after refresh'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    // Verify ticket is visible
    let ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text="${ticketData.title}"`).first()
    );
    await expect(ticketCard).toBeVisible();

    // Refresh page
    await page.reload();

    // Verify ticket is still visible after refresh
    ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text="${ticketData.title}"`).first()
    );
    await expect(ticketCard).toBeVisible();
  });

  test('should handle special characters in ticket title', async ({ page, request }) => {
    const ticketData = {
      title: 'Fix "bug" with <special> & characters: 日本語 🚀',
      description: 'Testing special character handling'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    expect(response.status()).toBe(201);

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    // Verify ticket displays correctly with special characters
    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text=/Fix.*bug.*special/i`).first()
    );

    await expect(ticketCard).toBeVisible();

    const cardText = await ticketCard.textContent();
    expect(cardText).toContain('Fix');
    expect(cardText).toContain('bug');
  });
});