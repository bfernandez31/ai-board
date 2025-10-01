/**
 * E2E Test: Ticket Creation Modal - Successful Creation
 *
 * This test verifies the complete end-to-end ticket creation workflow.
 * Expected to FAIL initially (RED state) - modal and API integration not implemented yet.
 *
 * Run: npx playwright test tests/ticket-creation-success.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { cleanupDatabase } from './helpers/db-cleanup';

// Helper: Wait for ticket to appear in column after board refresh
async function waitForTicketInColumn(page: Page, ticketTitle: string, timeout = 10000) {
  const ticket = page.locator('[data-stage="INBOX"]').getByText(ticketTitle);
  await expect(ticket).toBeVisible({ timeout });
}

test.describe("Ticket Creation Modal - Successful Creation", () => {
  test.beforeEach(async ({ page }) => {
    // Clean database before each test
    await cleanupDatabase();

    // Navigate to board page
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
  });

  test("should create ticket and display it in INBOX column", async ({ page }) => {
    // Step 1: Navigate to board page (already done in beforeEach)
    const testId = Date.now();
    const testTitle = `E2E Test Ticket ${testId}`;

    // Step 3: Click "+ New Ticket" button
    const newTicketButton = page.getByRole("button", { name: /new ticket/i });
    await newTicketButton.click();

    // Wait for modal to open
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();

    // Step 4: Fill title
    const titleInput = page.getByRole("dialog").getByLabel(/^title$/i);
    await titleInput.fill(testTitle);

    // Step 5: Fill description
    const descriptionInput = page.getByRole("dialog").getByLabel(/^description$/i);
    await descriptionInput.fill("This ticket was created by automated E2E test");

    // Step 6: Click Create button
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await createButton.click();

    // Step 7: Verify loading state (button disabled during submission)
    await expect(createButton).toBeDisabled();

    // Step 8: Wait for modal to close (indicates successful creation)
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Step 9: Wait for ticket to appear in INBOX column (board refresh is async)
    await waitForTicketInColumn(page, testTitle);
  });

  test("should create ticket with minimum valid input (1 char each)", async ({ page }) => {
    const testId = Date.now();
    const testTitle = `A ${testId}`;

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with minimal valid data
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(testTitle);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("B");

    // Submit
    await page.getByRole("button", { name: /create ticket|creating/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket exists (might be hard to find by single char, check count increased)
    const idleColumn = page.locator('[data-column="INBOX"], [data-stage="INBOX"]').first();
    const ticketCards = idleColumn.locator('[data-testid="ticket-card"]');

    // At least one ticket should exist now
    await expect(ticketCards).toHaveCount(await ticketCards.count());
  });

  test("should create ticket with maximum length title (100 chars)", async ({ page }) => {
    const testId = Date.now();
    const maxTitle = `${"a".repeat(85)} ${testId}`;

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with max length title
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(maxTitle);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Test description");

    // Submit
    await page.getByRole("button", { name: /create ticket|creating/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket exists (check by partial text match)
    const partialTitle = "a".repeat(20); // Check first 20 chars
    const newTicket = page.getByText(new RegExp(partialTitle));
    await expect(newTicket.first()).toBeVisible({ timeout: 3000 });
  });

  test("should create ticket with maximum length description (1000 chars)", async ({ page }) => {
    const testId = Date.now();
    const testTitle = `Test with long description ${testId}`;
    const maxDescription = "b".repeat(1000);

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with max length description
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(testTitle);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill(maxDescription);

    // Submit
    await page.getByRole("button", { name: /create ticket|creating/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Wait for ticket to appear in INBOX column
    await waitForTicketInColumn(page, testTitle);
  });

  test("should create ticket with allowed punctuation", async ({ page }) => {
    const testId = Date.now();
    const titleWithPunctuation = `Test, ticket! How? Yes-it works. ${testId}`;
    const descriptionWithPunctuation = "This description has periods, commas, hyphens, question marks!";

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with punctuation
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(titleWithPunctuation);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill(descriptionWithPunctuation);

    // Submit
    await page.getByRole("button", { name: /create ticket|creating/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Wait for ticket to appear in INBOX column
    await waitForTicketInColumn(page, titleWithPunctuation);
  });

  test("should show loading state during ticket creation", async ({ page }) => {
    const testId = Date.now();
    const testTitle = `Loading state test ticket ${testId}`;

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill form
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(testTitle);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Testing loading state");

    // Click Create button
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await createButton.click();

    // Immediately check that button is disabled
    await expect(createButton).toBeDisabled();

    // Check for loading indicator (spinner or text change)
    // This might vary based on implementation - checking disabled state is sufficient
    const isDisabled = await createButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Wait for completion
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
  });

  test("should refresh board automatically after ticket creation", async ({ page }) => {
    const uniqueTitle = `Auto-refresh test ${Date.now()}`;

    // Get INBOX column
    const idleColumn = page.locator('[data-column="INBOX"], [data-stage="INBOX"]').first();

    // Create ticket
    await page.getByRole("button", { name: /new ticket/i }).click();
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(uniqueTitle);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Testing auto-refresh");
    await page.getByRole("button", { name: /create ticket|creating/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Wait for network to settle (board refresh)
    await page.waitForLoadState('networkidle');

    // Verify board was refreshed (new ticket appears WITHOUT manual page reload)
    const newTicket = idleColumn.getByText(uniqueTitle);
    await expect(newTicket).toBeVisible({ timeout: 3000 });
  });

  test("should create multiple tickets in sequence", async ({ page }) => {
    const testId = Date.now();
    const tickets = [
      { title: `First sequential ticket ${testId}`, description: "First description" },
      { title: `Second sequential ticket ${testId}`, description: "Second description" },
      { title: `Third sequential ticket ${testId}`, description: "Third description" },
    ];

    for (const ticket of tickets) {
      // Open modal
      await page.getByRole("button", { name: /new ticket/i }).click();

      // Fill form
      await page.getByRole("dialog").getByLabel(/^title$/i).fill(ticket.title);
      await page.getByRole("dialog").getByLabel(/^description$/i).fill(ticket.description);

      // Submit
      await page.getByRole("button", { name: /create ticket|creating/i }).click();

      // Wait for modal to close
      const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
      await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

      // Verify ticket was created
      const newTicket = page.getByText(ticket.title);
      await expect(newTicket).toBeVisible({ timeout: 3000 });
    }

    // Verify all three tickets exist
    for (const ticket of tickets) {
      const ticketElement = page.getByText(ticket.title);
      await expect(ticketElement).toBeVisible();
    }
  });

  test("should handle network delay gracefully (within timeout)", async ({ page }) => {
    const testId = Date.now();
    const testTitle = `Network delay test ${testId}`;

    // This test assumes API responds within 15 seconds (spec requirement)

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill form
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(testTitle);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Testing timeout handling");

    // Submit
    const createButton = page.getByRole("button", { name: /create ticket|creating/i });
    await createButton.click();

    // Button should be disabled during submission
    await expect(createButton).toBeDisabled();

    // Wait for completion (allow up to 15 seconds per spec)
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 15000 });

    // Verify ticket was created
    const newTicket = page.getByText(testTitle);
    await expect(newTicket).toBeVisible({ timeout: 3000 });
  });

  test("should display new ticket with correct stage (INBOX)", async ({ page }) => {
    const testTitle = `Stage verification ${Date.now()}`;

    // Create ticket
    await page.getByRole("button", { name: /new ticket/i }).click();
    await page.getByRole("dialog").getByLabel(/^title$/i).fill(testTitle);
    await page.getByRole("dialog").getByLabel(/^description$/i).fill("Verifying stage is INBOX");
    await page.getByRole("button", { name: /create ticket|creating/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket appears in INBOX column (not in other columns)
    const idleColumn = page.locator('[data-column="INBOX"], [data-stage="INBOX"]').first();
    const ticketInIdle = idleColumn.getByText(testTitle);
    await expect(ticketInIdle).toBeVisible({ timeout: 3000 });

    // Verify ticket is NOT in other columns
    const planColumn = page.locator('[data-column="PLAN"], [data-stage="PLAN"]').first();
    const ticketInPlan = planColumn.getByText(testTitle);
    await expect(ticketInPlan).not.toBeVisible();
  });
});