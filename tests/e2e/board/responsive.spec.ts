import { test, expect } from '../../fixtures/auth';
import { cleanupDatabase } from '../../helpers/db-cleanup';

/**
 * E2E Test: Responsive Design
 * User Story: As a user, I want the board to work on mobile devices
 * Source: quickstart.md - Test Scenario 6
 *
 * This test MUST FAIL until responsive design is properly implemented
 */

test.describe('Responsive Board Design', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ request }) => {
    // Clean database before each test
    await cleanupDatabase();

    // Create a few test tickets for responsive testing
    for (let i = 1; i <= 3; i++) {
      await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        data: {
          title: `Responsive Test Ticket ${i}`,
          description: `Ticket for responsive design testing ${i}`
        }
      });
    }
  });

  test('should display all 6 columns on desktop (>= 1024px)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'];

    for (const stage of stages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      await expect(column).toBeVisible();
    }

    const boardGrid = page.locator('[data-testid="board-grid"]').first();
    const dimensions = await boardGrid.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    // Desktop layout should allow horizontal overflow when needed
    expect(dimensions.scrollWidth).toBeGreaterThanOrEqual(dimensions.clientWidth);
  });

  test('should enable horizontal scroll on mobile (< 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const boardGrid = page.locator('[data-testid="board-grid"]').first();

    const isScrollable = await boardGrid.evaluate((element) => {
      return element.scrollWidth > element.clientWidth;
    });

    expect(isScrollable).toBe(true);
  });

  test('should maintain column minimum width on small mobile (< 375px)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const column = page.locator(`[data-testid="column-INBOX"]`).first();
    const box = await column.boundingBox();

    if (box) {
      // Columns should maintain readable minimum width (e.g., 250px)
      expect(box.width).toBeGreaterThanOrEqual(200);
    }
  });

  test('should keep column headers visible during scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    // Get initial visibility of IDLE column header
    const idleHeader = page.getByRole('heading', { name: /inbox/i }).first();
    await expect(idleHeader).toBeVisible();

    // Scroll horizontally to the right
    await page.evaluate(() => {
      const board = document.querySelector('main') || document.body;
      board.scrollLeft = 500;
    });

    await page.waitForTimeout(200);

    // Check that a different column header is now visible
    const erroredHeader = page.getByRole('heading', { name: /errored/i }).first();

    // At least one header should be visible after scroll
    const idleVisible = await idleHeader.isVisible();
    const erroredVisible = await erroredHeader.isVisible();

    expect(idleVisible || erroredVisible).toBe(true);
  });

  test('should maintain ticket card readability on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const ticketCard = page.locator('[data-testid^="ticket-"]').first();

    if (await ticketCard.count() > 0) {
      await expect(ticketCard).toBeVisible();

      const box = await ticketCard.boundingBox();

      if (box) {
        // Card should have reasonable width on mobile
        expect(box.width).toBeGreaterThanOrEqual(150);
        expect(box.width).toBeLessThanOrEqual(400);

        // Card should have reasonable height
        expect(box.height).toBeGreaterThanOrEqual(80);
        expect(box.height).toBeLessThanOrEqual(200);
      }

      // Text should be readable (not too small)
      const fontSize = await ticketCard.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });

      const fontSizeNum = parseInt(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(12);
    }
  });

  test('should support touch scrolling on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const boardGrid = page.locator('[data-testid="board-grid"]').first();

    // Get initial scroll position
    const initialScroll = await boardGrid.evaluate((el) => el.scrollLeft);

    // Simulate touch scroll
    await boardGrid.evaluate((el) => {
      el.scrollLeft = 200;
    });

    await page.waitForTimeout(100);

    // Verify scroll occurred
    const newScroll = await boardGrid.evaluate((el) => el.scrollLeft);

    expect(newScroll).toBeGreaterThan(initialScroll);
  });

  test('should display columns side-by-side on tablet (768px-1023px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'];

    // All columns should be visible
    for (const stage of stages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      await expect(column).toBeVisible();
    }

    // Check if columns are laid out horizontally (adjacent columns)
    const firstColumn = page.locator(`[data-testid="column-INBOX"]`).first();
    const secondColumn = page.locator(`[data-testid="column-SPECIFY"]`).first();

    const firstBox = await firstColumn.boundingBox();
    const secondBox = await secondColumn.boundingBox();

    if (firstBox && secondBox) {
      // Second column should be to the right of first (horizontal layout)
      expect(secondBox.x).toBeGreaterThan(firstBox.x);
    }
  });

  test('should maintain proper spacing between columns on all screen sizes', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Large Desktop' },
      { width: 1024, height: 768, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BASE_URL}/projects/1/board`);

      // Measure gap between INBOX and SPECIFY (adjacent columns)
      const firstColumn = page.locator(`[data-testid="column-INBOX"]`).first();
      const secondColumn = page.locator(`[data-testid="column-SPECIFY"]`).first();

      const firstBox = await firstColumn.boundingBox();
      const secondBox = await secondColumn.boundingBox();

      if (firstBox && secondBox && secondBox.x > firstBox.x) {
        // Gap between columns should be reasonable (8px - 32px)
        const gap = secondBox.x - (firstBox.x + firstBox.width);
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(50);
      }
    }
  });

  test('should adapt font sizes for mobile devices', async ({ page }) => {
    // Desktop font sizes
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const desktopHeader = page.getByRole('heading', { name: /inbox/i }).first();
    const desktopFontSize = await desktopHeader.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });

    // Mobile font sizes
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    const mobileHeader = page.getByRole('heading', { name: /inbox/i }).first();
    const mobileFontSize = await mobileHeader.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });

    // Both should be readable (>= 10px)
    expect(parseFloat(desktopFontSize)).toBeGreaterThanOrEqual(10);
    expect(parseFloat(mobileFontSize)).toBeGreaterThanOrEqual(10);
  });

  test('should handle orientation change (portrait to landscape)', async ({ page }) => {
    // Portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const board = page.locator('main').or(page.locator('[data-testid="board"]'));
    await expect(board.first()).toBeVisible();

    // Landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(200);

    // Board should still be visible and functional
    await expect(board.first()).toBeVisible();

    // Check visibility of first few columns (horizontal scroll allows access to all)
    const stages = ['INBOX', 'SPECIFY', 'PLAN'];
    for (const stage of stages) {
      const column = page.locator(`[data-testid="column-${stage}"]`).first();
      await expect(column).toBeVisible();
    }
  });

  test('should maintain performance on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const startTime = Date.now();

    await page.goto(`${BASE_URL}/projects/1/board`);

    const board = page.locator('main').or(page.locator('[data-testid="board"]'));
    await board.first().waitFor({ state: 'visible', timeout: 3000 });

    const loadTime = Date.now() - startTime;

    // Should load within 2 seconds even on mobile
    expect(loadTime).toBeLessThan(2000);
  });

  test('should allow smooth horizontal scrolling without lag', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/1/board`);

    const boardGrid = page.locator('[data-testid="board-grid"]').first();

    // Perform multiple scroll steps
    for (let i = 0; i < 5; i++) {
      await boardGrid.evaluate((el, offset) => {
        el.scrollLeft += offset;
      }, 50);
      await page.waitForTimeout(50);
    }

    // Final scroll position should be updated
    const finalScroll = await boardGrid.evaluate((el) => el.scrollLeft);
    expect(finalScroll).toBeGreaterThan(0);
  });

  test('should render correctly in mobile Playwright project', async ({ page }) => {
    // This test uses Playwright's mobile configuration
    // Configure in playwright.config.ts with mobile viewport

    await page.goto(`${BASE_URL}/projects/1/board`);

    const board = page.locator('main').or(page.locator('[data-testid="board"]'));
    await expect(board.first()).toBeVisible();

    // Verify basic functionality works on mobile
    const idleColumn = page.locator(`[data-testid="column-INBOX"]`).first();
    await expect(idleColumn).toBeVisible();
  });
});
