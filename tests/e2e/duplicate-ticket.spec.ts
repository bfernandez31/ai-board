import { test, expect } from '../helpers/worker-isolation';
import { prisma } from '@/lib/db/client';
import { getProjectKey } from '../helpers/db-cleanup';

test.describe('Duplicate Ticket', () => {
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
    const project = await prisma.project.upsert({
      where: { id: projectId },
      update: {
        userId: testUser.id,
        clarificationPolicy: 'AUTO',
      },
      create: {
        id: projectId,
        name: '[e2e] Duplicate Test Project',
        description: 'Test project for duplicate ticket',
        githubOwner: 'test',
        githubRepo: `test-dup-${projectId}`,
        userId: testUser.id,
        key: `DP${projectId}`,
        clarificationPolicy: 'AUTO',
        updatedAt: new Date(),
      },
    });

    testProjectId = project.id;

    // Create test ticket with unique ticketNumber based on timestamp
    const projectKey = getProjectKey(projectId);
    const uniqueNum = 100 + Math.floor(Math.random() * 1000);
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Original Ticket',
        description: 'Original ticket description for duplication test',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: uniqueNum,
        ticketKey: `${projectKey}-${uniqueNum}`,
        clarificationPolicy: 'CONSERVATIVE',
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

  test('T014: Duplicate button visible in ticket modal', async ({ page }) => {
    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Original Ticket').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify duplicate button is visible
    const duplicateButton = page.getByTestId('duplicate-button');
    await expect(duplicateButton).toBeVisible();
    await expect(duplicateButton).toContainText('Duplicate');
  });

  test('T015-017: Duplicate API creates new ticket', async ({ request }) => {
    // Test the duplicate API directly for reliability
    const response = await request.post(
      `http://localhost:3000/api/projects/${testProjectId}/tickets/${testTicketId}/duplicate`
    );

    // Verify API response is successful
    expect(response.ok()).toBeTruthy();

    const newTicket = await response.json();

    // Verify the new ticket has the correct properties
    expect(newTicket.title).toBe('Copy of [e2e] Original Ticket');
    expect(newTicket.description).toBe('Original ticket description for duplication test');
    expect(newTicket.stage).toBe('INBOX');
    expect(newTicket.clarificationPolicy).toBe('CONSERVATIVE');
    expect(newTicket.projectId).toBe(testProjectId);

    // Verify ticket exists in database
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: newTicket.id },
    });

    expect(dbTicket).not.toBeNull();
    expect(dbTicket?.title).toBe('Copy of [e2e] Original Ticket');
  });

  test('Duplicated ticket preserves all fields', async ({ request }) => {
    // Create a ticket with rich content
    const projectKey = getProjectKey(testProjectId);
    const uniqueNum = 200 + Math.floor(Math.random() * 1000);
    const richTicket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rich Content Ticket',
        description: 'A longer description with\nmultiple lines\nand special chars: <>&"\'',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: uniqueNum,
        ticketKey: `${projectKey}-${uniqueNum}`,
        clarificationPolicy: 'PRAGMATIC',
        updatedAt: new Date(),
      },
    });

    // Duplicate via API
    const response = await request.post(
      `http://localhost:3000/api/projects/${testProjectId}/tickets/${richTicket.id}/duplicate`
    );

    expect(response.ok()).toBeTruthy();

    const newTicket = await response.json();

    // Verify all fields are preserved
    expect(newTicket.title).toBe('Copy of [e2e] Rich Content Ticket');
    expect(newTicket.description).toBe('A longer description with\nmultiple lines\nand special chars: <>&"\'');
    expect(newTicket.clarificationPolicy).toBe('PRAGMATIC');
    expect(newTicket.stage).toBe('INBOX');
  });

  test('Duplicate API returns 404 for non-existent ticket', async ({ request }) => {
    const response = await request.post(
      `http://localhost:3000/api/projects/${testProjectId}/tickets/999999/duplicate`
    );

    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error.error).toBe('Ticket not found');
  });

  test('Title truncation works correctly', async ({ request }) => {
    // Create a ticket with 95 character title (will be truncated to 92 + "Copy of " = 100)
    const projectKey = getProjectKey(testProjectId);
    const uniqueNum = 300 + Math.floor(Math.random() * 1000);
    const longTitle = 'A'.repeat(95);
    const longTitleTicket = await prisma.ticket.create({
      data: {
        title: longTitle,
        description: 'Test long title truncation',
        stage: 'INBOX',
        projectId: testProjectId,
        ticketNumber: uniqueNum,
        ticketKey: `${projectKey}-${uniqueNum}`,
        updatedAt: new Date(),
      },
    });

    // Duplicate via API
    const response = await request.post(
      `http://localhost:3000/api/projects/${testProjectId}/tickets/${longTitleTicket.id}/duplicate`
    );

    expect(response.ok()).toBeTruthy();

    const newTicket = await response.json();

    // Verify title is truncated correctly (100 chars max)
    expect(newTicket.title.length).toBe(100);
    expect(newTicket.title.startsWith('Copy of ')).toBeTruthy();
    expect(newTicket.title).toBe('Copy of ' + 'A'.repeat(92));
  });
});
