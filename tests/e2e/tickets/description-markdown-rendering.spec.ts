/**
 * E2E Tests: Markdown Rendering in Ticket Descriptions
 * Feature: AIB-85-markdown-rendering-for
 *
 * Test markdown formatting in ticket description content:
 * - Bold, italic, code
 * - Links, lists
 * - Blockquotes
 * - Headers
 */

import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient, getProjectKey } from '../../helpers/db-cleanup';

const TEST_USER_EMAIL = 'test@e2e.local';

test.describe('Ticket Description Markdown Rendering', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test
    await cleanupDatabase(projectId);

    // Create test user
    await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: {},
      create: {
        id: 'test-user-id',
        email: TEST_USER_EMAIL,
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update worker project
    await prisma.project.update({
      where: { id: projectId },
      data: {
        userId: 'test-user-id',
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T001: Bold text is rendered correctly
   */
  test('renders bold text with **bold**', async ({ page, request, projectId }) => {
    // Create ticket with bold markdown
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Bold Description',
        description: 'This is **bold text** in the description.',
      },
    });

    // Navigate to board and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Find description area
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');
    await expect(descriptionArea).toBeVisible();

    // Check for bold rendering (should be a <strong> tag)
    const boldText = descriptionArea.locator('strong');
    await expect(boldText).toBeVisible();
    await expect(boldText).toHaveText('bold text');
  });

  /**
   * T002: Italic text is rendered correctly
   */
  test('renders italic text with *italic*', async ({ page, request, projectId }) => {
    // Create ticket with italic markdown
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Italic Description',
        description: 'This is *italic text* in the description.',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check for italic rendering (should be an <em> tag)
    const italicText = descriptionArea.locator('em');
    await expect(italicText).toBeVisible();
    await expect(italicText).toHaveText('italic text');
  });

  /**
   * T003: Inline code is rendered correctly
   */
  test('renders inline code with `code`', async ({ page, request, projectId }) => {
    // Create ticket with inline code
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Code Description',
        description: 'This is `inline code` in the description.',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check for code rendering (should be a <code> tag)
    const codeText = descriptionArea.locator('code');
    await expect(codeText).toBeVisible();
    await expect(codeText).toHaveText('inline code');
  });

  /**
   * T004: Links are rendered correctly
   */
  test('renders links with [text](url)', async ({ page, request, projectId }) => {
    // Create ticket with link
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Link Description',
        description: 'Visit [Google](https://google.com) for search.',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check for link rendering
    const link = descriptionArea.locator('a[href="https://google.com"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('Google');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  /**
   * T005: Unordered lists are rendered correctly
   */
  test('renders unordered lists with - items', async ({ page, request, projectId }) => {
    // Create ticket with unordered list
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with List Description',
        description: 'Todo:\n- First item\n- Second item\n- Third item',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check for list rendering
    const list = descriptionArea.locator('ul');
    await expect(list).toBeVisible();

    // Check list items
    const listItems = list.locator('li');
    await expect(listItems).toHaveCount(3);
    await expect(listItems.nth(0)).toContainText('First item');
    await expect(listItems.nth(1)).toContainText('Second item');
    await expect(listItems.nth(2)).toContainText('Third item');
  });

  /**
   * T006: Ordered lists are rendered correctly
   */
  test('renders ordered lists with 1. items', async ({ page, request, projectId }) => {
    // Create ticket with ordered list
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Numbered List',
        description: 'Steps:\n1. First step\n2. Second step\n3. Third step',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check for ordered list rendering
    const list = descriptionArea.locator('ol');
    await expect(list).toBeVisible();

    const listItems = list.locator('li');
    await expect(listItems).toHaveCount(3);
  });

  /**
   * T007: Blockquotes are rendered correctly
   */
  test('renders blockquotes with > prefix', async ({ page, request, projectId }) => {
    // Create ticket with blockquote
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Blockquote',
        description: '> This is a quoted text\n> on multiple lines',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check for blockquote rendering
    const blockquote = descriptionArea.locator('blockquote');
    await expect(blockquote).toBeVisible();
    await expect(blockquote).toContainText('This is a quoted text');
  });

  /**
   * T008: Combined markdown formatting works
   */
  test('renders combined markdown formatting', async ({ page, request, projectId }) => {
    // Create ticket with multiple markdown elements
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Combined Markdown',
        description: '**Bold** and *italic* with `code` and [link](https://example.com)',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check all elements are present
    await expect(descriptionArea.locator('strong')).toHaveText('Bold');
    await expect(descriptionArea.locator('em')).toHaveText('italic');
    await expect(descriptionArea.locator('code')).toHaveText('code');
    await expect(descriptionArea.locator('a')).toHaveText('link');
  });

  /**
   * T009: Plain text without markdown still renders
   */
  test('renders plain text without markdown correctly', async ({ page, request, projectId }) => {
    // Create ticket with plain text
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Plain Text',
        description: 'This is just plain text without any markdown formatting.',
      },
    });

    // Navigate and open ticket
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Check text is displayed
    await expect(descriptionArea).toContainText('This is just plain text without any markdown formatting.');
  });

});
