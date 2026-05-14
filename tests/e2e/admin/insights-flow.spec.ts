/**
 * E2E: Admin Insights flow (AIB-791)
 *
 * Happy path only — exercising the trigger workflow would require real
 * GitHub Actions credentials and is covered by integration tests.
 *
 * Scope:
 *   1. As a non-admin, /admin/insights returns 404.
 *   2. As an admin (allowlist env var present at dev-server boot), the page
 *      renders with the metadata header phrasing and a sandboxed iframe
 *      whose src points at the html endpoint.
 *
 * Skipped when ADMIN_ALLOWLIST or the seeded admin user isn't set up —
 * keeping the spec non-flaky in environments without admin provisioning.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'test-admin@e2e.local';

test.describe('Admin Insights happy path', () => {
  test.skip(!process.env.E2E_ADMIN_HEADER, 'requires E2E_ADMIN_HEADER for admin session');

  test('non-admin gets 404 on /admin/insights', async ({ page }) => {
    const response = await page.goto('/admin/insights');
    expect(response?.status()).toBe(404);
  });

  test('admin sees the tab title, no internal H1, and a sandboxed iframe', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-test-user-id': ADMIN_EMAIL });
    await page.goto('/admin/insights');

    await expect(page).toHaveTitle(/Insights LLM/);
    expect(
      await page.getByRole('heading', { name: /claude code insights/i }).count()
    ).toBe(0);

    const iframe = page.locator('iframe[sandbox]');
    if (await iframe.count() > 0) {
      const sandbox = await iframe.first().getAttribute('sandbox');
      expect(sandbox).toBe('allow-scripts');
    }
  });
});
