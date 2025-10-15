import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { ClarificationPolicy } from '@prisma/client';

/**
 * Contract Tests: GET/PATCH /api/projects/[projectId]/tickets/[id] - clarificationPolicy field
 * Feature: 029-999-auto-clarification (User Story 2)
 * Source: specs/029-999-auto-clarification/contracts/api-contracts.yaml
 *
 * ⚠️ CRITICAL: These tests MUST FAIL initially (TDD requirement)
 * They should only pass after implementation of ticket policy endpoints in Phase 3
 */

test.describe('GET /api/projects/[projectId]/tickets/[id] - clarificationPolicy field', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create a ticket via API
   */
  const createTicket = async (
    request: any,
    title: string = '[e2e] Test Ticket',
    description: string = 'Test description'
  ): Promise<{ id: number; version: number }> => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: { title, description },
    });
    const ticket = await response.json();
    return { id: ticket.id, version: ticket.version || 1 };
  };

  /**
   * T001: GET ticket returns clarificationPolicy field (default null)
   */
  test('GET ticket returns clarificationPolicy with default null', async ({ request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // GET ticket
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`);

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response includes clarificationPolicy (null = inherit from project)
    const data = await response.json();
    expect(data).toHaveProperty('clarificationPolicy');
    expect(data.clarificationPolicy).toBeNull();
  });

  /**
   * T002: GET ticket returns clarificationPolicy for all policy values
   */
  test('GET ticket returns clarificationPolicy when set to CONSERVATIVE', async ({ request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // Update ticket to CONSERVATIVE
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
    });

    // GET ticket
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`);

    // Assert response includes CONSERVATIVE policy
    const data = await response.json();
    expect(data.clarificationPolicy).toBe('CONSERVATIVE');
  });

  test('GET ticket returns clarificationPolicy when set to PRAGMATIC', async ({ request }) => {
    const ticket = await createTicket(request);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { clarificationPolicy: ClarificationPolicy.PRAGMATIC },
    });

    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`);
    const data = await response.json();
    expect(data.clarificationPolicy).toBe('PRAGMATIC');
  });

  test('GET ticket returns clarificationPolicy when set to AUTO', async ({ request }) => {
    const ticket = await createTicket(request);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { clarificationPolicy: ClarificationPolicy.AUTO },
    });

    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`);
    const data = await response.json();
    expect(data.clarificationPolicy).toBe('AUTO');
  });

  test('GET ticket returns clarificationPolicy when set to INTERACTIVE', async ({ request }) => {
    const ticket = await createTicket(request);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { clarificationPolicy: ClarificationPolicy.INTERACTIVE },
    });

    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`);
    const data = await response.json();
    expect(data.clarificationPolicy).toBe('INTERACTIVE');
  });

  /**
   * T003: GET non-existent ticket returns 404
   */
  test('GET non-existent ticket returns 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/99999`);
    expect(response.status()).toBe(404);
  });
});

test.describe('PATCH /api/projects/[projectId]/tickets/[id] - clarificationPolicy updates', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  const createTicket = async (request: any): Promise<{ id: number; version: number }> => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await response.json();
    return { id: ticket.id, version: ticket.version || 1 };
  };

  /**
   * T004: PATCH ticket with valid clarificationPolicy updates field
   */
  test('PATCH ticket to CONSERVATIVE updates clarificationPolicy', async ({ request }) => {
    const ticket = await createTicket(request);

    // Verify initial state (null by default)
    const initialTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(initialTicket?.clarificationPolicy).toBeNull();

    // PATCH to CONSERVATIVE
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'CONSERVATIVE',
        version: ticket.version,
      },
    });

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response body
    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBe('CONSERVATIVE');
    expect(updatedTicket.version).toBe(ticket.version + 1);

    // Verify database state
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.clarificationPolicy).toBe('CONSERVATIVE');
  });

  test('PATCH ticket to PRAGMATIC updates clarificationPolicy', async ({ request }) => {
    const ticket = await createTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'PRAGMATIC',
        version: ticket.version,
      },
    });

    expect(response.status()).toBe(200);

    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBe('PRAGMATIC');
  });

  test('PATCH ticket to AUTO updates clarificationPolicy', async ({ request }) => {
    const ticket = await createTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'AUTO',
        version: ticket.version,
      },
    });

    expect(response.status()).toBe(200);

    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBe('AUTO');
  });

  test('PATCH ticket to INTERACTIVE updates clarificationPolicy', async ({ request }) => {
    const ticket = await createTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'INTERACTIVE',
        version: ticket.version,
      },
    });

    expect(response.status()).toBe(200);

    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBe('INTERACTIVE');
  });

  /**
   * T005: PATCH ticket to null resets to inherit from project
   */
  test('PATCH ticket to null resets clarificationPolicy', async ({ request }) => {
    const ticket = await createTicket(request);

    // First set to CONSERVATIVE
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE, version: 2 },
    });

    // PATCH back to null
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: null,
        version: 2,
      },
    });

    expect(response.status()).toBe(200);

    // Assert response
    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBeNull();

    // Verify database
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.clarificationPolicy).toBeNull();
  });

  /**
   * T006: PATCH ticket with invalid policy returns 400
   */
  test('PATCH ticket with invalid policy returns 400 validation error', async ({ request }) => {
    const ticket = await createTicket(request);

    // PATCH with invalid policy value
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'INVALID_POLICY',
        version: ticket.version,
      },
    });

    // Assert 400 Bad Request
    expect(response.status()).toBe(400);

    // Assert error response structure (Zod validation)
    const error = await response.json();
    expect(error.error).toBe('Validation failed');
    expect(error.issues).toBeDefined();
    expect(Array.isArray(error.issues)).toBe(true);
    expect(error.issues[0].path).toContain('clarificationPolicy');
  });

  /**
   * T007: PATCH ticket with stale version returns 409 Conflict
   */
  test('PATCH ticket policy with stale version returns 409 Conflict', async ({ request }) => {
    const ticket = await createTicket(request);

    // Update ticket directly in database to version 2
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { version: 2 },
    });

    // PATCH with stale version (version = 1)
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'CONSERVATIVE',
        version: 1, // Stale version
      },
    });

    // Assert 409 Conflict
    expect(response.status()).toBe(409);

    // Assert error response
    const error = await response.json();
    expect(error.error).toContain('Conflict');
    expect(error.currentVersion).toBe(2);
  });

  /**
   * T008: PATCH non-existent ticket returns 404
   */
  test('PATCH non-existent ticket returns 404', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/99999`, {
      data: {
        clarificationPolicy: 'CONSERVATIVE',
        version: 1,
      },
    });

    expect(response.status()).toBe(404);
  });

  /**
   * T009: PATCH ticket with other fields does not affect clarificationPolicy
   */
  test('PATCH ticket title does not affect clarificationPolicy', async ({ request }) => {
    const ticket = await createTicket(request);

    // Set initial policy to CONSERVATIVE
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE, version: 2 },
    });

    // PATCH only title
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: '[e2e] Updated Title',
        version: 2,
      },
    });

    expect(response.status()).toBe(200);

    // Verify policy unchanged
    const updatedTicket = await response.json();
    expect(updatedTicket.clarificationPolicy).toBe('CONSERVATIVE');
  });

  /**
   * T010: PATCH ticket policy persists across multiple updates
   */
  test('PATCH ticket policy persists across multiple updates', async ({ request }) => {
    const ticket = await createTicket(request);

    // Update 1: null → CONSERVATIVE
    const resp1 = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { clarificationPolicy: 'CONSERVATIVE', version: 1 },
    });
    const ticket1 = await resp1.json();

    // Update 2: CONSERVATIVE → PRAGMATIC
    const resp2 = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { clarificationPolicy: 'PRAGMATIC', version: ticket1.version },
    });
    const ticket2 = await resp2.json();

    // Update 3: PRAGMATIC → null
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { clarificationPolicy: null, version: ticket2.version },
    });

    expect(response.status()).toBe(200);

    // Verify final state
    const finalTicket = await response.json();
    expect(finalTicket.clarificationPolicy).toBeNull();

    // Verify database
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.clarificationPolicy).toBeNull();
  });
});

test.describe('PATCH /api/projects/[projectId]/tickets/[id] - Response Format', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  const createTicket = async (request: any): Promise<{ id: number; version: number }> => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await response.json();
    return { id: ticket.id, version: ticket.version || 1 };
  };

  /**
   * T011: PATCH response includes all expected ticket fields
   */
  test('PATCH response includes all expected ticket fields', async ({ request }) => {
    const ticket = await createTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'CONSERVATIVE',
        version: ticket.version,
      },
    });

    expect(response.status()).toBe(200);

    const updatedTicket = await response.json();

    // Verify response structure (from existing ticket API contract)
    expect(updatedTicket).toHaveProperty('id');
    expect(updatedTicket).toHaveProperty('title');
    expect(updatedTicket).toHaveProperty('description');
    expect(updatedTicket).toHaveProperty('stage');
    expect(updatedTicket).toHaveProperty('version');
    expect(updatedTicket).toHaveProperty('clarificationPolicy');
    expect(updatedTicket).toHaveProperty('createdAt');
    expect(updatedTicket).toHaveProperty('updatedAt');
  });

  /**
   * T012: PATCH updates updatedAt timestamp
   */
  test('PATCH updates updatedAt timestamp', async ({ request }) => {
    const ticket = await createTicket(request);

    // Get initial updatedAt
    const initialTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    const initialUpdatedAt = initialTicket?.updatedAt;

    // Wait 10ms to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // PATCH policy
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'CONSERVATIVE',
        version: ticket.version,
      },
    });

    expect(response.status()).toBe(200);

    // Verify updatedAt changed
    const updatedTicket = await response.json();
    const newUpdatedAt = new Date(updatedTicket.updatedAt);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt!.getTime());
  });
});

test.describe('Hierarchical Policy Resolution - Effective Policy', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  const createTicket = async (request: any): Promise<{ id: number; version: number }> => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await response.json();
    return { id: ticket.id, version: ticket.version || 1 };
  };

  /**
   * T013: Ticket inherits project policy when ticket policy is null
   */
  test('Ticket with null policy inherits project AUTO default', async ({ request }) => {
    // Verify project has AUTO default
    const project = await prisma.project.findUnique({ where: { id: 1 } });
    expect(project?.clarificationPolicy).toBe('AUTO');

    // Create ticket (policy = null)
    const ticket = await createTicket(request);

    // Verify ticket has null policy (inherits from project)
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.clarificationPolicy).toBeNull();

    // Effective policy should be AUTO (from project)
    // This will be tested in implementation phase
  });

  test('Ticket with null policy inherits project CONSERVATIVE', async ({ request }) => {
    // Set project to CONSERVATIVE
    await prisma.project.update({
      where: { id: 1 },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
    });

    // Create ticket
    const ticket = await createTicket(request);

    // Verify ticket has null policy
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.clarificationPolicy).toBeNull();

    // Effective policy should be CONSERVATIVE (from project)
  });

  /**
   * T014: Ticket policy overrides project policy when set
   */
  test('Ticket PRAGMATIC overrides project CONSERVATIVE', async ({ request }) => {
    // Set project to CONSERVATIVE
    await prisma.project.update({
      where: { id: 1 },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
    });

    // Create ticket
    const ticket = await createTicket(request);

    // Set ticket to PRAGMATIC
    await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        clarificationPolicy: 'PRAGMATIC',
        version: ticket.version,
      },
    });

    // Verify ticket policy is PRAGMATIC (overrides project)
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.clarificationPolicy).toBe('PRAGMATIC');

    // Effective policy should be PRAGMATIC (from ticket)
  });
});
