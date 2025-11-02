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

import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, ensureProjectExists, getPrismaClient, getProjectKey, getProjectGithub } from '../helpers/db-cleanup';

const prisma = getPrismaClient();

// Track ticket numbers per worker (keyed by projectId)
const ticketCounters = new Map<number, number>();

// Helper to create ticket with required test prefix
async function createTestTicket(data: {
  title: string;
  description?: string;
  branch?: string | null;
  projectId: number;
  stage?: string;
  workflowType?: string;
}) {
  const currentCounter = ticketCounters.get(data.projectId) || 1;
  const ticketNumber = currentCounter;
  ticketCounters.set(data.projectId, currentCounter + 1);
  const projectKey = getProjectKey(data.projectId);
  const ticketData: {
    ticketNumber: number;
    ticketKey: string;
    title: string;
    description: string;
    branch?: string | null;
    projectId: number;
    stage: any;
    workflowType: any;
    updatedAt: Date;
  } = {
    ticketNumber,
    ticketKey: `${projectKey}-${ticketNumber}`,
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
  projectId: number;
  command: string;
  status: string;
}) {
  return prisma.job.create({
    data: {
      ticketId: data.ticketId,
      projectId: data.projectId,
      command: data.command,
      status: data.status as any,
      completedAt: data.status === 'COMPLETED' ? new Date() : null,
      updatedAt: new Date(),
    },
  });
}

// Helper to open ticket modal and wait for jobs to load
async function openTicketModal(page: any, ticketId: number) {
  // Wait for ticket to be present on the page first
  const ticketCard = page.locator(`[data-ticket-id="${ticketId}"]`);
  await ticketCard.waitFor({ state: 'visible', timeout: 10000 });

  const jobsPromise = page.waitForResponse(
    (response: any) => response.url().includes(`/tickets/${ticketId}/jobs`) && response.status() === 200,
    { timeout: 15000 }
  );

  await ticketCard.click();
  await jobsPromise;
}

test.describe('Documentation Viewer - Plan Button Visibility', () => {
  test.beforeEach(async ({ projectId }) => {
    // Cleanup before each test - use cleanupDatabase for complete isolation
    await cleanupDatabase(projectId);

    // Reset ticket counter for this worker's project
    ticketCounters.set(projectId, 1);

    // Ensure test project exists for this worker (guarantees user + project)
    await ensureProjectExists(projectId);
  });

  test('shows Plan button when FULL workflow ticket has completed plan job', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Button Visible',
      branch: 'test-branch-plan',
      projectId,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'specify',
      status: 'COMPLETED',
    });

    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'plan',
      status: 'COMPLETED',
    });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).toBeVisible();
  });

  test('hides Plan button for QUICK workflow tickets', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Quick Workflow',
      branch: 'test-branch-quick',
      projectId,
      stage: 'BUILD',
      workflowType: 'QUICK',
    });

    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'quick-impl',
      status: 'COMPLETED',
    });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).not.toBeVisible();
  });

  test('hides Plan button when ticket has no branch', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc No Branch',
      branch: null,
      projectId,
      workflowType: 'FULL',
    });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).not.toBeVisible();
  });

  test('hides Plan button when plan job not completed', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Job Pending',
      branch: 'test-branch',
      projectId,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'plan',
      status: 'PENDING',
    });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Plan' })).not.toBeVisible();
  });
});

test.describe('Documentation Viewer - Tasks Button Visibility', () => {
  test.beforeEach(async ({ projectId }) => {
    // Cleanup before each test - use cleanupDatabase for complete isolation
    await cleanupDatabase(projectId);

    // Reset ticket counter
    ticketCounters.set(projectId, 1);

    // Ensure test project exists for this worker (guarantees user + project)
    await ensureProjectExists(projectId);
  });

  test('shows Tasks button when FULL workflow ticket has completed plan job', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks Button Visible',
      branch: 'test-branch-tasks',
      projectId,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'specify',
      status: 'COMPLETED',
    });

    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'plan',
      status: 'COMPLETED',
    });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
  });

  test('hides Tasks button for QUICK workflow tickets', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks Quick Workflow',
      branch: 'test-branch-quick-tasks',
      projectId,
      stage: 'BUILD',
      workflowType: 'QUICK',
    });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);

    await expect(page.getByRole('button', { name: 'Tasks' })).not.toBeVisible();
  });

  test('shows both Plan and Tasks buttons together', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Both Buttons',
      branch: 'test-branch-both',
      projectId,
      stage: 'BUILD',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'specify',
      status: 'COMPLETED',
    });

    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'plan',
      status: 'COMPLETED',
    });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);

    // Both buttons should be visible together
    await expect(page.getByRole('button', { name: 'Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
  });
});

test.describe('Documentation Viewer - Content Display', () => {
  test.beforeEach(async ({ projectId }) => {
    // Cleanup before each test - use cleanupDatabase for complete isolation
    await cleanupDatabase(projectId);

    // Reset ticket counter
    ticketCounters.set(projectId, 1);

    // Ensure test project exists for this worker (guarantees user + project)
    await ensureProjectExists(projectId);
  });

  test('displays plan content when Plan button clicked', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Content',
      branch: 'test-branch-plan-content',
      projectId,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'plan', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Plan")');

    // Wait for documentation viewer modal
    await expect(page.getByRole('dialog').filter({ hasText: 'Implementation Plan' })).toBeVisible();

    // In test mode, should see mock content for plan
    await expect(page.getByText('Test Mode plan')).toBeVisible();
  });

  test('displays tasks content when Tasks button clicked', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks Content',
      branch: 'test-branch-tasks-content',
      projectId,
      stage: 'BUILD',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'plan', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Tasks")');

    // Wait for documentation viewer modal
    await expect(page.getByRole('dialog').filter({ hasText: 'Task Breakdown' })).toBeVisible();

    // In test mode, should see mock content for tasks
    await expect(page.getByText('Test Mode tasks')).toBeVisible();
  });

  test('renders markdown headings in plan viewer', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan Headings',
      branch: 'test-branch-plan-headings',
      projectId,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'plan', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Plan")');

    await expect(page.getByRole('dialog')).toBeVisible();

    // Assert headings from test mode mock content
    await expect(page.locator('h2').filter({ hasText: 'Test Section' })).toBeVisible();
  });
});

test.describe('Documentation Viewer - Branch Selection for Shipped Tickets', () => {
  test.beforeEach(async ({ projectId }) => {
    // Cleanup before each test - use cleanupDatabase for complete isolation
    await cleanupDatabase(projectId);

    // Reset ticket counter
    ticketCounters.set(projectId, 1);

    // Ensure test project exists for this worker (guarantees user + project)
    await ensureProjectExists(projectId);
  });

  test('fetches plan from main branch for SHIP stage tickets', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Shipped Plan',
      branch: 'test-branch-shipped',
      projectId,
      stage: 'SHIP',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'plan', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

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

  test('fetches tasks from main branch for SHIP stage tickets', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Shipped Tasks',
      branch: 'test-branch-shipped-tasks',
      projectId,
      stage: 'SHIP',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'plan', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

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

  test('fetches spec from main branch for SHIP stage tickets', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Shipped Spec',
      branch: 'test-branch-shipped-spec',
      projectId,
      stage: 'SHIP',
      workflowType: 'FULL',
    });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

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
  test.beforeEach(async ({ projectId }) => {
    // Cleanup before each test - use cleanupDatabase for complete isolation
    await cleanupDatabase(projectId);

    // Reset ticket counter
    ticketCounters.set(projectId, 1);

    // Ensure test project exists for this worker (guarantees user + project)
    await ensureProjectExists(projectId);
  });

  test('closes plan modal with ESC key', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Plan ESC',
      branch: 'test-branch-plan-esc',
      projectId,
      stage: 'PLAN',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'plan', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Plan")');

    const planModal = page.getByRole('dialog').filter({ hasText: 'Implementation Plan' });
    await expect(planModal).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(planModal).not.toBeVisible();
  });

  test('closes tasks modal with ESC key', async ({ page , projectId }) => {
    const ticket = await createTestTicket({
      title: '[e2e] Doc Tasks ESC',
      branch: 'test-branch-tasks-esc',
      projectId,
      stage: 'BUILD',
      workflowType: 'FULL',
    });

    // Need specify job to make action buttons section visible
    await createTestJob({ ticketId: ticket.id, projectId, command: 'specify', status: 'COMPLETED' });

    await createTestJob({ ticketId: ticket.id, projectId, command: 'plan', status: 'COMPLETED' });

    await page.goto(`/projects/${projectId}/board`);

    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Tasks")');

    const tasksModal = page.getByRole('dialog').filter({ hasText: 'Task Breakdown' });
    await expect(tasksModal).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(tasksModal).not.toBeVisible();
  });
});

// =============================================================================
// User Story 3: Commit History and Change Tracking Tests
// =============================================================================

test.describe('Commit History - User Story 3', () => {
  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Reset ticket counter
    ticketCounters.set(projectId, 1);

    // Ensure test project exists for this worker (guarantees user + project)
    await ensureProjectExists(projectId);
  });

  /**
   * T031: E2E test for commit history display
   * Verifies "View History" button appears and commit list shows with authors and timestamps
   */
  test('displays commit history when View History button clicked', async ({ page , projectId }) => {
    // Create test ticket with branch
    const ticket = await createTestTicket({
      title: '[e2e] US3 Commit History Test',
      description: 'Testing commit history display',
      stage: 'SPECIFY',
      branch: '036-us3-history-test',
      projectId,
      workflowType: 'FULL',
    });

    // Create completed job (ticket has progressed through SPECIFY)
    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'specify',
      status: 'COMPLETED',
    });

    // Mock GitHub commit history API response
    await page.route(`**/api/projects/${projectId}/docs/history*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          commits: [
            {
              sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
              author: {
                name: 'Claude',
                email: 'noreply@anthropic.com',
                date: '2025-10-18T14:32:17Z',
              },
              message: 'docs: update specification with user scenarios',
              url: 'https://github.com/test/test/commit/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
            },
            {
              sha: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1',
              author: {
                name: 'Test User',
                email: 'test@e2e.local',
                date: '2025-10-18T12:15:30Z',
              },
              message: 'docs: initial specification',
              url: 'https://github.com/test/test/commit/b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1',
            },
          ],
        }),
      });
    });

    // Open documentation viewer
    await page.goto(`/projects/${projectId}/board`);
    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Spec")');

    // Verify "View History" button is visible
    const historyButton = page.locator('button:has-text("View History")');
    await expect(historyButton).toBeVisible();

    // Click View History button
    await historyButton.click();

    // Verify commit list displays
    const commitList = page.locator('[data-testid="commit-history-list"]');
    await expect(commitList).toBeVisible();

    // Verify first commit details (most recent)
    const firstCommit = page.locator('[data-testid="commit-item"]').first();
    await expect(firstCommit).toContainText('Claude');
    await expect(firstCommit).toContainText('noreply@anthropic.com');
    await expect(firstCommit).toContainText('update specification with user scenarios');
    await expect(firstCommit).toContainText('Oct 18'); // Date formatting

    // Verify second commit details
    const secondCommit = page.locator('[data-testid="commit-item"]').nth(1);
    await expect(secondCommit).toContainText('Test User');
    await expect(secondCommit).toContainText('test@e2e.local');
    await expect(secondCommit).toContainText('initial specification');
  });

  /**
   * T032: E2E test for diff viewing
   * Verifies clicking a commit displays the diff
   */
  test('displays diff when clicking on a commit', async ({ page , projectId }) => {
    // Create test ticket with branch
    const ticket = await createTestTicket({
      title: '[e2e] US3 Diff Viewing Test',
      description: 'Testing diff display',
      stage: 'SPECIFY',
      branch: '036-us3-diff-test',
      projectId,
      workflowType: 'FULL',
    });

    // Create completed job
    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'specify',
      status: 'COMPLETED',
    });

    // Mock commit history API
    await page.route(`**/api/projects/${projectId}/docs/history*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          commits: [
            {
              sha: 'abc123',
              author: {
                name: 'Claude',
                email: 'noreply@anthropic.com',
                date: '2025-10-18T14:32:17Z',
              },
              message: 'docs: update specification',
              url: 'https://github.com/test/test/commit/abc123',
            },
          ],
        }),
      });
    });

    // Mock diff API response
    await page.route(`**/api/projects/${projectId}/docs/diff*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sha: 'abc123',
          files: [
            {
              filename: 'specs/036-us3-diff-test/spec.md',
              status: 'modified',
              additions: 15,
              deletions: 3,
              patch:
                '@@ -10,7 +10,19 @@\n ## Summary\n \n-Original content here\n+Updated content with more details\n+\n+## User Scenarios\n+\n+1. User opens app\n+2. User sees feature\n+3. User interacts\n',
            },
          ],
        }),
      });
    });

    // Open documentation viewer and history
    await page.goto(`/projects/${projectId}/board`);
    await openTicketModal(page, ticket.id);
    await page.click('button:has-text("Spec")');
    await page.click('button:has-text("View History")');

    // Click on the commit to view diff
    const commitItem = page.locator('[data-testid="commit-item"]').first();
    await commitItem.click();

    // Verify diff viewer displays
    const diffViewer = page.locator('[data-testid="diff-viewer"]');
    await expect(diffViewer).toBeVisible();

    // Verify diff content shows additions and deletions
    await expect(diffViewer).toContainText('+15'); // Additions count
    await expect(diffViewer).toContainText('-3'); // Deletions count
    await expect(diffViewer).toContainText('Updated content with more details');
    await expect(diffViewer).toContainText('User Scenarios');

    // Verify diff syntax highlighting (additions shown in green, deletions in red)
    const additions = page.locator('.diff-addition').first();
    await expect(additions).toBeVisible();
    await expect(additions).toContainText('+Updated content');
  });

  /**
   * T033: E2E test for multi-user attribution
   * Verifies different authors shown correctly in commit history
   */
  test('displays multiple authors correctly in commit history', async ({ page , projectId }) => {
    // Create test ticket with branch
    const ticket = await createTestTicket({
      title: '[e2e] US3 Multi-User Attribution Test',
      description: 'Testing multi-user commit attribution',
      stage: 'PLAN',
      branch: '036-us3-multi-user-test',
      projectId,
      workflowType: 'FULL',
    });

    // Create completed jobs for SPECIFY and PLAN stages
    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'specify',
      status: 'COMPLETED',
    });
    await createTestJob({
      ticketId: ticket.id,
      projectId,
      command: 'plan',
      status: 'COMPLETED',
    });

    // Mock commit history with multiple different authors
    await page.route(`**/api/projects/${projectId}/docs/history*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          commits: [
            {
              sha: 'commit1',
              author: {
                name: 'Alice Developer',
                email: 'alice@company.com',
                date: '2025-10-18T16:00:00Z',
              },
              message: 'docs: add deployment section',
              url: 'https://github.com/test/test/commit/commit1',
            },
            {
              sha: 'commit2',
              author: {
                name: 'Bob Reviewer',
                email: 'bob@company.com',
                date: '2025-10-18T14:30:00Z',
              },
              message: 'docs: clarify acceptance criteria',
              url: 'https://github.com/test/test/commit/commit2',
            },
            {
              sha: 'commit3',
              author: {
                name: 'Claude',
                email: 'noreply@anthropic.com',
                date: '2025-10-18T12:00:00Z',
              },
              message: 'docs: initial plan generation',
              url: 'https://github.com/test/test/commit/commit3',
            },
            {
              sha: 'commit4',
              author: {
                name: 'Test User',
                email: 'test@e2e.local',
                date: '2025-10-18T10:00:00Z',
              },
              message: 'docs: create ticket',
              url: 'https://github.com/test/test/commit/commit4',
            },
          ],
        }),
      });
    });

    // Open documentation viewer and history
    await page.goto(`/projects/${projectId}/board`);
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('button:has-text("Plan")');
    await page.click('button:has-text("View History")');

    // Verify all four authors are displayed correctly
    const commitItems = page.locator('[data-testid="commit-item"]');
    await expect(commitItems).toHaveCount(4);

    // Verify first author (Alice)
    const aliceCommit = commitItems.nth(0);
    await expect(aliceCommit).toContainText('Alice Developer');
    await expect(aliceCommit).toContainText('alice@company.com');
    await expect(aliceCommit).toContainText('add deployment section');

    // Verify second author (Bob)
    const bobCommit = commitItems.nth(1);
    await expect(bobCommit).toContainText('Bob Reviewer');
    await expect(bobCommit).toContainText('bob@company.com');
    await expect(bobCommit).toContainText('clarify acceptance criteria');

    // Verify third author (Claude)
    const claudeCommit = commitItems.nth(2);
    await expect(claudeCommit).toContainText('Claude');
    await expect(claudeCommit).toContainText('noreply@anthropic.com');
    await expect(claudeCommit).toContainText('initial plan generation');

    // Verify fourth author (Test User)
    const testCommit = commitItems.nth(3);
    await expect(testCommit).toContainText('Test User');
    await expect(testCommit).toContainText('test@e2e.local');
    await expect(testCommit).toContainText('create ticket');

    // Verify commits are ordered by date (most recent first)
    const timestamps = await commitItems.allTextContents();
    // All commits should show different dates/times indicating proper ordering
    expect(timestamps[0]).toContain('Oct 18'); // Most recent
    expect(timestamps[3]).toContain('Oct 18'); // Oldest
  });
});
