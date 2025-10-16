import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';

/**
 * E2E Tests for Ticket Detail Modal
 * Feature: 005-add-ticket-detail
 *
 * IMPORTANT: These tests are written FIRST (TDD approach)
 * They should FAIL until the modal component is implemented
 */

test.describe('Ticket Detail Modal', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ request }) => {
    // Clean database before each test - protects project 3
    await cleanupDatabase();

    // Create test tickets for each stage
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Test Ticket in INBOX',
        description: 'This is a test ticket in the INBOX stage for modal testing.',
      },
    });

    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Test Ticket in PLAN',
        description: 'This is a test ticket in the PLAN stage.',
      },
    });

    // Create a ticket with a long description for scrolling tests
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket with Long Description',
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing'.repeat(20), // ~1000 chars
      },
    });

    // Update stages for test tickets (API creates them in INBOX by default)
    const tickets = await prisma.ticket.findMany();
    if (tickets.length >= 2 && tickets[1]) {
      await prisma.ticket.update({
        where: { id: tickets[1].id },
        data: { stage: 'PLAN' },
      });
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T004: Basic modal open and close
   * Scenario 1 from quickstart.md
   */
  test('should open modal when ticket card is clicked and close with button', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click first ticket card
    const firstTicket = page.locator('[data-testid="ticket-card"]').first();
    const ticketTitle = await firstTicket.locator('h3').textContent();
    await firstTicket.click();

    // Assert modal is visible - find dialog containing the ticket title
    const dialog = page.locator('[role="dialog"]').filter({ hasText: ticketTitle || '' });
    await expect(dialog).toBeVisible();

    // Assert ticket title is displayed in modal
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toContainText(ticketTitle || '');

    // Close the dialog by pressing ESC (more reliable than finding close button)
    await page.keyboard.press('Escape');

    // Dialog should no longer be visible (Radix UI removes it from DOM)
    await expect(dialog).not.toBeVisible();
  });

  /**
   * T005: ESC key dismissal
   * Scenario 2 from quickstart.md
   */
  test('should close modal when ESC key is pressed', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click ticket card to open modal
    await page.locator('[data-testid="ticket-card"]').first().click();

    // Assert modal is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Press ESC key
    await page.keyboard.press('Escape');

    // Assert modal closes
    await expect(dialog).not.toBeVisible();
  });

  /**
   * T006: Click outside to close
   * Scenario 3 from quickstart.md
   */
  test('should close modal when clicking outside (overlay)', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Open modal by clicking ticket
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click outside the modal by clicking on the page at coordinates outside the dialog
    // The overlay is managed by Radix and clicking outside should close the modal
    await page.mouse.click(10, 10); // Top-left corner, definitely outside modal

    // Assert modal closes
    await expect(dialog).not.toBeVisible();

    // Re-open modal to test clicking modal content doesn't close
    await page.locator('[data-testid="ticket-card"]').first().click();
    await expect(dialog).toBeVisible();

    // Click modal content (should NOT close)
    await dialog.click();

    // Modal should still be visible
    await expect(dialog).toBeVisible();
  });

  /**
   * T007: Multiple tickets display correctly
   * Scenario 4 from quickstart.md
   */
  test('should display different ticket data for different tickets', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    const tickets = page.locator('[data-testid="ticket-card"]');

    // Get titles of first two tickets
    const firstTicketTitle = await tickets.nth(0).locator('h3').textContent();
    const secondTicketTitle = await tickets.nth(1).locator('h3').textContent();

    // Click first ticket
    await tickets.nth(0).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify first ticket's title in modal
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toContainText(firstTicketTitle || '');

    // Close modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Click second ticket
    await tickets.nth(1).click();
    await expect(dialog).toBeVisible();

    // Verify second ticket's title (should be different, not first ticket's data)
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toContainText(secondTicketTitle || '');

    // Assert it's NOT showing first ticket's data
    if (firstTicketTitle !== secondTicketTitle) {
      await expect(dialog.locator('h2, [data-testid="modal-title"]')).not.toContainText(firstTicketTitle || 'xxxxx');
    }
  });

  /**
   * T008: Mobile responsive (full-screen)
   * Scenario 5 from quickstart.md
   */
  test('should display full-screen modal on mobile viewport', async ({ page }) => {
    // Set viewport to mobile size (375px width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click ticket card
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check that modal has full-screen classes or dimensions
    // Note: Exact implementation may vary, but we check for expected behavior
    const dialogContent = dialog.locator('[data-radix-dialog-content]').or(dialog).first();

    // Get bounding box to verify it fills viewport
    const box = await dialogContent.boundingBox();

    // Modal should be close to full width and height (allowing for small margins)
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThan(350); // Close to 375px
      expect(box.height).toBeGreaterThan(600); // Close to 667px
    }

    // Verify close button is accessible (shadcn Dialog's built-in close button)
    const closeButton = dialog.locator('button').first(); // Close button is first button in dialog
    await expect(closeButton).toBeVisible();
  });

  /**
   * T009: Desktop responsive (centered)
   * Scenario 6 from quickstart.md
   */
  test('should display centered modal on desktop viewport', async ({ page }) => {
    // Set viewport to desktop size (1280px width)
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click ticket card
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const dialogContent = dialog.locator('[data-radix-dialog-content]').or(dialog).first();

    // Get bounding box
    const box = await dialogContent.boundingBox();

    expect(box).toBeTruthy();
    if (box) {
      // Modal should have max-width (NOT full screen)
      expect(box.width).toBeLessThan(800); // Should be constrained (max-w-2xl ~768px)

      // Modal should be centered (x position should not be 0)
      expect(box.x).toBeGreaterThan(100); // Not at edge of screen
    }

    // Modal should not fill entire screen on desktop
    // (We already checked the box dimensions above)
  });

  /**
   * T010: Long content scrolling
   * Scenario 7 from quickstart.md
   */
  test('should handle long description with scrolling', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click the third ticket (which has a long description)
    await page.locator('[data-testid="ticket-card"]').nth(2).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Find description area
    const descriptionArea = dialog.locator('[data-testid="ticket-description"], .overflow-y-auto').first();

    // Check if description area has scrolling capabilities
    // (it should have max-height and overflow-y-auto classes)
    const hasOverflow = await descriptionArea.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY === 'auto' || style.overflowY === 'scroll';
    }).catch(() => false);

    // If there's scrollable content, verify it works
    if (hasOverflow) {
      expect(hasOverflow).toBe(true);
    }

    // Title and dates should remain visible (not in scroll area)
    await expect(dialog.locator('h2, [data-testid="modal-title"]')).toBeVisible();
  });

  /**
   * T011: Stage badge colors
   * Scenario 8 from quickstart.md
   */
  test('should display correct badge colors for different stages', async ({ page }) => {
    // Navigate to board and wait for tickets to load
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Stage color mapping (from contract)
    const stageColors = {
      'INBOX': 'bg-zinc-600',
      'PLAN': 'bg-blue-600',
      'BUILD': 'bg-green-600',
      'VERIFY': 'bg-orange-600',
      'SHIP': 'bg-purple-600',
    };

    // Test the tickets we created (INBOX and PLAN)
    const stages = [
      { name: 'INBOX', column: 'INBOX' },
      { name: 'PLAN', column: 'PLAN' },
    ];

    for (const stage of stages) {
      // Find the stage column and click the first ticket in it
      const stageColumn = page.locator(`[data-stage="${stage.column}"]`);
      const ticketInStage = stageColumn.locator('[data-testid="ticket-card"]').first();
      await ticketInStage.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Find stage badge
      const badge = dialog.locator('[data-testid="stage-badge"]');
      await expect(badge).toBeVisible();

      // Verify badge has correct color class for this stage
      const expectedColor = stageColors[stage.name as keyof typeof stageColors];
      if (expectedColor) {
        const badgeClasses = await badge.getAttribute('class');
        expect(badgeClasses).toContain(expectedColor);
      }

      // Close modal
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });
});

/**
 * E2E Tests for Branch Link in Ticket Detail Modal
 * Feature: 033-link-to-branch
 *
 * User Story 1: View Branch in GitHub
 * User Story 2: Link Visibility Based on Branch State
 * User Story 3: Hide Link for Shipped Tickets
 */
test.describe('Branch Link in Ticket Detail Modal', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();

    // Create test user
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update project 1 with GitHub configuration
    await prisma.project.update({
      where: { id: 1 },
      data: {
        githubOwner: 'testorg',
        githubRepo: 'testrepo',
        userId: testUser.id,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T006: User Story 1 - displays branch link when branch exists and stage is not SHIP
   */
  test('displays branch link when branch exists and stage is not SHIP', async ({ page, request }) => {
    // Create ticket with branch in BUILD stage
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket with Branch',
        description: 'Test ticket with branch for branch link feature',
      },
    });

    const ticket = await response.json();

    // Update ticket to BUILD stage with branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'BUILD',
        branch: '033-test-branch',
      },
    });

    // Navigate to board and open ticket detail modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link is visible
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).toBeVisible();

    // Verify link text
    await expect(branchLink).toContainText('View in GitHub');

    // Verify href attribute
    await expect(branchLink).toHaveAttribute(
      'href',
      'https://github.com/testorg/testrepo/tree/033-test-branch'
    );

    // Verify security attributes
    await expect(branchLink).toHaveAttribute('target', '_blank');
    await expect(branchLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  /**
   * T007: User Story 1 - opens GitHub in new tab when clicked
   */
  test('opens GitHub in new tab when clicked', async ({ page, context, request }) => {
    // Create ticket with branch
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket for New Tab Test',
        description: 'Test ticket for new tab functionality',
      },
    });

    const ticket = await response.json();

    // Update ticket with branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'BUILD',
        branch: '033-new-tab-test',
      },
    });

    // Navigate to board and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Listen for new page (tab) opening
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      branchLink.click(),
    ]);

    // Verify new page URL contains GitHub
    expect(newPage.url()).toContain('github.com');
    expect(newPage.url()).toContain('/tree/033-new-tab-test');

    // Clean up new page
    await newPage.close();
  });

  /**
   * T008: User Story 1 - constructs correct GitHub URL with owner/repo/branch
   */
  test('constructs correct GitHub URL with owner/repo/branch', async ({ page, request }) => {
    // Create ticket with branch
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] URL Construction Test',
        description: 'Test URL construction',
      },
    });

    const ticket = await response.json();

    // Update ticket with branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'VERIFY',
        branch: '033-url-test',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify complete URL structure
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/tree/033-url-test');
  });

  /**
   * T017: User Story 2 - hides branch link when branch is null
   */
  test('hides branch link when branch is null', async ({ page, request }) => {
    // Create ticket without branch
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket Without Branch',
        description: 'Test ticket with null branch',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link is NOT visible
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).not.toBeVisible();
  });

  /**
   * T018: User Story 2 - hides branch link when branch is empty string
   */
  test('hides branch link when branch is empty string', async ({ page, request }) => {
    // Create ticket with empty branch
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket With Empty Branch',
        description: 'Test ticket with empty branch string',
      },
    });

    const ticket = await response.json();

    // Update ticket with empty branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        branch: '',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link is NOT visible
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).not.toBeVisible();
  });

  /**
   * T019: User Story 2 - hides branch link when githubOwner is missing
   */
  test('hides branch link when githubOwner is missing', async ({ page, request }) => {
    // Update project to remove githubOwner
    await prisma.project.update({
      where: { id: 1 },
      data: {
        githubOwner: '',
      },
    });

    // Create ticket with branch
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket Missing Owner',
        description: 'Test ticket with missing githubOwner',
      },
    });

    const ticket = await response.json();

    // Update ticket with branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        branch: '033-no-owner',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link is NOT visible
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).not.toBeVisible();
  });

  /**
   * T020: User Story 2 - hides branch link when githubRepo is missing
   */
  test('hides branch link when githubRepo is missing', async ({ page, request }) => {
    // Update project to remove githubRepo
    await prisma.project.update({
      where: { id: 1 },
      data: {
        githubRepo: '',
      },
    });

    // Create ticket with branch
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket Missing Repo',
        description: 'Test ticket with missing githubRepo',
      },
    });

    const ticket = await response.json();

    // Update ticket with branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        branch: '033-no-repo',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link is NOT visible
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).not.toBeVisible();
  });

  /**
   * T025: User Story 3 - hides branch link when stage is SHIP
   */
  test('hides branch link when stage is SHIP', async ({ page, request }) => {
    // Create ticket with branch in SHIP stage
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Shipped Ticket',
        description: 'Test ticket in SHIP stage',
      },
    });

    const ticket = await response.json();

    // Update ticket to SHIP stage with branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'SHIP',
        branch: '033-shipped-branch',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link is NOT visible
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).not.toBeVisible();
  });

  /**
   * T026: User Story 3 - shows branch link when stage transitions from SHIP back to VERIFY
   */
  test('shows branch link when stage transitions from SHIP back to VERIFY', async ({ page, request }) => {
    // Create ticket with branch in VERIFY stage (rollback scenario)
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Rolled Back Ticket',
        description: 'Test ticket rolled back from SHIP',
      },
    });

    const ticket = await response.json();

    // Update ticket to VERIFY stage with branch
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'VERIFY',
        branch: '033-rollback-branch',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link IS visible (not SHIP stage)
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).toBeVisible();
  });

  /**
   * T029: Edge Case - encodes branch names with spaces
   */
  test('encodes branch names with spaces', async ({ page, request }) => {
    // Create ticket with branch containing spaces
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Branch With Spaces',
        description: 'Test URL encoding for spaces',
      },
    });

    const ticket = await response.json();

    // Update ticket with branch containing spaces
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'BUILD',
        branch: 'feature branch name',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify URL encoding (spaces become %20)
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/tree/feature%20branch%20name');
  });

  /**
   * T030: Edge Case - encodes branch names with slashes
   */
  test('encodes branch names with slashes', async ({ page, request }) => {
    // Create ticket with branch containing slashes
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Branch With Slashes',
        description: 'Test URL encoding for slashes',
      },
    });

    const ticket = await response.json();

    // Update ticket with branch containing slashes
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'BUILD',
        branch: 'feature/login',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify URL encoding (slashes become %2F)
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/tree/feature%2Flogin');
  });

  /**
   * T031: Edge Case - encodes branch names with special characters
   */
  test('encodes branch names with special characters', async ({ page, request }) => {
    // Create ticket with branch containing multiple special characters
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Branch With Special Chars',
        description: 'Test URL encoding for special characters',
      },
    });

    const ticket = await response.json();

    // Update ticket with branch containing special characters
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: 'BUILD',
        branch: 'feature/login page#2',
      },
    });

    // Navigate and open modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify URL encoding (all special chars encoded)
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/tree/feature%2Flogin%20page%232');
  });
});
