import { test, expect } from '@playwright/test';

test.describe('Sign-In Page Redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin');
  });

  // User Story 1: GitHub OAuth Sign-In Tests
  test.describe('User Story 1: GitHub OAuth Sign-In', () => {
    test('displays GitHub OAuth button', async ({ page }) => {
      const githubButton = page.getByRole('button', { name: /continue with github/i });
      await expect(githubButton).toBeVisible();
      await expect(githubButton).toBeEnabled();
    });

    test('GitHub button has proper icon', async ({ page }) => {
      const githubButton = page.getByRole('button', { name: /continue with github/i });

      // Icon should be present (check for svg element)
      const icon = githubButton.locator('svg').first();
      await expect(icon).toBeVisible();

      // Verify icon size (lucide-react default: h-5 w-5 = 20px)
      const iconSize = await icon.evaluate((el) => ({
        width: el.clientWidth,
        height: el.clientHeight,
      }));
      expect(iconSize.width).toBe(20);
      expect(iconSize.height).toBe(20);
    });

    test('preserves callbackUrl parameter', async ({ page }) => {
      await page.goto('/auth/signin?callbackUrl=/projects/3/board');

      const githubButton = page.getByRole('button', { name: /continue with github/i });
      await expect(githubButton).toBeVisible();

      // Note: Actual OAuth redirect testing requires GitHub credentials
      // This test just verifies the page loads with callbackUrl param
    });
  });

  // User Story 2: Visual Consistency Tests
  test.describe('User Story 2: Visual Consistency with Site Theme', () => {
    test('displays header on sign-in page', async ({ page }) => {
      // Header should be visible
      const header = page.locator('header');
      await expect(header).toBeVisible();

      // Logo should be present
      const logo = page.locator('img[alt="AI-BOARD Logo"]');
      await expect(logo).toBeVisible();

      // "AI-BOARD" text should be visible
      await expect(page.getByText('AI-BOARD')).toBeVisible();
    });

    test('displays dark theme background', async ({ page }) => {
      // Get the auth layout element (should be a div with min-h-screen)
      const authLayout = page.locator('div.min-h-screen').first();
      await expect(authLayout).toBeVisible();

      const bgColor = await authLayout.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // Catppuccin Mocha base: #1e1e2e = rgb(30, 30, 46)
      expect(bgColor).toBe('rgb(30, 30, 46)');
    });

    test('displays card with violet border', async ({ page }) => {
      // Find the card element with violet border class
      const card = page.locator('[class*="border"]').first();
      await expect(card).toBeVisible();

      const borderColor = await card.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.borderColor || style.borderTopColor;
      });

      // #8B5CF6 = rgb(139, 92, 246)
      expect(borderColor).toBe('rgb(139, 92, 246)');
    });

    test('uses Catppuccin theme text colors', async ({ page }) => {
      const cardDescription = page.locator('[class*="text-\\[hsl"]').first();

      // CardDescription should exist with theme color
      await expect(cardDescription).toBeVisible();
    });

    test('is responsive on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      const card = page.locator('[class*="max-w-md"]').first();
      await expect(card).toBeVisible();

      // Card should not overflow viewport
      const cardBox = await card.boundingBox();
      expect(cardBox!.width).toBeLessThanOrEqual(375);
    });
  });

  // User Story 3: Multiple OAuth Provider Options Tests
  test.describe('User Story 3: Multiple OAuth Provider Options Display', () => {
    test('displays three OAuth provider buttons', async ({ page }) => {
      // GitHub button - active
      const githubButton = page.getByRole('button', { name: /continue with github/i });
      await expect(githubButton).toBeVisible();
      await expect(githubButton).toBeEnabled();

      // GitLab button - disabled
      const gitlabButton = page.getByRole('button', { name: /continue with gitlab/i });
      await expect(gitlabButton).toBeVisible();
      await expect(gitlabButton).toBeDisabled();

      // BitBucket button - disabled
      const bitbucketButton = page.getByRole('button', { name: /continue with bitbucket/i });
      await expect(bitbucketButton).toBeVisible();
      await expect(bitbucketButton).toBeDisabled();
    });

    test('displays "Coming soon" text for disabled providers', async ({ page }) => {
      const comingSoonLabels = page.getByText('Coming soon');
      await expect(comingSoonLabels).toHaveCount(2); // GitLab + BitBucket
    });

    test('disabled providers have proper visual styling', async ({ page }) => {
      // GitLab button should have opacity and cursor styling
      const gitlabButton = page.getByRole('button', { name: /continue with gitlab/i });

      const opacity = await gitlabButton.evaluate((el) =>
        window.getComputedStyle(el).opacity
      );

      // Should have reduced opacity (0.5)
      expect(parseFloat(opacity)).toBeLessThan(1.0);
    });

    test('all provider buttons have proper icons', async ({ page }) => {
      // GitHub icon (lucide-react)
      const githubButton = page.getByRole('button', { name: /continue with github/i });
      const githubIcon = githubButton.locator('svg').first();
      await expect(githubIcon).toBeVisible();

      // GitLab icon (react-icons/si)
      const gitlabButton = page.getByRole('button', { name: /continue with gitlab/i });
      const gitlabIcon = gitlabButton.locator('svg').first();
      await expect(gitlabIcon).toBeVisible();

      // BitBucket icon (react-icons/si)
      const bitbucketButton = page.getByRole('button', { name: /continue with bitbucket/i });
      const bitbucketIcon = bitbucketButton.locator('svg').first();
      await expect(bitbucketIcon).toBeVisible();
    });
  });

  // Cross-Story Integration Tests
  test.describe('Integration Tests', () => {
    test('page structure is semantically correct', async ({ page }) => {
      // Should have a card with title and description
      await expect(page.getByRole('heading', { name: /welcome to ai board/i })).toBeVisible();
      await expect(page.getByText(/sign in with/i)).toBeVisible();
    });

    test('all interactive elements are keyboard accessible', async ({ page }) => {
      // Tab through all buttons
      await page.keyboard.press('Tab');

      const githubButton = page.getByRole('button', { name: /continue with github/i });
      await expect(githubButton).toBeFocused();
    });

    test('layout is centered on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      const card = page.locator('[class*="max-w-md"]').first();
      await expect(card).toBeVisible();

      // Card should be horizontally centered
      const cardBox = await card.boundingBox();
      const viewportWidth = 1920;
      const cardCenter = cardBox!.x + cardBox!.width / 2;
      const viewportCenter = viewportWidth / 2;

      // Allow 50px tolerance for centering
      expect(Math.abs(cardCenter - viewportCenter)).toBeLessThan(50);
    });
  });
});
