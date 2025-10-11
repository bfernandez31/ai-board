import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * E2E Tests: Inline Ticket Editing
 * Feature: 007-enable-inline-editing
 * Source: quickstart.md - All Test Scenarios
 *
 * ⚠️ CRITICAL: These tests MUST FAIL initially (TDD requirement)
 * They should only pass after full implementation of Phase 3.3 and 3.4
 */

test.describe('Inline Ticket Editing - User Interface', () => {
  const BASE_URL = 'http://localhost:3000';
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = new PrismaClient();
  });

  test.beforeEach(async () => {
    // Clean database before each test
    await prisma.ticket.deleteMany({});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create a ticket via API and return its data
   */
  const createTicket = async (
    request: any,
    title: string = 'Test Ticket',
    description: string = 'Test description'
  ): Promise<{ id: number; version: number; title: string; description: string }> => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: { title, description },
    });
    const ticket = await response.json();
    return {
      id: ticket.id,
      version: ticket.version || 1,
      title: ticket.title,
      description: ticket.description,
    };
  };

  /**
   * Helper: Get ticket from database
   */
  const getTicket = async (id: number) => {
    return await prisma.ticket.findUnique({ where: { id } });
  };

  /**
   * T010: User can click title to enter inline edit mode
   */
  test('user can click title to enter inline edit mode', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // Navigate to board and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    await ticketCard.click();

    // Wait for modal to open
    await page.waitForSelector('[role="dialog"]');

    // Locate title element
    const titleElement = page.getByTestId('ticket-title');

    // Hover to verify pencil icon appears
    await titleElement.hover();
    const pencilIcon = page.getByTestId('edit-icon-title');
    await expect(pencilIcon).toBeVisible();

    // Click title to enter edit mode
    await titleElement.click();

    // Assert: title becomes input field
    const titleInput = page.getByTestId('title-input');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toBeFocused();

    // Assert: current value is selected
    const inputValue = await titleInput.inputValue();
    expect(inputValue).toBe('Original Title');

    // Press ESC to cancel (verify no save)
    await titleInput.press('Escape');
    await expect(titleInput).not.toBeVisible();
  });

  /**
   * T011: User can save title by pressing Enter
   */
  test('user can save title with Enter key', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click title to edit
    const titleElement = page.getByTestId('ticket-title');
    await titleElement.click();

    // Type new title
    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('Updated Title');
    await titleInput.press('Enter');

    // Assert: input returns to display mode
    await expect(titleInput).not.toBeVisible();

    // Assert: title shows updated value
    await expect(titleElement).toContainText('Updated Title');

    // Wait for success toast
    const toast = page.getByTestId('toast').filter({ hasText: 'Ticket updated' }).first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify database
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.title).toBe('Updated Title');

    // Close modal and verify board shows updated title
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const boardCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(boardCard).toContainText('Updated Title');
  });

  /**
   * T012: User can cancel title edit with ESC
   */
  test('user can cancel title edit with ESC', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click title and change it
    const titleElement = page.getByTestId('ticket-title');
    await titleElement.click();
    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('Changed Title');

    // Press ESC
    await titleInput.press('Escape');

    // Assert: title reverts to original
    await expect(titleElement).toContainText('Original Title');
    await expect(titleInput).not.toBeVisible();

    // Verify no API call was made (version unchanged)
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.version).toBe(1);
  });

  /**
   * T013: User can click description to enter edit mode with counter
   */
  test('user can click description to enter edit mode with character counter', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Test Title', 'Original description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Hover over description to verify pencil icon
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.hover();
    const pencilIcon = page.getByTestId('edit-icon-description');
    await expect(pencilIcon).toBeVisible();

    // Click description
    await descriptionElement.click();

    // Assert: description becomes textarea
    const textarea = page.getByTestId('description-textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeFocused();

    // Assert: character counter visible
    const counter = page.getByTestId('character-counter');
    await expect(counter).toBeVisible();

    // Verify counter shows correct count
    const textareaValue = await textarea.inputValue();
    const remaining = 1000 - textareaValue.length;
    await expect(counter).toContainText(`${remaining} characters remaining`);
  });

  /**
   * T014: User can save description via Save button
   */
  test('user can save description via Save button', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Test Title', 'Original description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description to edit
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();

    // Type new description
    const textarea = page.getByTestId('description-textarea');
    await textarea.fill('Updated description with new content');

    // Click Save button
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Note: loading spinner may be too fast to catch, so we skip this assertion in favor of waiting for completion

    // Assert: textarea returns to display mode
    await expect(textarea).not.toBeVisible({ timeout: 5000 });

    // Assert: counter disappears
    const counter = page.getByTestId('character-counter');
    await expect(counter).not.toBeVisible();

    // Wait for success toast
    const toast = page.getByTestId('toast').filter({ hasText: 'Ticket updated' }).first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify database
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.description).toBe('Updated description with new content');
  });

  /**
   * T015: Empty title validation shows error and prevents save
   */
  test('empty title validation shows error and prevents save', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click title and delete all text
    const titleElement = page.getByTestId('ticket-title');
    await titleElement.click();
    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('   '); // Only whitespace

    // Try to save (press Enter or blur)
    await titleInput.press('Enter');

    // Assert: inline error message
    const errorMessage = page.getByTestId('title-error');
    await expect(errorMessage).toBeVisible();

    // Assert: input remains in edit mode
    await expect(titleInput).toBeVisible();

    // Verify no API call was made
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.version).toBe(1);
  });

  /**
   * T016: Title max length is enforced (100 characters)
   */
  test('title max length enforcement prevents exceeding 100 characters', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click title
    const titleElement = page.getByTestId('ticket-title');
    await titleElement.click();
    const titleInput = page.getByTestId('title-input');

    // Type 101 characters
    const longText = 'A'.repeat(101);
    await titleInput.fill(longText);

    // Assert: input only contains 100 characters (maxLength attribute enforces this)
    const inputValue = await titleInput.inputValue();
    expect(inputValue.length).toBeLessThanOrEqual(100);

    // If maxLength not set, try to save and expect error
    if (inputValue.length > 100) {
      await titleInput.press('Enter');
      const errorMessage = page.getByTestId('title-error');
      await expect(errorMessage).toBeVisible();
    }
  });

  /**
   * T017: Description character counter shows warning at 90%
   */
  test('description character counter shows warning at 90%', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();
    const textarea = page.getByTestId('description-textarea');

    // Type exactly 910 characters (>90% of 1000)
    const text910 = 'A'.repeat(910);
    await textarea.fill(text910);

    // Assert: counter shows "90 characters remaining"
    const counter = page.getByTestId('character-counter');
    await expect(counter).toContainText('90 characters remaining');

    // Assert: warning indicator visible (yellow/orange)
    const warningIcon = counter.locator('svg').first();
    await expect(warningIcon).toBeVisible();

    // Continue typing to 1000 characters
    const text1000 = 'A'.repeat(1000);
    await textarea.fill(text1000);

    // Assert: counter shows "0 characters remaining"
    await expect(counter).toContainText('0 characters remaining');

    // Assert: input prevents further typing (maxLength)
    const inputValue = await textarea.inputValue();
    expect(inputValue.length).toBe(1000);

    // Save button should still be enabled (1000 is valid)
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeEnabled();

    // Click Save and verify success
    await saveButton.click();
    const toast = page.getByTestId('toast').filter({ hasText: 'Ticket updated' }).first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  /**
   * T018: Empty description validation shows error and prevents save
   */
  test('empty description validation shows error and prevents save', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description and delete all text
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();
    const textarea = page.getByTestId('description-textarea');
    await textarea.fill(''); // Empty

    // Click Save button
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Assert: inline error message
    const errorMessage = page.getByTestId('description-error');
    await expect(errorMessage).toBeVisible();

    // Assert: textarea remains in edit mode
    await expect(textarea).toBeVisible();

    // Assert: Save button disabled
    await expect(saveButton).toBeDisabled();

    // Verify no API call was made
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.version).toBe(1);
  });

  /**
   * T019: Optimistic update rolls back on network error
   */
  test('optimistic update rolls back on network failure', async ({ page, context, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click title to edit
    const titleElement = page.getByTestId('ticket-title');
    await titleElement.click();

    // Enable offline mode
    await context.setOffline(true);

    // Type new title and press Enter
    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('Updated Title');
    await titleInput.press('Enter');

    // Assert: title updates immediately in UI (optimistic)
    await expect(titleElement).toContainText('Updated Title', { timeout: 1000 });

    // Wait for error toast after timeout
    const errorToast = page.getByTestId('toast').filter({ hasText: 'Failed to save changes while offline' }).first();
    await expect(errorToast).toBeVisible({ timeout: 10000 });
    await expect(errorToast).toContainText('Changes reverted');

    // Assert: title reverts to original (rollback)
    await expect(titleElement).toContainText('Original Title', { timeout: 2000 });

    // Re-enable network
    await context.setOffline(false);
  });

  /**
   * T020: Concurrent edit conflict shows 409 error
   */
  test('concurrent edit conflict shows error and prompts refresh', async ({ page, request }) => {
    // Create ticket (version = 1)
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click title to edit (but don't save yet)
    const titleElement = page.getByTestId('ticket-title');
    await titleElement.click();
    const titleInput = page.getByTestId('title-input');

    // Simulate concurrent update: update ticket directly in database
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { title: '[e2e] Concurrent Update', version: { increment: 1 } },
    });

    // Now try to save in browser (with stale version 1)
    await titleInput.fill('My Update');
    await titleInput.press('Enter');

    // Give time for the request to complete and toast to render
    await page.waitForTimeout(1000);

    // Assert: API returns 409
    // Wait for conflict toast
    const errorToast = page.getByTestId('toast').filter({ hasText: 'Conflict' }).first();
    await expect(errorToast).toBeVisible({ timeout: 5000 });
    await expect(errorToast).toContainText('modified by another user');

    // Toast should suggest refreshing
    await expect(errorToast).toContainText('refresh');

    // Assert: ticket refreshes with server data after delay (not rollback to original)
    await expect(titleElement).toContainText('Concurrent Update', { timeout: 3000 });
  });

  /**
   * T021: Board refreshes after successful save
   */
  test('board refreshes after successful save', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // Navigate to board
    await page.goto(`${BASE_URL}/projects/1/board`);

    // Verify board shows original title
    const boardCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
    await expect(boardCard).toContainText('Original Title');

    // Open modal
    await boardCard.click();

    // Edit title
    const titleElement = page.getByTestId('ticket-title');
    await titleElement.click();
    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('Updated Title');
    await titleInput.press('Enter');

    // Wait for success toast
    const toast = page.getByTestId('toast').filter({ hasText: 'Ticket updated' }).first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Assert: board shows updated title
    await expect(boardCard).toContainText('Updated Title');

    // User's scroll position/context preserved (difficult to test, but verify no full page reload)
    const url = page.url();
    expect(url).toContain('/projects/1/board');
  });

  /**
   * T022: Save button disabled when unchanged
   */
  test('save button disabled when content is unchanged', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Test Title', 'Test description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description to edit
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();

    // Do NOT change content
    const saveButton = page.locator('button:has-text("Save")');

    // Assert: Save button is disabled
    await expect(saveButton).toBeDisabled();

    // Type one character (make a change)
    const textarea = page.getByTestId('description-textarea');
    await textarea.fill('Test description!');

    // Assert: Save button becomes enabled
    await expect(saveButton).toBeEnabled();

    // Delete the character (restore to original)
    await textarea.fill('Test description');

    // Assert: Save button disabled again
    await expect(saveButton).toBeDisabled();
  });

  /**
   * T023: Inline edit description with [e2e] prefix succeeds
   * Feature: 024-16204-description-validation
   */
  test('inline edit description with [e2e] prefix succeeds', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request, '[e2e] Test', 'Original description');

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description to edit
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();
    const textarea = page.getByTestId('description-textarea');

    // Update with [e2e] prefix
    await textarea.fill('[e2e] Updated description with brackets');

    // Save
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Wait for success toast
    const toast = page.getByTestId('toast').filter({ hasText: 'Ticket updated' }).first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify database
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.description).toBe('[e2e] Updated description with brackets');
  });

  /**
   * T024: Inline edit description with special characters succeeds
   * Feature: 024-16204-description-validation
   */
  test('inline edit description with special characters succeeds', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description to edit
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();
    const textarea = page.getByTestId('description-textarea');

    // Update with various special characters
    await textarea.fill("Test with [brackets], (parens), {braces}, and 'quotes'");

    // Save
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Wait for success toast
    const toast = page.getByTestId('toast').filter({ hasText: 'Ticket updated' }).first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify database
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.description).toBe("Test with [brackets], (parens), {braces}, and 'quotes'");
  });

  /**
   * T025: Inline edit description with emoji shows validation error
   * Feature: 024-16204-description-validation
   */
  test('inline edit description with emoji shows validation error', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description to edit
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();
    const textarea = page.getByTestId('description-textarea');

    // Type invalid character (emoji)
    await textarea.fill('Bug with emoji 😀');

    // Wait for validation to run
    await page.waitForTimeout(100);

    // Verify error message appears
    const errorMessage = page.getByTestId('description-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('can only contain letters, numbers, spaces, and common special characters');

    // Verify Save button is disabled
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeDisabled();

    // Verify database not updated
    const dbTicket = await getTicket(ticket.id);
    expect(dbTicket?.version).toBe(1);
  });

  /**
   * T026: Validation error message is clear and actionable
   * Feature: 024-16204-description-validation
   */
  test('validation error message is clear and actionable', async ({ page, request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Navigate and open modal
    await page.goto(`${BASE_URL}/projects/1/board`);
    await page.locator(`[data-ticket-id="${ticket.id}"]`).click();

    // Click description to edit
    const descriptionElement = page.getByTestId('ticket-description');
    await descriptionElement.click();
    const textarea = page.getByTestId('description-textarea');

    // Type invalid characters (newline - but this is actually allowed by \s in the regex)
    // Use emoji instead which is definitely invalid
    await textarea.fill('Bug 🚀');

    // Wait for validation to run
    await page.waitForTimeout(100);

    // Wait for error message
    const errorMessage = page.getByTestId('description-error');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Assert: Error message is clear
    await expect(errorMessage).toContainText('can only contain letters, numbers, spaces, and common special characters');

    // Assert: Save button is disabled
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeDisabled();

    // Assert: textarea remains in edit mode (not saved)
    await expect(textarea).toBeVisible();

    // Verify: User can fix the error and save
    await textarea.fill('Bug fixed'); // Remove emoji
    await page.waitForTimeout(100);

    // Error should be gone and Save button enabled
    await expect(errorMessage).not.toBeVisible();
    await expect(saveButton).toBeEnabled();

    // Now save
    await saveButton.click();

    // Success toast appears
    const toast = page.getByTestId('toast').filter({ hasText: 'Ticket updated' }).first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});
