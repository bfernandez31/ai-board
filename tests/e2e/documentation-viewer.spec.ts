/**
 * E2E Tests for Documentation Viewer Feature (Plan & Tasks)
 *
 * Tests cover:
 * - Plan button visibility based on ticket state and workflow type
 * - Tasks button visibility based on ticket state and workflow type
 * - Documentation content display
 * - Branch selection logic for shipped tickets
 * - Error handling
 * - Modal interactions
 *
 * TDD Approach: These tests validate the plan and tasks viewing functionality
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
  workflowType?: string;
}) {
  const ticketData: {
    title: string;
    description: string;
    branch?: string | null;
    projectId: number;
    stage: any;
    workflowType: any;
    updatedAt: Date;
  } = {
    title: data.title,
    description: data.description ?? 'Test description',
    projectId: data.projectId,
    stage: (data.stage ?? 'INBOX') as any,
    workflowType: (data.workflowType ?? 'FULL') as any,
    updatedAt: new Date(),
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
      projectId: 1,
      command: data.command,
      status: data.status as any,
      completedAt: data.status === 'COMPLETED' ? new Date() : null,
      updatedAt: new Date(),
    },
  });
}

// Helper to open ticket modal and wait for jobs to load
async function openTicketModal(page: any, ticketId: number) {
  const jobsPromise = page.waitForResponse(
    (response: any) => response.url().includes(`/tickets/${ticketId}/jobs`) && response.status() === 200
  );

  await page.click(`[data-ticket-id="${ticketId}"]`);
  await jobsPromise;
}

test.describe('Documentation Viewer - Plan Button Visibility', () => {
  test.beforeEach(async () => {
    // Cleanup before each test
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Doc' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Doc' } } });

    // Ensure test user exists
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
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });
  });

  test('shows Plan button when FULL workflow ticket has completed plan job', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Button Visible',
      branch: 'test-branch-plan',
      projectId: 1,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({
      ticketId: ticket.id,
      command: 'specify',
      status: 'COMPLETED',
    });

    await createTestJob({
      ticketId: ticket.id,
      command: 'plan',
      status: 'COMPLETED',
    });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).toBeVisible();
  });

  test('hides Plan button for QUICK workflow tickets', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Quick Workflow',
      branch: 'test-branch-quick',
      projectId: 1,
      stage: 'BUILD',
      workflowType: 'QUICK',
    });

    await createTestJob({
      ticketId: ticket.id,
      command: 'quick-impl',
      status: 'COMPLETED',
    });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).not.toBeVisible();
  });

  test('hides Plan button when ticket has no branch', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc No Branch',
      branch: null,
      projectId: 1,
      workflowType: 'FULL',
    });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).not.toBeVisible();
  });

  test('hides Plan button when plan job not completed', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Job Pending',
      branch: 'test-branch',
      projectId: 1,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    await createTestJob({
      ticketId: ticket.id,
      command: 'plan',
      status: 'PENDING',
    });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).not.toBeVisible();
  });
});

test.describe('Documentation Viewer - Tasks Button Visibility', () => {
  test.beforeEach(async () => {
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Doc' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Doc' } } });

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
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });
  });

  test('shows Tasks button when FULL workflow ticket has completed plan job', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks Button Visible',
      branch: 'test-branch-tasks',
      projectId: 1,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({
      ticketId: ticket.id,
      command: 'specify',
      status: 'COMPLETED',
    });

    await createTestJob({
      ticketId: ticket.id,
      command: 'plan',
      status: 'COMPLETED',
    });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
  });

  test('hides Tasks button for QUICK workflow tickets', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks Quick Workflow',
      branch: 'test-branch-quick-tasks',
      projectId: 1,
      stage: 'BUILD',
      workflowType: 'QUICK',
    });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Tasks' })).not.toBeVisible();
  });

  test('shows both Plan and Tasks buttons together', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Both Buttons',
      branch: 'test-branch-both',
      projectId: 1,
      stage: 'BUILD',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({
      ticketId: ticket.id,
      command: 'specify',
      status: 'COMPLETED',
    });

    await createTestJob({
      ticketId: ticket.id,
      command: 'plan',
      status: 'COMPLETED',
    });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    // Both buttons should be visible together
    await expect(page.getByRole('button', { name: 'Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
  });
});

test.describe('Documentation Viewer - Content Display', () => {
  test.beforeEach(async () => {
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Doc' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Doc' } } });

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
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });
  });

  test('displays plan content when Plan button clicked', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Content',
      branch: 'test-branch-plan-content',
      projectId: 1,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Plan")');

    // Wait for documentation viewer modal
    await expect(page.getByRole('dialog').filter({ hasText: 'Implementation Plan' })).toBeVisible();

    // In test mode, should see mock content for plan
    await expect(page.getByText('Test Mode plan')).toBeVisible();
  });

  test('displays tasks content when Tasks button clicked', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks Content',
      branch: 'test-branch-tasks-content',
      projectId: 1,
      stage: 'BUILD',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Tasks")');

    // Wait for documentation viewer modal
    await expect(page.getByRole('dialog').filter({ hasText: 'Task Breakdown' })).toBeVisible();

    // In test mode, should see mock content for tasks
    await expect(page.getByText('Test Mode tasks')).toBeVisible();
  });

  test('renders markdown headings in plan viewer', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Headings',
      branch: 'test-branch-plan-headings',
      projectId: 1,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Plan")');

    await expect(page.getByRole('dialog')).toBeVisible();

    // Assert headings from test mode mock content
    await expect(page.locator('h2').filter({ hasText: 'Test Section' })).toBeVisible();
  });
});

test.describe('Documentation Viewer - Branch Selection for Shipped Tickets', () => {
  test.beforeEach(async () => {
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Doc' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Doc' } } });

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
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });
  });

  test('fetches plan from main branch for SHIP stage tickets', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Shipped Plan',
      branch: 'test-branch-shipped',
      projectId: 1,
      stage: 'SHIP',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    // Wait for plan API call when button is clicked
    const planApiPromise = page.waitForResponse(
      (response) => response.url().includes('/plan') && response.status() === 200
    );

    await page.click('button:has-text("Plan")');

    // Wait for API response and check branch
    const response = await planApiPromise;
    const data = await response.json();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify branch is 'main' in metadata
    expect(data.metadata.branch).toBe('main');
  });

  test('fetches tasks from main branch for SHIP stage tickets', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Shipped Tasks',
      branch: 'test-branch-shipped-tasks',
      projectId: 1,
      stage: 'SHIP',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    // Wait for tasks API call when button is clicked
    const tasksApiPromise = page.waitForResponse(
      (response) => response.url().includes('/tasks') && response.status() === 200
    );

    await page.click('button:has-text("Tasks")');

    // Wait for API response and check branch
    const response = await tasksApiPromise;
    const data = await response.json();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify branch is 'main' in metadata
    expect(data.metadata.branch).toBe('main');
  });

  test('fetches spec from main branch for SHIP stage tickets', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Shipped Spec',
      branch: 'test-branch-shipped-spec',
      projectId: 1,
      stage: 'SHIP',
      workflowType: 'FULL',
    });

    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);

    // Wait for spec API call when button is clicked
    const specApiPromise = page.waitForResponse(
      (response) => response.url().includes('/spec') && response.status() === 200
    );

    await page.click('button:has-text("Spec")');

    // Wait for API response and check branch
    const response = await specApiPromise;
    const data = await response.json();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify branch is 'main' in metadata
    expect(data.metadata.branch).toBe('main');
  });
});

test.describe('Documentation Viewer - Modal Interactions', () => {
  test.beforeEach(async () => {
    await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e] Doc' } } } });
    await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e] Doc' } } });

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
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });
  });

  test('closes plan modal with ESC key', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan ESC',
      branch: 'test-branch-plan-esc',
      projectId: 1,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Plan")');

    const planModal = page.getByRole('dialog').filter({ hasText: 'Implementation Plan' });
    await expect(planModal).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(planModal).not.toBeVisible();
  });

  test('closes tasks modal with ESC key', async ({ page }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks ESC',
      branch: 'test-branch-tasks-esc',
      projectId: 1,
      stage: 'BUILD',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, command: 'plan', status: 'COMPLETED' });

    await page.goto('/projects/1/board');

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Tasks")');

    const tasksModal = page.getByRole('dialog').filter({ hasText: 'Task Breakdown' });
    await expect(tasksModal).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(tasksModal).not.toBeVisible();
  });
});
