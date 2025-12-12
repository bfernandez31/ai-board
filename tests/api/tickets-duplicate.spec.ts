import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, getProjectKey } from '../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: POST /api/projects/${projectId}/tickets/${id}/duplicate
 * Validates API contract from specs/AIB-106-duplicate-a-ticket/contracts/duplicate-ticket-api.ts
 *
 * This test validates the duplicate ticket endpoint behavior
 */

test.describe('POST /api/projects/${projectId}/tickets/${id}/duplicate - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';
  let testTicketId: number;

  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test
    await cleanupDatabase(projectId);

    // Create test user
    await prisma.user.upsert({
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
    const projectKey = getProjectKey(projectId);
    await prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        name: '[e2e] API Test Project',
        description: 'Test project for API tests',
        githubOwner: 'test',
        githubRepo: `test${projectId}`,
        userId: 'test-user-id',
        key: projectKey,
        updatedAt: new Date(),
      },
    });

    // Ensure the project-specific sequence exists and get the next ticket number
    // This ensures no ticketKey conflicts when duplicating
    const nextTicketNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const sourceTicketNumber = nextTicketNumResult[0]?.get_next_ticket_number || 1;

    // Create source ticket with the sequence-generated number
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Source Ticket for Duplication',
        description: 'This ticket will be duplicated',
        stage: 'INBOX',
        projectId: projectId,
        ticketNumber: sourceTicketNumber,
        ticketKey: `${projectKey}-${sourceTicketNumber}`,
        clarificationPolicy: 'PRAGMATIC',
        attachments: [
          {
            type: 'external',
            url: 'https://example.com/image.png',
            filename: 'image.png',
            mimeType: 'image/png',
            sizeBytes: 1000,
            uploadedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date(),
      },
    });

    testTicketId = ticket.id;
  });

  test('T004: should duplicate ticket and return 201 with complete response schema', async ({ request, projectId }) => {
    const response = await request.post(
      `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/duplicate`
    );

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();

    // Validate DuplicateTicketResponse schema
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);
    expect(body.id).not.toBe(testTicketId); // Must be different from source

    expect(body).toHaveProperty('ticketNumber');
    expect(typeof body.ticketNumber).toBe('number');
    expect(body.ticketNumber).toBeGreaterThan(0); // Should be a positive integer

    expect(body).toHaveProperty('ticketKey');
    expect(typeof body.ticketKey).toBe('string');
    expect(body.ticketKey).toMatch(/^[A-Z0-9]+-\d+$/); // Format: KEY-NUMBER

    expect(body).toHaveProperty('title');
    expect(body.title).toBe('Copy of [e2e] Source Ticket for Duplication');

    expect(body).toHaveProperty('description');
    expect(body.description).toBe('This ticket will be duplicated');

    expect(body).toHaveProperty('stage');
    expect(body.stage).toBe('INBOX'); // Always INBOX for duplicates

    expect(body).toHaveProperty('version');
    expect(body.version).toBe(1); // New ticket starts at version 1

    expect(body).toHaveProperty('projectId');
    expect(body.projectId).toBe(projectId);

    expect(body).toHaveProperty('branch');
    expect(body.branch).toBeNull(); // No branch for new tickets

    expect(body).toHaveProperty('previewUrl');
    expect(body.previewUrl).toBeNull(); // No preview for new tickets

    expect(body).toHaveProperty('autoMode');
    expect(body.autoMode).toBe(false);

    expect(body).toHaveProperty('workflowType');
    expect(body.workflowType).toBe('FULL');

    expect(body).toHaveProperty('attachments');
    expect(Array.isArray(body.attachments)).toBe(true);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].url).toBe('https://example.com/image.png');

    expect(body).toHaveProperty('clarificationPolicy');
    expect(body.clarificationPolicy).toBe('PRAGMATIC');

    expect(body).toHaveProperty('createdAt');
    expect(typeof body.createdAt).toBe('string');
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);

    expect(body).toHaveProperty('updatedAt');
    expect(typeof body.updatedAt).toBe('string');
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
  });

  test('T016: should return 404 when source ticket not found', async ({ request, projectId }) => {
    const nonExistentTicketId = 999999;

    const response = await request.post(
      `${BASE_URL}/api/projects/${projectId}/tickets/${nonExistentTicketId}/duplicate`
    );

    expect(response.status()).toBe(404);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body.error).toBe('Ticket not found');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('TICKET_NOT_FOUND');
  });

  test('T017: should return 404 when project not found', async ({ request }) => {
    const nonExistentProjectId = 999999;

    const response = await request.post(
      `${BASE_URL}/api/projects/${nonExistentProjectId}/tickets/${testTicketId}/duplicate`
    );

    expect(response.status()).toBe(404);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body.error).toBe('Project not found');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('PROJECT_NOT_FOUND');
  });

  test('T025: should return 400 for invalid projectId format', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/projects/invalid/tickets/${testTicketId}/duplicate`
    );

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('T025: should return 400 for invalid ticketId format', async ({ request, projectId }) => {
    const response = await request.post(
      `${BASE_URL}/api/projects/${projectId}/tickets/invalid/duplicate`
    );

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should handle long title truncation (>92 chars after prefix)', async ({ request, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Get next ticket number from sequence
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 10;

    // Create ticket with title exactly 100 chars (max)
    const longTitle = '[e2e] ' + 'A'.repeat(94); // 100 chars total
    const longTicket = await prisma.ticket.create({
      data: {
        title: longTitle,
        description: 'Long title ticket',
        stage: 'INBOX',
        projectId: projectId,
        ticketNumber: ticketNum,
        ticketKey: `${projectKey}-${ticketNum}`,
        updatedAt: new Date(),
      },
    });

    const response = await request.post(
      `${BASE_URL}/api/projects/${projectId}/tickets/${longTicket.id}/duplicate`
    );

    expect(response.status()).toBe(201);

    const body = await response.json();

    // Title should be truncated to 100 chars max
    expect(body.title.length).toBeLessThanOrEqual(100);
    expect(body.title.startsWith('Copy of ')).toBe(true);
  });

  test('should preserve attachments in duplicate', async ({ request, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Get next ticket number from sequence
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 20;

    // Create ticket with 5 attachments (max)
    const ticketWithAttachments = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket with Max Attachments',
        description: 'Ticket with 5 attachments',
        stage: 'INBOX',
        projectId: projectId,
        ticketNumber: ticketNum,
        ticketKey: `${projectKey}-${ticketNum}`,
        attachments: [
          { type: 'external', url: 'https://example.com/1.png', filename: 'img1.png', mimeType: 'image/png', sizeBytes: 100, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/2.png', filename: 'img2.png', mimeType: 'image/png', sizeBytes: 100, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/3.png', filename: 'img3.png', mimeType: 'image/png', sizeBytes: 100, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/4.png', filename: 'img4.png', mimeType: 'image/png', sizeBytes: 100, uploadedAt: new Date().toISOString() },
          { type: 'external', url: 'https://example.com/5.png', filename: 'img5.png', mimeType: 'image/png', sizeBytes: 100, uploadedAt: new Date().toISOString() },
        ],
        updatedAt: new Date(),
      },
    });

    const response = await request.post(
      `${BASE_URL}/api/projects/${projectId}/tickets/${ticketWithAttachments.id}/duplicate`
    );

    expect(response.status()).toBe(201);

    const body = await response.json();

    expect(body.attachments).toHaveLength(5);
    expect(body.attachments[0].url).toBe('https://example.com/1.png');
    expect(body.attachments[4].url).toBe('https://example.com/5.png');
  });

  test('should handle ticket in different stages', async ({ request, projectId }) => {
    const projectKey = getProjectKey(projectId);

    // Get next ticket number from sequence
    const nextNumResult = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;
    const ticketNum = nextNumResult[0]?.get_next_ticket_number || 30;

    // Create ticket in BUILD stage (not INBOX)
    const buildTicket = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket in BUILD',
        description: 'Ticket that has progressed to BUILD stage',
        stage: 'BUILD',
        projectId: projectId,
        ticketNumber: ticketNum,
        ticketKey: `${projectKey}-${ticketNum}`,
        branch: `${ticketNum}-ticket-in-build`,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    const response = await request.post(
      `${BASE_URL}/api/projects/${projectId}/tickets/${buildTicket.id}/duplicate`
    );

    expect(response.status()).toBe(201);

    const body = await response.json();

    // Duplicate should ALWAYS be in INBOX regardless of source stage
    expect(body.stage).toBe('INBOX');
    // Branch should be null for duplicate
    expect(body.branch).toBeNull();
    // workflowType should be FULL (default)
    expect(body.workflowType).toBe('FULL');
  });

  test('should return 404 when ticket exists but in different project', async ({ request, projectId }) => {
    // testTicketId belongs to projectId, try to duplicate from a different project
    const differentProjectId = projectId === 1 ? 2 : 1;

    const response = await request.post(
      `${BASE_URL}/api/projects/${differentProjectId}/tickets/${testTicketId}/duplicate`
    );

    // Should return 404 because ticket not found in that project
    expect(response.status()).toBe(404);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body.code).toBe('TICKET_NOT_FOUND');
  });
});
