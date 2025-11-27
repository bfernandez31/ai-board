/**
 * E2E Tests: Notification Bell Mobile Visibility
 * Feature: AIB-82-display-the-bell
 *
 * Test that the notification bell is visible on mobile viewports
 */

import { test, expect } from '../helpers/worker-isolation';
import { prisma } from '@/lib/db/client';
import { getProjectKey, getProjectGithub } from '../helpers/db-cleanup';

const TEST_USER_EMAIL = 'test@e2e.local';

/**
 * Setup: Create test user and project before each test
 */
test.beforeEach(async ({ projectId }) => {
  const github = getProjectGithub(projectId);
  const projectKey = getProjectKey(projectId);

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

  // Ensure test project exists
  await prisma.project.upsert({
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

  // Add project member
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
});

/**
 * Cleanup: Disconnect Prisma client after each test
 */
test.afterEach(async () => {
  await prisma.$disconnect();
});

/**
 * Test: Notification bell is visible on mobile viewport
 */
test.describe('Notification Bell Mobile Visibility', () => {
  test('Notification bell is visible on mobile viewport (375px width)', async ({ page, projectId }) => {
    // Set viewport to mobile size (iPhone SE width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to the project board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Verify notification bell is visible
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toBeVisible({ timeout: 5000 });

    // Verify it's clickable (not hidden or covered)
    await expect(notificationBell).toBeEnabled();

    // Verify the bell icon is present
    const bellIcon = notificationBell.locator('svg');
    await expect(bellIcon).toBeVisible();
  });

  test('Notification bell is visible on tablet viewport (768px width)', async ({ page, projectId }) => {
    // Set viewport to tablet size (iPad Mini width)
    await page.setViewportSize({ width: 768, height: 1024 });

    // Navigate to the project board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Verify notification bell is visible
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toBeVisible({ timeout: 5000 });
  });

  test('Notification bell is visible on desktop viewport (1920px width)', async ({ page, projectId }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Navigate to the project board
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');

    // Verify notification bell is visible
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toBeVisible({ timeout: 5000 });
  });
});
