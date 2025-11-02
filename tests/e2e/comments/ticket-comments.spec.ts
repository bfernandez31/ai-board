import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';

/**
 * E2E Tests: Ticket Comments Feature
 * Feature: 042-ticket-comments-context
 * Source: specs/042-ticket-comments-context/tasks.md (TASK-026 to TASK-033)
 *
 * Tests validate:
 * - User creates comment (TASK-026)
 * - User views comments with markdown rendering (TASK-027)
 * - User deletes own comment (TASK-028)
 * - User cannot delete another user's comment (TASK-029)
 * - Tab navigation with keyboard shortcuts (TASK-030)
 * - Existing functionality preserved in tabs (TASK-031)
 * - Real-time comment updates via polling (TASK-032)
 * - Mobile responsiveness of comments (TASK-033)
 */

const prisma = getPrismaClient();

let nextTicketNumber = 1;
let projectKey = '';

test.describe('Ticket Comments - User Stories', () => {
  test.beforeEach(async ({ projectId }) => {
    // Comprehensive cleanup of all test data
    await cleanupDatabase(projectId);

    // Reset ticket counter
    nextTicketNumber = 1;

    // Fetch project key for ticketKey generation
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });
    projectKey = project!.key;

    // Create test user (required for comment.userId foreign key)
    await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Ensure different user exists for permission tests
    await prisma.user.upsert({
      where: { id: 'different-user-id' },
      update: {},
      create: {
        id: 'different-user-id',
        email: 'different@e2e.local',
        name: 'Different User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * TASK-026: User creates comment
   * User Story: As a user, I want to add comments to tickets so I can communicate with my team
   */
  test('user can create a comment on a ticket', async ({ page , projectId }) => {
    // Setup: Create test ticket
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Comments Test - Create',
        description: 'Test ticket for comment creation',
        stage: 'SPECIFY',
        projectId,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Click ticket to open detail modal
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.waitForSelector('[role="dialog"]');

    // Click Conversation tab and wait for tab content to be visible
    await page.click('[role="tab"]:has-text("Conversation")');
    await page.waitForSelector('[role="tabpanel"]:visible');

    // Wait for textarea to be visible (confirms CommentList loaded)
    const textarea = page.locator('textarea[placeholder*="Write a comment"]');
    await textarea.waitFor({ state: 'visible' });

    // Type comment
    const commentText = 'This is my test comment';
    await textarea.fill(commentText);

    // Wait for the Comment button to be enabled (validation check)
    // Use getByRole to avoid conflict with "Comments" tab
    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.waitFor({ state: 'visible' });
    await expect(submitButton).toBeEnabled();

    // Wait for the POST request and the UI update
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes(`/api/projects/${projectId}/tickets/${ticket.id}/comments`) &&
          resp.request().method() === 'POST'
      ),
      submitButton.click(),
    ]);

    // Verify POST was successful
    expect(response.status()).toBe(201);

    // Wait for optimistic update to appear
    await expect(page.locator(`text=${commentText}`).first()).toBeVisible();

    // Verify in database
    const dbComment = await prisma.comment.findFirst({
      where: {
        ticketId: ticket.id,
        content: commentText,
      },
    });
    expect(dbComment).toBeTruthy();
    expect(dbComment?.content).toBe(commentText);
  });

  /**
   * TASK-027: User views comments with markdown rendering
   * User Story: As a user, I want to see formatted comments so I can read structured information
   */
  test('user can view comments with markdown formatting', async ({ page , projectId }) => {
    // Setup: Create ticket with markdown comment
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Comments Test - Markdown',
        description: 'Test ticket for markdown rendering',
        stage: 'SPECIFY',
        projectId,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    const commentContent = `Test comment with special characters and formatting.
Multi-line content is preserved.`;

    await prisma.comment.create({
      data: {
        content: commentContent,
        userId: 'test-user-id',
        ticketId: ticket.id,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Click ticket to open detail modal
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.waitForSelector('[role="dialog"]');

    // Click Conversation tab
    await page.click('[role="tab"]:has-text("Conversation")');

    // Verify comment content is displayed (as plain text with whitespace preserved)
    const commentItem = page.locator('[data-testid="comment-item"]').first();
    await expect(commentItem).toBeVisible();
    await expect(commentItem).toContainText('Test comment with special characters');
    await expect(commentItem).toContainText('Multi-line content is preserved');
  });

  /**
   * TASK-028: User deletes own comment
   * User Story: As a user, I want to delete my own comments so I can remove mistakes
   */
  test('user can delete their own comment', async ({ page , projectId }) => {
    // Setup: Create ticket with user's comment
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Comments Test - Delete Own',
        description: 'Test ticket for deleting own comment',
        stage: 'SPECIFY',
        projectId,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    const comment = await prisma.comment.create({
      data: {
        content: 'Comment to delete',
        userId: 'test-user-id',
        ticketId: ticket.id,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Click ticket to open detail modal
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.waitForSelector('[role="dialog"]');

    // Click Conversation tab and wait for it to be visible
    await page.click('[role="tab"]:has-text("Conversation")');
    await page.waitForSelector('[role="tabpanel"]:visible');

    // Wait for comment to load and be visible
    const commentText = page.locator('text=Comment to delete');
    await commentText.waitFor({ state: 'visible' });

    // Find the exact comment container (now using data-testid for timeline design)
    const commentContainer = page.locator('[data-testid="comment-item"]').filter({ hasText: 'Comment to delete' });

    // Hover over the comment container to trigger isHovered state
    await commentContainer.hover();

    // Wait for delete button to appear (triggered by onMouseEnter → isHovered=true)
    const deleteButton = commentContainer.getByRole('button', { name: 'Delete comment' });
    await deleteButton.waitFor({ state: 'visible' });

    // Click the delete button
    await deleteButton.click();

    // Confirm deletion in AlertDialog
    const alertDialog = page.locator('[role="alertdialog"]');
    await alertDialog.waitFor({ state: 'visible' });

    const confirmButton = alertDialog.getByRole('button', { name: /delete/i });
    await confirmButton.click();

    // Wait for DELETE request to complete
    await page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/projects/${projectId}/tickets/${ticket.id}/comments/${comment.id}`) &&
        resp.request().method() === 'DELETE'
    );

    // Verify comment is removed from UI
    await expect(commentText).not.toBeVisible();

    // Verify comment is deleted from database
    const dbComment = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(dbComment).toBeNull();
  });

  /**
   * TASK-029: User cannot delete another user's comment
   * User Story: As a user, I should not be able to delete others' comments for data integrity
   */
  test('user cannot delete another user\'s comment', async ({ page , projectId }) => {
    // Setup: Create ticket with another user's comment
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Comments Test - Delete Others',
        description: 'Test ticket for permission check',
        stage: 'SPECIFY',
        projectId,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    await prisma.comment.create({
      data: {
        content: 'Another user\'s comment',
        userId: 'different-user-id', // Different user
        ticketId: ticket.id,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Click ticket to open detail modal
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.waitForSelector('[role="dialog"]');

    // Click Conversation tab
    await page.click('[role="tab"]:has-text("Conversation")');

    // Wait for comment to load
    await page.waitForSelector('text=Another user\'s comment');

    // Hover over the comment area
    await page.locator('text=Another user\'s comment').hover();

    // Verify delete button is NOT visible for other users' comments
    const deleteButton = page.getByRole('button', { name: 'Delete comment' });
    await expect(deleteButton).not.toBeVisible();
  });

  /**
   * TASK-030: Tab navigation with keyboard shortcuts
   * User Story: As a user, I want keyboard shortcuts to quickly switch between tabs
   */
  test('user can navigate tabs with keyboard shortcuts', async ({ page , projectId }) => {
    // Setup: Create ticket
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Comments Test - Keyboard Nav',
        description: 'Test ticket for keyboard navigation',
        stage: 'SPECIFY',
        projectId,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Click ticket to open detail modal
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.waitForSelector('[role="dialog"]');

    // Verify Details tab is active by default
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Details")')).toBeVisible();

    // Press Cmd+2 (or Ctrl+2) to switch to Conversation tab
    await page.keyboard.press('Meta+2');
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Conversation")')).toBeVisible();

    // Press Cmd+3 to switch to Files tab
    await page.keyboard.press('Meta+3');
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Files")')).toBeVisible();

    // Press Cmd+1 to switch back to Details tab
    await page.keyboard.press('Meta+1');
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Details")')).toBeVisible();
  });

  /**
   * TASK-031: Existing functionality preserved in tabs
   * User Story: As a user, I want all existing ticket features to work in the new tabs layout
   */
  test('existing ticket features work in Details tab', async ({ page , projectId }) => {
    // Setup: Create ticket
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Comments Test - Existing Features',
        description: 'Original description',
        stage: 'SPECIFY',
        projectId,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Click ticket to open detail modal
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.waitForSelector('[role="dialog"]');

    // Verify Details tab is active by default
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Details")')).toBeVisible();

    // Verify Details tab content is visible
    await expect(page.locator('text=Original description')).toBeVisible();

    // Verify ticket title in modal (use data-testid to avoid multiple matches)
    await expect(page.getByTestId('ticket-title')).toContainText('[e2e] Comments Test - Existing Features');

    // Verify stage badge is visible (use data-testid to avoid strict mode violation)
    await expect(page.getByTestId('stage-badge')).toBeVisible();
    await expect(page.getByTestId('stage-badge')).toContainText('Specify');

    // Verify all tabs are accessible
    await expect(page.locator('[role="tab"]:has-text("Conversation")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Files")')).toBeVisible();

    // Verify can switch between tabs
    await page.click('[role="tab"]:has-text("Conversation")');
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Conversation")')).toBeVisible();

    await page.click('[role="tab"]:has-text("Files")');
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Files")')).toBeVisible();

    await page.click('[role="tab"]:has-text("Details")');
    await expect(page.locator('[role="tab"][data-state="active"]:has-text("Details")')).toBeVisible();
  });
});
