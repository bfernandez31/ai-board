import { test, expect } from '../../helpers/worker-isolation';

/**
 * E2E: Responsive board layout
 * Requires real browser for viewport/scroll behavior (testing skill §5).
 * No ticket creation needed — columns render from stage enum regardless of data.
 */

test.describe('Responsive Board Layout', () => {
  const BASE_URL = 'http://localhost:3000';
  const STAGES = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'] as const;

  test('shows all 6 columns on desktop (>=1024px)', async ({ page, projectId }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);

    for (const stage of STAGES) {
      await expect(page.locator(`[data-testid="column-${stage}"]`).first()).toBeVisible();
    }

    const boardGrid = page.locator('[data-testid="board-grid"]').first();
    const { scrollWidth, clientWidth } = await boardGrid.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
  });

  test('enables horizontal scroll on mobile (<768px)', async ({ page, projectId }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);

    const boardGrid = page.locator('[data-testid="board-grid"]').first();
    const isScrollable = await boardGrid.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(isScrollable).toBe(true);
  });

  test('columns keep minimum width on small mobile (320px)', async ({ page, projectId }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);

    const column = page.locator('[data-testid="column-INBOX"]').first();
    const box = await column.boundingBox();
    expect(box).not.toBeNull();
    // Board uses minmax(300px, 1fr) — column must be at least 280px (allowing minor browser rounding)
    expect(box!.width).toBeGreaterThanOrEqual(280);
  });

  test('columns are side-by-side on tablet (768px)', async ({ page, projectId }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);

    const firstBox = await page.locator('[data-testid="column-INBOX"]').first().boundingBox();
    const secondBox = await page.locator('[data-testid="column-SPECIFY"]').first().boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(secondBox!.x).toBeGreaterThan(firstBox!.x);
  });

  test('board survives orientation change', async ({ page, projectId }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/projects/${projectId}/board`);

    const boardGrid = page.locator('[data-testid="board-grid"]').first();
    await expect(boardGrid).toBeVisible();

    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 });

    await expect(boardGrid).toBeVisible();
    await expect(page.locator('[data-testid="column-INBOX"]').first()).toBeVisible();
  });
});
