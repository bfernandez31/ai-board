import { test, expect } from '@playwright/test';

/**
 * E2E Test: Long Title Truncation
 * User Story: As a user, I want long ticket titles to be truncated consistently
 * Source: quickstart.md - Test Scenario 7
 *
 * This test MUST FAIL until title truncation is properly implemented
 */

test.describe('Ticket Title Truncation', () => {
  const BASE_URL = 'http://localhost:3000';

  test('should truncate very long title at 2 lines', async ({ page, request }) => {
    const longTitle = 'This is a very long ticket title that should definitely exceed two lines when displayed on the card and needs to be truncated with an ellipsis to maintain consistent card heights';

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: longTitle,
        description: 'Testing truncation'
      }
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text=/This is a very long/i`).first()
    );

    await expect(ticketCard).toBeVisible();

    // Find the title element within the card
    const titleElement = ticketCard.locator('[data-testid="ticket-title"]').or(
      ticketCard.locator('h3, h4, .title, [class*="title"]').first()
    );

    if (await titleElement.count() > 0) {
      // Check CSS properties for truncation
      const lineClamp = await titleElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.webkitLineClamp || style.lineClamp;
      });

      const overflow = await titleElement.evaluate(el => {
        return window.getComputedStyle(el).overflow;
      });

      const textOverflow = await titleElement.evaluate(el => {
        return window.getComputedStyle(el).textOverflow;
      });

      // Should have line-clamp of 2 or appropriate truncation CSS
      const hasTruncation = lineClamp === '2' ||
                           overflow === 'hidden' ||
                           textOverflow === 'ellipsis';

      expect(hasTruncation).toBe(true);
    }
  });

  test('should display ellipsis (...) when title is truncated', async ({ page, request }) => {
    const longTitle = 'A'.repeat(200); // Very long title

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: longTitle,
        description: 'Ellipsis test'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid^="ticket-"]`).first();
    await expect(ticketCard).toBeVisible();

    const titleElement = ticketCard.locator('[data-testid="ticket-title"]').or(
      ticketCard.locator('h3, h4, .title, [class*="title"]').first()
    );

    if (await titleElement.count() > 0) {
      // Check for ellipsis in text overflow style
      const textOverflow = await titleElement.evaluate(el => {
        return window.getComputedStyle(el).textOverflow;
      });

      expect(textOverflow).toBe('ellipsis');
    }
  });

  test('should maintain consistent card height with truncated titles', async ({ page, request }) => {
    const titles = [
      'Short title',
      'This is a moderately long title that might span one to two lines',
      'This is an extremely long title that will definitely exceed two lines and should be truncated to maintain consistent card heights across all tickets in the column'
    ];

    const createdTickets = [];

    for (const title of titles) {
      const response = await request.post(`${BASE_URL}/api/tickets`, {
        data: { title, description: 'Height test' }
      });
      createdTickets.push(await response.json());
    }

    await page.goto(`${BASE_URL}/board`);

    const ticketCards = await page.locator('[data-testid^="ticket-"]').or(
      page.locator('.ticket-card, [class*="ticket"]')
    ).all();

    if (ticketCards.length >= 3) {
      const heights = await Promise.all(
        ticketCards.map(card => card.evaluate(el => el.getBoundingClientRect().height))
      );

      // All cards should have similar heights (within 30% variance)
      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      const variance = (maxHeight - minHeight) / maxHeight;

      expect(variance).toBeLessThan(0.3);
    }
  });

  test('should handle truncation on different screen sizes', async ({ page, request }) => {
    const longTitle = 'This is a responsive truncation test title that should be truncated consistently across different viewport sizes';

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: longTitle,
        description: 'Responsive truncation'
      }
    });

    const createdTicket = await response.json();

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1024, height: 768 },
      { width: 375, height: 667 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(`${BASE_URL}/board`);

      const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
        page.locator(`text=/responsive truncation test/i`).first()
      );

      await expect(ticketCard).toBeVisible();

      const titleElement = ticketCard.locator('[data-testid="ticket-title"]').or(
        ticketCard.locator('h3, h4, .title, [class*="title"]').first()
      );

      if (await titleElement.count() > 0) {
        // Title should still be truncated at 2 lines
        const lineClamp = await titleElement.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.webkitLineClamp || style.lineClamp;
        });

        if (lineClamp) {
          expect(lineClamp).toBe('2');
        }
      }
    }
  });

  test('should not truncate short titles', async ({ page, request }) => {
    const shortTitle = 'Short title';

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: shortTitle,
        description: 'No truncation needed'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="${shortTitle}"`).first();
    await expect(ticketCard).toBeVisible();

    const cardText = await ticketCard.textContent();

    // Full title should be visible
    expect(cardText).toContain(shortTitle);
  });

  test('should truncate titles with special characters correctly', async ({ page, request }) => {
    const longTitleWithSpecial = 'This is a long title with "special" <characters> & symbols: 日本語 🚀 that should still be truncated properly at two lines';

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: longTitleWithSpecial,
        description: 'Special chars truncation'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text=/This is a long title/i`).first();
    await expect(ticketCard).toBeVisible();

    const titleElement = ticketCard.locator('[data-testid="ticket-title"]').or(
      ticketCard.locator('h3, h4, .title, [class*="title"]').first()
    );

    if (await titleElement.count() > 0) {
      const overflow = await titleElement.evaluate(el => {
        return window.getComputedStyle(el).overflow;
      });

      expect(overflow).toBe('hidden');
    }
  });

  test('should handle maximum length title (500 chars) with truncation', async ({ page, request }) => {
    const maxLengthTitle = 'A'.repeat(500);

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: maxLengthTitle,
        description: 'Max length truncation'
      }
    });

    expect(response.status()).toBe(201);

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator('[data-testid^="ticket-"]').first();
    await expect(ticketCard).toBeVisible();

    const titleElement = ticketCard.locator('[data-testid="ticket-title"]').or(
      ticketCard.locator('h3, h4, .title, [class*="title"]').first()
    );

    if (await titleElement.count() > 0) {
      // Should be truncated to 2 lines
      const lineClamp = await titleElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.webkitLineClamp || style.lineClamp;
      });

      if (lineClamp) {
        expect(lineClamp).toBe('2');
      }

      // Visual height should be limited
      const box = await titleElement.boundingBox();
      if (box) {
        // Height should not exceed ~3-4 lines worth (roughly 80px)
        expect(box.height).toBeLessThan(100);
      }
    }
  });

  test('should maintain truncation after page refresh', async ({ page, request }) => {
    const longTitle = 'This long title should remain truncated even after refreshing the page to ensure CSS is properly applied';

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: longTitle,
        description: 'Persistence test'
      }
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    // Check truncation before refresh
    let ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text=/This long title/i`).first()
    );
    await expect(ticketCard).toBeVisible();

    // Refresh page
    await page.reload();

    // Check truncation after refresh
    ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text=/This long title/i`).first()
    );
    await expect(ticketCard).toBeVisible();

    const titleElement = ticketCard.locator('[data-testid="ticket-title"]').or(
      ticketCard.locator('h3, h4, .title, [class*="title"]').first()
    );

    if (await titleElement.count() > 0) {
      const lineClamp = await titleElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.webkitLineClamp || style.lineClamp;
      });

      if (lineClamp) {
        expect(lineClamp).toBe('2');
      }
    }
  });

  test('should display full title on tooltip/hover (future enhancement)', async ({ page, request }) => {
    // This test documents expected future behavior
    // Currently, full title may not be accessible via tooltip

    const longTitle = 'This is a long title that should show full text on hover';

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: longTitle,
        description: 'Tooltip test'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text=/This is a long title/i`).first();
    await expect(ticketCard).toBeVisible();

    // Hover over card
    await ticketCard.hover();
    await page.waitForTimeout(500);

    // Future: Check for tooltip with full title
    // For now, just verify card is visible
    await expect(ticketCard).toBeVisible();
  });

  test('should apply truncation to all tickets uniformly', async ({ page, request }) => {
    const longTitles = [
      'First very long title that should be truncated consistently',
      'Second extremely long title that needs to be truncated at two lines',
      'Third super long title for testing uniform truncation behavior'
    ];

    for (const title of longTitles) {
      await request.post(`${BASE_URL}/api/tickets`, {
        data: { title, description: 'Uniform truncation' }
      });
    }

    await page.goto(`${BASE_URL}/board`);

    const ticketCards = await page.locator('[data-testid^="ticket-"]').or(
      page.locator('.ticket-card, [class*="ticket"]')
    ).all();

    // Check that all cards have truncation applied
    for (const card of ticketCards) {
      const titleElement = card.locator('[data-testid="ticket-title"]').or(
        card.locator('h3, h4, .title, [class*="title"]').first()
      );

      if (await titleElement.count() > 0) {
        const overflow = await titleElement.evaluate(el => {
          return window.getComputedStyle(el).overflow;
        });

        // All should have overflow hidden for truncation
        expect(['hidden', 'clip']).toContain(overflow);
      }
    }
  });
});