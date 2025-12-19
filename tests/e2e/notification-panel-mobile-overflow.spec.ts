/**
 * E2E Tests: Notification Panel Mobile Overflow Fix
 * Feature: AIB-113-fix-notification-panel
 *
 * Test that the notification panel doesn't overflow on mobile viewports
 * and properly scrolls when there are many notifications
 */

import { test, expect } from '../helpers/worker-isolation';
import { prisma } from '@/lib/db/client';
import { getProjectKey, getProjectGithub } from '../helpers/db-cleanup';

const TEST_USER_EMAIL = 'test@e2e.local';
const ACTOR_EMAIL = 'actor@e2e.local';

/**
 * Setup: Create test user, project, and notifications before each test
 */
test.beforeEach(async ({ projectId }) => {
  const github = getProjectGithub(projectId);
  const projectKey = getProjectKey(projectId);

  // Create test user (recipient)
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

  // Create actor user (who creates notifications)
  const actorUser = await prisma.user.upsert({
    where: { email: ACTOR_EMAIL },
    update: {
      id: 'actor-user-id',
      name: 'Actor User',
    },
    create: {
      id: 'actor-user-id',
      email: ACTOR_EMAIL,
      name: 'Actor User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  // Ensure test project exists
  const project = await prisma.project.upsert({
    where: { id: projectId },
    update: { userId: testUser.id },
    create: {
      id: projectId,
      name: '[e2e] Test Project',
      description: 'Test project for E2E tests',
      githubOwner: github.owner,
      githubRepo: github.repo,
      userId: testUser.id,
      key: projectKey,
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
        userId: actorUser.id,
      },
    },
    update: {},
    create: {
      projectId,
      userId: actorUser.id,
      role: 'member',
    },
  });

  // Create a test ticket
  const ticket = await prisma.ticket.create({
    data: {
      ticketKey: `${projectKey}-1`,
      ticketNumber: 1,
      title: '[e2e] Test Ticket for Notifications',
      description: 'Test ticket',
      stage: 'INBOX',
      projectId,
    },
  });

  // Create a test comment
  const comment = await prisma.comment.create({
    data: {
      ticketId: ticket.id,
      userId: actorUser.id,
      content: 'Test comment with @mention',
    },
  });

  // Create multiple notifications to test scrolling (10 notifications)
  for (let i = 0; i < 10; i++) {
    await prisma.notification.create({
      data: {
        recipientId: testUser.id,
        actorId: actorUser.id,
        commentId: comment.id,
        ticketId: ticket.id,
        read: false,
      },
    });
  }
});

/**
 * Cleanup: Disconnect Prisma client after each test
 */
test.afterEach(async () => {
  await prisma.$disconnect();
});

/**
 * Test: Notification panel doesn't overflow on mobile
 */
test.describe('Notification Panel Mobile Overflow', () => {
  test('Notification panel fits within mobile viewport (375px width)', async ({ page, projectId }) => {
    // Set viewport to mobile size (iPhone SE width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to the project board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Click the notification bell to open the dropdown
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await notificationBell.click();

    // Wait for dropdown to be visible
    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Get the dropdown's bounding box
    const dropdownBox = await dropdown.boundingBox();
    expect(dropdownBox).not.toBeNull();

    // Verify dropdown doesn't extend beyond viewport width
    // Account for some padding/margin (20px on each side)
    if (dropdownBox) {
      expect(dropdownBox.x).toBeGreaterThanOrEqual(0);
      expect(dropdownBox.x + dropdownBox.width).toBeLessThanOrEqual(375);
    }

    // Verify the dropdown is properly scrollable
    const scrollArea = dropdown.locator('[data-radix-scroll-area-viewport]');
    await expect(scrollArea).toBeVisible();

    // The content area should be visible (even if empty or has notifications)
    // The important part is that the dropdown doesn't overflow the viewport

    // Verify the scroll container has limited height
    const scrollBox = await scrollArea.boundingBox();
    expect(scrollBox).not.toBeNull();
    if (scrollBox) {
      // Max height should be reasonable for mobile (not exceeding 400px)
      expect(scrollBox.height).toBeLessThanOrEqual(400);
    }
  });

  test('Notification panel has proper scroll area on mobile', async ({ page, projectId }) => {
    // Set viewport to mobile size (iPhone SE width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to the project board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Click the notification bell to open the dropdown
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await notificationBell.click();

    // Wait for dropdown to be visible
    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Get the scroll area
    const scrollArea = dropdown.locator('[data-radix-scroll-area-viewport]');
    await expect(scrollArea).toBeVisible();

    // Verify the scroll area has a bounded height (should use viewport-relative height)
    const scrollBox = await scrollArea.boundingBox();
    expect(scrollBox).not.toBeNull();
    if (scrollBox) {
      // On mobile (667px height), the max-h-[calc(100vh-200px)] should result in max 467px
      expect(scrollBox.height).toBeLessThanOrEqual(467);
    }
  });

  test('Notification panel fits within small mobile viewport (320px width)', async ({ page, projectId }) => {
    // Set viewport to very small mobile size (iPhone 5/SE in portrait)
    await page.setViewportSize({ width: 320, height: 568 });

    // Navigate to the project board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Click the notification bell to open the dropdown
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await notificationBell.click();

    // Wait for dropdown to be visible
    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Get the dropdown's bounding box
    const dropdownBox = await dropdown.boundingBox();
    expect(dropdownBox).not.toBeNull();

    // Verify dropdown doesn't extend beyond viewport width
    if (dropdownBox) {
      expect(dropdownBox.x).toBeGreaterThanOrEqual(0);
      expect(dropdownBox.x + dropdownBox.width).toBeLessThanOrEqual(320);
    }
  });
});
