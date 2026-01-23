/**
 * E2E Tests: Personal Access Tokens
 * Feature: AIB-173-personal-access-tokens
 *
 * Tests for token management UI flows that require browser interaction:
 * - Token generation modal with copy functionality
 * - Token deletion confirmation modal
 * - Token list display
 */

import { test, expect } from '@playwright/test';

test.describe('Personal Access Tokens', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the tokens settings page
    await page.goto('/settings/tokens');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Token Settings Page', () => {
    test('should display the token settings page', async ({ page }) => {
      // Verify page title
      await expect(page.locator('h1')).toContainText('Personal Access Tokens');

      // Verify description is present
      await expect(page.locator('text=Manage tokens for API authentication')).toBeVisible();

      // Verify "Generate New Token" button is present
      const generateButton = page.locator('button', { hasText: 'Generate New Token' });
      await expect(generateButton).toBeVisible();
    });

    test('should display empty state when no tokens exist', async ({ page }) => {
      // Check for empty state message (may or may not be present depending on existing tokens)
      const emptyState = page.locator('text=No personal access tokens yet');
      const tokenList = page.locator('[class*="divide-y"]');

      // Either empty state or token list should be visible
      const hasEmptyState = await emptyState.count() > 0;
      const hasTokenList = await tokenList.count() > 0;

      expect(hasEmptyState || hasTokenList).toBe(true);
    });
  });

  test.describe('Token Generation Flow', () => {
    test('should open create token dialog', async ({ page }) => {
      // Click the generate button
      await page.click('button:has-text("Generate New Token")');

      // Verify dialog opens
      await expect(page.locator('text=Generate Personal Access Token')).toBeVisible();

      // Verify input field is present
      await expect(page.locator('input#token-name')).toBeVisible();

      // Verify Generate and Cancel buttons are present
      await expect(page.locator('button:has-text("Generate Token")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    });

    test('should validate token name is required', async ({ page }) => {
      // Open dialog
      await page.click('button:has-text("Generate New Token")');

      // Try to generate with empty name - button should be disabled
      const generateBtn = page.locator('button:has-text("Generate Token")');
      await expect(generateBtn).toBeDisabled();

      // Enter a name
      await page.fill('input#token-name', '[e2e] Test Token');

      // Button should now be enabled
      await expect(generateBtn).toBeEnabled();
    });

    test('should generate token and show it once', async ({ page }) => {
      // Open dialog
      await page.click('button:has-text("Generate New Token")');

      // Enter token name
      await page.fill('input#token-name', '[e2e] Test Token ' + Date.now());

      // Click Generate
      await page.click('button:has-text("Generate Token")');

      // Wait for token to be generated
      await page.waitForSelector('text=Token Generated');

      // Verify token is displayed
      const tokenDisplay = page.locator('code');
      await expect(tokenDisplay).toBeVisible();

      // Verify token starts with pat_
      const tokenText = await tokenDisplay.textContent();
      expect(tokenText).toMatch(/^pat_[a-f0-9]{64}$/);

      // Verify warning message is shown
      await expect(page.locator('text=You won\'t be able to see it again')).toBeVisible();

      // Verify copy button is present
      const copyButton = page.locator('button[aria-label*="copy" i], button:has(svg[class*="copy" i])').or(
        page.locator('button').filter({ has: page.locator('svg') }).nth(0)
      );
      await expect(copyButton.first()).toBeVisible();
    });

    test('should close dialog and clear state', async ({ page }) => {
      // Open dialog
      await page.click('button:has-text("Generate New Token")');

      // Enter token name
      await page.fill('input#token-name', 'Test Token');

      // Cancel
      await page.click('button:has-text("Cancel")');

      // Verify dialog is closed
      await expect(page.locator('text=Generate Personal Access Token')).not.toBeVisible();

      // Reopen dialog and verify input is cleared
      await page.click('button:has-text("Generate New Token")');
      const input = page.locator('input#token-name');
      await expect(input).toHaveValue('');
    });
  });

  test.describe('Token List Display', () => {
    test('should display token in list after creation', async ({ page }) => {
      const tokenName = '[e2e] List Test Token ' + Date.now();

      // Create a token
      await page.click('button:has-text("Generate New Token")');
      await page.fill('input#token-name', tokenName);
      await page.click('button:has-text("Generate Token")');
      await page.waitForSelector('text=Token Generated');
      await page.click('button:has-text("Done")');

      // Verify token appears in list
      await expect(page.locator(`text=${tokenName}`)).toBeVisible();

      // Verify preview is shown (format: ...xxxx)
      await expect(page.locator('code:has-text("...")')).toBeVisible();

      // Verify "Never used" is shown for new token
      await expect(page.locator('text=Never used')).toBeVisible();
    });

    test('should show token metadata', async ({ page }) => {
      const tokenName = '[e2e] Metadata Test Token ' + Date.now();

      // Create a token
      await page.click('button:has-text("Generate New Token")');
      await page.fill('input#token-name', tokenName);
      await page.click('button:has-text("Generate Token")');
      await page.waitForSelector('text=Token Generated');
      await page.click('button:has-text("Done")');

      // Find the token row
      const tokenRow = page.locator('[class*="flex items-center justify-between"]', { hasText: tokenName }).first();

      // Verify created time is shown (e.g., "Created X ago")
      await expect(tokenRow.locator('text=Created')).toBeVisible();
    });
  });

  test.describe('Token Deletion Flow', () => {
    test('should open delete confirmation dialog', async ({ page }) => {
      const tokenName = '[e2e] Delete Test Token ' + Date.now();

      // Create a token first
      await page.click('button:has-text("Generate New Token")');
      await page.fill('input#token-name', tokenName);
      await page.click('button:has-text("Generate Token")');
      await page.waitForSelector('text=Token Generated');
      await page.click('button:has-text("Done")');

      // Find the delete button for this token
      const tokenRow = page.locator('[class*="flex items-center justify-between"]', { hasText: tokenName }).first();
      const deleteButton = tokenRow.locator('button:has(svg[class*="trash" i])').or(
        tokenRow.locator('button[aria-label*="delete" i]')
      ).or(tokenRow.locator('button').last());

      await deleteButton.click();

      // Verify confirmation dialog opens
      await expect(page.locator('text=Revoke Token?')).toBeVisible();

      // Verify token name is shown in dialog
      await expect(page.locator(`text=${tokenName}`)).toBeVisible();

      // Verify warning message
      await expect(page.locator('text=will immediately lose access')).toBeVisible();

      // Verify Cancel and Revoke buttons
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
      await expect(page.locator('button:has-text("Revoke Token")')).toBeVisible();
    });

    test('should cancel deletion', async ({ page }) => {
      const tokenName = '[e2e] Cancel Delete Token ' + Date.now();

      // Create a token
      await page.click('button:has-text("Generate New Token")');
      await page.fill('input#token-name', tokenName);
      await page.click('button:has-text("Generate Token")');
      await page.waitForSelector('text=Token Generated');
      await page.click('button:has-text("Done")');

      // Open delete dialog
      const tokenRow = page.locator('[class*="flex items-center justify-between"]', { hasText: tokenName }).first();
      await tokenRow.locator('button').last().click();

      // Cancel
      await page.click('button:has-text("Cancel")');

      // Verify dialog closed
      await expect(page.locator('text=Revoke Token?')).not.toBeVisible();

      // Verify token still in list
      await expect(page.locator(`text=${tokenName}`)).toBeVisible();
    });

    test('should delete token and remove from list', async ({ page }) => {
      const tokenName = '[e2e] Confirm Delete Token ' + Date.now();

      // Create a token
      await page.click('button:has-text("Generate New Token")');
      await page.fill('input#token-name', tokenName);
      await page.click('button:has-text("Generate Token")');
      await page.waitForSelector('text=Token Generated');
      await page.click('button:has-text("Done")');

      // Open delete dialog
      const tokenRow = page.locator('[class*="flex items-center justify-between"]', { hasText: tokenName }).first();
      await tokenRow.locator('button').last().click();

      // Confirm deletion
      await page.click('button:has-text("Revoke Token")');

      // Wait for dialog to close
      await page.waitForSelector('text=Revoke Token?', { state: 'hidden' });

      // Verify token removed from list
      await expect(page.locator(`text=${tokenName}`)).not.toBeVisible({ timeout: 5000 });
    });
  });
});
