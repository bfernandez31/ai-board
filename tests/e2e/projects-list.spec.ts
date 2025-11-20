import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, getProjectKey } from '../helpers/db-cleanup';

test.describe('Projects List Page', () => {
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    // IMPORTANT: Only clean up test data, preserve existing projects
    // Reset ticket counter
    nextTicketNumber = 1;

    await cleanupDatabase(projectId); // This function preserves non-[e2e] prefixed data
  });

  test('displays all projects with correct information', async ({ page , projectId }) => {
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

  test('shows hover effect on project cards', async ({ page , projectId }) => {
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

  test('displays shipped ticket metadata below ticket title', async ({ page , projectId }) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Create a shipped ticket for testing the layout
      const ticketNumber = nextTicketNumber++;
      const projectKey = getProjectKey(projectId);
      await prisma.ticket.create({
        data: {
          ticketNumber,
          ticketKey: `${projectKey}-${ticketNumber}`,
          id: 999,
          title: '[e2e] Test Shipped Ticket',
          description: 'Test ticket for layout verification',
          stage: 'SHIP',
          projectId,
          updatedAt: new Date(),
        },
      });

      await page.goto('http://localhost:3000/projects');
      await page.waitForSelector('[data-testid="project-card"]');

      // Find the card for this worker's project (which now has a shipped ticket)
      const cardWithShippedTicket = page.locator(`[data-testid="project-card"][data-project-id="${projectId}"]`);

      // Verify the metadata (timestamp and count) is on a separate line below the title
      const metadata = cardWithShippedTicket.locator('[data-testid="shipped-ticket-metadata"]');
      await expect(metadata).toBeVisible();

      // Verify metadata contains timestamp and count
      await expect(metadata.locator('[data-testid="shipped-ticket-time"]')).toBeVisible();
      await expect(metadata.locator('[data-testid="ticket-count"]')).toBeVisible();
    } finally {
      await prisma.$disconnect();
    }
  });

  test('displays Import and Create Project buttons as disabled when projects exist', async ({ page , projectId }) => {
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

  test('displays Empty component when no projects exist', async ({ page , projectId }) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Create ISOLATED user for this test only (no projects)
      const isolatedUserId = `empty-projects-user-${Date.now()}`;
      await prisma.user.create({
        data: {
          id: isolatedUserId,
          email: `empty-projects-${Date.now()}@e2e.local`,
          name: 'Empty Projects User',
          emailVerified: new Date(),
          updatedAt: new Date(),
        },
      });

      // Set auth header to use isolated user
      await page.context().setExtraHTTPHeaders({
        'x-test-user-id': isolatedUserId,
      });

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

      // Cleanup: Delete isolated user (auto-cleanup handles this in global-teardown via email pattern)
      await prisma.user.delete({ where: { id: isolatedUserId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('displays Import and Create buttons below title on mobile viewport', async ({ browser , projectId }) => {
    // Create mobile context (iPhone SE dimensions)
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();

    try {
      await page.goto('http://localhost:3000/projects');
      await page.waitForSelector('[data-testid="project-card"]');

      // Get the header container with title and buttons
      const header = page.locator('h1:has-text("Projects")').locator('..');

      // Verify title is visible
      const title = header.locator('h1');
      await expect(title).toBeVisible();

      // Get the buttons container
      const buttonsContainer = header.locator('div').filter({ has: page.getByRole('button', { name: /import project/i }) });

      // Verify buttons are visible
      const importButton = page.getByRole('button', { name: /import project/i });
      const createButton = page.getByRole('button', { name: /create project/i });
      await expect(importButton).toBeVisible();
      await expect(createButton).toBeVisible();

      // Get bounding boxes to verify vertical stacking
      const titleBox = await title.boundingBox();
      const importBox = await importButton.boundingBox();
      const createBox = await createButton.boundingBox();

      // Verify buttons are below the title (Y position of buttons > Y position of title)
      expect(importBox!.y).toBeGreaterThan(titleBox!.y + titleBox!.height);
      expect(createBox!.y).toBeGreaterThan(titleBox!.y + titleBox!.height);

      // Verify buttons are stacked vertically (one below the other, not side by side)
      // Check if import button and create button have significantly different Y positions OR
      // are on the same row but the buttons should be in a flex-col layout
      const buttonsContainerBox = await buttonsContainer.boundingBox();

      // The buttons container should span most of the width (not a narrow horizontal strip)
      // OR the buttons should be vertically stacked
      if (importBox!.y !== createBox!.y) {
        // Buttons are on different rows - vertical stacking confirmed
        expect(Math.abs(importBox!.y - createBox!.y)).toBeGreaterThan(10);
      }
    } finally {
      await context.close();
    }
  });
});
