import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, ensureProjectExists, getProjectKey } from '../helpers/db-cleanup';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let nextTicketNumber = 1;

/**
 * E2E Tests: Project Activity Feed
 * Feature: AIB-172 Project Activity Feed
 *
 * Tests for the activity feed feature including:
 * - Header navigation to activity page (T032)
 * - Polling behavior for real-time updates (T024)
 * - Full navigation flow (header → activity → ticket modal → back) (T038)
 */

test.describe('Project Activity Feed', () => {
  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    await ensureProjectExists(projectId);

    // Reset ticket counter for this worker
    nextTicketNumber = 1;
  });

  test.afterEach(async () => {
    await prisma.$disconnect();
  });

  /**
   * Test: Header navigation to activity page (T032)
   * Given: User is on any project page (board, analytics, settings)
   * When: User clicks "Activity" link in header
   * Then: User navigates to /projects/{projectId}/activity page
   */
  test('should navigate to activity page from header link', async ({ page, projectId }) => {
    // Navigate to board page
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // Click Activity link in header (icon with aria-label)
    const activityLink = page.getByRole('link', { name: /view project activity/i });
    await expect(activityLink).toBeVisible();
    await activityLink.click();

    // Verify navigation to activity page
    await page.waitForURL(`**/projects/${projectId}/activity`);
    expect(page.url()).toContain(`/projects/${projectId}/activity`);

    // Verify activity page content is loaded (empty state or timeline)
    await expect(
      page.getByText(/no recent activity/i).or(
        page.locator('[aria-label="Timeline of ticket activity"]')
      )
    ).toBeVisible();
  });

  /**
   * Test: Activity page shows events from project (T024 prerequisite)
   * Given: Project has tickets, jobs, and comments
   * When: User visits activity page
   * Then: Events are displayed in chronological order
   */
  test('should display activity events for project', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Create test ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: nextTicketNumber++,
        ticketKey: `${projectKey}-1`,
        title: '[e2e] Activity Test Ticket',
        description: 'Testing activity feed display',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create a job for the ticket
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - 60000), // 1 minute ago
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Navigate to activity page
    await page.goto(`/projects/${projectId}/activity`);

    // Wait for activity content to load
    await page.waitForSelector('[aria-label="Timeline of ticket activity"]', {
      timeout: 10000,
    });

    // Verify ticket creation event is displayed
    await expect(page.getByText(`${projectKey}-1`).first()).toBeVisible();

    // Verify job event is displayed (Specification completed)
    await expect(
      page.getByText(/specification/i).first().or(page.getByText(/completed/i).first())
    ).toBeVisible();
  });

  /**
   * Test: Polling updates activity feed (T024)
   * Given: User is on activity page
   * When: New activity is created in the database
   * Then: Activity feed updates within 15 seconds without manual refresh
   */
  test('should poll and update activity feed with new events', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Create initial ticket
    await prisma.ticket.create({
      data: {
        ticketNumber: nextTicketNumber++,
        ticketKey: `${projectKey}-1`,
        title: '[e2e] Initial Ticket',
        description: 'Initial ticket for polling test',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Navigate to activity page
    await page.goto(`/projects/${projectId}/activity`);

    // Wait for initial activity to load
    await page.waitForSelector('[aria-label="Timeline of ticket activity"]', {
      timeout: 10000,
    });

    // Verify initial ticket is shown
    await expect(page.getByText(`${projectKey}-1`)).toBeVisible();

    // Create a new ticket (simulating new activity)
    await prisma.ticket.create({
      data: {
        ticketNumber: nextTicketNumber++,
        ticketKey: `${projectKey}-2`,
        title: '[e2e] New Ticket After Load',
        description: 'This ticket should appear via polling',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Wait for polling to pick up the new event (15 seconds + buffer)
    // The feed should update automatically without page refresh
    await expect(page.getByText(`${projectKey}-2`)).toBeVisible({
      timeout: 20000, // 15s polling + 5s buffer
    });
  });

  /**
   * Test: Back to Board button navigation
   * Given: User is on activity page
   * When: User clicks "Back to Board" button
   * Then: User navigates back to board page
   */
  test('should navigate back to board from activity page', async ({ page, projectId }) => {
    // Navigate to activity page
    await page.goto(`/projects/${projectId}/activity`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click "Back to Board" button
    const backButton = page.getByRole('link', { name: /back to board/i });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Verify navigation to board page
    await page.waitForURL(`**/projects/${projectId}/board`);
    expect(page.url()).toContain(`/projects/${projectId}/board`);
  });

  /**
   * Test: Full navigation flow (T038)
   * Given: User is on board page
   * When: User navigates header → activity → clicks ticket → back
   * Then: Full navigation cycle works correctly
   */
  test('should complete full navigation flow: header → activity → ticket modal → back', async ({
    page,
    projectId,
  }) => {
    const projectKey = getProjectKey(projectId);

    // Create test ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: nextTicketNumber++,
        ticketKey: `${projectKey}-1`,
        title: '[e2e] Navigation Flow Test',
        description: 'Testing full navigation cycle',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // 1. Start on board page
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // 2. Navigate to activity via header (icon with aria-label)
    const activityLink = page.getByRole('link', { name: /view project activity/i });
    await activityLink.click();
    await page.waitForURL(`**/projects/${projectId}/activity`);

    // 3. Wait for activity page to load and show the ticket
    await page.waitForSelector('[aria-label="Timeline of ticket activity"]', {
      timeout: 10000,
    });
    await expect(page.getByText(`${projectKey}-1`)).toBeVisible();

    // 4. Click on ticket reference to navigate to board with modal
    const ticketLink = page.getByRole('link', { name: `${projectKey}-1` }).first();
    await ticketLink.click();

    // 5. Verify navigation to board with ticket query param
    await page.waitForURL(`**/projects/${projectId}/board?ticket=${ticket.id}`);
    expect(page.url()).toContain(`/projects/${projectId}/board`);
    expect(page.url()).toContain(`ticket=${ticket.id}`);

    // 6. Verify ticket modal is shown (or board loaded with ticket context)
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // 7. Navigate back to activity page via header (icon with aria-label)
    const activityLinkAgain = page.getByRole('link', { name: /view project activity/i });
    await activityLinkAgain.click();
    await page.waitForURL(`**/projects/${projectId}/activity`);

    // 8. Verify activity page loads correctly
    await page.waitForSelector('[aria-label="Timeline of ticket activity"]', {
      timeout: 10000,
    });
    await expect(page.getByText(`${projectKey}-1`)).toBeVisible();
  });

  /**
   * Test: Empty state for project with no activity
   * Given: Project has no tickets, jobs, or comments
   * When: User visits activity page
   * Then: Empty state message is displayed
   */
  test('should show empty state when no activity exists', async ({ page, projectId }) => {
    // Navigate to activity page (project has no tickets after cleanup)
    await page.goto(`/projects/${projectId}/activity`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify empty state is displayed
    await expect(page.getByText(/no recent activity/i)).toBeVisible();
    await expect(
      page.getByText(/when tickets are created/i).or(
        page.getByText(/activity will appear here/i)
      )
    ).toBeVisible();
  });

  /**
   * Test: Load more button pagination
   * Given: Project has more than 50 activity events
   * When: User clicks "Load more" button
   * Then: Additional events are appended to the feed
   */
  test('should load more events when clicking Load more button', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Create multiple tickets to generate activity (need >50 for pagination)
    // For test efficiency, we'll create enough to verify the button appears
    const ticketPromises = [];
    for (let i = 1; i <= 55; i++) {
      ticketPromises.push(
        prisma.ticket.create({
          data: {
            ticketNumber: i,
            ticketKey: `${projectKey}-${i}`,
            title: `[e2e] Pagination Test Ticket ${i}`,
            description: `Testing pagination - ticket ${i}`,
            stage: 'INBOX',
            projectId,
            updatedAt: new Date(Date.now() - (55 - i) * 60000), // Stagger timestamps
          },
        })
      );
    }
    await Promise.all(ticketPromises);

    // Navigate to activity page
    await page.goto(`/projects/${projectId}/activity`);

    // Wait for activity to load
    await page.waitForSelector('[aria-label="Timeline of ticket activity"]', {
      timeout: 10000,
    });

    // Verify Load more button is visible
    const loadMoreButton = page.getByRole('button', { name: /load more activity/i });
    await expect(loadMoreButton).toBeVisible();

    // Verify initial event count (should show 50 of 55)
    await expect(page.getByText(/showing \d+ of 55 events/i)).toBeVisible();

    // Click Load more button
    await loadMoreButton.click();

    // Wait for more events to load
    await expect(page.getByText(/showing 55 of 55 events/i)).toBeVisible({
      timeout: 10000,
    });

    // Load more button should be hidden now (no more events)
    await expect(loadMoreButton).not.toBeVisible();
  });
});
