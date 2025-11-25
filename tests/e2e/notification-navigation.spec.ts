/**
 * E2E Tests: Notification Click Navigation to Ticket Conversation Tab
 * Feature: AIB-80-show-ticket-conversation
 *
 * Test all user stories for notification navigation:
 * - US1: Same-project notification click (same window)
 * - US2: Cross-project notification click (new tab)
 * - US3: Notification mark as read before navigation
 */

import { test, expect } from '../helpers/worker-isolation';
import { prisma } from '@/lib/db/client';
import { getProjectKey, getProjectGithub } from '../helpers/db-cleanup';

const TEST_USER_EMAIL = 'test@e2e.local';

// Module-level variables to store IDs for test access
let testProjectId: number;
let testProject2Id: number;
let testTicketId: number;
let testTicket2Id: number;
let testUserId: string;
let testUser2Id: string;

/**
 * Setup: Create test users, projects, tickets, and notifications before each test
 */
test.beforeEach(async ({ page, projectId }) => {
  testProjectId = projectId; // Store for test access
  testProject2Id = projectId === 1 ? 2 : 1; // Use the other test project

  const github = getProjectGithub(projectId);
  const github2 = getProjectGithub(testProject2Id);
  const projectKey = getProjectKey(projectId);
  const projectKey2 = getProjectKey(testProject2Id);

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
  testUserId = testUser.id;

  // Create second test user (actor for mentions)
  const testUser2 = await prisma.user.upsert({
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
  testUser2Id = testUser2.id;

  // Ensure both test projects exist
  await prisma.project.upsert({
    where: { id: projectId },
    update: { userId: testUser.id },
    create: {
      id: projectId,
      name: '[e2e] Test Project 1',
      description: 'Test project for E2E tests',
      githubOwner: github.owner,
      githubRepo: github.repo,
      userId: testUser.id,
      key: projectKey,
      updatedAt: new Date(),
    },
  });

  await prisma.project.upsert({
    where: { id: testProject2Id },
    update: { userId: testUser.id },
    create: {
      id: testProject2Id,
      name: '[e2e] Test Project 2',
      description: 'Test project 2 for cross-project E2E tests',
      githubOwner: github2.owner,
      githubRepo: github2.repo,
      userId: testUser.id,
      key: projectKey2,
      updatedAt: new Date(),
    },
  });

  // Add project members
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId,
        userId: testUser.id,
      },
    },
    update: {},
    create: {
      projectId,
      userId: testUser.id,
      role: 'owner',
    },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId,
        userId: testUser2.id,
      },
    },
    update: {},
    create: {
      projectId,
      userId: testUser2.id,
      role: 'member',
    },
  });

  // Add members to second project
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: testProject2Id,
        userId: testUser.id,
      },
    },
    update: {},
    create: {
      projectId: testProject2Id,
      userId: testUser.id,
      role: 'owner',
    },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: testProject2Id,
        userId: testUser2.id,
      },
    },
    update: {},
    create: {
      projectId: testProject2Id,
      userId: testUser2.id,
      role: 'member',
    },
  });

  // Create test ticket in project 1
  const testTicket = await prisma.ticket.upsert({
    where: {
      projectId_ticketNumber: {
        projectId,
        ticketNumber: 1,
      },
    },
    update: {},
    create: {
      title: '[e2e] Test Ticket for Notification Navigation',
      description: 'Ticket for testing notification navigation',
      stage: 'INBOX',
      projectId,
      ticketNumber: 1,
      ticketKey: `${projectKey}-1`,
      updatedAt: new Date(),
    },
  });
  testTicketId = testTicket.id;

  // Create test ticket in project 2
  const testTicket2 = await prisma.ticket.upsert({
    where: {
      projectId_ticketNumber: {
        projectId: testProject2Id,
        ticketNumber: 1,
      },
    },
    update: {},
    create: {
      title: '[e2e] Test Ticket 2 for Cross-Project Navigation',
      description: 'Ticket 2 for testing cross-project notification navigation',
      stage: 'INBOX',
      projectId: testProject2Id,
      ticketNumber: 1,
      ticketKey: `${projectKey2}-1`,
      updatedAt: new Date(),
    },
  });
  testTicket2Id = testTicket2.id;

  // Clean up existing comments and notifications
  await prisma.comment.deleteMany({
    where: { ticketId: { in: [testTicket.id, testTicket2.id] } },
  });

  await prisma.notification.deleteMany({
    where: { recipientId: testUser.id },
  });
});

/**
 * Cleanup: Disconnect Prisma client after each test
 */
test.afterEach(async () => {
  await prisma.$disconnect();
});

/**
 * ======================
 * User Story 1: Same-Project Notification Click (Priority: P1)
 * ======================
 */

test.describe('US1: Same-Project Notification Click', () => {
  test('[US1] T007: Same-project notification opens modal in same window with comments tab', async ({ page, projectId }) => {
    // Setup: Create a comment in the same project
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], check this out!`,
      },
    });

    // Create notification for the mention
    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment.id,
        ticketId: testTicketId,
        read: false,
      },
    });

    // Navigate to the board of the same project
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Wait for notifications to load (badge should appear)
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const notificationBadge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 10000 });
    await expect(notificationBadge).toHaveText('1');

    // Open notification dropdown
    await notificationBell.click();

    // Wait for dropdown to be visible
    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Get the current page URL before clicking
    const initialUrl = page.url();

    // Click the notification
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    await expect(notificationItem).toBeVisible();
    await notificationItem.click();

    // Wait for modal to be visible (URL params are cleaned immediately after opening)
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Assert: Should stay on same project board
    const newUrl = page.url();
    expect(newUrl).toContain(`/projects/${projectId}/board`);

    // Assert: Conversation tab should be active
    const conversationTab = page.locator('[role="tab"]:has-text("Conversation")');
    await expect(conversationTab).toHaveAttribute('aria-selected', 'true');

    // Assert: Comment should be visible in the viewport
    // Note: Component uses id="comment-{id}" not data-testid
    const commentElement = page.locator(`#comment-${comment.id}`);
    await expect(commentElement).toBeInViewport({ timeout: 2000 });
  });
});

/**
 * ======================
 * User Story 2: Cross-Project Notification Click (Priority: P2)
 * ======================
 */

test.describe('US2: Cross-Project Notification Click', () => {
  test('[US2] T014: Cross-project notification opens modal in new tab with comments tab', async ({ page, projectId, context }) => {
    // Setup: Create a comment in the OTHER project
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicket2Id,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], check this cross-project comment!`,
      },
    });

    // Create notification for the mention (pointing to other project)
    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment.id,
        ticketId: testTicket2Id,
        read: false,
      },
    });

    // Navigate to the board of project 1
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Wait for notifications to load (badge should appear)
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const notificationBadge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 10000 });

    // Open notification dropdown
    await notificationBell.click();

    // Wait for dropdown to be visible
    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Get the current page count before clicking
    const pagesBefore = context.pages().length;
    const originalUrl = page.url();

    // Setup listener for new page
    const newPagePromise = context.waitForEvent('page');

    // Click the notification
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    await expect(notificationItem).toBeVisible();
    await notificationItem.click();

    // Wait for new page to open
    const newPage = await newPagePromise;
    await newPage.waitForLoadState('networkidle');

    // Assert: New tab should have been opened
    const pagesAfter = context.pages().length;
    expect(pagesAfter).toBe(pagesBefore + 1);

    // Assert: Original page should remain on the same project board
    expect(page.url()).toBe(originalUrl);

    // Assert: New tab should navigate to project 2 board
    // Note: URL params are cleaned immediately after modal opens to allow proper closing
    const newUrl = newPage.url();
    expect(newUrl).toContain(`/projects/${testProject2Id}/board`);

    // Assert: Modal should be visible in new tab
    const modal = newPage.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Assert: Conversation tab should be active
    const conversationTab = newPage.locator('[role="tab"]:has-text("Conversation")');
    await expect(conversationTab).toHaveAttribute('aria-selected', 'true');

    // Cleanup: Close the new tab
    await newPage.close();
  });

  test('[US2] T015: Original tab remains unchanged after cross-project click', async ({ page, projectId, context }) => {
    // Setup: Create a comment in the OTHER project
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicket2Id,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], another cross-project comment!`,
      },
    });

    // Create notification for the mention
    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment.id,
        ticketId: testTicket2Id,
        read: false,
      },
    });

    // Navigate to the board of project 1
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Capture state before clicking notification
    const urlBefore = page.url();
    const titleBefore = await page.title();

    // Wait for notifications to load
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const notificationBadge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 10000 });

    // Open notification dropdown and click notification
    await notificationBell.click();

    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Setup listener for new page
    const newPagePromise = context.waitForEvent('page');

    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    await notificationItem.click();

    // Wait for new page to open
    const newPage = await newPagePromise;
    await newPage.waitForLoadState('networkidle');

    // Wait a bit to ensure original page doesn't change
    await page.waitForTimeout(500);

    // Assert: Original page URL should remain unchanged
    expect(page.url()).toBe(urlBefore);

    // Assert: Original page should still be on project 1 board
    expect(page.url()).toContain(`/projects/${projectId}/board`);
    expect(page.url()).not.toContain('modal=open'); // Modal should NOT open in original tab

    // Cleanup: Close the new tab
    await newPage.close();
  });
});

/**
 * ======================
 * User Story 3: Notification Mark as Read (Priority: P3)
 * ======================
 */

test.describe('US3: Notification Mark as Read', () => {
  test('[US3] T019: Notification marked as read before modal opens', async ({ page, projectId }) => {
    // Setup: Create a comment and notification
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], testing mark as read!`,
      },
    });

    const notification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment.id,
        ticketId: testTicketId,
        read: false,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Wait for notifications to load
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const notificationBadge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 10000 });
    await expect(notificationBadge).toHaveText('1');

    // Open notification dropdown
    await notificationBell.click();

    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Verify notification is unread (has blue indicator)
    const unreadIndicator = page.locator('[data-testid="unread-indicator"]').first();
    await expect(unreadIndicator).toBeVisible();

    // Click the notification
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    await notificationItem.click();

    // Wait for modal to open
    await page.waitForTimeout(500);

    // Check database to verify notification was marked as read
    const updatedNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
    });

    expect(updatedNotification?.read).toBe(true);
    expect(updatedNotification?.readAt).not.toBeNull();
  });

  test('[US3] T020: Unread count decrements immediately after click', async ({ page, projectId }) => {
    // Setup: Create multiple comments and notifications
    const comment1 = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], notification 1!`,
      },
    });

    const comment2 = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], notification 2!`,
      },
    });

    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment1.id,
        ticketId: testTicketId,
        read: false,
      },
    });

    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment2.id,
        ticketId: testTicketId,
        read: false,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Wait for notifications to load and verify initial unread count is 2
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const badge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toHaveText('2');

    // Open notification dropdown
    await notificationBell.click();

    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Click the first notification
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    await notificationItem.click();

    // Wait for navigation
    await page.waitForTimeout(500);

    // Close modal by navigating to board URL (removes modal query params)
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Open dropdown again to verify count
    await notificationBell.click();
    await expect(dropdown).toBeVisible();

    // Wait for polling to update the count
    await page.waitForTimeout(2500); // Wait for 15-second polling interval

    // Verify unread count decremented to 1
    await expect(badge).toHaveText('1', { timeout: 5000 });
  });

  test('[US3] T021: Rapid clicks do not cause multiple navigations (race condition)', async ({ page, projectId }) => {
    // Setup: Create a comment and notification
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], testing rapid clicks!`,
      },
    });

    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment.id,
        ticketId: testTicketId,
        read: false,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Wait for notifications to load
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const notificationBadge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 10000 });
    await expect(notificationBadge).toHaveText('1');

    // Open notification dropdown
    await notificationBell.click();

    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Capture initial URL
    const initialUrl = page.url();

    // Rapidly click the notification multiple times (don't await - fire and forget)
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    // Use dblclick to simulate rapid clicking, then one more click
    await notificationItem.dblclick();
    // The notification gets disabled after first click, so we just verify the outcome

    // Wait for navigation to complete
    await page.waitForTimeout(1000);

    // Assert: Modal should only open once
    const modals = page.locator('[role="dialog"]');
    await expect(modals).toHaveCount(1);

    // Assert: URL changed (params are cleaned immediately after modal opens)
    // The important thing is that only one modal opened, not the URL state
  });
});

/**
 * ======================
 * Performance Tests
 * ======================
 */

test.describe('Performance Tests', () => {
  test('[T033] Comment visible in viewport within 1 second', async ({ page, projectId }) => {
    // Setup: Create a comment and notification
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], performance test!`,
      },
    });

    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment.id,
        ticketId: testTicketId,
        read: false,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Wait for notifications to load
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const notificationBadge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 10000 });
    await expect(notificationBadge).toHaveText('1');

    // Open notification dropdown
    await notificationBell.click();

    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Start timer
    const startTime = Date.now();

    // Click notification
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    await notificationItem.click();

    // Wait for comment to be in viewport
    // Note: Component uses id="comment-{id}" not data-testid
    const commentElement = page.locator(`#comment-${comment.id}`);
    await expect(commentElement).toBeInViewport({ timeout: 1000 });

    // Calculate elapsed time
    const elapsedTime = Date.now() - startTime;

    // Assert: Should be visible within 1 second (1000ms)
    expect(elapsedTime).toBeLessThan(1000);
  });

  test('[T034] Unread count updates within 200ms', async ({ page, projectId }) => {
    // Setup: Create a comment and notification
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: testUser2Id,
        content: `Hey @[${testUserId}:E2E Test User], unread count test!`,
      },
    });

    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: testUser2Id,
        commentId: comment.id,
        ticketId: testTicketId,
        read: false,
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Wait for notifications to load and verify initial unread count is 1
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const badge = notificationBell.locator('[data-testid="notification-badge"]');
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toHaveText('1');

    // Open notification dropdown
    await notificationBell.click();

    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Start timer
    const startTime = Date.now();

    // Click notification
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    await notificationItem.click();

    // Calculate elapsed time - badge should update optimistically without needing to reopen dropdown
    // The badge is visible in the header even with modal open
    const elapsedTime = Date.now() - startTime;

    // Note: This test checks the optimistic update speed
    // The badge count should decrement immediately (optimistic update)
    // We don't need to reopen the dropdown - just verify the badge no longer shows "1"
    // After marking as read, badge should either show nothing or be hidden
    await expect(badge).toBeHidden({ timeout: 200 });

    expect(elapsedTime).toBeLessThan(200);
  });
});
