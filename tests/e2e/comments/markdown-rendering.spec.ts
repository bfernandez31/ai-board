/**
 * E2E Tests: Markdown Rendering in Comments
 *
 * Test markdown formatting in comment content:
 * - Bold, italic, code
 * - Links, lists
 * - Blockquotes
 * - Combined markdown with mentions
 */

import { test, expect } from '../../helpers/worker-isolation';
import { prisma } from '@/lib/db/client';
import { getProjectKey, getProjectGithub } from '../../helpers/db-cleanup';

const TEST_USER_EMAIL = 'test@e2e.local';

/**
 * Setup: Create test user, project, and ticket before each test
 */
test.beforeEach(async ({ page , projectId }) => {
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

  // Ensure test ticket exists
  const testTicket = await prisma.ticket.upsert({
    where: {
      projectId_ticketNumber: {
        projectId,
        ticketNumber: 1,
      }
    },
    update: {},
    create: {
      title: '[e2e] Test Ticket for Markdown Comments',
      description: 'Ticket for testing markdown rendering in comments',
      stage: 'INBOX',
      projectId,
      ticketNumber: 1,
      ticketKey: `${projectKey}-1`,
      updatedAt: new Date(),
    },
  });

  // Clean up existing comments
  await prisma.comment.deleteMany({
    where: { ticketId: testTicket.id },
  });

  // Navigate to board and open ticket modal
  await page.goto(`/projects/${projectId}/board`);

  // Click ticket to open detail modal
  await page.click(`[data-ticket-id="${testTicket.id}"]`);
  await page.waitForSelector('[role="dialog"]');

  // Click Conversation tab and wait for tab content to be visible
  await page.click('[role="tab"]:has-text("Conversation")');
  await page.waitForSelector('[role="tabpanel"]:visible');
});

/**
 * Cleanup: Remove test data after each test
 * Note: Comments are already cleaned up in beforeEach via cleanupDatabase
 */

/**
 * ======================
 * Markdown Formatting Tests
 * ======================
 */

test.describe('Markdown Rendering', () => {
  test('T001: Bold text should render with strong styling', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    // Type comment with bold markdown
    await commentInput.fill('This is **bold text** in a comment');

    // Submit comment
    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    // Wait for comment to appear
    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    // Verify bold text is rendered as strong element
    const strongElement = newComment.locator('strong');
    await expect(strongElement).toBeVisible();
    await expect(strongElement).toHaveText('bold text');

    // Verify markdown syntax is NOT visible
    await expect(newComment).not.toContainText('**');
  });

  test('T002: Italic text should render with em styling', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    await commentInput.fill('This is *italic text* in a comment');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    const emElement = newComment.locator('em');
    await expect(emElement).toBeVisible();
    await expect(emElement).toHaveText('italic text');
  });

  test('T003: Inline code should render with code element', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    await commentInput.fill('Use the `console.log()` function');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    const codeElement = newComment.locator('code');
    await expect(codeElement).toBeVisible();
    await expect(codeElement).toHaveText('console.log()');

    // Verify markdown syntax is NOT visible
    await expect(newComment.getByText('console.log()')).toBeVisible();
  });

  test('T004: Links should be clickable', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    await commentInput.fill('Check this [link](https://example.com)');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    const linkElement = newComment.locator('a[href="https://example.com"]');
    await expect(linkElement).toBeVisible();
    await expect(linkElement).toHaveText('link');
    await expect(linkElement).toHaveAttribute('target', '_blank');
  });

  test('T005: Unordered lists should render properly', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    await commentInput.fill('List:\n- Item 1\n- Item 2\n- Item 3');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    const ulElement = newComment.locator('ul');
    await expect(ulElement).toBeVisible();

    const listItems = ulElement.locator('li');
    await expect(listItems).toHaveCount(3);
    await expect(listItems.nth(0)).toHaveText('Item 1');
    await expect(listItems.nth(1)).toHaveText('Item 2');
    await expect(listItems.nth(2)).toHaveText('Item 3');
  });

  test('T006: Ordered lists should render properly', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    await commentInput.fill('Steps:\n1. First step\n2. Second step\n3. Third step');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    const olElement = newComment.locator('ol');
    await expect(olElement).toBeVisible();

    const listItems = olElement.locator('li');
    await expect(listItems).toHaveCount(3);
    await expect(listItems.nth(0)).toHaveText('First step');
    await expect(listItems.nth(1)).toHaveText('Second step');
    await expect(listItems.nth(2)).toHaveText('Third step');
  });

  test('T007: Blockquotes should render with proper styling', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    await commentInput.fill('> This is a quote\n> Second line');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    const blockquoteElement = newComment.locator('blockquote');
    await expect(blockquoteElement).toBeVisible();
    await expect(blockquoteElement).toContainText('This is a quote');
  });

  test('T008: Combined markdown formats should work together', async ({ page , projectId }) => {
    const commentInput = page.locator('textarea[placeholder*="Write a comment"]');

    await commentInput.fill('This has **bold** and *italic* and `code`');

    const submitButton = page.getByRole('button', { name: 'Comment', exact: true });
    await submitButton.click();

    const newComment = page.locator('[data-testid="comment-list"] [data-testid="comment-item"]').last();
    await expect(newComment).toBeVisible();

    // Verify all elements are present
    await expect(newComment.locator('strong')).toHaveText('bold');
    await expect(newComment.locator('em')).toHaveText('italic');
    await expect(newComment.locator('code')).toHaveText('code');
  });

});

/**
 * ======================
 * Timeline Comments Markdown Tests
 * ======================
 * NOTE: Timeline tab has been removed from the ticket modal.
 * Markdown rendering is now tested in the Conversation tab only.
 */
