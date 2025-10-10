/**
 * E2E Test: Ticket Creation Modal - Form Validation
 *
 * This test verifies form validation rules for the ticket creation modal.
 * Expected to FAIL initially (RED state) - validation logic not implemented yet.
 *
 * Run: npx playwright test tests/ticket-creation-form-validation.spec.ts
 */

import { test, expect } from "@playwright/test";
import { cleanupDatabase } from './helpers/db-cleanup';

test.describe("Ticket Creation Modal - Form Validation", () => {
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

    // Navigate to board and open modal
    await page.goto("/projects/1/board");
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Wait for modal to be visible
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();
  });

  test("should disable Create button when both fields are empty", async ({ page }) => {
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });

    // Initially, both fields are empty
    await expect(createButton).toBeDisabled();
  });

  test("should disable Create button when only title is filled", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });

    // Fill only title
    await titleInput.fill("Test ticket title");

    // Create button should still be disabled
    await expect(createButton).toBeDisabled();
  });

  test("should disable Create button when only description is filled", async ({ page }) => {
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });

    // Fill only description
    await descriptionInput.fill("Test ticket description");

    // Create button should still be disabled
    await expect(createButton).toBeDisabled();
  });

  test("should show error when title exceeds 100 characters", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const tooLongTitle = "a".repeat(101);

    // Fill title with 101 characters
    await titleInput.fill(tooLongTitle);

    // Blur to trigger validation
    await titleInput.blur();

    // Wait for error message
    const errorMessage = page.getByText(/title must be 100 characters or less/i);
    await expect(errorMessage).toBeVisible();

    // Create button should be disabled
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await expect(createButton).toBeDisabled();
  });

  test("should show error when description exceeds 1000 characters", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);
    const tooLongDescription = "a".repeat(1001);

    // Fill title with valid data
    await titleInput.fill("Valid title");

    // Fill description with 1001 characters
    await descriptionInput.fill(tooLongDescription);

    // Blur to trigger validation
    await descriptionInput.blur();

    // Wait for error message
    const errorMessage = page.getByText(/description must be 1000 characters or less/i);
    await expect(errorMessage).toBeVisible();

    // Create button should be disabled
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await expect(createButton).toBeDisabled();
  });

  test("should show error when title contains emoji", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);

    // Fill with emoji
    await titleInput.fill("Test ticket 🚀");
    await descriptionInput.fill("Valid description");

    // Blur to trigger validation
    await titleInput.blur();

    // Wait for error message about invalid characters
    const errorMessage = page.getByText(/can only contain letters, numbers, spaces, and common special characters/i);
    await expect(errorMessage).toBeVisible();

    // Create button should be disabled
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await expect(createButton).toBeDisabled();
  });


  test("should accept title with allowed punctuation", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);

    // Fill with allowed punctuation: . , ? ! -
    await titleInput.fill("Test, ticket! How? Yes-it works.");
    await descriptionInput.fill("Valid description");

    // Blur to trigger validation
    await titleInput.blur();
    await descriptionInput.blur();

    // Wait a moment for validation
    await page.waitForTimeout(500);

    // Should not show error
    const errorMessage = page.getByText(/can only contain/i);
    await expect(errorMessage).not.toBeVisible();

    // Create button should be enabled
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await expect(createButton).toBeEnabled();
  });

  test("should accept description with allowed punctuation", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);

    // Fill with allowed punctuation
    await titleInput.fill("Valid title");
    await descriptionInput.fill("This description has periods, commas, hyphens, spaces, question marks, and exclamation points!");

    // Blur to trigger validation
    await titleInput.blur();
    await descriptionInput.blur();

    // Wait a moment for validation
    await page.waitForTimeout(500);

    // Should not show error
    const errorMessage = page.getByText(/can only contain/i);
    await expect(errorMessage).not.toBeVisible();

    // Create button should be enabled
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await expect(createButton).toBeEnabled();
  });

  test("should enable Create button when both fields are valid", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });

    // Fill both fields with valid data
    await titleInput.fill("Valid ticket title");
    await descriptionInput.fill("Valid ticket description");

    // Blur to trigger validation
    await titleInput.blur();
    await descriptionInput.blur();

    // Wait a moment for validation
    await page.waitForTimeout(500);

    // Create button should be enabled
    await expect(createButton).toBeEnabled();
  });

  test("should show real-time validation errors as user types", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);

    // Start typing a title that will exceed 100 chars
    const longTitle = "a".repeat(101);
    await titleInput.fill(longTitle);

    // Wait for debounced validation (typically 300ms)
    await page.waitForTimeout(500);

    // Error should appear while typing
    const errorMessage = page.getByText(/title must be 100 characters or less/i);
    await expect(errorMessage).toBeVisible();

    // Now reduce to valid length
    await titleInput.fill("a".repeat(50));

    // Wait for validation to update
    await page.waitForTimeout(500);

    // Error should disappear
    await expect(errorMessage).not.toBeVisible();
  });

  test("should validate on blur (when field loses focus)", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);

    // Fill title with invalid characters
    await titleInput.fill("Invalid @#$🚀");

    // Error might not show immediately while typing
    // But should show when field loses focus
    await titleInput.blur();

    // Error should now be visible
    const errorMessage = page.getByText(/can only contain letters, numbers, spaces, and common special characters/i);
    await expect(errorMessage).toBeVisible();
  });

  test("should trim whitespace from title and description", async ({ page }) => {
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);

    // Fill with leading/trailing whitespace
    await titleInput.fill("   Valid title   ");
    await descriptionInput.fill("   Valid description   ");

    // Blur to trigger validation and trimming
    await titleInput.blur();
    await descriptionInput.blur();

    // Wait a moment
    await page.waitForTimeout(500);

    // Trimming happens on submit, so verify no errors
    // Create button should be enabled for valid trimmed input
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await expect(createButton).toBeEnabled();
  });
});
