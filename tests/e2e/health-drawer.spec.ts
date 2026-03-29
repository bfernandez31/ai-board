/**
 * E2E Tests: Health Dashboard Scan Detail Drawer
 * Feature: AIB-376-copy-of-health
 *
 * Tests for drawer open/close flow via close button, overlay, and Escape key
 */

import { test, expect } from '../helpers/worker-isolation';
import { ensureProjectExists } from '../helpers/db-cleanup';

test.describe('Health Drawer Open/Close', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page, projectId }) => {
    await ensureProjectExists(projectId);
    await page.goto(`/projects/${projectId}/health`);
    await page.waitForLoadState('networkidle');
  });

  test('should open drawer when clicking a module card and close via close button', async ({ page }) => {
    // Wait for module cards to render
    const moduleCard = page.locator('[role="button"]').filter({ hasText: /Security|Compliance|Tests|Spec Sync|Quality Gate|Last Clean/ }).first();
    await moduleCard.waitFor({ state: 'visible', timeout: 10000 });
    await moduleCard.click();

    // Drawer should appear (Sheet component with role="dialog")
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Close via close button (Cross2Icon in SheetContent)
    const closeButton = drawer.locator('button:has(.sr-only)').first();
    await closeButton.click();

    // Drawer should close
    await expect(drawer).not.toBeVisible({ timeout: 5000 });
  });

  test('should close drawer via Escape key', async ({ page }) => {
    const moduleCard = page.locator('[role="button"]').filter({ hasText: /Security|Compliance|Tests|Spec Sync|Quality Gate|Last Clean/ }).first();
    await moduleCard.waitFor({ state: 'visible', timeout: 10000 });
    await moduleCard.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Press Escape
    await page.keyboard.press('Escape');

    await expect(drawer).not.toBeVisible({ timeout: 5000 });
  });

  test('should close drawer via overlay click', async ({ page }) => {
    const moduleCard = page.locator('[role="button"]').filter({ hasText: /Security|Compliance|Tests|Spec Sync|Quality Gate|Last Clean/ }).first();
    await moduleCard.waitFor({ state: 'visible', timeout: 10000 });
    await moduleCard.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click the overlay (the semi-transparent backdrop)
    const overlay = page.locator('[data-state="open"].fixed.inset-0');
    await overlay.click({ position: { x: 10, y: 10 }, force: true });

    await expect(drawer).not.toBeVisible({ timeout: 5000 });
  });
});
