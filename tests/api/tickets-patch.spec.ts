import { test, expect, APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * Contract Tests: PATCH /api/tickets/[id]
 * Feature: 007-enable-inline-editing
 * Source: contracts/patch-ticket.yaml
 *
 * ⚠️ CRITICAL: These tests MUST FAIL initially (TDD requirement)
 * They should only pass after implementation of PATCH endpoint in Phase 3.3
 */

test.describe('PATCH /api/tickets/[id] - Inline Editing API', () => {
  const BASE_URL = 'http://localhost:3000';
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = new PrismaClient();
  });

  test.beforeEach(async () => {
    // Clean database before each test
    await prisma.ticket.deleteMany({});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create a ticket via API and return full ticket data
   */
  const createTicket = async (
    request: any,
    title: string = 'Test Ticket',
    description: string = 'Test description'
  ): Promise<{ id: number; version: number; title: string; description: string }> => {
    const response: APIResponse = await request.post(`${BASE_URL}/api/tickets`, {
      data: { title, description },
    });
    const ticket = await response.json();
    return {
      id: ticket.id,
      version: ticket.version || 1,
      title: ticket.title,
      description: ticket.description,
    };
  };

  /**
   * T004: PATCH with valid title returns 200 and increments version
   */
  test('PATCH with valid title updates title and increments version', async ({ request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // PATCH title
    const response = await request.patch(`${BASE_URL}/api/tickets/${ticket.id}`, {
      data: {
        title: 'Updated Title',
        version: ticket.version,
      },
    });

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response body
    const updatedTicket = await response.json();
    expect(updatedTicket.title).toBe('Updated Title');
    expect(updatedTicket.description).toBe('Original description'); // Unchanged
    expect(updatedTicket.version).toBe(ticket.version + 1); // Incremented

    // Verify database state
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.title).toBe('Updated Title');
    expect(dbTicket?.version).toBe(ticket.version + 1);
  });

  /**
   * T005: PATCH with valid description returns 200 and increments version
   */
  test('PATCH with valid description updates description and increments version', async ({ request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // PATCH description
    const response = await request.patch(`${BASE_URL}/api/tickets/${ticket.id}`, {
      data: {
        description: 'Updated description with more details',
        version: ticket.version,
      },
    });

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response body
    const updatedTicket = await response.json();
    expect(updatedTicket.title).toBe('Original Title'); // Unchanged
    expect(updatedTicket.description).toBe('Updated description with more details');
    expect(updatedTicket.version).toBe(ticket.version + 1); // Incremented

    // Verify database state
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.description).toBe('Updated description with more details');
    expect(dbTicket?.version).toBe(ticket.version + 1);
  });

  /**
   * T006: PATCH with both title and description updates both and increments version
   */
  test('PATCH with both fields updates both and increments version', async ({ request }) => {
    // Create ticket
    const ticket = await createTicket(request, 'Original Title', 'Original description');

    // PATCH both fields
    const response = await request.patch(`${BASE_URL}/api/tickets/${ticket.id}`, {
      data: {
        title: 'New Title',
        description: 'New Description',
        version: ticket.version,
      },
    });

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response body
    const updatedTicket = await response.json();
    expect(updatedTicket.title).toBe('New Title');
    expect(updatedTicket.description).toBe('New Description');
    expect(updatedTicket.version).toBe(ticket.version + 1); // Incremented

    // Verify database state
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.title).toBe('New Title');
    expect(dbTicket?.description).toBe('New Description');
    expect(dbTicket?.version).toBe(ticket.version + 1);
  });

  /**
   * T007: PATCH with empty/whitespace title returns 400 validation error
   */
  test('PATCH with empty title returns 400 validation error', async ({ request }) => {
    // Create ticket
    const ticket = await createTicket(request);

    // PATCH with empty title (whitespace only)
    const response = await request.patch(`${BASE_URL}/api/tickets/${ticket.id}`, {
      data: {
        title: '   ',
        version: ticket.version,
      },
    });

    // Assert 400 Bad Request
    expect(response.status()).toBe(400);

    // Assert error response body
    const error = await response.json();
    expect(error.error).toBe('Validation failed');
    expect(error.issues).toBeDefined();
    expect(error.issues.length).toBeGreaterThan(0);
    expect(error.issues[0].path).toContain('title');
    expect(error.issues[0].message).toContain('empty');
  });

  /**
   * T008: PATCH with stale version returns 409 Conflict
   */
  test('PATCH with stale version returns 409 Conflict', async ({ request }) => {
    // Create ticket (version = 1)
    const ticket = await createTicket(request);

    // Update ticket directly in database to version 2
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { version: 2 },
    });

    // PATCH with stale version (version = 1)
    const response = await request.patch(`${BASE_URL}/api/tickets/${ticket.id}`, {
      data: {
        title: 'Test',
        version: 1, // Stale version
      },
    });

    // Assert 409 Conflict
    expect(response.status()).toBe(409);

    // Assert error response body
    const error = await response.json();
    expect(error.error).toContain('Conflict');
    expect(error.error).toContain('modified by another user');
    expect(error.currentVersion).toBe(2);
  });

  /**
   * T009: PATCH non-existent ticket returns 404
   */
  test('PATCH non-existent ticket returns 404', async ({ request }) => {
    // PATCH to non-existent ticket ID
    const response = await request.patch(`${BASE_URL}/api/tickets/99999`, {
      data: {
        title: 'Test',
        version: 1,
      },
    });

    // Assert 404 Not Found
    expect(response.status()).toBe(404);

    // Assert error response body
    const error = await response.json();
    expect(error.error).toBe('Ticket not found');
  });
});
