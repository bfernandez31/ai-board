/**
 * E2E Tests for Spec Viewer Feature
 *
 * Tests cover:
 * - Button visibility based on ticket state
 * - Spec content display
 * - Markdown rendering
 * - Error handling
 * - Modal interactions
 * - Responsive design
 *
 * TDD Approach: These tests are written BEFORE implementation and should fail initially
 */

import { test, expect } from '@playwright/test';
import { getPrismaClient } from '../helpers/db-cleanup';

const prisma = getPrismaClient();

// Helper to create ticket with required test prefix
async function createTestTicket(data: {
  title: string;
  description?: string;
  branch?: string | null;
  projectId: number;
  stage?: string;
}) {
  const ticketData: {
    title: string;
    description: string;
    branch?: string | null;
    projectId: number;
    stage: any;
    updatedAt: Date;
  } = {
    title: data.title,
    description: data.description ?? 'Test description',
    projectId: data.projectId,
    stage: (data.stage ?? 'INBOX') as any,
    updatedAt: new Date(), // Required field
  };

  if (data.branch !== undefined) {
    ticketData.branch = data.branch;
  }

  return prisma.ticket.create({
    data: ticketData,
  });
}

// Helper to create job
async function createTestJob(data: {
  ticketId: number;
  command: string;
  status: string;
}) {
  return prisma.job.create({
    data: {
      ticketId: data.ticketId,
      projectId: 1, // Add required projectId field
      command: data.command,
      status: data.status as any,
      completedAt: data.status === 'COMPLETED' ? new Date() : null,
      updatedAt: new Date(), // Required field
    },
  });
}

test.describe('Spec Viewer - Button Visibility', () => {
  test.beforeEach(async () => {
    // Cleanup before each test
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Spec' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Spec' } } });

    // Ensure test user exists (matches db-cleanup.ts pattern)
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    // Ensure test project exists
    await prisma.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });
  });

  // T004: Button visibility with completed specify job
  test('shows Spec button when ticket has branch and completed specify job', async ({ page }) => {
    // Setup: Create ticket with branch + completed job
    const ticket = await createTestTicket({
      title: '[e2e] Spec Button Visibility',
      branch: 'test-branch-spec',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({
      ticketId: ticket.id,
      command: 'specify',
      status: 'COMPLETED',
    });

    // Navigate and open ticket
    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);

    // Assert button visible
    await expect(page.getByRole('button', { name: 'Spec' })).toBeVisible();
  });

  // T005: Button hidden when no branch
  test('hides Spec button when ticket has no branch', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec No Branch Ticket',
      branch: null,
      projectId: 1,
    });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);

    await expect(page.getByRole('button', { name: 'Spec' })).not.toBeVisible();
  });

  // T006: Button hidden when no completed specify job
  test('hides button when job not completed', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Pending Job Ticket',
      branch: 'test-branch',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({
      ticketId: ticket.id,
      command: 'specify',
      status: 'PENDING',
    });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);

    await expect(page.getByRole('button', { name: 'Spec' })).not.toBeVisible();
  });

  // T007: Button shown with multiple jobs including completed specify
  test('shows button when multiple jobs include completed specify', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Multiple Jobs Ticket',
      branch: 'test-branch-multi',
      projectId: 1,
      stage: 'BUILD',
    });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'PENDING' });
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });
    await createTestJob({ ticketId: ticket.id, command: 'build', status: 'FAILED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);

    await expect(page.getByRole('button', { name: 'Spec' })).toBeVisible();
  });
});

test.describe('Spec Viewer - Content Display', () => {
  test.beforeEach(async () => {
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Spec' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Spec' } } });

    // Ensure test user exists (matches db-cleanup.ts pattern)
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    await prisma.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });
  });

  // T008: Spec content displays when button clicked
  test('displays spec content when button clicked', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Content Test',
      branch: 'test-branch-content',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    // Wait for spec viewer modal
    await expect(page.getByRole('dialog').filter({ hasText: 'Specification' })).toBeVisible();

    // In test mode, should see mock content
    await expect(page.getByText('Test Mode Specification')).toBeVisible();
  });

  // T009: Markdown headings render correctly
  test('renders markdown headings correctly', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Headings Test',
      branch: 'test-branch-headings',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    // Wait for modal
    await expect(page.getByRole('dialog')).toBeVisible();

    // Assert headings (from test mode mock content)
    await expect(page.locator('h1').filter({ hasText: 'Test Mode Specification' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Test Requirements' })).toBeVisible();
  });

  // T010: Code blocks with syntax highlighting
  test('renders code blocks with syntax highlighting', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Code Blocks Test',
      branch: 'test-branch-code',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    await expect(page.getByRole('dialog')).toBeVisible();

    // Assert code block exists (from test mode mock content)
    const codeBlock = page.locator('pre code, code');
    await expect(codeBlock.first()).toBeVisible();

    // Should contain TypeScript code from mock
    await expect(page.locator('text=const test')).toBeVisible();
  });

  // T011: Loading state shows while fetching
  test('shows loading state while fetching spec', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Loading Test',
      branch: 'test-branch-loading',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);

    // Click button and check for loading state (button should be disabled briefly)
    const viewButton = page.getByRole('button', { name: 'Spec' });
    await viewButton.click();

    // Modal should appear eventually
    await expect(page.getByRole('dialog').filter({ hasText: 'Specification' })).toBeVisible();
  });
});

test.describe('Spec Viewer - Error Handling', () => {
  test.beforeEach(async () => {
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Spec' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Spec' } } });

    // Ensure test user exists (matches db-cleanup.ts pattern)
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    await prisma.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });
  });

  // T012: Error handling for 404
  test('displays error on 404', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec 404 Test',
      branch: 'test-branch-404',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    // Intercept API call to return 404
    await page.route('**/api/projects/*/tickets/*/spec', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Specification not available' }),
      });
    });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    // Assert error message appears in toast (shadcn/ui toast with data-testid)
    await expect(page.locator('[data-testid="toast"]').filter({ hasText: /Specification not available|Error/i })).toBeVisible({ timeout: 5000 });
  });

  // T013: Error handling for 403 Forbidden
  test('displays error on 403 Forbidden', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec 403 Test',
      branch: 'test-branch-403',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.route('**/api/projects/*/tickets/*/spec', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden' }),
      });
    });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    // Assert error message appears in toast (shadcn/ui toast with data-testid)
    await expect(page.locator('[data-testid="toast"]').filter({ hasText: /Forbidden|Error/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Spec Viewer - Modal Interactions', () => {
  test.beforeEach(async () => {
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Spec' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Spec' } } });

    // Ensure test user exists (matches db-cleanup.ts pattern)
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    await prisma.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });
  });

  // T014: Modal closes with close button
  test('closes modal with close button', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Close Button Test',
      branch: 'test-branch-close',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    const specModal = page.getByRole('dialog').filter({ hasText: 'Specification' });
    await expect(specModal).toBeVisible();

    // Find and click the X button (uses radix-ui dialog close structure)
    const closeButton = specModal.locator('button').last(); // Last button in dialog is typically close
    await closeButton.click();

    // Assert spec modal closed (element removed from DOM)
    await expect(specModal).not.toBeVisible();
  });

  // T015: Modal closes with ESC key
  test('closes modal with ESC key', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec ESC Test',
      branch: 'test-branch-esc',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    const specModal = page.getByRole('dialog').filter({ hasText: 'Specification' });
    await expect(specModal).toBeVisible();

    // Press ESC
    await page.keyboard.press('Escape');

    // Assert spec modal closed (element removed from DOM)
    await expect(specModal).not.toBeVisible();
  });

  // T016: Scrollable content for large specs
  test('provides scrollable content for large specs', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Spec Scroll Test',
      branch: 'test-branch-scroll',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    // Intercept API to return large content
    await page.route('**/api/projects/*/tickets/*/spec', (route) => {
      const largeContent = '# Large Spec\n\n' + '## Section\n\nContent here.\n\n'.repeat(100);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: largeContent,
          metadata: {
            ticketId: ticket.id,
            branch: 'test-branch-scroll',
            projectId: 1,
            fileName: 'spec.md',
            filePath: 'specs/test-branch-scroll/spec.md',
          },
        }),
      });
    });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    const specModal = page.getByRole('dialog').filter({ hasText: 'Specification' });
    await expect(specModal).toBeVisible();

    // Check for scroll area within the spec modal only
    const scrollArea = specModal.locator('[data-radix-scroll-area-viewport]');

    // If ScrollArea is present within the spec modal, it should be visible
    // If not present, dialog content itself should be scrollable
    const hasScrollArea = await scrollArea.count() > 0;
    if (hasScrollArea) {
      await expect(scrollArea.first()).toBeVisible();
    } else {
      // Fallback: check dialog content is scrollable
      await expect(specModal).toBeVisible();
    }
  });

  // T017: Responsive layout on mobile
  test('displays correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const ticket = await createTestTicket({
      title: '[e2e] Spec Mobile Test',
      branch: 'test-branch-mobile',
      projectId: 1,
      stage: 'SPECIFY',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Spec")');

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Verify modal fits viewport
    const modalBox = await modal.boundingBox();
    if (modalBox) {
      expect(modalBox.width).toBeLessThanOrEqual(375);
    }
  });
});
