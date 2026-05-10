import { test, expect } from '../../helpers/worker-isolation';
import { prisma } from '@/lib/db/client';
import {
  seedAdminAllowlistedUser,
  seedCompletedInsightsReport,
  deleteAllInsightsReports,
} from '@/tests/helpers/admin-insights-fixtures';

const ADMIN_EMAIL = 'e2e-admin-page@e2e.local';
const HTML_BODY = '<html><body><h1 data-test-marker="report">Insights</h1></body></html>';

test.describe.configure({ mode: 'serial' });

test.describe('Admin Insights page', () => {
  test.beforeEach(async () => {
    await deleteAllInsightsReports();
    await seedAdminAllowlistedUser(ADMIN_EMAIL);
  });

  test.afterEach(async () => {
    await deleteAllInsightsReports();
    await prisma.user.delete({ where: { email: ADMIN_EMAIL } }).catch(() => undefined);
  });

  test('non-admin gets 404 baseline at /admin/insights', async ({ page }) => {
    const response = await page.goto('/admin/insights', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });

  test('allowlisted admin sees metadata header for seeded report', async ({ page, request, baseURL }) => {
    // Sign in via dev-login as the allowlisted admin
    await page.goto('/auth/signin');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/shared secret/i).fill('shared-preview-secret');
    await page.getByRole('button', { name: /continue with preview login/i }).click();
    await page.waitForURL('**/projects');

    // Seed a completed report with known counts/period. The HTML body is uploaded
    // via the workflow PUT endpoint (writes to blob and assigns the canonical key).
    const report = await seedCompletedInsightsReport({
      sessionsCount: 7,
      ticketsCount: 3,
      periodStart: new Date('2026-04-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-30T00:00:00.000Z'),
    });

    // Upload HTML via the workflow PUT route (workflow Bearer token).
    const uploadRes = await request.put(
      `${baseURL ?? 'http://localhost:3000'}/api/admin/insights/reports/${report.id}/html`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN ?? 'test-workflow-token-for-e2e-tests-only'}`,
        },
        data: HTML_BODY,
      }
    );
    expect(uploadRes.ok()).toBeTruthy();
    const { htmlBlobKey, htmlBlobSize } = await uploadRes.json();
    await prisma.adminInsightsReport.update({
      where: { id: report.id },
      data: { htmlBlobKey, htmlBlobSize },
    });

    await page.goto('/admin/insights');

    await expect(
      page.getByTestId('insights-metadata-header')
    ).toContainText(
      'Analyzed 7 Claude Code sessions across 3 tickets shipped between 2026-04-01 and 2026-04-30'
    );

    const iframe = page.getByTestId('insights-report-iframe');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(iframe).toHaveAttribute(
      'src',
      `/api/admin/insights/reports/${report.id}/html`
    );
  });
});
