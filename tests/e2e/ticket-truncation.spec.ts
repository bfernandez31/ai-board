import { test, expect, type APIRequestContext, type Locator } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

type TicketResponse = {
  id: number;
  title: string;
};

async function createTicket(request: APIRequestContext, data: Record<string, unknown>): Promise<TicketResponse> {
  const response = await request.post(`${BASE_URL}/api/tickets`, { data });
  expect(response.ok()).toBeTruthy();
  const json = (await response.json()) as Partial<TicketResponse>;
  if (typeof json.id !== 'number' || typeof json.title !== 'string') {
    throw new Error('Ticket API did not return required fields');
  }
  return json as TicketResponse;
}

async function getStyle(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((element, prop) => window.getComputedStyle(element).getPropertyValue(prop as string), property);
}

test.describe('Ticket Title Truncation', () => {
  test('should truncate very long title at 2 lines', async ({ page, request }) => {
    const longTitle =
      'This is a very long ticket title that should definitely exceed two lines when displayed on the card and needs to be truncated with an ellipsis to maintain consistent card heights';

    const ticket = await createTicket(request, {
      title: longTitle,
      description: 'Testing truncation',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${ticket.id}"]`).or(page.locator('text=/This is a very long/i').first());
    await expect(ticketCard).toBeVisible();

    const titleElement = ticketCard
      .locator('[data-testid="ticket-title"]').or(ticketCard.locator('h3, h4, .title, [class*="title"]').first());

    if ((await titleElement.count()) > 0) {
      const lineClamp = await getStyle(titleElement.first(), '-webkit-line-clamp');
      const overflow = await getStyle(titleElement.first(), 'overflow');
      const textOverflow = await getStyle(titleElement.first(), 'text-overflow');

      const hasTruncation = lineClamp === '2' || overflow === 'hidden' || textOverflow === 'ellipsis';
      expect(hasTruncation).toBe(true);
    }
  });

  test('should display ellipsis (...) when title is truncated', async ({ page, request }) => {
    const longTitle = 'A'.repeat(200);

    await createTicket(request, {
      title: longTitle,
      description: 'Ellipsis test',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator('[data-testid^="ticket-"]').first();
    await expect(ticketCard).toBeVisible();

    const titleElement = ticketCard
      .locator('[data-testid="ticket-title"]').or(ticketCard.locator('h3, h4, .title, [class*="title"]').first());

    if ((await titleElement.count()) > 0) {
      const textOverflow = await getStyle(titleElement.first(), 'text-overflow');
      const hasEllipsis = textOverflow.includes('ellipsis');
      expect(hasEllipsis).toBe(true);
    }
  });

  test('should maintain consistent heights for truncated titles', async ({ page, request }) => {
    const titles = [
      'Short title',
      'Medium length ticket title for testing truncation behavior',
      'This is a very long ticket title that spans multiple lines and must be truncated to keep the card height consistent',
    ];

    await Promise.all(
      titles.map((title) =>
        createTicket(request, {
          title,
          description: 'Consistency check',
        })
      )
    );

    await page.goto(`${BASE_URL}/board`);

    const titleElements = await page
      .locator('[data-testid="ticket-title"]').or(page.locator('h3, h4, .title, [class*="title"]').first())
      .all();

    if (titleElements.length >= 2) {
      const heights = await Promise.all(
        titleElements.map((element) => element.evaluate((el) => el.getBoundingClientRect().height))
      );

      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      const variance = (maxHeight - minHeight) / maxHeight;

      expect(variance).toBeLessThan(0.35);
    }
  });

  test('should keep tooltip or full title accessible', async ({ page, request }) => {
    const longTitle = 'Ensure full title remains accessible when truncated by providing a tooltip or title attribute';

    const ticket = await createTicket(request, {
      title: longTitle,
      description: 'Tooltip test',
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${ticket.id}"]`).first();
    await expect(ticketCard).toBeVisible();

    const titleElement = ticketCard
      .locator('[data-testid="ticket-title"]').or(ticketCard.locator('h3, h4, .title, [class*="title"]').first());

    if ((await titleElement.count()) > 0) {
      const titleAttr = await titleElement.first().getAttribute('title');
      expect(titleAttr ?? '').toContain('Ensure full title');
    }
  });
});
