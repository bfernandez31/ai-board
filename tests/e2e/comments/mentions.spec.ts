/**
 * E2E Tests: User Mentions in Comments
 *
 * Test all user stories for mention functionality:
 * - US1: Basic autocomplete (type @, see users, filter, select)
 * - US2: Keyboard navigation (arrow keys, Enter, Escape)
 * - US3: Multiple mentions in one comment
 * - US4: Persistence and deleted user handling
 */

import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/client';

const TEST_USER_EMAIL = 'test@e2e.local';
const TEST_PROJECT_ID = 1;
const TEST_TICKET_ID = 1;

/**
 * Setup: Create test user, project, and ticket before each test
 */
test.beforeEach(async ({ page }) => {
  // Create test user (project owner)
  const testUser = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: {
      id: 'test-user-id',
      name: 'E2E Test User',
    },
    create: {
      id: 'test-user-id',
      email: TEST_USER_EMAIL,
      name: 'E2E Test User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  // Create additional test users for multi-user mentions
  const user2 = await prisma.user.upsert({
    where: { email: 'alice@test.com' },
    update: {
      id: 'user-alice',
      name: 'Alice Smith',
    },
    create: {
      id: 'user-alice',
      email: 'alice@test.com',
      name: 'Alice Smith',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'bob@test.com' },
    update: {
      id: 'user-bob',
      name: 'Bob Johnson',
    },
    create: {
      id: 'user-bob',
      email: 'bob@test.com',
      name: 'Bob Johnson',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  // Ensure test project exists
  await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: { userId: testUser.id },
    create: {
      id: TEST_PROJECT_ID,
      name: '[e2e] Test Project',
      description: 'Test project for E2E tests',
      githubOwner: 'test',
      githubRepo: 'test',
      userId: testUser.id,
      updatedAt: new Date(),
    },
  });

  // Add project members
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: TEST_PROJECT_ID,
        userId: testUser.id,
      },
    },
    update: {},
    create: {
      projectId: TEST_PROJECT_ID,
      userId: testUser.id,
      role: 'owner',
    },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: TEST_PROJECT_ID,
        userId: user2.id,
      },
    },
    update: {},
    create: {
      projectId: TEST_PROJECT_ID,
      userId: user2.id,
      role: 'member',
    },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: TEST_PROJECT_ID,
        userId: user3.id,
      },
    },
    update: {},
    create: {
      projectId: TEST_PROJECT_ID,
      userId: user3.id,
      role: 'member',
    },
  });

  // Ensure test ticket exists
  await prisma.ticket.upsert({
    where: { id: TEST_TICKET_ID },
    update: { projectId: TEST_PROJECT_ID },
    create: {
      id: TEST_TICKET_ID,
      title: '[e2e] Test Ticket for Mentions',
      description: 'Ticket for testing mention functionality',
      stage: 'INBOX',
      projectId: TEST_PROJECT_ID,
      updatedAt: new Date(),
    },
  });

  // Clean up existing comments
  await prisma.comment.deleteMany({
    where: { ticketId: TEST_TICKET_ID },
  });

  // Navigate to board and open ticket modal
  await page.goto(`/projects/${TEST_PROJECT_ID}/board`);

  // Click ticket to open detail modal
  await page.click(`[data-ticket-id="${TEST_TICKET_ID}"]`);
  await page.waitForSelector('[role="dialog"]');

  // Click Comments tab and wait for tab content to be visible
  await page.click('[role="tab"]:has-text("Comments")');
  await page.waitForSelector('[role="tabpanel"]:visible');
});

/**
 * Cleanup: Remove test data after each test
 */
test.afterEach(async () => {
  await prisma.comment.deleteMany({
    where: { ticketId: TEST_TICKET_ID },
  });
});

/**
 * ======================
 * User Story 1: Basic Mention Autocomplete
 * ======================
 */

test.describe('US1: Basic Mention Autocomplete', () => {
  test('[US1] T011: Typing @ opens autocomplete dropdown', async ({ page }) => {
    // Find comment input field
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');
    await expect(commentInput).toBeVisible();

    // Type @ to trigger autocomplete
    await commentInput.fill('@');

    // Verify autocomplete dropdown is visible
    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    // Verify dropdown contains all 3 project members
    const userItems = autocomplete.locator('[data-testid="mention-user-item"]');
    await expect(userItems).toHaveCount(3); // E2E Test User, Alice Smith, Bob Johnson
  });

  test('[US1] T012: Typing letters after @ filters user list', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');
    await commentInput.fill('@');

    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    // Get initial user count (should be 3)
    const userItems = autocomplete.locator('[data-testid="mention-user-item"]');
    await expect(userItems).toHaveCount(3);

    // Type partial name "ali" (matches "Alice Smith")
    await commentInput.fill('@ali');

    // Verify filtering works - only Alice should be shown
    await expect(userItems).toHaveCount(1);
    await expect(userItems.first()).toContainText('Alice');

    // Type non-matching text
    await commentInput.fill('@nonexistentuser');

    // Verify no users shown
    await expect(userItems).toHaveCount(0);
  });

  test('[US1] T013: Clicking user in dropdown inserts mention', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');
    await commentInput.fill('@');

    // Wait for autocomplete
    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    // Click first user in list
    const firstUser = autocomplete.locator('[data-testid="mention-user-item"]').first();
    await firstUser.click();

    // Verify mention markup is inserted
    const inputValue = await commentInput.inputValue();
    expect(inputValue).toMatch(/@\[.+:.+\]/); // Format: @[userId:displayName]

    // Verify autocomplete closes
    await expect(autocomplete).not.toBeVisible();
  });

  test('[US1] T014: Submitted comment with mention is saved and displayed with formatting', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    // Insert mention
    await commentInput.fill('@');
    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    const firstUser = autocomplete.locator('[data-testid="mention-user-item"]').first();
    await firstUser.click();

    // Add text after mention
    await commentInput.press('End');
    await commentInput.type(' can you review?');

    // Submit comment
    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.waitFor({ state: 'visible' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for comment to appear in list
    const commentList = page.locator('[data-testid="comment-list"]');
    const newComment = commentList.locator('[data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    // Verify mention is displayed with formatting (not raw markup)
    await expect(newComment).toContainText('E2E Test User'); // User name visible
    await expect(newComment).not.toContainText('@['); // Raw markup NOT visible

    // Verify mention chip/badge exists
    const mentionChip = newComment.locator('[data-testid="mention-chip"]');
    await expect(mentionChip).toBeVisible();
  });
});

/**
 * ======================
 * User Story 2: Keyboard Navigation
 * ======================
 */

test.describe('US2: Keyboard Navigation', () => {
  test('[US2] T024: Arrow Down key highlights next user', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');
    await commentInput.fill('@');

    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    // Initially no user highlighted (or first one)
    const highlightedUser = autocomplete.locator('[data-selected="true"]');

    // Press Arrow Down
    await commentInput.press('ArrowDown');

    // Verify user is highlighted
    await expect(highlightedUser).toBeVisible();
  });

  test('[US2] T025: Arrow Up key highlights previous user', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');
    await commentInput.fill('@');

    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    // Press Arrow Down twice
    await commentInput.press('ArrowDown');
    await commentInput.press('ArrowDown');

    // Press Arrow Up
    await commentInput.press('ArrowUp');

    // Verify highlight moved up (test implementation will track selected index)
    const highlightedUser = autocomplete.locator('[data-selected="true"]');
    await expect(highlightedUser).toBeVisible();
  });

  test('[US2] T026: Enter key selects highlighted user', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');
    await commentInput.fill('@');

    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    // Highlight user with Arrow Down
    await commentInput.press('ArrowDown');

    // Press Enter to select
    await commentInput.press('Enter');

    // Verify mention is inserted
    const inputValue = await commentInput.inputValue();
    expect(inputValue).toMatch(/@\[.+:.+\]/);

    // Verify autocomplete closes
    await expect(autocomplete).not.toBeVisible();
  });

  test('[US2] T027: Escape key closes dropdown without inserting mention', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');
    await commentInput.fill('@');

    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();

    // Press Escape
    await commentInput.press('Escape');

    // Verify autocomplete closes
    await expect(autocomplete).not.toBeVisible();

    // Verify no mention inserted (just @ remains)
    const inputValue = await commentInput.inputValue();
    expect(inputValue).toBe('@');
  });
});

/**
 * ======================
 * User Story 3: Multiple Mentions
 * ======================
 */

test.describe('US3: Multiple Mentions', () => {
  test('[US3] T033: Typing @ after existing mention opens new autocomplete', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    // Insert first mention
    await commentInput.fill('@');
    let autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await expect(autocomplete).toBeVisible();
    await autocomplete.locator('[data-testid="mention-user-item"]').first().click();

    // Type text after first mention
    await commentInput.press('End');
    await commentInput.type(' and ');

    // Type @ again
    await commentInput.type('@');

    // Verify autocomplete opens again
    await expect(autocomplete).toBeVisible();
  });

  test('[US3] T034: Submitting comment with multiple mentions saves all mentions', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    // Insert first mention
    await commentInput.fill('@');
    let autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await autocomplete.locator('[data-testid="mention-user-item"]').first().click();

    // Add text and second mention
    await commentInput.press('End');
    await commentInput.type(' and @');
    await autocomplete.locator('[data-testid="mention-user-item"]').first().click();

    // Submit comment
    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.waitFor({ state: 'visible' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Verify comment appears
    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    // Verify both mentions are displayed
    const mentionChips = newComment.locator('[data-testid="mention-chip"]');
    await expect(mentionChips).toHaveCount(2);
  });

  test('[US3] T035: Viewing comment with multiple mentions displays all mentions formatted', async ({ page }) => {
    // Create comment with multiple mentions via API
    const testUser = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
    });

    await prisma.comment.create({
      data: {
        ticketId: TEST_TICKET_ID,
        userId: testUser!.id,
        content: `Hey @[${testUser!.id}:E2E User] and @[${testUser!.id}:Test User], check this!`,
      },
    });

    // Reload page to verify persistence
    await page.reload();

    // Re-open ticket modal and comments tab after reload
    await page.click(`[data-ticket-id="${TEST_TICKET_ID}"]`);
    await page.waitForSelector('[role="dialog"]');
    await page.click('[role="tab"]:has-text("Comments")');
    await page.waitForSelector('[role="tabpanel"]:visible');

    // Verify both mentions are displayed
    const comment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    const mentionChips = comment.locator('[data-testid="mention-chip"]');
    await expect(mentionChips).toHaveCount(2);
  });
});

/**
 * ======================
 * User Story 4: Persistence and Edge Cases
 * ======================
 */

test.describe('US4: Mention Persistence and Display', () => {
  test('[US4] T040: Mentions remain formatted after page reload', async ({ page }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    // Create comment with mention
    await commentInput.fill('@');
    const autocomplete = page.locator('[data-testid="mention-autocomplete"]');
    await autocomplete.locator('[data-testid="mention-user-item"]').first().click();

    await commentInput.press('End');
    await commentInput.type(' check this');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.waitFor({ state: 'visible' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for comment to appear
    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    // Reload page to verify persistence
    await page.reload();

    // Re-open ticket modal and comments tab after reload
    await page.click(`[data-ticket-id="${TEST_TICKET_ID}"]`);
    await page.waitForSelector('[role="dialog"]');
    await page.click('[role="tab"]:has-text("Comments")');
    await page.waitForSelector('[role="tabpanel"]:visible');

    // Verify mention still formatted
    const mentionChip = page.locator('[data-testid="comment-list"] [data-testid="mention-chip"]').last();
    await expect(mentionChip).toBeVisible();
    await expect(mentionChip).toContainText('Alice Smith');
  });

  test('[US4] T041: Hovering over mention shows user details tooltip', async ({ page }) => {
    // Create comment with mention via API
    const testUser = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
    });

    await prisma.comment.create({
      data: {
        ticketId: TEST_TICKET_ID,
        userId: testUser!.id,
        content: `Hey @[${testUser!.id}:E2E Test User], check this!`,
      },
    });

    await page.reload();

    // Re-open ticket modal and comments tab after reload
    await page.click(`[data-ticket-id="${TEST_TICKET_ID}"]`);
    await page.waitForSelector('[role="dialog"]');
    await page.click('[role="tab"]:has-text("Comments")');
    await page.waitForSelector('[role="tabpanel"]:visible');

    // Hover over mention
    const mentionChip = page.locator('[data-testid="mention-chip"]').first();
    await mentionChip.hover();

    // Verify tooltip shows user details
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(TEST_USER_EMAIL); // Email shown in tooltip
  });

  test('[US4] T042: Deleted user mention displays "[Removed User]"', async ({ page }) => {
    // Create another user
    const tempUser = await prisma.user.create({
      data: {
        id: 'temp-user-deleted',
        email: 'temp-deleted@e2e.local',
        name: 'Temp User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create comment mentioning temp user
    const testUser = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
    });

    await prisma.comment.create({
      data: {
        ticketId: TEST_TICKET_ID,
        userId: testUser!.id,
        content: `Hey @[${tempUser.id}:Temp User], check this!`,
      },
    });

    // Delete the temp user
    await prisma.user.delete({
      where: { id: tempUser.id },
    });

    // Reload page
    await page.reload();

    // Re-open ticket modal and comments tab after reload
    await page.click(`[data-ticket-id="${TEST_TICKET_ID}"]`);
    await page.waitForSelector('[role="dialog"]');
    await page.click('[role="tab"]:has-text("Comments")');
    await page.waitForSelector('[role="tabpanel"]:visible');

    // Verify mention shows "[Removed User]"
    const comment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(comment).toContainText('[Removed User]');

    // Verify raw markup is NOT visible
    await expect(comment).not.toContainText('@[');
  });
});
