import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/client';

test.describe('Clarification Policy - User Story 1', () => {
  let testProjectId: number;

  test.beforeEach(async () => {
    // Create test user
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

    // Create test project with AUTO policy (default)
    const project = await prisma.project.create({
      data: {
        name: '[e2e] Policy Test Project',
        description: 'Test project for clarification policy',
        githubOwner: 'test',
        githubRepo: 'test-policy',
        userId: testUser.id,
        clarificationPolicy: 'AUTO', // Explicit default
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });

    testProjectId = project.id;
  });

  test.afterEach(async () => {
    // Cleanup test data
    if (testProjectId) {
      await prisma.project.delete({
        where: { id: testProjectId },
      });
    }
  });

  test('T023: Setting project policy persists to database', async ({ page }) => {
    // Navigate to project settings
    await page.goto(`http://localhost:3000/projects/${testProjectId}/settings`);

    // Wait for the clarification policy card to load
    await expect(page.getByText('Default Clarification Policy')).toBeVisible();

    // Verify initial policy is AUTO (default)
    const selectTrigger = page.locator('[role="combobox"]').first();
    await expect(selectTrigger).toContainText('AUTO');

    // Click the select to open dropdown
    await selectTrigger.click();

    // Select CONSERVATIVE policy
    await page.getByRole('option', { name: /CONSERVATIVE/ }).click();

    // Wait for the API call to complete (check for updated value)
    await expect(selectTrigger).toContainText('CONSERVATIVE');

    // Verify the change persisted to database
    const updatedProject = await prisma.project.findUnique({
      where: { id: testProjectId },
      select: { clarificationPolicy: true },
    });

    expect(updatedProject?.clarificationPolicy).toBe('CONSERVATIVE');
  });

  test('T024: New tickets inherit project policy', async ({ page }) => {
    // Update project policy to CONSERVATIVE
    await prisma.project.update({
      where: { id: testProjectId },
      data: { clarificationPolicy: 'CONSERVATIVE' },
    });

    // Create a ticket without specifying a policy (should inherit)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test Ticket for Inheritance',
        description: 'Test ticket to verify policy inheritance',
        stage: 'INBOX',
        projectId: testProjectId,
        updatedAt: new Date(), // Required field
        // clarificationPolicy: null (inherited from project)
      },
      include: {
        project: {
          select: { clarificationPolicy: true },
        },
      },
    });

    // Verify ticket has null policy (inherits from project)
    expect(ticket.clarificationPolicy).toBeNull();

    // Verify effective policy resolves to CONSERVATIVE
    const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;
    expect(effectivePolicy).toBe('CONSERVATIVE');

    // Cleanup ticket
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('GET /api/projects/:id returns clarificationPolicy', async ({ request }) => {
    // Update project policy to PRAGMATIC
    await prisma.project.update({
      where: { id: testProjectId },
      data: { clarificationPolicy: 'PRAGMATIC' },
    });

    // Fetch project via API
    const response = await request.get(`http://localhost:3000/api/projects/${testProjectId}`);

    expect(response.status()).toBe(200);

    const project = await response.json();

    // Verify clarificationPolicy is returned
    expect(project).toHaveProperty('clarificationPolicy');
    expect(project.clarificationPolicy).toBe('PRAGMATIC');
  });

  test('PATCH /api/projects/:id updates clarificationPolicy', async ({ request }) => {
    // Verify initial policy is AUTO
    let project = await prisma.project.findUnique({
      where: { id: testProjectId },
      select: { clarificationPolicy: true },
    });
    expect(project?.clarificationPolicy).toBe('AUTO');

    // Update policy via API
    const response = await request.patch(`http://localhost:3000/api/projects/${testProjectId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { clarificationPolicy: 'CONSERVATIVE' },
    });

    expect(response.status()).toBe(200);

    const updatedProject = await response.json();
    expect(updatedProject.clarificationPolicy).toBe('CONSERVATIVE');

    // Verify persistence in database
    project = await prisma.project.findUnique({
      where: { id: testProjectId },
      select: { clarificationPolicy: true },
    });
    expect(project?.clarificationPolicy).toBe('CONSERVATIVE');
  });

  test('PATCH /api/projects/:id rejects invalid policy with 400', async ({ request }) => {
    // Attempt to set invalid policy
    const response = await request.patch(`http://localhost:3000/api/projects/${testProjectId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { clarificationPolicy: 'INVALID_POLICY' },
    });

    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toBe('Validation failed');
    expect(error).toHaveProperty('issues'); // Changed from 'details' to 'issues'
  });

  test('Project settings page displays policy options with icons', async ({ page }) => {
    await page.goto(`http://localhost:3000/projects/${testProjectId}/settings`);

    // Wait for settings page to load
    await expect(page.getByText('Default Clarification Policy')).toBeVisible();

    // Open policy select using data-testid or button locator
    const selectTrigger = page.locator('button').filter({ hasText: 'AUTO' }).first();
    await selectTrigger.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(300);

    // Verify dropdown appeared (use first() to avoid strict mode violation with multiple matches)
    const dropdown = page.locator('[role="listbox"]').first();
    await expect(dropdown).toBeVisible();

    // Verify icons are present (emojis) - check they're visible anywhere on page
    const pageContent = await page.content();
    expect(pageContent).toContain('🤖');
    expect(pageContent).toContain('🛡️');
    expect(pageContent).toContain('⚡');
  });
});

test.describe('Clarification Policy - User Story 2', () => {
  let testProjectId: number;
  let testTicketId: number;

  test.beforeEach(async () => {
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

    // Create test project with CONSERVATIVE policy
    const project = await prisma.project.create({
      data: {
        name: '[e2e] Policy Override Test Project',
        description: 'Test project for ticket policy overrides',
        githubOwner: 'test',
        githubRepo: 'test-override',
        userId: testUser.id,
        clarificationPolicy: 'CONSERVATIVE', // Project default
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });

    testProjectId = project.id;

    // Create test ticket without policy override (inherits CONSERVATIVE)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test Ticket for Override',
        description: 'Test ticket for policy override',
        stage: 'INBOX',
        projectId: testProjectId,
        clarificationPolicy: null, // Inherit from project
        updatedAt: new Date(), // Required field
      },
    });

    testTicketId = ticket.id;
  });

  test.afterEach(async () => {
    // Cleanup test data
    if (testProjectId) {
      await prisma.project.delete({
        where: { id: testProjectId },
      });
    }
  });

  test('T032: User can override ticket policy via edit dialog', async ({ page }) => {
    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Test Ticket for Override').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify policy badge shows CONSERVATIVE (inherited from project)
    const policyBadge = page.getByTestId('policy-badge').first();
    await expect(policyBadge.getByTestId('policy-label')).toHaveText('CONSERVATIVE');
    await expect(policyBadge.getByTestId('policy-override-label')).not.toBeVisible(); // Not an override yet

    // Click "Edit Policy" button
    await page.getByTestId('edit-policy-button').click();

    // Wait for policy edit dialog to open
    await expect(page.getByText('Edit Clarification Policy')).toBeVisible();

    // Verify current policy shows CONSERVATIVE (project default) - use first() to avoid strict mode
    await expect(page.getByText(/CONSERVATIVE.*project default/).first()).toBeVisible();

    // Open policy select dropdown
    const selectTrigger = page.locator('#policy-select');
    await selectTrigger.click();

    // Select PRAGMATIC policy (override)
    await page.getByRole('option', { name: /PRAGMATIC/ }).click();

    // Click "Save Changes" button
    await page.getByRole('button', { name: /Save Changes/ }).click();

    // Wait for policy edit dialog to close
    await expect(page.getByText('Edit Clarification Policy')).not.toBeVisible();

    // Ensure ticket detail modal is still open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Wait for badge to update and become visible
    await page.waitForTimeout(1000);

    // Verify policy badge now shows PRAGMATIC with "(override)" label
    await expect(page.getByText('PRAGMATIC')).toBeVisible();
    await expect(page.getByText('(override)')).toBeVisible();

    // Verify the change persisted to database
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
      select: { clarificationPolicy: true },
    });

    expect(updatedTicket?.clarificationPolicy).toBe('PRAGMATIC');
  });

  test('T033: User can reset ticket policy to null (revert to project default)', async ({ page }) => {
    // First, set ticket policy to PRAGMATIC (override)
    await prisma.ticket.update({
      where: { id: testTicketId },
      data: { clarificationPolicy: 'PRAGMATIC' },
    });

    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 });

    // Click on ticket to open detail modal
    await page.getByText('[e2e] Test Ticket for Override').click();

    // Wait for ticket detail modal to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify policy badge shows PRAGMATIC with "(override)" label
    const initialBadge = page.getByTestId('policy-badge').first();
    await expect(initialBadge.getByTestId('policy-label')).toHaveText('PRAGMATIC');
    await expect(initialBadge.getByTestId('policy-override-label')).toBeVisible();

    // Click "Edit Policy" button
    await page.getByTestId('edit-policy-button').click();

    // Wait for policy edit dialog to open
    await expect(page.getByText('Edit Clarification Policy')).toBeVisible();

    // Verify current policy shows PRAGMATIC (override) in the edit dialog text
    await expect(page.getByText(/PRAGMATIC.*override/).first()).toBeVisible();

    // Open policy select dropdown
    const selectTrigger = page.locator('#policy-select');
    await selectTrigger.click();

    // Select "Use project default" option
    await page.getByRole('option', { name: /Use project default/ }).click();

    // Click "Save Changes" button
    await page.getByRole('button', { name: /Save Changes/ }).click();

    // Wait for policy edit dialog to close
    await expect(page.getByText('Edit Clarification Policy')).not.toBeVisible();

    // Ensure ticket detail modal is still open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Wait for badge to update and become visible
    await page.waitForTimeout(1000);

    // Verify policy badge now shows CONSERVATIVE (project default) without "(override)"
    await expect(page.getByText('CONSERVATIVE')).toBeVisible();
    await expect(page.getByText('(override)')).not.toBeVisible();

    // Verify the ticket policy was reset to null in database
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
      select: { clarificationPolicy: true },
    });

    expect(updatedTicket?.clarificationPolicy).toBeNull();
  });

  test('PATCH /api/projects/:projectId/tickets/:id accepts null clarificationPolicy', async ({ request }) => {
    // First, set ticket policy to PRAGMATIC
    await prisma.ticket.update({
      where: { id: testTicketId },
      data: { clarificationPolicy: 'PRAGMATIC', version: 1 },
    });

    // Reset policy to null via API
    const response = await request.patch(
      `http://localhost:3000/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { clarificationPolicy: null, version: 1 },
      }
    );

    expect(response.status()).toBe(200);

    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBeNull();

    // Verify persistence in database
    const ticket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
      select: { clarificationPolicy: true },
    });
    expect(ticket?.clarificationPolicy).toBeNull();
  });

  test('PATCH /api/projects/:projectId/tickets/:id updates clarificationPolicy', async ({ request }) => {
    // Verify initial policy is null (inherited)
    let ticket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
      select: { clarificationPolicy: true, version: true },
    });
    expect(ticket?.clarificationPolicy).toBeNull();

    // Update policy via API
    const response = await request.patch(
      `http://localhost:3000/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { clarificationPolicy: 'PRAGMATIC', version: ticket?.version },
      }
    );

    expect(response.status()).toBe(200);

    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBe('PRAGMATIC');

    // Verify persistence in database
    ticket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
      select: { clarificationPolicy: true },
    });
    expect(ticket?.clarificationPolicy).toBe('PRAGMATIC');
  });

  test('Ticket creation modal allows setting optional policy', async ({ page }) => {
    // Navigate to project board
    await page.goto(`http://localhost:3000/projects/${testProjectId}/board`);

    // Wait for the board to load
    await page.waitForLoadState('networkidle');

    // Click "New Ticket" button
    await page.getByRole('button', { name: /New Ticket/i }).click();

    // Wait for modal to open
    await expect(page.getByText('Create New Ticket')).toBeVisible();

    // Fill in ticket details
    await page.fill('#title', '[e2e] Test Ticket with Policy Override');
    await page.fill('#description', 'Test ticket created with PRAGMATIC policy override');

    // Open clarification policy select
    const policySelect = page.locator('#clarificationPolicy');
    await policySelect.click();

    // Verify "Use project default" is the initial selection
    await expect(page.getByRole('option', { name: /Use project default/ })).toBeVisible();

    // Select PRAGMATIC policy
    await page.getByRole('option', { name: /PRAGMATIC/ }).click();

    // Submit the form
    await page.getByRole('button', { name: /Create Ticket/i }).click();

    // Wait for modal to close and ticket to appear on board
    await expect(page.getByText('Create New Ticket')).not.toBeVisible();
    await expect(page.getByText('[e2e] Test Ticket with Policy Override')).toBeVisible();

    // Verify the ticket was created with PRAGMATIC policy in database
    const createdTicket = await prisma.ticket.findFirst({
      where: {
        title: '[e2e] Test Ticket with Policy Override',
        projectId: testProjectId,
      },
      select: { id: true, clarificationPolicy: true },
    });

    expect(createdTicket?.clarificationPolicy).toBe('PRAGMATIC');

    // Cleanup
    if (createdTicket) {
      await prisma.ticket.delete({ where: { id: createdTicket.id } });
    }
  });
});
