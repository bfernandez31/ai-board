/**
 * E2E Tests: Health Dashboard Navigation
 * Feature: AIB-375 — Health Dashboard
 *
 * Tests sidebar navigation to the Health page
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

  test('should show Health entry in sidebar after Comparisons', async ({ page }) => {
    const sidebar = page.locator('nav, [data-testid="sidebar"]').first();
    await sidebar.waitFor({ state: 'visible', timeout: 10000 });

    const healthLink = sidebar.locator('a:has-text("Health")').first();
    await expect(healthLink).toBeVisible();
  });

  test('should navigate to health page when clicking Health in sidebar', async ({ page, projectId }) => {
    const sidebar = page.locator('nav, [data-testid="sidebar"]').first();
    await sidebar.waitFor({ state: 'visible', timeout: 10000 });

    const healthLink = sidebar.locator('a:has-text("Health")').first();
    await healthLink.click();

    await expect(page).toHaveURL(`/projects/${projectId}/health`);
  });
});
