/**
 * E2E Test: Ticket Creation Modal - Open/Close Workflow
 *
 * This test verifies the modal opening and closing behaviors.
 * Expected to FAIL initially (RED state) - modal component doesn't exist yet.
 *
 * Run: npx playwright test tests/ticket-creation-modal-open.spec.ts
 */

import { test, expect } from "@playwright/test";
import { cleanupDatabase } from '../../helpers/db-cleanup';

test.describe("Ticket Creation Modal - Open/Close Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Clean database before each test
    await cleanupDatabase();

    // Mock SSE endpoint to prevent connection timeouts
    await page.route('**/api/sse**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      });
    });

    // Navigate to the board page before each test
    await page.goto("/projects/1/board");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should open modal when clicking + New Ticket button", async ({ page }) => {
    // Find and click the "+ New Ticket" button
    const newTicketButton = page.getByRole("button", { name: /new ticket/i });
    await expect(newTicketButton).toBeVisible();

    await newTicketButton.click();

    // Verify modal opens
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    const modalTitle = modal.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();

    // Verify form fields are present within the modal
    const titleInput = modal.getByLabel(/^title$/i);
    const descriptionInput = modal.getByLabel(/^description$/i);

    await expect(titleInput).toBeVisible();
    await expect(descriptionInput).toBeVisible();

    // Verify action buttons are present
    const cancelButton = modal.getByRole("button", { name: /cancel/i });
    const createButton = modal.getByRole("button", { name: /create/i });

    await expect(cancelButton).toBeVisible();
    await expect(createButton).toBeVisible();
  });

  test("should close modal when clicking Cancel button", async ({ page }) => {
    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();

    // Type some data in the form
    await page.getByRole("dialog").getByLabel(/^title$/i).fill("Test ticket that should not be created");
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("This is a test description");

    // Click Cancel button
    await page.getByRole("button", { name: /cancel/i }).click();

    // Verify modal is closed
    await expect(modalTitle).not.toBeVisible();

    // Verify no ticket was created by checking the board
    const testTicket = page.getByText("Test ticket that should not be created");
    await expect(testTicket).not.toBeVisible();
  });

  test("should close modal when pressing Escape key", async ({ page }) => {
    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();

    // Type some data
    await page.getByRole("dialog").getByLabel(/^title$/i).fill("Another test ticket");
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Should not be created");

    // Press Escape key
    await page.keyboard.press("Escape");

    // Verify modal is closed
    await expect(modalTitle).not.toBeVisible();

    // Verify no ticket was created
    const testTicket = page.getByText("Another test ticket");
    await expect(testTicket).not.toBeVisible();
  });

  test("should close modal when clicking backdrop (outside modal)", async ({ page }) => {
    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();

    // Type some data
    await page.getByRole("dialog").getByLabel(/^title$/i).fill("Backdrop test ticket");

    // Click on the backdrop (dialog overlay)
    // Note: This clicks outside the dialog content but inside the overlay
    const dialog = page.getByRole("dialog");
    const box = await dialog.boundingBox();

    if (box) {
      // Click at the top-left corner (backdrop area)
      await page.mouse.click(10, 10);
    }

    // Verify modal is closed
    await expect(modalTitle).not.toBeVisible();

    // Verify no ticket was created
    const testTicket = page.getByText("Backdrop test ticket");
    await expect(testTicket).not.toBeVisible();
  });

  test("should focus title field automatically when modal opens", async ({ page }) => {
    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Wait for modal to be visible
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();

    // Check that title input has focus
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    await expect(titleInput).toBeFocused();
  });

  test("should not create ticket after canceling via any method", async ({ page }) => {
    // Get initial ticket count in INBOX column
    const idleColumn = page.locator('[data-column="INBOX"], [data-stage="INBOX"]').first();
    const initialTickets = await idleColumn.locator('[data-testid="ticket-card"]').count();

    // Test 1: Cancel via button
    await page.getByRole("button", { name: /new ticket/i }).click();
    await page.getByRole("dialog").getByLabel(/^title$/i).fill("Cancel test 1");
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Description 1");
    await page.getByRole("button", { name: /cancel/i }).click();

    // Test 2: Cancel via Escape
    await page.getByRole("button", { name: /new ticket/i }).click();
    await page.getByRole("dialog").getByLabel(/^title$/i).fill("Cancel test 2");
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Description 2");
    await page.keyboard.press("Escape");

    // Wait a moment for any potential API calls to complete
    await page.waitForTimeout(500);

    // Verify ticket count hasn't changed
    const finalTickets = await idleColumn.locator('[data-testid="ticket-card"]').count();
    expect(finalTickets).toBe(initialTickets);
  });
});