import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

type TicketResponse = {
  id: number;
  title: string;
  stage: string;
  updatedAt: string;
  description: string | null;
};

const BASE_URL = 'http://localhost:3000';

async function createTicket(request: APIRequestContext, data: Record<string, unknown>): Promise<TicketResponse> {
  const response = await request.post(`${BASE_URL}/api/tickets`, { data });
  expect(response.status()).toBe(201);
  const json = (await response.json()) as Partial<TicketResponse>;

  if (typeof json.id !== 'number' || typeof json.title !== 'string' || typeof json.stage !== 'string') {
    throw new Error('Invalid ticket payload received');
  }

  return {
    description: json.description ?? null,
    updatedAt: json.updatedAt ?? new Date().toISOString(),
    ...json,
  } as TicketResponse;
}

async function findTicketCard(page: Page, ticketId: number, fallbackTitle: string): Promise<Locator> {
  return page.locator(`[data-testid="ticket-${ticketId}"]`).or(page.locator(`text="${fallbackTitle}"`).first());
}

test.describe('Ticket Creation and Display', () => {
  test('should create ticket via API and appear in IDLE column', async ({ page, request }) => {
    const ticketData = {
      title: 'Fix login bug',
      description: 'Users cannot log in with email',
    };

    const createdTicket = await createTicket(request, ticketData);
    expect(createdTicket.stage).toBe('IDLE');

    await page.goto(`${BASE_URL}/board`);

    const idleColumn = page.locator('[data-testid="column-IDLE"]').or(page.getByRole('region', { name: /idle/i }));
    await expect(idleColumn.first()).toBeVisible();

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
  });

  test('should create ticket without description and display correctly', async ({ page, request }) => {
    const ticketData = { title: 'Add dark mode toggle' };
    const createdTicket = await createTicket(request, ticketData);
    expect(createdTicket.description).toBeNull();

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
  });

  test('should update IDLE column ticket count after creation', async ({ page, request }) => {
    await page.goto(`${BASE_URL}/board`);

    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const initialCountText = (await idleColumn.textContent()) ?? '';
    const initialCountMatch = initialCountText.match(/(\d+)\s*tickets?/i);
    const initialCount = initialCountMatch?.[1] ? Number.parseInt(initialCountMatch[1], 10) : 0;

    await createTicket(request, {
      title: 'New ticket for count test',
      description: 'Testing count update',
    });

    await page.reload();

    const updatedCountText = (await idleColumn.textContent()) ?? '';
    const updatedCountMatch = updatedCountText.match(/(\d+)\s*tickets?/i);
    const updatedCount = updatedCountMatch?.[1] ? Number.parseInt(updatedCountMatch[1], 10) : 0;

    expect(updatedCount).toBe(initialCount + 1);
  });

  test('should display newly created ticket with all required fields', async ({ page, request }) => {
    const ticketData = {
      title: 'Implement user dashboard',
      description: 'Create a dashboard showing user statistics',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
    expect((await ticketCard.textContent()) ?? '').toContain(ticketData.title);
  });

  test('should handle multiple sequential ticket creations', async ({ page, request }) => {
    const tickets = [
      { title: 'First ticket', description: 'First test ticket' },
      { title: 'Second ticket', description: 'Second test ticket' },
      { title: 'Third ticket', description: 'Third test ticket' },
    ];

    const createdTickets = [] as TicketResponse[];

    for (const ticketData of tickets) {
      createdTickets.push(await createTicket(request, ticketData));
    }

    await page.goto(`${BASE_URL}/board`);

    for (const ticket of createdTickets) {
      const ticketCard = await findTicketCard(page, ticket.id, ticket.title);
      await expect(ticketCard).toBeVisible();
    }
  });

  test('should display ticket in correct stage (IDLE) after creation', async ({ page, request }) => {
    const ticketData = {
      title: 'Verify stage assignment',
      description: 'Ticket should be in IDLE stage',
    };

    await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/board`);

    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const otherColumns = [
      page.locator('[data-testid="column-PLAN"]'),
      page.locator('[data-testid="column-BUILD"]'),
      page.locator('[data-testid="column-REVIEW"]'),
      page.locator('[data-testid="column-SHIPPED"]'),
      page.locator('[data-testid="column-ERRORED"]'),
    ];

    const ticketInIdle = idleColumn.locator(`text="${ticketData.title}"`);
    await expect(ticketInIdle).toBeVisible();

    for (const column of otherColumns) {
      await expect(column.locator(`text="${ticketData.title}"`)).not.toBeVisible();
    }
  });

  test('should persist ticket after page refresh', async ({ page, request }) => {
    const ticketData = {
      title: 'Persistence test ticket',
      description: 'This ticket should persist after refresh',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/board`);

    let ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();

    await page.reload();

    ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
  });

  test('should handle special characters in ticket title', async ({ page, request }) => {
    const ticketData = {
      title: 'Fix "bug" with <special> & characters: 日本語 🚀',
      description: 'Testing special character handling',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();

    const cardText = (await ticketCard.textContent()) ?? '';
    expect(cardText).toContain('Fix');
    expect(cardText).toContain('bug');
  });
});
