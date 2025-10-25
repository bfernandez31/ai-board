import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { Stage } from '@prisma/client';

/**
 * Contract Test: PATCH /api/projects/[projectId]/tickets/[id]
 * Feature: 051-895-restricted-description
 *
 * Tests stage-based editing restrictions for description and clarificationPolicy fields.
 * These fields can only be edited when ticket is in INBOX stage.
 */

test.describe('PATCH /api/projects/[projectId]/tickets/[id] - Stage-Based Restrictions', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create a ticket directly in database with specified stage
   */
  async function createTicket(
    _request: any,
    stage: Stage = Stage.INBOX,
    description: string = '[e2e] Test description'
  ) {
    // Create ticket directly in database to avoid stage transition issues
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test ticket',
        description,
        stage,
        projectId: 1,
        version: 1,
        updatedAt: new Date(),
      },
    });

    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      stage: ticket.stage,
      version: ticket.version,
      projectId: ticket.projectId,
      branch: ticket.branch,
      autoMode: ticket.autoMode,
      clarificationPolicy: ticket.clarificationPolicy,
      workflowType: ticket.workflowType,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  /**
   * User Story 1: Edit Ticket in INBOX Stage (Priority: P1)
   * Goal: Users can freely edit ticket description and clarification policy when tickets are in INBOX stage
   */
  test.describe('User Story 1: INBOX Editing Allowed', () => {
    test('US1-T1: PATCH with description in INBOX returns 200', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.INBOX);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            description: '[e2e] Updated description in INBOX',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('description', '[e2e] Updated description in INBOX');
      expect(body).toHaveProperty('version', ticket.version + 1);
    });

    test('US1-T2: PATCH with clarificationPolicy in INBOX returns 200', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.INBOX);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            clarificationPolicy: 'PRAGMATIC',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('clarificationPolicy', 'PRAGMATIC');
      expect(body).toHaveProperty('version', ticket.version + 1);
    });

    test('US1-T3: PATCH with title in INBOX returns 200 (title not restricted)', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.INBOX);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            title: '[e2e] Updated title',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('title', '[e2e] Updated title');
      expect(body).toHaveProperty('version', ticket.version + 1);
    });
  });

  /**
   * User Story 2: Restricted Editing in Active Stages (Priority: P1)
   * Goal: Ticket descriptions and policies become read-only after leaving INBOX stage
   */
  test.describe('User Story 2: Non-INBOX Restrictions', () => {
    test('US2-T1: PATCH with description in SPECIFY returns 400 with INVALID_STAGE_FOR_EDIT', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.SPECIFY);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            description: '[e2e] Attempting to update in SPECIFY',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('code', 'INVALID_STAGE_FOR_EDIT');
      expect(body.error).toContain('INBOX stage');
    });

    test('US2-T2: PATCH with clarificationPolicy in PLAN returns 400', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.PLAN);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            clarificationPolicy: 'CONSERVATIVE',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('code', 'INVALID_STAGE_FOR_EDIT');
    });

    test('US2-T3: PATCH with description in BUILD returns 400', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.BUILD);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            description: '[e2e] Attempting to update in BUILD',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('code', 'INVALID_STAGE_FOR_EDIT');
    });

    test('US2-T4: PATCH with clarificationPolicy in VERIFY returns 400', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.VERIFY);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            clarificationPolicy: 'INTERACTIVE',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('code', 'INVALID_STAGE_FOR_EDIT');
    });

    test('US2-T5: PATCH with description in SHIP returns 400', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.SHIP);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            description: '[e2e] Attempting to update in SHIP',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('code', 'INVALID_STAGE_FOR_EDIT');
    });

    test('US2-T6: PATCH with title in SPECIFY returns 200 (title not restricted)', async ({
      request,
    }) => {
      const ticket = await createTicket(request, Stage.SPECIFY);

      const response = await request.patch(
        `${BASE_URL}/api/projects/1/tickets/${ticket.id}`,
        {
          data: {
            title: '[e2e] Updated title in SPECIFY',
            version: ticket.version,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('title', '[e2e] Updated title in SPECIFY');
      expect(body).toHaveProperty('version', ticket.version + 1);
    });
  });
});
