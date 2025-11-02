import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';

/**
 * E2E Tests for Ticket Description Line Break Preservation
 * Feature: 037-887-ticket-description
 *
 * IMPORTANT: These tests follow TDD approach
 * They test that line breaks in ticket descriptions are preserved in view mode
 */

test.describe('Ticket Description Line Break Preservation', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test
    await cleanupDatabase(projectId);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T001: Line breaks in description are preserved in view mode
   */
  test('preserves line breaks in ticket description view mode', async ({ page, request , projectId }) => {
    // Create ticket with multi-line description
    const descriptionWithLineBreaks = 'First line of description\nSecond line of description\nThird line of description';

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Multi-line Description',
        description: descriptionWithLineBreaks,
      },
    });

    expect(response.ok()).toBe(true);

    // Navigate to board and open ticket detail modal
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Find description area (view mode, not editing)
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');
    await expect(descriptionArea).toBeVisible();

    // Get the text content
    const displayedText = await descriptionArea.textContent();

    // Verify that the text contains all three lines
    expect(displayedText).toContain('First line of description');
    expect(displayedText).toContain('Second line of description');
    expect(displayedText).toContain('Third line of description');

    // Check that the description uses whitespace: pre-wrap or similar to preserve line breaks
    // The description area has two child divs: first is the edit icon, second is the actual text
    const descriptionDiv = descriptionArea.locator('div').nth(1);

    const whiteSpace = await descriptionDiv.evaluate((el) => {
      return window.getComputedStyle(el).whiteSpace;
    });

    // whitespace should be 'pre-wrap', 'pre-line', or 'pre' to preserve line breaks
    expect(whiteSpace).toMatch(/^(pre-wrap|pre-line|pre)$/);
  });

  /**
   * T002: Multiple consecutive line breaks are preserved
   */
  test('preserves multiple consecutive line breaks', async ({ page, request , projectId }) => {
    // Create ticket with description containing double line breaks (paragraphs)
    const descriptionWithParagraphs = 'First paragraph.\n\nSecond paragraph after blank line.\n\n\nThird paragraph after two blank lines.';

    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket with Paragraphs',
        description: descriptionWithParagraphs,
      },
    });

    // Navigate to board and open modal
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Verify whitespace preservation
    // The description area has two child divs: first is the edit icon, second is the actual text
    const descriptionDiv = descriptionArea.locator('div').nth(1);
    const whiteSpace = await descriptionDiv.evaluate((el) => {
      return window.getComputedStyle(el).whiteSpace;
    });

    expect(whiteSpace).toMatch(/^(pre-wrap|pre-line|pre)$/);

    // Verify all paragraphs are present
    const displayedText = await descriptionArea.textContent();
    expect(displayedText).toContain('First paragraph.');
    expect(displayedText).toContain('Second paragraph after blank line.');
    expect(displayedText).toContain('Third paragraph after two blank lines.');
  });

  /**
   * T003: Line breaks are preserved after editing
   */
  test('preserves line breaks after editing description', async ({ page, request , projectId }) => {
    // Create ticket
    await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Ticket for Edit Test',
        description: 'Initial description',
      },
    });

    // Navigate to board and open modal
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const descriptionArea = dialog.locator('[data-testid="ticket-description"]');

    // Click to edit
    await descriptionArea.click();

    // Wait for textarea to appear
    const textarea = dialog.locator('[data-testid="description-textarea"]');
    await expect(textarea).toBeVisible();

    // Edit with multi-line content
    await textarea.fill('Updated first line\nUpdated second line\nUpdated third line');

    // Save
    const saveButton = dialog.locator('button:has-text("Save")');
    await saveButton.click();

    // Wait for save to complete (textarea should disappear)
    await expect(textarea).not.toBeVisible();

    // Verify line breaks are preserved in view mode
    const displayedText = await descriptionArea.textContent();
    expect(displayedText).toContain('Updated first line');
    expect(displayedText).toContain('Updated second line');
    expect(displayedText).toContain('Updated third line');

    // Verify whitespace preservation
    // The description area has two child divs: first is the edit icon, second is the actual text
    const descriptionDiv = descriptionArea.locator('div').nth(1);
    const whiteSpace = await descriptionDiv.evaluate((el) => {
      return window.getComputedStyle(el).whiteSpace;
    });

    expect(whiteSpace).toMatch(/^(pre-wrap|pre-line|pre)$/);
  });

});
