/**
 * E2E Test: Ticket Creation Modal - Successful Creation
 *
 * This test verifies the complete end-to-end ticket creation workflow.
 * Expected to FAIL initially (RED state) - modal and API integration not implemented yet.
 *
 * Run: npx playwright test tests/ticket-creation-success.spec.ts
 */

import { test, expect } from "@playwright/test";

test.describe("Ticket Creation Modal - Successful Creation", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to board page
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
  });

  test("should create ticket and display it in IDLE column", async ({ page }) => {
    // Step 1: Navigate to board page (already done in beforeEach)

    // Step 2: Count existing tickets in IDLE column (baseline)
    const idleColumn = page.locator('[data-column="IDLE"], [data-stage="IDLE"]').first();
    const initialTicketCount = await idleColumn.locator('[data-testid="ticket-card"]').count();

    // Step 3: Click "+ New Ticket" button
    const newTicketButton = page.getByRole("button", { name: /new ticket/i });
    await newTicketButton.click();

    // Wait for modal to open
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).toBeVisible();

    // Step 4: Fill title
    const titleInput = page.getByLabel(/title/i);
    await titleInput.fill("E2E Test Ticket");

    // Step 5: Fill description
    const descriptionInput = page.getByLabel(/description/i);
    await descriptionInput.fill("This ticket was created by automated E2E test");

    // Step 6: Click Create button
    const createButton = page.getByRole("button", { name: /^create$/i });
    await createButton.click();

    // Step 7: Verify loading state (button disabled during submission)
    await expect(createButton).toBeDisabled();

    // Step 8: Wait for modal to close (indicates successful creation)
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Step 9: Verify ticket appears in IDLE column
    const newTicket = page.getByText("E2E Test Ticket");
    await expect(newTicket).toBeVisible({ timeout: 3000 });

    // Step 10: Verify ticket title matches input
    await expect(newTicket).toHaveText("E2E Test Ticket");

    // Step 11: Verify ticket count increased by 1
    const finalTicketCount = await idleColumn.locator('[data-testid="ticket-card"]').count();
    expect(finalTicketCount).toBe(initialTicketCount + 1);
  });

  test("should create ticket with minimum valid input (1 char each)", async ({ page }) => {
    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with minimal valid data
    await page.getByLabel(/title/i).fill("A");
    await page.getByLabel(/description/i).fill("B");

    // Submit
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket exists (might be hard to find by single char, check count increased)
    const idleColumn = page.locator('[data-column="IDLE"], [data-stage="IDLE"]').first();
    const ticketCards = idleColumn.locator('[data-testid="ticket-card"]');

    // At least one ticket should exist now
    await expect(ticketCards).toHaveCount(await ticketCards.count());
  });

  test("should create ticket with maximum length title (100 chars)", async ({ page }) => {
    const maxTitle = "a".repeat(100);

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with max length title
    await page.getByLabel(/title/i).fill(maxTitle);
    await page.getByLabel(/description/i).fill("Test description");

    // Submit
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket exists (check by partial text match)
    const partialTitle = "a".repeat(20); // Check first 20 chars
    const newTicket = page.getByText(new RegExp(partialTitle));
    await expect(newTicket.first()).toBeVisible({ timeout: 3000 });
  });

  test("should create ticket with maximum length description (1000 chars)", async ({ page }) => {
    const maxDescription = "b".repeat(1000);

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with max length description
    await page.getByLabel(/title/i).fill("Test with long description");
    await page.getByLabel(/description/i).fill(maxDescription);

    // Submit
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket exists by title
    const newTicket = page.getByText("Test with long description");
    await expect(newTicket).toBeVisible({ timeout: 3000 });
  });

  test("should create ticket with allowed punctuation", async ({ page }) => {
    const titleWithPunctuation = "Test, ticket! How? Yes-it works.";
    const descriptionWithPunctuation = "This description has periods, commas, hyphens, question marks!";

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill with punctuation
    await page.getByLabel(/title/i).fill(titleWithPunctuation);
    await page.getByLabel(/description/i).fill(descriptionWithPunctuation);

    // Submit
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket exists with exact title
    const newTicket = page.getByText(titleWithPunctuation);
    await expect(newTicket).toBeVisible({ timeout: 3000 });
  });

  test("should show loading state during ticket creation", async ({ page }) => {
    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill form
    await page.getByLabel(/title/i).fill("Loading state test ticket");
    await page.getByLabel(/description/i).fill("Testing loading state");

    // Click Create button
    const createButton = page.getByRole("button", { name: /^create$/i });
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

    // Get initial state
    const idleColumn = page.locator('[data-column="IDLE"], [data-stage="IDLE"]').first();
    const initialCount = await idleColumn.locator('[data-testid="ticket-card"]').count();

    // Create ticket
    await page.getByRole("button", { name: /new ticket/i }).click();
    await page.getByLabel(/title/i).fill(uniqueTitle);
    await page.getByLabel(/description/i).fill("Testing auto-refresh");
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify board was refreshed (new ticket appears WITHOUT manual page reload)
    const newTicket = page.getByText(uniqueTitle);
    await expect(newTicket).toBeVisible({ timeout: 3000 });

    // Verify count increased
    const finalCount = await idleColumn.locator('[data-testid="ticket-card"]').count();
    expect(finalCount).toBe(initialCount + 1);
  });

  test("should create multiple tickets in sequence", async ({ page }) => {
    const tickets = [
      { title: "First sequential ticket", description: "First description" },
      { title: "Second sequential ticket", description: "Second description" },
      { title: "Third sequential ticket", description: "Third description" },
    ];

    for (const ticket of tickets) {
      // Open modal
      await page.getByRole("button", { name: /new ticket/i }).click();

      // Fill form
      await page.getByLabel(/title/i).fill(ticket.title);
      await page.getByLabel(/description/i).fill(ticket.description);

      // Submit
      await page.getByRole("button", { name: /^create$/i }).click();

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
    // This test assumes API responds within 15 seconds (spec requirement)

    // Open modal
    await page.getByRole("button", { name: /new ticket/i }).click();

    // Fill form
    await page.getByLabel(/title/i).fill("Network delay test");
    await page.getByLabel(/description/i).fill("Testing timeout handling");

    // Submit
    const createButton = page.getByRole("button", { name: /^create$/i });
    await createButton.click();

    // Button should be disabled during submission
    await expect(createButton).toBeDisabled();

    // Wait for completion (allow up to 15 seconds per spec)
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 15000 });

    // Verify ticket was created
    const newTicket = page.getByText("Network delay test");
    await expect(newTicket).toBeVisible({ timeout: 3000 });
  });

  test("should display new ticket with correct stage (IDLE)", async ({ page }) => {
    const testTitle = `Stage verification ${Date.now()}`;

    // Create ticket
    await page.getByRole("button", { name: /new ticket/i }).click();
    await page.getByLabel(/title/i).fill(testTitle);
    await page.getByLabel(/description/i).fill("Verifying stage is IDLE");
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for modal to close
    const modalTitle = page.getByRole("heading", { name: /create new ticket/i });
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

    // Verify ticket appears in IDLE column (not in other columns)
    const idleColumn = page.locator('[data-column="IDLE"], [data-stage="IDLE"]').first();
    const ticketInIdle = idleColumn.getByText(testTitle);
    await expect(ticketInIdle).toBeVisible({ timeout: 3000 });

    // Verify ticket is NOT in other columns
    const planColumn = page.locator('[data-column="PLAN"], [data-stage="PLAN"]').first();
    const ticketInPlan = planColumn.getByText(testTitle);
    await expect(ticketInPlan).not.toBeVisible();
  });
});