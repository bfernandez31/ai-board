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
    await expect(firstCard.locator('[data-testid="github-link"]')).toBeVisible();
    // Note: shipped ticket info or "no shipped tickets" message should be visible
    const hasShippedTickets = await firstCard.locator('[data-testid="shipped-ticket-title"]').isVisible().catch(() => false);
    const hasNoShippedMessage = await firstCard.locator('[data-testid="no-shipped-tickets"]').isVisible().catch(() => false);
    expect(hasShippedTickets || hasNoShippedMessage).toBe(true);
  });

  test.skip('navigates to board when clicking project card', async ({ page }) => {
    // TODO: Fix navigation test after project card redesign
    // The test needs updating to account for new click handlers on GitHub/deployment links
    await page.goto('http://localhost:3000/projects');
    await page.waitForSelector('[data-testid="project-card"]');

    // Get first project ID
    const firstCard = page.locator('[data-testid="project-card"]').first();
    const projectId = await firstCard.getAttribute('data-project-id');

    // Click on the "No tickets yet" text area (CardContent, safe area)
    const cardContent = firstCard.locator('[data-testid="no-shipped-tickets"]').or(firstCard.locator('[data-testid="ticket-count"]'));
    await cardContent.first().click({ force: true });

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

    // Verify brightness filter applied on hover (check for filter property)
    const filter = await firstCard.evaluate(el => window.getComputedStyle(el).filter);
    expect(filter).toContain('brightness');
  });

  test('displays Import and Create Project buttons as disabled when projects exist', async ({ page }) => {
    await page.goto('http://localhost:3000/projects');

    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]');

    // Verify Import Project button
    const importButton = page.getByRole('button', { name: /import project/i });
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeDisabled();

    // Verify Create Project button
    const createButton = page.getByRole('button', { name: /create project/i });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeDisabled();
  });

  test('displays Empty component when no projects exist', async ({ page }) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Temporarily delete all test projects to test empty state
      await prisma.ticket.deleteMany({ where: { projectId: { in: [1, 2] } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: [1, 2] } } });
      await prisma.project.deleteMany({ where: { id: { in: [1, 2] } } });

      await page.goto('http://localhost:3000/projects');

      // Verify empty state is displayed with shadcn Empty component
      await expect(page.getByText(/no projects yet/i)).toBeVisible();
      await expect(page.getByText(/get started by creating a new project or importing an existing one/i)).toBeVisible();

      // Verify action buttons are shown in the empty state (not in header)
      const emptyStateImportButton = page.locator('[data-slot="empty-content"]').getByRole('button', { name: /import project/i });
      const emptyStateCreateButton = page.locator('[data-slot="empty-content"]').getByRole('button', { name: /create project/i });

      await expect(emptyStateImportButton).toBeVisible();
      await expect(emptyStateImportButton).toBeDisabled();
      await expect(emptyStateCreateButton).toBeVisible();
      await expect(emptyStateCreateButton).toBeDisabled();

      // Verify header action buttons are NOT shown when empty
      const headerButtons = page.locator('h1:has-text("Projects") ~ div button');
      await expect(headerButtons.first()).not.toBeVisible();
    } finally {
      // Restore test projects for other tests
      const { ensureTestFixtures } = await import('../helpers/db-cleanup');
      await ensureTestFixtures();
      await prisma.$disconnect();
    }
  });
});
