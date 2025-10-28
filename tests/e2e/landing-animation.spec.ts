import { test, expect } from '@playwright/test';

test.describe('Landing Page Animated Background', () => {
  // Override the test context to remove authentication headers
  test.use({
    extraHTTPHeaders: {}, // Remove x-test-user-id header for landing page tests
  });

  test('renders 18 ticket cards on landing page', async ({ page }) => {
    await page.goto('/');

    const ticketCards = page.locator('.ticket-card');
    await expect(ticketCards).toHaveCount(18);
  });

  test('shows 18 tickets on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    const visibleTickets = page.locator('.ticket-card:visible');
    await expect(visibleTickets).toHaveCount(18);
  });

  test('shows 12 tickets on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1024 });
    await page.goto('/');

    const visibleTickets = page.locator('.ticket-card:visible');
    await expect(visibleTickets).toHaveCount(12);
  });

  test('shows 8 tickets on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const visibleTickets = page.locator('.ticket-card:visible');
    await expect(visibleTickets).toHaveCount(8);
  });

  test('tickets have pointer-events disabled', async ({ page }) => {
    await page.goto('/');

    const firstTicket = page.locator('.ticket-card').first();
    const pointerEvents = await firstTicket.evaluate((el) =>
      getComputedStyle(el).pointerEvents
    );

    expect(pointerEvents).toBe('none');
  });

  test('tickets are hidden from screen readers', async ({ page }) => {
    await page.goto('/');

    const firstTicket = page.locator('.ticket-card').first();
    await expect(firstTicket).toHaveAttribute('aria-hidden', 'true');
  });

  test('respects prefers-reduced-motion setting', async ({ page }) => {
    // Emulate user preference for reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const firstTicket = page.locator('.ticket-card').first();
    const hasAnimation = await firstTicket.evaluate((el) => {
      const styles = getComputedStyle(el);
      return styles.animationName !== 'none';
    });

    expect(hasAnimation).toBe(false);
  });
});
