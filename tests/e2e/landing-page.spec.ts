/**
 * Landing Page E2E Tests
 * Tests for marketing landing page functionality
 * Following TDD approach: tests written before implementation
 */

import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/client';
import { cleanupDatabase } from '../helpers/db-cleanup';

test.describe('Landing Page - User Story 4: Authenticated User Redirection', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('T008: authenticated user visits / and redirects to /projects', async ({ page }) => {
    // Given: User is authenticated (test mode auto-login)
    // When: User visits root page
    await page.goto('/');

    // Then: User is redirected to /projects
    await expect(page).toHaveURL('/projects');

    // And: Landing page is NOT visible
    const landingPlaceholder = page.getByText('Landing Page Placeholder');
    await expect(landingPlaceholder).not.toBeVisible();
  });

  // TODO: Fix session loading timing issue with useSession() in header
  test.skip('T009: authenticated user sees application header variant (not marketing header)', async ({ page }) => {
    // Given: User is authenticated (test mode auto-login)
    // When: User visits root page (redirected to /projects)
    await page.goto('/');
    await expect(page).toHaveURL('/projects');

    // Wait for projects page content to load (indicates session is ready)
    await expect(page.getByText('Projects')).toBeVisible();

    // Then: Application header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // And: User menu is visible (not Sign In button)
    const userMenu = header.getByTestId('user-menu');
    await expect(userMenu).toBeVisible();

    // And: Sign In button is NOT visible
    const signInButton = header.getByRole('link', { name: /sign in/i });
    await expect(signInButton).not.toBeVisible();
  });
});

test.describe('Landing Page - User Story 1: Unauthenticated Visitor Discovery', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('T013: unauthenticated visitor sees hero section with headline and CTAs', async ({ browser }) => {
    // Given: User is NOT authenticated
    const context = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {},
    });
    const page = await context.newPage();

    // When: User visits landing page
    await page.goto('/');

    // Then: Hero section is visible with gradient title
    const heroTitle = page.getByRole('heading', { name: /build better software/i });
    await expect(heroTitle).toBeVisible();

    // And: Primary CTA button is visible
    const primaryCTA = page.getByRole('link', { name: /get started free/i }).first();
    await expect(primaryCTA).toBeVisible();

    // And: Secondary CTA button is visible
    const secondaryCTA = page.getByRole('link', { name: /view demo/i });
    await expect(secondaryCTA).toBeVisible();

    await context.close();
  });

  test('T014: unauthenticated visitor sees 6 feature cards in grid layout', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {},
    });
    const page = await context.newPage();

    await page.goto('/');

    // Then: Features section is visible
    const featuresSection = page.locator('#features');
    await expect(featuresSection).toBeVisible();

    // And: 6 feature cards are visible
    const featureCards = page.locator('[data-testid="feature-card"]');
    await expect(featureCards).toHaveCount(6);

    // And: Grid layout is present (check child grid container)
    const gridContainer = featuresSection.locator('.grid');
    await expect(gridContainer).toBeVisible();

    await context.close();
  });

  test('T015: unauthenticated visitor sees workflow timeline with 5 stages', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {},
    });
    const page = await context.newPage();

    await page.goto('/');

    // Then: Workflow section is visible
    const workflowSection = page.locator('#workflow');
    await expect(workflowSection).toBeVisible();

    // And: 5 workflow stages are visible
    const workflowSteps = page.locator('[data-testid="workflow-step"]');
    await expect(workflowSteps).toHaveCount(5);

    // And: Stage names are visible (INBOX, SPECIFY, PLAN, BUILD, VERIFY)
    await expect(page.getByText('INBOX')).toBeVisible();
    await expect(page.getByText('SPECIFY')).toBeVisible();
    await expect(page.getByText('PLAN')).toBeVisible();
    await expect(page.getByText('BUILD')).toBeVisible();
    await expect(page.getByText('VERIFY')).toBeVisible();

    await context.close();
  });

  test('T016: unauthenticated visitor sees final CTA section at bottom', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {},
    });
    const page = await context.newPage();

    await page.goto('/');

    // Then: Final CTA section is visible
    const finalCTA = page.getByRole('link', { name: /get started free/i }).last();
    await expect(finalCTA).toBeVisible();

    // And: CTA has gradient background
    const ctaSection = page.locator('[data-testid="final-cta-section"]');
    await expect(ctaSection).toBeVisible();

    await context.close();
  });
});

test.describe('Landing Page - User Story 3: Section Navigation', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('T035: clicking "Features" link scrolls to features section', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {},
    });
    const page = await context.newPage();

    await page.goto('/');

    // Click Features link in header
    const featuresLink = page.getByRole('link', { name: /features/i }).first();
    await featuresLink.click();

    // Wait for scroll to complete
    await page.waitForTimeout(500);

    // Verify features section is in viewport
    const featuresSection = page.locator('#features');
    await expect(featuresSection).toBeInViewport();

    await context.close();
  });

  test('T036: clicking "Workflow" link scrolls to workflow section', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {},
    });
    const page = await context.newPage();

    await page.goto('/');

    // Click Workflow link in header
    const workflowLink = page.getByRole('link', { name: /workflow/i }).first();
    await workflowLink.click();

    // Wait for scroll to complete
    await page.waitForTimeout(500);

    // Verify workflow section is in viewport
    const workflowSection = page.locator('#workflow');
    await expect(workflowSection).toBeInViewport();

    await context.close();
  });

  test('T037: hovering over navigation links shows color transition', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {},
    });
    const page = await context.newPage();

    await page.goto('/');

    // Get Features link
    const featuresLink = page.getByRole('link', { name: /features/i }).first();

    // Hover over link
    await featuresLink.hover();

    // Verify link has transition classes
    const hasTransition = await featuresLink.evaluate((el) => {
      const classes = el.className;
      return classes.includes('transition');
    });

    expect(hasTransition).toBe(true);

    await context.close();
  });
});
