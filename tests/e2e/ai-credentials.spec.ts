import { test, expect } from '../helpers/worker-isolation';

test.describe('AI Credentials Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/ai-credentials');
    await page.waitForLoadState('networkidle');
  });

  test('saves a credential and renders a masked summary', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('AI Credentials');

    await page.click('button:has-text("Add Credential")');
    await page.fill('input#ai-credential-label', `[e2e] Anthropic ${Date.now()}`);
    await page.fill('input#ai-credential-secret', 'sk-ant-valid-secret-12345678');
    await page.click('button:has-text("Save Credential")');

    await expect(page.locator('text=Ready')).toBeVisible();
    await expect(page.locator('code:has-text("...5678")')).toBeVisible();
  });

  test('replaces and deletes a credential', async ({ page }) => {
    const firstLabel = `[e2e] Anthropic ${Date.now()}`;
    const secondLabel = `[e2e] Anthropic Rotated ${Date.now()}`;

    await page.click('button:has-text("Add Credential")');
    await page.fill('input#ai-credential-label', firstLabel);
    await page.fill('input#ai-credential-secret', 'sk-ant-valid-secret-12345678');
    await page.click('button:has-text("Save Credential")');

    await page.click('button:has-text("Replace Credential")');
    await page.fill('input#ai-credential-label', secondLabel);
    await page.fill('input#ai-credential-secret', 'sk-ant-valid-secret-87654321');
    await page.click('button:has-text("Replace Credential")');

    await expect(page.locator(`text=${secondLabel}`)).toBeVisible();
    await expect(page.locator('code:has-text("...4321")')).toBeVisible();

    await page.click('button:has-text("Delete Credential")');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.click('button:has-text("Delete Credential")');

    await expect(page.locator('text=No AI credentials saved yet')).toBeVisible();
  });
});
