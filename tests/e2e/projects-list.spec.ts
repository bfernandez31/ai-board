import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

test.describe('Projects List Page', () => {
  test.beforeEach(async () => {
    // IMPORTANT: Only clean up test data, preserve existing projects
    await cleanupDatabase(); // This function preserves non-[e2e] prefixed data
  });

  test('displays all projects with correct information', async ({ page }) => {
    // Navigate to projects page
    await page.goto('http://localhost:3000/projects');

    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]');

    // Verify project cards display
    const projectCards = await page.locator('[data-testid="project-card"]').count();
    expect(projectCards).toBeGreaterThan(0);

    // Verify first project shows all required fields
    const firstCard = page.locator('[data-testid="project-card"]').first();
    await expect(firstCard.locator('[data-testid="project-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="project-description"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="project-updated"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="project-ticket-count"]')).toBeVisible();
  });

  test('navigates to board when clicking project card', async ({ page }) => {
    await page.goto('http://localhost:3000/projects');
    await page.waitForSelector('[data-testid="project-card"]');

    // Get first project ID
    const firstCard = page.locator('[data-testid="project-card"]').first();
    const projectId = await firstCard.getAttribute('data-project-id');

    // Click project card
    await firstCard.click();

    // Verify navigation to board
    await expect(page).toHaveURL(`/projects/${projectId}/board`);
  });

  test('shows hover effect on project cards', async ({ page }) => {
    await page.goto('http://localhost:3000/projects');
    await page.waitForSelector('[data-testid="project-card"]');

    const firstCard = page.locator('[data-testid="project-card"]').first();

    // Hover over card
    await firstCard.hover();

    // Verify cursor changes to pointer
    const cursor = await firstCard.evaluate(el => window.getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');

    // Verify scale transform applied (check for transform property)
    const transform = await firstCard.evaluate(el => window.getComputedStyle(el).transform);
    expect(transform).not.toBe('none');
  });

  test('displays Import and Create Project buttons as disabled', async ({ page }) => {
    await page.goto('http://localhost:3000/projects');

    // Verify Import Project button
    const importButton = page.getByRole('button', { name: /import project/i });
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeDisabled();

    // Verify Create Project button
    const createButton = page.getByRole('button', { name: /create project/i });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeDisabled();
  });

  // Note: This test is skipped because Next.js Server Components perform server-side fetches
  // that cannot be intercepted by Playwright's route mocking. The empty state functionality
  // is tested manually via quickstart.md. To properly test this, we would need to:
  // 1. Temporarily delete all projects (violates data preservation policy), OR
  // 2. Add a query parameter to force empty state (not production code), OR
  // 3. Use a separate test database (infrastructure change)
  test.skip('displays empty state when no projects exist', async ({ page }) => {
    // This test verifies the empty state UI when no projects are available
    // Empty state component code is at: /components/projects/empty-projects-state.tsx
    // Manual testing: Delete all projects and visit /projects
    await page.goto('http://localhost:3000/projects');
    await expect(page.getByText(/no projects available/i)).toBeVisible();
    await expect(page.getByText(/get started by clicking/i)).toBeVisible();
  });
});
