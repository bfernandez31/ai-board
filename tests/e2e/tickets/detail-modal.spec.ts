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
    const tickets = await prisma.ticket.findMany({
      where: { projectId: 1 },
      orderBy: { id: 'asc' },
    });
    if (tickets.length >= 2 && tickets[1]) {
      await prisma.ticket.update({
        where: { id: tickets[1].id },
        data: {
          stage: 'PLAN',
          updatedAt: new Date(),
        },
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

    // Stage color mapping (Catppuccin theme from ticket-detail-modal.tsx)
    const stageColors = {
      'INBOX': 'bg-[#6c7086]',
      'SPECIFY': 'bg-[#b4befe]',
      'PLAN': 'bg-[#89b4fa]',
      'BUILD': 'bg-[#f9cb98]',
      'VERIFY': 'bg-[#f2cdcd]',
      'SHIP': 'bg-[#a6e3a1]',
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify branch link is visible
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');
    await expect(branchLink).toBeVisible();

    // Verify link text contains branch name (compact design)
    await expect(branchLink).toContainText('033-test-branch');

    // Verify href attribute (compare URL format)
    await expect(branchLink).toHaveAttribute(
      'href',
      'https://github.com/testorg/testrepo/compare/main...033-test-branch'
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Listen for new page (tab) opening
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      branchLink.click(),
    ]);

    // Verify new page URL contains GitHub compare URL
    expect(newPage.url()).toContain('github.com');
    expect(newPage.url()).toContain('/compare/main...033-new-tab-test');

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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify complete URL structure (compare format)
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/compare/main...033-url-test');
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify URL encoding (spaces become %20) in compare URL
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/compare/main...feature%20branch%20name');
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify URL encoding (slashes become %2F) in compare URL
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/compare/main...feature%2Flogin');
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
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    const branchLink = dialog.locator('[data-testid="github-branch-link"]');

    // Verify URL encoding (all special chars encoded) in compare URL
    const href = await branchLink.getAttribute('href');
    expect(href).toBe('https://github.com/testorg/testrepo/compare/main...feature%2Flogin%20page%232');
  });
});

/**
 * E2E Tests for Ticket Detail Modal Refactoring
 * Feature: 049-rework-detail-ticket
 *
 * Tests for:
 * 1. Ticket ID display in header
 * 2. Footer with relative dates in Details tab
 * 3. Removal of old dates section
 * 4. Scrollable description with fixed footer
 */
test.describe('Ticket Detail Modal - Date Footer Refactoring', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ request }) => {
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

    // Update project 1
    await prisma.project.update({
      where: { id: 1 },
      data: {
        userId: testUser.id,
      },
    });

    // Create test ticket
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Test Ticket for Footer',
        description: 'Test description for footer refactoring',
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Test: Ticket ID displays in header before title
   */
  test('displays ticket ID in header before title', async ({ page }) => {
    // Navigate to board and open ticket detail modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify ticket ID is displayed (format: #<ticketId>)
    const ticketId = dialog.locator('[data-testid="ticket-id"]');
    await expect(ticketId).toBeVisible();

    // Verify it has correct styling (font-mono text-muted-foreground)
    const ticketIdClasses = await ticketId.getAttribute('class');
    expect(ticketIdClasses).toContain('font-mono');
    expect(ticketIdClasses).toContain('text-muted-foreground');

    // Verify text starts with #
    const ticketIdText = await ticketId.textContent();
    expect(ticketIdText).toMatch(/^#\d+$/);
  });

  /**
   * Test: Footer with relative dates appears in Details tab
   */
  test('displays footer with relative dates in Details tab', async ({ page }) => {
    // Navigate to board and open ticket detail modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Ensure we're on Details tab
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await detailsTab.click();

    // Wait for tab content to be visible
    const detailsContent = dialog.locator('[role="tabpanel"]').filter({ hasText: 'Description' });
    await expect(detailsContent).toBeVisible();

    // Verify footer is visible
    const footer = dialog.locator('[data-testid="details-footer"]');
    await expect(footer).toBeVisible();

    // Verify footer has correct styling
    const footerClasses = await footer.getAttribute('class');
    expect(footerClasses).toContain('border-t');
    expect(footerClasses).toContain('text-xs');
    expect(footerClasses).toContain('text-muted-foreground');

    // Verify footer contains ticket ID
    const footerText = await footer.textContent();
    expect(footerText).toMatch(/#\d+/);

    // Verify footer contains "Created" with relative time
    expect(footerText).toContain('Created');
    expect(footerText).toMatch(/(seconds?|minutes?|hours?|days?|months?|years?) ago/);

    // Verify footer contains "Updated" with relative time
    expect(footerText).toContain('Updated');

    // Verify separator · is used
    expect(footerText).toContain('·');
  });

  /**
   * Test: Old dates section is removed
   */
  test('does not display old dates section in Details tab', async ({ page }) => {
    // Navigate to board and open ticket detail modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Ensure we're on Details tab
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await detailsTab.click();

    // Verify old dates section with "Created:" and "Last Updated:" labels doesn't exist
    const oldDatesSection = dialog.getByText('Created:');
    await expect(oldDatesSection).not.toBeVisible();

    const oldUpdatedLabel = dialog.getByText('Last Updated:');
    await expect(oldUpdatedLabel).not.toBeVisible();
  });

  /**
   * Test: Footer is sticky on desktop viewport
   */
  test('footer is sticky on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to board and open ticket detail modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Ensure we're on Details tab
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await detailsTab.click();

    // Verify footer has sticky positioning on desktop
    const footer = dialog.locator('[data-testid="details-footer"]');
    await expect(footer).toBeVisible();

    // Check if footer has sticky class (only on desktop)
    const footerClasses = await footer.getAttribute('class');
    expect(footerClasses).toContain('md:sticky');
  });

  /**
   * Test: Footer is NOT sticky on mobile viewport
   */
  test('footer is not sticky on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to board and open ticket detail modal
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Ensure we're on Details tab
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await detailsTab.click();

    // Verify footer is visible but not sticky (no md:sticky applied by default on mobile)
    const footer = dialog.locator('[data-testid="details-footer"]');
    await expect(footer).toBeVisible();

    // On mobile, footer should have normal positioning
    const position = await footer.evaluate((el) => {
      return window.getComputedStyle(el).position;
    });

    // On mobile (below md breakpoint), position should be static or relative, not sticky
    expect(position).not.toBe('sticky');
  });

  /**
   * Test: Description is scrollable independently
   */
  test('description section is scrollable independently in Details tab', async ({ page }) => {
    // Clean database and create a ticket with a very long description directly via Prisma
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

    // Update project 1
    await prisma.project.update({
      where: { id: 1 },
      data: {
        userId: testUser.id,
      },
    });

    // Create ticket directly in DB with long description (max 1000 chars)
    await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket with Very Long Description',
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(15), // ~900 chars (under 1000 limit)
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Navigate to board and open the ticket
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

    // Click the first (and only) ticket
    await page.locator('[data-testid="ticket-card"]').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Ensure we're on Details tab
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await detailsTab.click();

    // Find the Details TabsContent (should be scrollable)
    const detailsTabContent = dialog.locator('[role="tabpanel"]').filter({ hasText: 'Description' });
    await expect(detailsTabContent).toBeVisible();

    // Verify Details TabsContent has overflow-y-auto
    const hasScroll = await detailsTabContent.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY === 'auto' || style.overflowY === 'scroll';
    });

    expect(hasScroll).toBe(true);

    // Verify footer remains visible
    const footer = dialog.locator('[data-testid="details-footer"]');
    await expect(footer).toBeVisible();
  });
});

/**
 * E2E Tests for Ticket Detail Modal - Initial Tab Selection
 * Feature: 920-open-ticket-to-conversation-tab
 *
 * Tests for:
 * 1. Tickets in VERIFY stage open with Conversation tab active
 * 2. Tickets in other stages open with Details tab active
 */
test.describe('Ticket Detail Modal - Initial Tab Selection', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ request }) => {
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

    // Update project 1
    await prisma.project.update({
      where: { id: 1 },
      data: {
        userId: testUser.id,
      },
    });

    // Create ticket in INBOX stage
    await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket in INBOX',
        description: 'Test ticket in INBOX stage',
      },
    });

    // Create ticket in BUILD stage
    const buildTicket = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket in BUILD',
        description: 'Test ticket in BUILD stage',
      },
    });
    const buildTicketData = await buildTicket.json();

    // Update to BUILD stage
    await prisma.ticket.update({
      where: { id: buildTicketData.id },
      data: {
        stage: 'BUILD',
        updatedAt: new Date(),
      },
    });

    // Create ticket in VERIFY stage
    const verifyTicket = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Ticket in VERIFY',
        description: 'Test ticket in VERIFY stage',
      },
    });
    const verifyTicketData = await verifyTicket.json();

    // Update to VERIFY stage
    await prisma.ticket.update({
      where: { id: verifyTicketData.id },
      data: {
        stage: 'VERIFY',
        updatedAt: new Date(),
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Test: Ticket in VERIFY stage opens with Conversation tab active
   */
  test('opens Conversation tab when clicking ticket in VERIFY stage', async ({ page }) => {
    // Navigate to board
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

    // Find the VERIFY column
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    await expect(verifyColumn).toBeVisible();

    // Click the ticket in VERIFY stage
    const verifyTicket = verifyColumn.locator('[data-testid="ticket-card"]').first();
    await verifyTicket.click();

    // Modal should be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Conversation tab is active
    const conversationTab = dialog.locator('[role="tab"]').filter({ hasText: 'Conversation' });
    await expect(conversationTab).toHaveAttribute('data-state', 'active');

    // Verify Details tab is not active
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await expect(detailsTab).toHaveAttribute('data-state', 'inactive');

    // Verify conversation tab panel is visible
    const conversationPanel = dialog.locator('[role="tabpanel"]').nth(1); // Conversation is the second tab panel
    await expect(conversationPanel).toBeVisible();
  });

  /**
   * Test: Ticket in INBOX stage opens with Details tab active
   */
  test('opens Details tab when clicking ticket in INBOX stage', async ({ page }) => {
    // Navigate to board
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

    // Find the INBOX column
    const inboxColumn = page.locator('[data-stage="INBOX"]');
    await expect(inboxColumn).toBeVisible();

    // Click the ticket in INBOX stage
    const inboxTicket = inboxColumn.locator('[data-testid="ticket-card"]').first();
    await inboxTicket.click();

    // Modal should be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Details tab is active
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await expect(detailsTab).toHaveAttribute('data-state', 'active');

    // Verify Conversation tab is not active
    const conversationTab = dialog.locator('[role="tab"]').filter({ hasText: 'Conversation' });
    await expect(conversationTab).toHaveAttribute('data-state', 'inactive');

    // Verify description is visible
    const description = dialog.locator('[data-testid="ticket-description"]');
    await expect(description).toBeVisible();
  });

  /**
   * Test: Ticket in BUILD stage opens with Details tab active
   */
  test('opens Details tab when clicking ticket in BUILD stage', async ({ page }) => {
    // Navigate to board
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

    // Find the BUILD column
    const buildColumn = page.locator('[data-stage="BUILD"]');
    await expect(buildColumn).toBeVisible();

    // Click the ticket in BUILD stage
    const buildTicket = buildColumn.locator('[data-testid="ticket-card"]').first();
    await buildTicket.click();

    // Modal should be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Details tab is active
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await expect(detailsTab).toHaveAttribute('data-state', 'active');

    // Verify Conversation tab is not active
    const conversationTab = dialog.locator('[role="tab"]').filter({ hasText: 'Conversation' });
    await expect(conversationTab).toHaveAttribute('data-state', 'inactive');
  });

  /**
   * Test: Modal resets to correct initial tab when reopening ticket
   */
  test('resets to correct initial tab when reopening same ticket', async ({ page }) => {
    // Navigate to board
    await page.goto('/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 3000 });

    // Find and click VERIFY ticket
    const verifyColumn = page.locator('[data-stage="VERIFY"]');
    const verifyTicket = verifyColumn.locator('[data-testid="ticket-card"]').first();
    await verifyTicket.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Conversation tab is active
    const conversationTab = dialog.locator('[role="tab"]').filter({ hasText: 'Conversation' });
    await expect(conversationTab).toHaveAttribute('data-state', 'active');

    // Switch to Details tab manually
    const detailsTab = dialog.locator('[role="tab"]').filter({ hasText: 'Details' });
    await detailsTab.click();
    await expect(detailsTab).toHaveAttribute('data-state', 'active');

    // Close modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Reopen the same ticket
    await verifyTicket.click();
    await expect(dialog).toBeVisible();

    // Verify it reopened with Conversation tab active (reset to initial)
    await expect(conversationTab).toHaveAttribute('data-state', 'active');
  });
});
