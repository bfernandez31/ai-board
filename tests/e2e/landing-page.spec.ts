import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 1200 },
] as const;

test.describe('Landing page', () => {
  for (const viewport of VIEWPORTS) {
    test(`renders key sections without horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'Turn one ticket into a reviewed, shippable change.' })).toBeVisible();
      await expect(page.locator('#proof')).toBeVisible();
      await expect(page.locator('#workflow')).toBeVisible();
      await expect(page.locator('#capabilities')).toBeVisible();
      await expect(page.locator('#pricing')).toBeVisible();
      await expect(page.locator('#final-cta')).toBeVisible();

      const pageScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(pageScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
    });
  }

  test('keeps keyboard focus aligned with marketing navigation order', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const expectedLabels = ['Proof', 'Workflow', 'Capabilities', 'Pricing', 'Get Started Free'];

    for (const label of expectedLabels) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: label })).toBeFocused();
    }
  });

  test('uses reduced-motion fallbacks for decorative surfaces', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.animated-ticket-background')).toBeHidden();
    await expect(page.locator('.mini-kanban-demo')).toHaveAttribute('data-reduced-motion', 'true');
  });
});
