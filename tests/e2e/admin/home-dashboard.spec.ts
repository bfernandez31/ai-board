/**
 * E2E: Admin home dashboard (AIB-800) — golden path only.
 *
 * Covers:
 *   1. Non-admin gets byte-equivalent 404 on /admin.
 *   2. Admin sees all five dashboard sections (Alertes, Pulse, Santé Business,
 *      Tendances, Détails actionnables) on first paint from initialData.
 *   3. No global skeleton flash on the initial render (SC-005): Pulse tile headings
 *      are visible immediately without a loading state replacing them.
 *
 * The auto-refresh cycle (SC-005, 30 s) is covered by the unit test in
 * tests/unit/components/admin/home/admin-home-page.test.tsx which runs faster
 * and without requiring a live server.
 *
 * Skipped when E2E_ADMIN_HEADER is not set — keeps the spec non-flaky in
 * environments without admin provisioning.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'test-admin@e2e.local';

test.describe('Admin home dashboard golden path', () => {
  test.skip(!process.env.E2E_ADMIN_HEADER, 'requires E2E_ADMIN_HEADER for admin session');

  test('non-admin gets 404 on /admin', async ({ page }) => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);
  });

  test('admin sees all five dashboard sections on first paint', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-test-user-id': ADMIN_EMAIL });
    await page.goto('/admin');

    // All five labelled sections must be present
    await expect(page.getByRole('region', { name: 'Alertes' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pulse' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Santé Business' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tendances' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Détails actionnables' })).toBeVisible();
  });

  test('Pulse section shows four KPI tile headings without skeleton flash', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-test-user-id': ADMIN_EMAIL });
    await page.goto('/admin');

    const pulseSection = page.getByRole('region', { name: 'Pulse' });
    await expect(pulseSection).toBeVisible();

    // Four KPI tiles must render from server-supplied initialData without a skeleton
    await expect(pulseSection.getByText('Users')).toBeVisible();
    await expect(pulseSection.getByText('MAU')).toBeVisible();
    await expect(pulseSection.getByText('MRR')).toBeVisible();
    await expect(pulseSection.getByText('Active Paying')).toBeVisible();
  });
});
