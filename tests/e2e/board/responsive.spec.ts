import { test, expect } from '../../helpers/worker-isolation';
import { getPrismaClient, cleanupDatabase, getProjectKey } from '../../helpers/db-cleanup';

/**
 * E2E: Responsive board layout
 * Requires real browser for viewport/scroll behavior (testing skill §5).
 * Layout tests need no tickets — columns render from stage enum regardless of data.
 * The SHIP infinite-scroll test seeds its own tickets (AIB-890).
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
  test.describe('SHIP infinite scroll', () => {
    test.afterEach(async ({ projectId }) => {
      await cleanupDatabase(projectId);
    });

    test('loads more SHIP tickets with touch-style column scrolling on mobile', async ({ page, projectId }) => {
      await cleanupDatabase(projectId);
      const prisma = getPrismaClient();
      const projectKey = getProjectKey(projectId);
      const now = Date.now();
      await prisma.ticket.createMany({
        data: Array.from({ length: 60 }, (_, i) => ({
          ticketNumber: i + 1,
          ticketKey: `${projectKey}-${i + 1}`,
          title: `[e2e] Ship Infinite Scroll ${i + 1}`,
          description: 'Seeded SHIP ticket for infinite scroll',
          stage: 'SHIP' as const,
          workflowType: 'FULL' as const,
          projectId,
          updatedAt: new Date(now - i * 1000),
        })),
      });

      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/projects/${projectId}/board`);

      const shipColumn = page.locator('[data-testid="column-SHIP"]').first();
      await shipColumn.scrollIntoViewIfNeeded();
      await expect(shipColumn).toBeVisible();

      const cards = shipColumn.locator('[data-testid="ticket-card"]');
      await expect(cards).toHaveCount(50);
      await expect(shipColumn.getByRole('button', { name: /load more/i })).toHaveCount(0);

      const viewport = shipColumn.locator('[data-radix-scroll-area-viewport]');
      await viewport.evaluate((el) => el.scrollTo(0, el.scrollHeight));

      await expect.poll(() => cards.count(), { timeout: 10000 }).toBeGreaterThan(50);
      await expect(cards).toHaveCount(60);

      // Floating scroll buttons still work after the append
      await viewport.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      const scrollUp = shipColumn.getByRole('button', { name: 'Scroll up' });
      await expect(scrollUp).toBeVisible();
      const before = await viewport.evaluate((el) => el.scrollTop);
      await scrollUp.click();
      await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeLessThan(before);
    });
  });
});
