import { test, expect } from '@playwright/test';

test.describe('Marketing Pricing Section', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('renders pricing between workflow and CTA with correct CTA destinations', async ({ page }) => {
    await page.goto('/landing');
    await page.waitForSelector('[data-testid="pricing-section"]');

    const workflowBox = await page.locator('#workflow').boundingBox();
    const pricingBox = await page.locator('[data-testid="pricing-section"]').boundingBox();
    const finalCtaBox = await page.locator('[data-testid="final-cta-section"]').boundingBox();

    if (!workflowBox || !pricingBox || !finalCtaBox) {
      throw new Error('Required marketing sections not found');
    }

    expect(workflowBox.y).toBeLessThan(pricingBox.y);
    expect(pricingBox.y).toBeLessThan(finalCtaBox.y);

    const freeCtaHref = await page
      .locator('[data-testid="plan-card"][data-plan="free"] a', { hasText: 'Get Started' })
      .first()
      .getAttribute('href');
    expect(freeCtaHref).toBe('/auth/signin');

    const proCtaHref = await page
      .locator('[data-testid="plan-card"][data-plan="pro"] a', { hasText: 'Start 14-day trial' })
      .first()
      .getAttribute('href');
    expect(proCtaHref).toContain('/auth/signin?callbackUrl=');
    expect(proCtaHref).toContain('plan=PRO');

    const teamCtaHref = await page
      .locator('[data-testid="plan-card"][data-plan="team"] a', { hasText: 'Start 14-day trial' })
      .first()
      .getAttribute('href');
    expect(teamCtaHref).toContain('/auth/signin?callbackUrl=');
    expect(teamCtaHref).toContain('plan=TEAM');
  });

  test('renders shared footer on marketing routes only', async ({ page }) => {
    const marketingRoutes = ['/landing', '/terms', '/privacy'];
    for (const route of marketingRoutes) {
      await page.goto(route);
      const footer = page.locator('[data-testid="marketing-footer"]');
      await expect(footer, `Footer missing on ${route}`).toBeVisible();
    }

    await page.goto('/projects/1/board');
    await expect(page.locator('[data-testid="marketing-footer"]')).toHaveCount(0);
  });
});
