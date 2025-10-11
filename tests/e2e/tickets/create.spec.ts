import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { cleanupDatabase } from '../../helpers/db-cleanup';

type TicketResponse = {
  id: number;
  title: string;
  stage: string;
  updatedAt: string;
  description: string | null;
};

const BASE_URL = 'http://localhost:3000';

async function createTicket(request: APIRequestContext, data: Record<string, unknown>): Promise<TicketResponse> {
  const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, { data });
  if (response.status() !== 201) {
    const errorBody = await response.text();
    console.error(`Expected 201, got ${response.status()}. Response:`, errorBody);
  }
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
  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should create ticket via API and appear in IDLE column', async ({ page, request }) => {
    const ticketData = {
      title: '[e2e] Fix login bug',
      description: 'Users cannot log in with email',
    };

    const createdTicket = await createTicket(request, ticketData);
    expect(createdTicket.stage).toBe('INBOX');

    await page.goto(`${BASE_URL}/projects/1/board`);

    const idleColumn = page.locator('[data-testid="column-INBOX"]').or(page.getByRole('region', { name: /inbox/i }));
    await expect(idleColumn.first()).toBeVisible();

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
  });

  test('should create ticket with minimal description and display correctly', async ({ page, request }) => {
    const ticketData = {
      title: '[e2e] Add dark mode toggle',
      description: 'Minimal description'
    };
    const createdTicket = await createTicket(request, ticketData);
    expect(createdTicket.description).toBe('Minimal description');

    await page.goto(`${BASE_URL}/projects/1/board`);

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
  });

  test('should update IDLE column ticket count badge after creation', async ({ page, request }) => {
    await page.goto(`${BASE_URL}/projects/1/board`);

    const idleColumn = page.locator('[data-testid="column-INBOX"]').first();
    const badge = idleColumn.locator('span[class*="rounded-full"]').first();
    const initialCount = Number.parseInt((await badge.textContent()) ?? '0', 10);

    await createTicket(request, {
      title: '[e2e] New ticket for count test',
      description: 'Testing count update',
    });

    await page.reload();

    const updatedCount = Number.parseInt((await badge.textContent()) ?? '0', 10);
    expect(updatedCount).toBe(initialCount + 1);
  });

  test('should display newly created ticket with all required fields', async ({ page, request }) => {
    const ticketData = {
      title: '[e2e] Implement user dashboard',
      description: 'Create a dashboard showing user statistics',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/projects/1/board`);

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
    expect((await ticketCard.textContent()) ?? '').toContain(ticketData.title);
  });

  test('should handle multiple sequential ticket creations', async ({ page, request }) => {
    const tickets = [
      { title: '[e2e] First ticket', description: 'First test ticket' },
      { title: '[e2e] Second ticket', description: 'Second test ticket' },
      { title: '[e2e] Third ticket', description: 'Third test ticket' },
    ];

    const createdTickets = [] as TicketResponse[];

    for (const ticketData of tickets) {
      createdTickets.push(await createTicket(request, ticketData));
    }

    await page.goto(`${BASE_URL}/projects/1/board`);

    for (const ticket of createdTickets) {
      const ticketCard = await findTicketCard(page, ticket.id, ticket.title);
      await expect(ticketCard).toBeVisible();
    }
  });

  test('should display ticket in correct stage (IDLE) after creation', async ({ page, request }) => {
    const ticketData = {
      title: '[e2e] Verify stage assignment',
      description: 'Ticket should be in IDLE stage',
    };

    await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/projects/1/board`);

    const idleColumn = page.locator('[data-testid="column-INBOX"]').first();

    const ticketInIdle = idleColumn.locator(`text="${ticketData.title}"`);
    await expect(ticketInIdle).toBeVisible();

    // Verify ticket is NOT in other columns
    const otherStages = ['PLAN', 'BUILD', 'VERIFY', 'SHIP'];
    for (const stage of otherStages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      const ticketInOtherColumn = column.locator(`text="${ticketData.title}"`);
      const count = await ticketInOtherColumn.count();
      expect(count).toBe(0);
    }
  });

  test('should persist ticket after page refresh', async ({ page, request }) => {
    const ticketData = {
      title: '[e2e] Persistence test ticket',
      description: 'This ticket should persist after refresh',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/projects/1/board`);

    let ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();

    await page.reload();

    ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();
  });

  test('should handle allowed punctuation in ticket title', async ({ page, request }) => {
    const ticketData = {
      title: '[e2e] Fix bug with special chars - test, test? test! test.',
      description: 'Testing allowed punctuation handling',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/projects/1/board`);

    const ticketCard = await findTicketCard(page, createdTicket.id, ticketData.title);
    await expect(ticketCard).toBeVisible();

    const cardText = (await ticketCard.textContent()) ?? '';
    expect(cardText).toContain('Fix bug');
    expect(cardText).toContain('special chars');
  });
});
