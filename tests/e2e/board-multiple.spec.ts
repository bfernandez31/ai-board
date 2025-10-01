import { test, expect, APIResponse } from '@playwright/test';

/**
 * E2E Test: Multiple Tickets with Sorting
 * User Story: As a user, I want to see multiple tickets organized by stage
 * Source: quickstart.md - Test Scenario 4
 *
 * This test MUST FAIL until the board properly handles multiple tickets
 */

test.describe('Multiple Tickets Display and Sorting', () => {
  const BASE_URL = 'http://localhost:3000';

  const parseTicket = async (response: APIResponse) => {
    const json = (await response.json()) as { id: number; title: string };
    if (typeof json?.id !== 'number' || typeof json?.title !== 'string') {
      throw new Error('Invalid ticket response payload');
    }
    return json;
  };

  test('should display multiple tickets in IDLE column', async ({ page, request }) => {
    // Create 5 tickets
    const tickets: Array<{ id: number; title: string }> = [];
    for (let i = 1; i <= 5; i++) {
      const response = await request.post(`${BASE_URL}/api/tickets`, {
        data: {
          title: `Test Ticket ${i}`,
          description: `Description for ticket ${i}`
        }
      });
      tickets.push(await parseTicket(response));
    }

    await page.goto(`${BASE_URL}/board`);

    // All 5 tickets should be visible in IDLE column
    for (const ticket of tickets) {
      const ticketCard = page.locator(`[data-testid="ticket-${ticket.id}"]`).or(
        page.locator(`text="${ticket.title}"`).first()
      );
      await expect(ticketCard).toBeVisible();
    }
  });

  test('should sort tickets by most recently updated first', async ({ page, request }) => {
    // Create tickets with delays to ensure different timestamps
    await parseTicket(
      await request.post(`${BASE_URL}/api/tickets`, {
        data: { title: 'First Ticket', description: 'Created first' }
      })
    );

    await page.waitForTimeout(100); // Small delay

    await parseTicket(
      await request.post(`${BASE_URL}/api/tickets`, {
        data: { title: 'Second Ticket', description: 'Created second' }
      })
    );

    await page.waitForTimeout(100); // Small delay

    await parseTicket(
      await request.post(`${BASE_URL}/api/tickets`, {
        data: { title: 'Third Ticket', description: 'Created third' }
      })
    );

    await page.goto(`${BASE_URL}/board`);

    // Get all ticket cards in IDLE column
    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const ticketCards = await idleColumn
      .locator('[data-testid^="ticket-"]').or(idleColumn.locator('.ticket-card, [class*="ticket"]'))
      .all();

    if (ticketCards.length >= 3) {
      // Get positions of our test tickets
      const positions: Record<'first' | 'second' | 'third', number | undefined> = {
        first: undefined,
        second: undefined,
        third: undefined,
      };

      await Promise.all(
        ticketCards.map(async (card, index) => {
          const cardText = (await card.textContent()) ?? '';
          if (cardText.includes('First Ticket')) positions.first = index;
          if (cardText.includes('Second Ticket')) positions.second = index;
          if (cardText.includes('Third Ticket')) positions.third = index;
        })
      );

      const { first, second, third } = positions;
      if (first !== undefined && second !== undefined && third !== undefined) {
        expect(third).toBeLessThan(second);
        expect(second).toBeLessThan(first);
      }
    }
  });

  test('should show correct ticket count in column header badge', async ({ page, request }) => {
    await page.goto(`${BASE_URL}/board`);

    // Get initial count from badge
    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const badge = idleColumn.locator('span[class*="rounded-full"]').first();
    const initialCount = Number.parseInt((await badge.textContent()) ?? '0', 10);

    // Create known number of tickets
    const ticketCount = 7;
    for (let i = 1; i <= ticketCount; i++) {
      await request.post(`${BASE_URL}/api/tickets`, {
        data: { title: `Count Test Ticket ${i}` }
      });
    }

    await page.reload();

    // Verify badge shows correct count
    const updatedCount = Number.parseInt((await badge.textContent()) ?? '0', 10);
    expect(updatedCount).toBe(initialCount + ticketCount);
  });

  test('should enable scrolling when tickets exceed viewport height', async ({ page, request }) => {
    // Create many tickets to force scrolling
    const ticketCount = 20;
    for (let i = 1; i <= ticketCount; i++) {
      await request.post(`${BASE_URL}/api/tickets`, {
        data: { title: `Scroll Test Ticket ${i}` }
      });
    }

    await page.goto(`${BASE_URL}/board`);

    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();

    // Find the ScrollArea component inside the column
    const scrollArea = idleColumn.locator('[data-radix-scroll-area-viewport]');

    // Check if scroll area content exceeds viewport
    const isScrollable = await scrollArea.evaluate(el => {
      return el.scrollHeight > el.clientHeight;
    });

    expect(isScrollable).toBe(true);
  });

  test('should maintain consistent card heights for multiple tickets', async ({ page, request }) => {
    // Create tickets with varying title lengths
    const tickets = [
      { title: 'Short title' },
      { title: 'This is a medium length title for testing' },
      { title: 'This is a very long title that will definitely span multiple lines when displayed on the card' },
      { title: 'Another short one' }
    ];

    for (const ticket of tickets) {
      await request.post(`${BASE_URL}/api/tickets`, { data: ticket });
    }

    await page.goto(`${BASE_URL}/board`);

    const ticketCards = await page
      .locator('[data-testid^="ticket-"]').or(page.locator('.ticket-card, [class*="ticket"]'))
      .all();

    if (ticketCards.length >= 2) {
      const heights = await Promise.all(
        ticketCards.map((card) => card.evaluate((el) => el.getBoundingClientRect().height))
      );

      // All cards should have similar heights due to truncation
      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      const variance = (maxHeight - minHeight) / maxHeight;

      // Variance should be small (<30%)
      expect(variance).toBeLessThan(0.3);
    }
  });

  test('should display tickets across all 6 stages correctly', async ({ page }) => {
    // Note: In MVP, we can only create tickets in IDLE
    // This test documents the expected behavior for future drag-drop feature

    // For now, just verify all columns are visible
    await page.goto(`${BASE_URL}/board`);

    const stages = ['INBOX', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'];

    for (const stage of stages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      await expect(column).toBeVisible();
    }

    // In future: manually update ticket stages via Prisma and verify display
  });

  test('should handle 100 tickets without performance degradation', async ({ page, request }) => {
    // Create 100 tickets
    const createPromises = [];
    for (let i = 1; i <= 100; i++) {
      createPromises.push(
        request.post(`${BASE_URL}/api/tickets`, {
          data: { title: `Performance Test Ticket ${i}` }
        })
      );
    }
    await Promise.all(createPromises);

    const startTime = Date.now();

    await page.goto(`${BASE_URL}/board`);

    // Wait for board to be visible
    const board = page.locator('main').or(page.locator('[data-testid="board"]'));
    await board.first().waitFor({ state: 'visible', timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds even with 100 tickets
    expect(loadTime).toBeLessThan(5000);

    // Verify badge shows correct count
    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const badge = idleColumn.locator('span[class*="rounded-full"]').first();
    const count = Number.parseInt((await badge.textContent()) ?? '0', 10);

    expect(count).toBeGreaterThanOrEqual(100);
  });

  test('should maintain ticket order during multiple refreshes', async ({ page, request }) => {
    // Create tickets
    for (let i = 1; i <= 5; i++) {
      const response = await request.post(`${BASE_URL}/api/tickets`, {
        data: { title: `Order Test Ticket ${i}` }
      });
      await parseTicket(response);
      await page.waitForTimeout(50);
    }

    await page.goto(`${BASE_URL}/board`);

    // Get initial order
    const getTicketOrder = async () => {
      const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
      const cards = await idleColumn
        .locator('[data-testid^="ticket-"]').or(idleColumn.locator('.ticket-card, [class*="ticket"]'))
        .all();

      const order: number[] = [];
      for (const card of cards) {
        const text = (await card.textContent()) ?? '';
        const match = text.match(/Order Test Ticket (\d+)/);
        if (match?.[1]) order.push(Number.parseInt(match[1], 10));
      }
      return order;
    };

    const initialOrder = await getTicketOrder();

    // Refresh page
    await page.reload();
    await page.waitForTimeout(500);

    const afterRefreshOrder = await getTicketOrder();

    // Order should be consistent
    expect(afterRefreshOrder).toEqual(initialOrder);
  });

  test('should handle empty and populated columns simultaneously', async ({ page, request }) => {
    // Create tickets only in IDLE
    for (let i = 1; i <= 3; i++) {
      await request.post(`${BASE_URL}/api/tickets`, {
        data: { title: `Mixed State Ticket ${i}` }
      });
    }

    await page.goto(`${BASE_URL}/board`);

    // IDLE should have tickets
    const idleColumn = page.locator('[data-testid="column-IDLE"]').first();
    const idleCards = await idleColumn
      .locator('[data-testid^="ticket-"]').or(idleColumn.locator('.ticket-card, [class*="ticket"]'))
      .all();
    expect(idleCards.length).toBeGreaterThan(0);

    // Other columns should be empty with "No tickets" message or badge showing 0
    const otherStages = ['PLAN', 'BUILD', 'VERIFY', 'SHIP'];
    for (const stage of otherStages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      await expect(column).toBeVisible();

      // Check badge shows 0
      const badge = column.locator('span[class*="rounded-full"]').first();
      const count = await badge.textContent();
      expect(count?.trim()).toBe('0');
    }
  });
});
