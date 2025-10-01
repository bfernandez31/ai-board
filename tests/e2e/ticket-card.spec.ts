import { test, expect, type APIRequestContext, type Locator } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

type TicketResponse = {
  id: number;
  title: string;
  stage: string;
  updatedAt: string;
};

const BASE_URL = 'http://localhost:3000';

async function createTicket(request: APIRequestContext, data: Record<string, unknown>): Promise<TicketResponse> {
  const response = await request.post(`${BASE_URL}/api/tickets`, { data });
  expect(response.ok()).toBeTruthy();
  const ticket = (await response.json()) as Partial<TicketResponse>;

  if (typeof ticket.id !== 'number' || typeof ticket.title !== 'string' || typeof ticket.updatedAt !== 'string') {
    throw new Error('Ticket creation response missing required fields');
  }

  return ticket as TicketResponse;
}

async function getText(locator: Locator): Promise<string> {
  return (await locator.textContent()) ?? '';
}

async function getStyleValue(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (element, prop) => window.getComputedStyle(element).getPropertyValue(prop as string),
    property
  );
}

test.describe('Ticket Card Display', () => {
  test.beforeEach(async ({ request }) => {
    // Clean database before each test
    await cleanupDatabase();

    await createTicket(request, {
      title: 'Test Ticket for Card Display',
      description: 'This ticket is used for card display testing',
    });
  });

  test('should display ticket title on card', async ({ page, request }) => {
    const ticketData = {
      title: 'Display Title Test Ticket',
      description: 'Testing title display',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text="${ticketData.title}"`).first()
    );

    await expect(ticketCard).toBeVisible();
    expect(await getText(ticketCard)).toContain(ticketData.title);
  });

  test('should display ticket ID in format #N', async ({ page, request }) => {
    const createdTicket = await createTicket(request, {
      title: 'ID Format Test Ticket',
      description: 'Testing ID display',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator('text="ID Format Test Ticket"').first()
    );

    await expect(ticketCard).toBeVisible();

    const idPattern = new RegExp(`#${createdTicket.id}\\b`);
    expect(await getText(ticketCard)).toMatch(idPattern);
  });

  test('should display status badge showing stage', async ({ page, request }) => {
    await createTicket(request, {
      title: 'Badge Test Ticket',
      description: 'Testing badge display',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator('text="Badge Test Ticket"').first();
    await expect(ticketCard).toBeVisible();

    const badge = ticketCard.locator('[data-testid="ticket-badge"]').or(ticketCard.locator('text=/idle/i'));
    await expect(badge.first()).toBeVisible();
  });

  test('should display timestamp in relative format (<24h)', async ({ page, request }) => {
    await createTicket(request, {
      title: 'Recent Timestamp Test',
      description: 'Testing relative timestamp',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator('text="Recent Timestamp Test"').first();
    await expect(ticketCard).toBeVisible();

    const cardText = await getText(ticketCard);
    const relativeTimePatterns = [
      /\d+\s*(second|minute|hour)s?\s*ago/i,
      /just now/i,
      /moments? ago/i,
      /a few (second|minute|hour)s? ago/i,
    ];

    const hasRelativeTime = relativeTimePatterns.some((pattern) => pattern.test(cardText));
    expect(hasRelativeTime).toBe(true);
  });

  test('should show visual feedback on hover', async ({ page, request }) => {
    await createTicket(request, {
      title: 'Hover Test Ticket',
      description: 'Testing hover effect',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator('text="Hover Test Ticket"').first();
    await expect(ticketCard).toBeVisible();

    const initialBg = await getStyleValue(ticketCard, 'background-color');

    await ticketCard.hover();

    const cursor = await getStyleValue(ticketCard, 'cursor');
    expect(cursor).toBe('pointer');

    await page.waitForTimeout(100);

    const hoverBg = await getStyleValue(ticketCard, 'background-color');
    const hoverBorder = await getStyleValue(ticketCard, 'border');

    const hasVisualChange = hoverBg !== initialBg || hoverBorder.includes('rgb');
    expect(hasVisualChange).toBeTruthy();
  });

  test('should show visual feedback on click', async ({ page, request }) => {
    await createTicket(request, {
      title: 'Click Test Ticket',
      description: 'Testing click effect',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator('text="Click Test Ticket"').first();
    await expect(ticketCard).toBeVisible();

    await ticketCard.click();
    await page.waitForTimeout(100);

    const transform = await getStyleValue(ticketCard, 'transform');
    const boxShadow = await getStyleValue(ticketCard, 'box-shadow');

    const hasClickFeedback = transform !== 'none' || boxShadow !== 'none';
    expect(hasClickFeedback).toBeTruthy();
  });

  test('should NOT navigate or open modal on click', async ({ page, request }) => {
    await createTicket(request, {
      title: 'No Navigation Test',
      description: 'Click should not navigate',
    });

    await page.goto(`${BASE_URL}/board`);

    const initialUrl = page.url();
    const ticketCard = page.locator('text="No Navigation Test"').first();
    await expect(ticketCard).toBeVisible();

    await ticketCard.click();
    await page.waitForTimeout(200);

    expect(page.url()).toBe(initialUrl);

    const modal = page.locator('[role="dialog"]').or(page.locator('.modal'));
    await expect(modal.first()).not.toBeVisible();
  });

  test('should display all required card elements together', async ({ page, request }) => {
    const ticketData = {
      title: 'Complete Card Test',
      description: 'Testing all card elements',
    };

    const createdTicket = await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="${ticketData.title}"`).first();
    await expect(ticketCard).toBeVisible();

    const cardText = await getText(ticketCard);
    const hasTitle = cardText.includes(ticketData.title);
    const hasId = cardText.includes(`#${createdTicket.id}`);
    const hasTimestamp = /\d+\s*(second|minute|hour)s?\s*ago|just now/i.test(cardText);

    expect(hasTitle).toBe(true);
    expect(hasId).toBe(true);
    expect(hasTimestamp).toBe(true);
  });

  test('should NOT display description on card', async ({ page, request }) => {
    const ticketData = {
      title: 'Description Hidden Test',
      description: 'THIS_UNIQUE_DESCRIPTION_SHOULD_NOT_BE_VISIBLE_ON_CARD',
    };

    await createTicket(request, ticketData);

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="${ticketData.title}"`).first();
    await expect(ticketCard).toBeVisible();

    expect(await getText(ticketCard)).not.toContain('THIS_UNIQUE_DESCRIPTION_SHOULD_NOT_BE_VISIBLE_ON_CARD');
  });

  test('should maintain consistent card height', async ({ page, request }) => {
    const tickets = [
      { title: 'Short', description: 'Short title ticket' },
      { title: 'Medium length title for testing', description: 'Medium title' },
      {
        title: 'Very long title that might span multiple lines depending on card width and font size',
        description: 'Long title',
      },
    ];

    await Promise.all(tickets.map((ticket) => createTicket(request, ticket)));

    await page.goto(`${BASE_URL}/board`);

    const cards = await page.locator('[data-testid^="ticket-"]').or(page.locator('.ticket-card, [class*="ticket"]')).all();

    if (cards.length >= 2) {
      const heights = await Promise.all(cards.map((card) => card.evaluate((el) => el.getBoundingClientRect().height)));

      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      const variance = (maxHeight - minHeight) / maxHeight;

      expect(variance).toBeLessThan(0.3);
    }
  });
});
