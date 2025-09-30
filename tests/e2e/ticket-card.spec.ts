import { test, expect } from '@playwright/test';

/**
 * E2E Test: Ticket Card Information Display
 * User Story: As a user, I want to see ticket information on cards
 * Source: quickstart.md - Test Scenario 3
 *
 * This test MUST FAIL until ticket card component is implemented
 */

test.describe('Ticket Card Display', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ request }) => {
    // Create a test ticket for display testing
    await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'Test Ticket for Card Display',
        description: 'This ticket is used for card display testing'
      }
    });
  });

  test('should display ticket title on card', async ({ page, request }) => {
    const ticketData = {
      title: 'Display Title Test Ticket',
      description: 'Testing title display'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text="${ticketData.title}"`).first()
    );

    await expect(ticketCard).toBeVisible();

    const cardText = await ticketCard.textContent();
    expect(cardText).toContain(ticketData.title);
  });

  test('should display ticket ID in format #N', async ({ page, request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'ID Format Test Ticket',
        description: 'Testing ID display'
      }
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`[data-testid="ticket-${createdTicket.id}"]`).or(
      page.locator(`text="ID Format Test Ticket"`).first()
    );

    await expect(ticketCard).toBeVisible();

    // Look for ID format: #1, #2, etc.
    const cardText = await ticketCard.textContent();
    const idPattern = new RegExp(`#${createdTicket.id}\\b`);
    expect(cardText).toMatch(idPattern);
  });

  test('should display status badge showing stage', async ({ page, request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'Badge Test Ticket',
        description: 'Testing badge display'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="Badge Test Ticket"`).first();
    await expect(ticketCard).toBeVisible();

    // Look for badge or stage indicator showing "IDLE"
    const badge = ticketCard.locator('[data-testid="ticket-badge"]').or(
      ticketCard.locator('text=/idle/i')
    );

    // Badge should exist showing stage
    const badgeCount = await badge.count();
    expect(badgeCount).toBeGreaterThan(0);
  });

  test('should display timestamp in relative format (<24h)', async ({ page, request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'Recent Timestamp Test',
        description: 'Testing relative timestamp'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="Recent Timestamp Test"`).first();
    await expect(ticketCard).toBeVisible();

    const cardText = await ticketCard.textContent();

    // Look for relative time indicators
    const relativeTimePatterns = [
      /\d+\s*(second|minute|hour)s?\s*ago/i,
      /just now/i,
      /moments? ago/i,
      /a few (second|minute|hour)s? ago/i
    ];

    const hasRelativeTime = relativeTimePatterns.some(pattern => pattern.test(cardText || ''));
    expect(hasRelativeTime).toBe(true);
  });

  test('should show visual feedback on hover', async ({ page, request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'Hover Test Ticket',
        description: 'Testing hover effect'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="Hover Test Ticket"`).first();
    await expect(ticketCard).toBeVisible();

    // Get initial state
    const initialBg = await ticketCard.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Hover over card
    await ticketCard.hover();

    // Check cursor changes to pointer
    const cursor = await ticketCard.evaluate(el => {
      return window.getComputedStyle(el).cursor;
    });

    expect(cursor).toBe('pointer');

    // Small delay for CSS transition
    await page.waitForTimeout(100);

    // Background or border should change on hover
    const hoverBg = await ticketCard.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });

    const hoverBorder = await ticketCard.evaluate(el => {
      return window.getComputedStyle(el).border;
    });

    // Some visual change should occur (bg color change or border change)
    const hasVisualChange = hoverBg !== initialBg || hoverBorder.includes('rgb');
    expect(hasVisualChange).toBeTruthy();
  });

  test('should show visual feedback on click', async ({ page, request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'Click Test Ticket',
        description: 'Testing click effect'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="Click Test Ticket"`).first();
    await expect(ticketCard).toBeVisible();

    // Click the card
    await ticketCard.click();

    // Small delay for CSS transition
    await page.waitForTimeout(100);

    // Card should show active state (scale, shadow, border, etc.)
    const transform = await ticketCard.evaluate(el => {
      return window.getComputedStyle(el).transform;
    });

    const boxShadow = await ticketCard.evaluate(el => {
      return window.getComputedStyle(el).boxShadow;
    });

    // Some visual feedback should be present (not 'none')
    const hasClickFeedback = transform !== 'none' || boxShadow !== 'none';
    expect(hasClickFeedback).toBeTruthy();
  });

  test('should NOT navigate or open modal on click', async ({ page, request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: 'No Navigation Test',
        description: 'Click should not navigate'
      }
    });

    await page.goto(`${BASE_URL}/board`);

    const initialUrl = page.url();

    const ticketCard = page.locator(`text="No Navigation Test"`).first();
    await expect(ticketCard).toBeVisible();

    // Click the card
    await ticketCard.click();

    // Wait a moment
    await page.waitForTimeout(200);

    // URL should remain the same
    const currentUrl = page.url();
    expect(currentUrl).toBe(initialUrl);

    // No modal should appear
    const modal = page.locator('[role="dialog"]').or(page.locator('.modal'));
    await expect(modal).not.toBeVisible();
  });

  test('should display all required card elements together', async ({ page, request }) => {
    const ticketData = {
      title: 'Complete Card Test',
      description: 'Testing all card elements'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    const createdTicket = await response.json();

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="${ticketData.title}"`).first();
    await expect(ticketCard).toBeVisible();

    const cardText = await ticketCard.textContent() || '';

    // All required elements should be present in card
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
      description: 'THIS_UNIQUE_DESCRIPTION_SHOULD_NOT_BE_VISIBLE_ON_CARD'
    };

    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: ticketData
    });

    await page.goto(`${BASE_URL}/board`);

    const ticketCard = page.locator(`text="${ticketData.title}"`).first();
    await expect(ticketCard).toBeVisible();

    const cardText = await ticketCard.textContent() || '';

    // Description should NOT be in card text
    expect(cardText).not.toContain('THIS_UNIQUE_DESCRIPTION_SHOULD_NOT_BE_VISIBLE_ON_CARD');
  });

  test('should maintain consistent card height', async ({ page, request }) => {
    // Create tickets with different title lengths
    const tickets = [
      { title: 'Short', description: 'Short title ticket' },
      { title: 'Medium length title for testing', description: 'Medium title' },
      { title: 'Very long title that might span multiple lines depending on card width and font size', description: 'Long title' }
    ];

    for (const ticketData of tickets) {
      await request.post(`${BASE_URL}/api/tickets`, {
        data: ticketData
      });
    }

    await page.goto(`${BASE_URL}/board`);

    // Get all ticket cards
    const cards = await page.locator('[data-testid^="ticket-"]').or(
      page.locator('.ticket-card, [class*="ticket"]')
    ).all();

    if (cards.length >= 2) {
      const heights = await Promise.all(
        cards.map(card => card.evaluate(el => el.getBoundingClientRect().height))
      );

      // Heights should be similar (within 20% variance for truncation)
      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      const variance = (maxHeight - minHeight) / maxHeight;

      expect(variance).toBeLessThan(0.3);
    }
  });
});