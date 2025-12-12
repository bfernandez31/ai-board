import { test, expect } from '../helpers/worker-isolation';
import { prisma } from '@/lib/db/client';
import { getProjectKey } from '../helpers/db-cleanup';

test.describe('Ticket Duplicate - User Story 1', () => {
  let testProjectId: number;
  let testTicketId: number;
  let testTicketKey: string;

  test.beforeEach(async ({ projectId }) => {
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

    // Upsert test project
    const projectKey = getProjectKey(projectId);
    const project = await prisma.project.upsert({
      where: { id: projectId },
      update: {
        userId: testUser.id,
        clarificationPolicy: 'AUTO',
      },
      create: {
        id: projectId,
        name: '[e2e] Duplicate Test Project',
        description: 'Test project for ticket duplication',
        githubOwner: 'test',
        githubRepo: `test${projectId}`,
        userId: testUser.id,
        key: projectKey,
        clarificationPolicy: 'AUTO',
        updatedAt: new Date(),
      },
    });

    testProjectId = project.id;

    // Get next ticket number from sequence to avoid conflicts
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 1;

    testTicketKey = `${projectKey}-${ticketNum}`;

    // Create test ticket to duplicate
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Original Ticket',
        description: 'This is the original ticket description for duplication test',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: ticketNum,
        ticketKey: testTicketKey,
        clarificationPolicy: 'PRAGMATIC',
        attachments: [],
        updatedAt: new Date(),
      },
    });

    testTicketId = ticket.id;
  });

  test.afterEach(async () => {
    // Cleanup test data
    if (testProjectId) {
      await prisma.ticket.deleteMany({
        where: { projectId: testProjectId },
      });
    }
  });

  test('T003: Basic duplication flow - button click creates new ticket in INBOX', async ({ page, projectId: _projectId }) => {
    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Original Ticket').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click duplicate button
    await page.getByTestId('duplicate-ticket-button').click();

    // Wait for toast notification (use first() to handle multiple matches)
    await expect(page.getByText(/Ticket duplicated/i).first()).toBeVisible({ timeout: 5000 });

    // Modal should close after duplication
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify new ticket appears in INBOX with "Copy of " prefix
    await expect(page.getByText('Copy of [e2e] Original Ticket')).toBeVisible();

    // Verify the duplicate was created in database
    const duplicatedTicket = await prisma.ticket.findFirst({
      where: {
        projectId: testProjectId,
        title: 'Copy of [e2e] Original Ticket',
      },
    });

    expect(duplicatedTicket).toBeTruthy();
    expect(duplicatedTicket?.stage).toBe('INBOX');
    expect(duplicatedTicket?.description).toBe('This is the original ticket description for duplication test');
    expect(duplicatedTicket?.clarificationPolicy).toBe('PRAGMATIC');
  });
});

test.describe('Ticket Duplicate - User Story 2 (Visual Feedback)', () => {
  let testProjectId: number;
  let testTicketId: number;

  test.beforeEach(async ({ projectId }) => {
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

    // Upsert test project
    const projectKey = getProjectKey(projectId);
    const project = await prisma.project.upsert({
      where: { id: projectId },
      update: {
        userId: testUser.id,
      },
      create: {
        id: projectId,
        name: '[e2e] Visual Feedback Test Project',
        description: 'Test project for visual feedback',
        githubOwner: 'test',
        githubRepo: `test${projectId}`,
        userId: testUser.id,
        key: projectKey,
        updatedAt: new Date(),
      },
    });

    testProjectId = project.id;

    // Get next ticket number from sequence to avoid conflicts
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 1;

    // Create test ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Visual Test Ticket',
        description: 'Test ticket for visual feedback',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: ticketNum,
        ticketKey: `${projectKey}-${ticketNum}`,
        updatedAt: new Date(),
      },
    });

    testTicketId = ticket.id;
  });

  test.afterEach(async () => {
    if (testProjectId) {
      await prisma.ticket.deleteMany({
        where: { projectId: testProjectId },
      });
    }
  });

  test('T010: Tooltip displays on duplicate button hover', async ({ page, projectId: _projectId }) => {
    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Visual Test Ticket').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Hover over duplicate button
    const duplicateButton = page.getByTestId('duplicate-ticket-button');
    await duplicateButton.hover();

    // Verify tooltip appears
    await expect(page.getByRole('tooltip', { name: /Duplicate ticket/i })).toBeVisible({ timeout: 2000 });
  });

  test('T011: Success toast shows new ticket key', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Visual Test Ticket').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click duplicate button
    await page.getByTestId('duplicate-ticket-button').click();

    // Verify toast shows new ticket key (pattern: Created PROJECT_KEY-NUMBER)
    await expect(page.getByText(new RegExp(`Created ${projectKey}-\\d+`))).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Ticket Duplicate - User Story 3 (Error Handling)', () => {
  let testProjectId: number;

  test.beforeEach(async ({ projectId }) => {
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

    // Upsert test project
    const projectKey = getProjectKey(projectId);
    const project = await prisma.project.upsert({
      where: { id: projectId },
      update: {
        userId: testUser.id,
      },
      create: {
        id: projectId,
        name: '[e2e] Error Handling Test Project',
        description: 'Test project for error handling',
        githubOwner: 'test',
        githubRepo: `test${projectId}`,
        userId: testUser.id,
        key: projectKey,
        updatedAt: new Date(),
      },
    });

    testProjectId = project.id;

    // Get next ticket number from sequence to avoid conflicts
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 1;

    // Create test ticket
    await prisma.ticket.create({
      data: {
        title: '[e2e] Error Test Ticket',
        description: 'Test ticket for error handling',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: ticketNum,
        ticketKey: `${projectKey}-${ticketNum}`,
        updatedAt: new Date(),
      },
    });
  });

  test.afterEach(async () => {
    if (testProjectId) {
      await prisma.ticket.deleteMany({
        where: { projectId: testProjectId },
      });
    }
  });

  test('T018: Error toast displays on API failure and modal stays open', async ({ page, projectId: _projectId }) => {
    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Error Test Ticket').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Intercept the duplicate API call and force it to fail
    await page.route('**/api/projects/*/tickets/*/duplicate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error', code: 'DATABASE_ERROR' }),
      });
    });

    // Click duplicate button
    await page.getByTestId('duplicate-ticket-button').click();

    // Verify error toast appears (message comes from API response)
    await expect(page.getByText(/Internal server error/i)).toBeVisible({ timeout: 5000 });

    // Verify modal stays open
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('Ticket Duplicate - Edge Cases', () => {
  let testProjectId: number;

  test.beforeEach(async ({ projectId }) => {
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

    // Upsert test project
    const projectKey = getProjectKey(projectId);
    await prisma.project.upsert({
      where: { id: projectId },
      update: {
        userId: testUser.id,
      },
      create: {
        id: projectId,
        name: '[e2e] Edge Cases Test Project',
        description: 'Test project for edge cases',
        githubOwner: 'test',
        githubRepo: `test${projectId}`,
        userId: testUser.id,
        key: projectKey,
        updatedAt: new Date(),
      },
    });

    testProjectId = projectId;
  });

  test.afterEach(async () => {
    if (testProjectId) {
      await prisma.ticket.deleteMany({
        where: { projectId: testProjectId },
      });
    }
  });

  test('T023: Long title truncation (>92 chars)', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);
    const longTitle = '[e2e] ' + 'A'.repeat(94); // 100 chars total (max allowed)

    // Get next ticket number from sequence to avoid conflicts
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 1;

    // Create ticket with long title
    await prisma.ticket.create({
      data: {
        title: longTitle,
        description: 'Test ticket with long title',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: ticketNum,
        ticketKey: `${projectKey}-${ticketNum}`,
        updatedAt: new Date(),
      },
    });

    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });

    // Click on ticket to open detail modal (use partial text match)
    await page.getByText('[e2e] AAAA', { exact: false }).first().click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click duplicate button
    await page.getByTestId('duplicate-ticket-button').click();

    // Wait for toast (use first() to handle multiple matches)
    await expect(page.getByText(/Ticket duplicated/i).first()).toBeVisible({ timeout: 5000 });

    // Verify the duplicate has truncated title (100 chars max)
    const duplicatedTicket = await prisma.ticket.findFirst({
      where: {
        projectId: testProjectId,
        title: { startsWith: 'Copy of [e2e]' },
      },
    });

    expect(duplicatedTicket).toBeTruthy();
    expect(duplicatedTicket?.title.length).toBeLessThanOrEqual(100);
    expect(duplicatedTicket?.title.startsWith('Copy of ')).toBe(true);
  });

  test('T024: Ticket with maximum 5 attachments', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Get next ticket number from sequence to avoid conflicts
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 2;

    // Create ticket with 5 attachments
    await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket with Attachments',
        description: 'Test ticket with maximum attachments',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: ticketNum,
        ticketKey: `${projectKey}-${ticketNum}`,
        attachments: [
          { type: 'external', url: 'https://example.com/1.png', filename: 'image1.png', mimeType: 'image/png', sizeBytes: 1000, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/2.png', filename: 'image2.png', mimeType: 'image/png', sizeBytes: 1000, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/3.png', filename: 'image3.png', mimeType: 'image/png', sizeBytes: 1000, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/4.png', filename: 'image4.png', mimeType: 'image/png', sizeBytes: 1000, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/5.png', filename: 'image5.png', mimeType: 'image/png', sizeBytes: 1000, uploadedAt: new Date().toISOString() },
        ],
        updatedAt: new Date(),
      },
    });

    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 5000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Ticket with Attachments').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click duplicate button
    await page.getByTestId('duplicate-ticket-button').click();

    // Wait for toast (use first() to handle multiple matches)
    await expect(page.getByText(/Ticket duplicated/i).first()).toBeVisible({ timeout: 5000 });

    // Verify the duplicate has all 5 attachments
    const duplicatedTicket = await prisma.ticket.findFirst({
      where: {
        projectId: testProjectId,
        title: 'Copy of [e2e] Ticket with Attachments',
      },
    });

    expect(duplicatedTicket).toBeTruthy();
    const attachments = duplicatedTicket?.attachments as any[];
    expect(attachments).toHaveLength(5);
  });
});
