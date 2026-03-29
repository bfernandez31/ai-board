/**
 * E2E Tests: Health Dashboard Sidebar Navigation
 * Feature: AIB-370-health-dashboard-page
 *
 * Tests for Health entry visibility in sidebar and navigation to Health page
 */

import { test, expect } from '../helpers/worker-isolation';
import { ensureProjectExists } from '../helpers/db-cleanup';

test.describe('Health Sidebar Navigation', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page, projectId }) => {
    await ensureProjectExists(projectId);
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');
  });

  test('should show Health entry in sidebar under Views', async ({ page }) => {
    // The sidebar renders HeartPulse icon with tooltip "Health"
    const healthLink = page.locator('a[href*="/health"]').first();
    await expect(healthLink).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to health page when clicked', async ({ page, projectId }) => {
    const healthLink = page.locator(`a[href="/projects/${projectId}/health"]`).first();
    await healthLink.waitFor({ state: 'visible', timeout: 10000 });
    await healthLink.click();

    await page.waitForURL(`**/projects/${projectId}/health`);
    await expect(page.locator('h1')).toContainText('Health');
  });
});
