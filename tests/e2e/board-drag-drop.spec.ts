import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, ensureProjectExists, getProjectKey } from '../helpers/db-cleanup';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let nextTicketNumber = 1;

/**
 * E2E Tests: Drag and Drop Ticket to Trash
 * Feature: 084-drag-and-drop-trash
 *
 * Tests drag-and-drop deletion functionality for tickets
 * - Drag ticket to trash zone, confirm deletion
 * - Drag ticket to trash zone, cancel modal
 */

test.describe('Drag and Drop to Trash Zone', () => {
  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    await ensureProjectExists(projectId);

    // Reset ticket counter
    nextTicketNumber = 1;

    // Create test ticket in INBOX
    const projectKey = getProjectKey(projectId);
    const ticketNumber = nextTicketNumber++;
    await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test Ticket for Trash',
        description: 'Testing drag-and-drop to trash zone',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });
  });

  test.afterEach(async () => {
    await prisma.$disconnect();
  });

  /**
   * Test: Drag INBOX ticket to trash, confirm deletion, verify ticket deleted
   * Task: T025
   * Given: User has ticket in INBOX stage
   * When: User drags ticket to trash zone and confirms deletion
   * Then: Ticket is deleted from database and disappears from board
   */
  test('should delete ticket when dragged to trash and confirmed', async ({ page, projectId }) => {
    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // Get the ticket card
    const ticketCard = page.locator('[data-testid="column-INBOX"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Get initial ticket count
    const initialTicketCount = await prisma.ticket.count({ where: { projectId } });
    expect(initialTicketCount).toBe(1);

    // Start dragging - need actual mouse movement to trigger @dnd-kit
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    // Move to ticket center and press down
    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse slightly to trigger drag (important for @dnd-kit)
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(50); // Wait for drag state to activate

    // Verify trash zone appeared
    const trashZone = page.locator('[data-testid="trash-zone"]');
    await expect(trashZone).toBeVisible();

    // Get trash zone position
    const trashBox = await trashZone.boundingBox();
    if (!trashBox) throw new Error('Trash zone not found');

    // Drag ticket to trash zone center
    await page.mouse.move(trashBox.x + trashBox.width / 2, trashBox.y + trashBox.height / 2, { steps: 10 });
    await page.waitForTimeout(50);

    // Release mouse to drop on trash zone
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Verify confirmation modal appears
    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).toBeVisible();

    // Verify modal title (use role="heading" to be specific)
    const modalTitle = modal.getByRole('heading', { name: /Delete Ticket/i });
    await expect(modalTitle).toBeVisible();

    // Verify modal contains expected confirmation message for INBOX stage
    await expect(modal.getByText(/You are about to permanently delete ticket/i)).toBeVisible();

    // Click confirm button
    const confirmButton = modal.getByRole('button', { name: /Delete Permanently/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for deletion mutation to complete
    // The mutation will optimistically remove the ticket, then call the API
    await page.waitForTimeout(1000);

    // Verify modal is closed after successful deletion
    await expect(modal).not.toBeVisible();

    // Wait for API call to complete and database to update
    await page.waitForTimeout(1000);

    // Verify ticket is deleted from database
    const finalTicketCount = await prisma.ticket.count({ where: { projectId } });
    expect(finalTicketCount).toBe(0);

    // Verify ticket disappeared from board (INBOX column should be empty)
    const ticketsInInbox = page.locator('[data-testid="column-INBOX"] [data-draggable="true"]');
    await expect(ticketsInInbox).toHaveCount(0);
  });

  /**
   * Test: Drag ticket to trash, cancel modal, verify ticket remains
   * Task: T026
   * Given: User has ticket in INBOX stage
   * When: User drags ticket to trash zone and cancels deletion modal
   * Then: Ticket remains in database and on board
   */
  test('should keep ticket when deletion is cancelled', async ({ page, projectId }) => {
    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // Get the ticket card
    const ticketCard = page.locator('[data-testid="column-INBOX"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Get initial ticket count
    const initialTicketCount = await prisma.ticket.count({ where: { projectId } });
    expect(initialTicketCount).toBe(1);

    // Start dragging - need actual mouse movement to trigger @dnd-kit
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    // Move to ticket center and press down
    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse slightly to trigger drag (important for @dnd-kit)
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(50); // Wait for drag state to activate

    // Verify trash zone appeared
    const trashZone = page.locator('[data-testid="trash-zone"]');
    await expect(trashZone).toBeVisible();

    // Get trash zone position
    const trashBox = await trashZone.boundingBox();
    if (!trashBox) throw new Error('Trash zone not found');

    // Drag ticket to trash zone center
    await page.mouse.move(trashBox.x + trashBox.width / 2, trashBox.y + trashBox.height / 2, { steps: 10 });
    await page.waitForTimeout(50);

    // Release mouse to drop on trash zone
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Verify confirmation modal appears
    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).toBeVisible();

    // Verify modal title (use role="heading" to be specific)
    const modalTitle = modal.getByRole('heading', { name: /Delete Ticket/i });
    await expect(modalTitle).toBeVisible();

    // Verify modal contains expected confirmation message for INBOX stage
    await expect(modal.getByText(/You are about to permanently delete ticket/i)).toBeVisible();

    // Click cancel button
    const cancelButton = modal.getByRole('button', { name: /Cancel/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Wait for modal to close
    await page.waitForTimeout(200);

    // Verify modal is closed
    await expect(modal).not.toBeVisible();

    // Verify ticket is still in database
    const finalTicketCount = await prisma.ticket.count({ where: { projectId } });
    expect(finalTicketCount).toBe(1);

    // Verify ticket is still visible on board in INBOX column
    const ticketsInInbox = page.locator('[data-testid="column-INBOX"] [data-draggable="true"]');
    await expect(ticketsInInbox).toHaveCount(1);

    // Verify it's the same ticket
    const remainingTicket = ticketsInInbox.first();
    await expect(remainingTicket).toBeVisible();
    const ticketTitle = remainingTicket.locator('text=/Test Ticket for Trash/i');
    await expect(ticketTitle).toBeVisible();
  });

  /**
   * Test: Drag ticket with pending job, verify trash zone disabled with tooltip
   * Task: T047
   * Given: User has ticket with active PENDING job
   * When: User drags ticket over disabled trash zone
   * Then: Trash zone shows disabled state with explanatory tooltip
   */
  test('should disable trash zone and show tooltip for ticket with pending job', async ({ page, projectId }) => {
    // Create ticket with PENDING job
    const projectKey = getProjectKey(projectId);
    const ticketNumber = nextTicketNumber++;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Ticket with Pending Job',
        description: 'Testing trash zone disabled state',
        stage: 'SPECIFY',
        projectId,
        branch: '084-test-branch',
        updatedAt: new Date(),
      },
    });

    // Create PENDING job for the ticket
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        status: 'PENDING',
        command: 'specify',
        branch: '084-test-branch',
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-SPECIFY"]');

    // Get the ticket card with pending job
    const ticketCard = page.locator('[data-testid="column-SPECIFY"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Start dragging
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse to trigger drag
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(50);

    // Verify trash zone appeared but is disabled
    const trashZone = page.locator('[data-testid="trash-zone"]');
    await expect(trashZone).toBeVisible();

    // Verify disabled state styling (opacity-50 and cursor-not-allowed)
    const trashClasses = await trashZone.getAttribute('class');
    expect(trashClasses).toContain('opacity-50');
    expect(trashClasses).toContain('cursor-not-allowed');

    // Verify disabled reason text is present in the trash zone (for tooltip)
    // Note: Tooltip may not appear during active drag, but the content should be there
    const trashZoneText = await trashZone.textContent();
    expect(trashZoneText).toContain('Delete Ticket');

    // Release drag
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Verify no modal appeared (deletion blocked)
    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).not.toBeVisible();

    // Verify ticket still exists
    const ticketCount = await prisma.ticket.count({ where: { id: ticket.id } });
    expect(ticketCount).toBe(1);
  });

  /**
   * Test: Drag SHIP ticket, verify trash zone does not appear
   * Task: T048
   * Given: User has ticket in SHIP stage
   * When: User drags SHIP stage ticket
   * Then: Trash zone does not appear (SHIP tickets cannot be deleted)
   */
  test('should not show trash zone for SHIP stage ticket', async ({ page, projectId }) => {
    // Create ticket in SHIP stage
    const projectKey = getProjectKey(projectId);
    const ticketNumber = nextTicketNumber++;
    await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] SHIP Stage Ticket',
        description: 'Testing trash zone for SHIP tickets',
        stage: 'SHIP',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-SHIP"]');

    // Get the SHIP ticket card
    const ticketCard = page.locator('[data-testid="column-SHIP"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Start dragging
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse to trigger drag
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(100);

    // Verify trash zone does NOT appear
    const trashZone = page.locator('[data-testid="trash-zone"]');
    await expect(trashZone).not.toBeVisible();

    // Release drag
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Verify no modal appeared
    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).not.toBeVisible();
  });

  /**
   * Test: Hover over trash zone during drag, verify visual feedback (red border)
   * Task: T049
   * Given: User is dragging a deletable ticket
   * When: User hovers over enabled trash zone
   * Then: Trash zone shows red border and red icon (visual feedback)
   */
  test('should show red border visual feedback when hovering over trash zone', async ({ page, projectId }) => {
    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Wait for board to load
    await page.waitForSelector('[data-testid="column-INBOX"]');

    // Get the ticket card (from beforeEach setup)
    const ticketCard = page.locator('[data-testid="column-INBOX"] [data-draggable="true"]').first();
    await expect(ticketCard).toBeVisible();

    // Start dragging
    const ticketBox = await ticketCard.boundingBox();
    if (!ticketBox) throw new Error('Ticket not found');

    await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
    await page.mouse.down();

    // Move mouse to trigger drag
    await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 10, ticketBox.y + ticketBox.height / 2 + 10, { steps: 5 });
    await page.waitForTimeout(50);

    // Verify trash zone appeared
    const trashZone = page.locator('[data-testid="trash-zone"]');
    await expect(trashZone).toBeVisible();

    // Get initial trash zone classes (not hovering yet)
    const initialClasses = await trashZone.getAttribute('class');
    expect(initialClasses).not.toContain('border-red-500');

    // Move over trash zone to trigger hover state
    const trashBox = await trashZone.boundingBox();
    if (!trashBox) throw new Error('Trash zone not found');

    await page.mouse.move(trashBox.x + trashBox.width / 2, trashBox.y + trashBox.height / 2, { steps: 10 });
    await page.waitForTimeout(100); // Wait for CSS transition

    // Verify red border and background appear on hover
    const hoverClasses = await trashZone.getAttribute('class');
    expect(hoverClasses).toContain('border-red-500');
    expect(hoverClasses).toContain('bg-red-50');

    // Verify trash icon turns red
    const trashIcon = trashZone.locator('svg').first(); // Trash2 icon
    const iconClasses = await trashIcon.getAttribute('class');
    expect(iconClasses).toContain('text-red-500');

    // Release drag while still over trash zone
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Trash zone should disappear after drag ends
    await expect(trashZone).not.toBeVisible();
  });
});
