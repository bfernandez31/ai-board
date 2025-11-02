import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase } from '../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API Test: Image Management Permission Enforcement
 *
 * Tests that image editing (upload, delete, replace) is only allowed in INBOX stage.
 * All other stages (SPECIFY, PLAN, BUILD, VERIFY, SHIP) should return 403 Forbidden.
 *
 * Permission Model:
 * - INBOX: Images editable (upload, delete, replace)
 * - SPECIFY/PLAN/BUILD/VERIFY/SHIP: Images read-only (403 on mutations)
 */

test.describe('Image Management Permissions', () => {
  const BASE_URL = 'http://localhost:3000';
  const FIXTURES_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'images');

  let testTicketInbox: number;
  let testTicketSpecify: number;
  let testTicketPlan: number;
  let testTicketBuild: number;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);

    // Create test user
    await prisma.user.upsert({
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

    // Create tickets in different stages with existing image
    const baseAttachment = {
      type: 'uploaded' as const,
      url: 'https://raw.githubusercontent.com/test/test/main/images/1/test.png',
      filename: 'test.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      uploadedAt: new Date().toISOString(),
    };

    const ticketInbox = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] INBOX ticket',
        description: 'Ticket in INBOX stage',
        stage: 'INBOX',
        projectId,
        attachments: [baseAttachment],
        updatedAt: new Date(), // Required: Ticket.updatedAt has no default
      },
    });
    testTicketInbox = ticketInbox.id;

    const ticketSpecify = await prisma.ticket.create({
      data: {
        ticketNumber: 2,
        ticketKey: `E2E${projectId}-2`,
        title: '[e2e] SPECIFY ticket',
        description: 'Ticket in SPECIFY stage',
        stage: 'SPECIFY',
        projectId,
        attachments: [baseAttachment],
        updatedAt: new Date(), // Required: Ticket.updatedAt has no default
      },
    });
    testTicketSpecify = ticketSpecify.id;

    const ticketPlan = await prisma.ticket.create({
      data: {
        ticketNumber: 3,
        ticketKey: `E2E${projectId}-3`,
        title: '[e2e] PLAN ticket',
        description: 'Ticket in PLAN stage',
        stage: 'PLAN',
        projectId,
        attachments: [baseAttachment],
        updatedAt: new Date(), // Required: Ticket.updatedAt has no default
      },
    });
    testTicketPlan = ticketPlan.id;

    const ticketBuild = await prisma.ticket.create({
      data: {
        ticketNumber: 4,
        ticketKey: `E2E${projectId}-4`,
        title: '[e2e] BUILD ticket',
        description: 'Ticket in BUILD stage',
        stage: 'BUILD',
        projectId,
        attachments: [baseAttachment],
        updatedAt: new Date(), // Required: Ticket.updatedAt has no default
      },
    });
    testTicketBuild = ticketBuild.id;
  });

  test.describe('POST /api/projects/[projectId]/tickets/[id]/images (Upload)', () => {
    test('allows upload in INBOX stage', async ({ request , projectId }) => {
      // Create test image file
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      // Create FormData
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'new-image.png');
      formData.append('version', '1');

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketInbox}/images`,
        {
          multipart: {
            file: {
              name: 'new-image.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.attachments).toHaveLength(2); // Original + new
      expect(body.version).toBe(2);
    });

    test('denies upload in SPECIFY stage (403)', async ({ request , projectId }) => {
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketSpecify}/images`,
        {
          multipart: {
            file: {
              name: 'new-image.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in SPECIFY stage');
      expect(body.code).toBe('FORBIDDEN');
    });

    test('denies upload in PLAN stage (403)', async ({ request , projectId }) => {
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketPlan}/images`,
        {
          multipart: {
            file: {
              name: 'new-image.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in PLAN stage');
      expect(body.code).toBe('FORBIDDEN');
    });

    test('denies upload in BUILD stage (403)', async ({ request , projectId }) => {
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketBuild}/images`,
        {
          multipart: {
            file: {
              name: 'new-image.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in BUILD stage');
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  test.describe('DELETE /api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]', () => {
    test('allows delete in INBOX stage', async ({ request , projectId }) => {
      const response = await request.delete(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketInbox}/images/0`,
        {
          data: { version: 1 },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.attachments).toHaveLength(0);
      expect(body.version).toBe(2);
    });

    test('denies delete in SPECIFY stage (403)', async ({ request , projectId }) => {
      const response = await request.delete(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketSpecify}/images/0`,
        {
          data: { version: 1 },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in SPECIFY stage');
      expect(body.code).toBe('FORBIDDEN');
    });

    test('denies delete in PLAN stage (403)', async ({ request , projectId }) => {
      const response = await request.delete(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketPlan}/images/0`,
        {
          data: { version: 1 },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in PLAN stage');
      expect(body.code).toBe('FORBIDDEN');
    });

    test('denies delete in BUILD stage (403)', async ({ request , projectId }) => {
      const response = await request.delete(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketBuild}/images/0`,
        {
          data: { version: 1 },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in BUILD stage');
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  test.describe('PUT /api/projects/[projectId]/tickets/[id]/images/[attachmentIndex] (Replace)', () => {
    test('allows replace in INBOX stage', async ({ request , projectId }) => {
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await request.put(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketInbox}/images/0`,
        {
          multipart: {
            file: {
              name: 'replacement.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].filename).toBe('replacement.png');
      expect(body.version).toBe(2);
    });

    test('denies replace in SPECIFY stage (403)', async ({ request , projectId }) => {
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await request.put(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketSpecify}/images/0`,
        {
          multipart: {
            file: {
              name: 'replacement.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in SPECIFY stage');
      expect(body.code).toBe('FORBIDDEN');
    });

    test('denies replace in PLAN stage (403)', async ({ request , projectId }) => {
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await request.put(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketPlan}/images/0`,
        {
          multipart: {
            file: {
              name: 'replacement.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in PLAN stage');
      expect(body.code).toBe('FORBIDDEN');
    });

    test('denies replace in BUILD stage (403)', async ({ request , projectId }) => {
      const imagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await request.put(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketBuild}/images/0`,
        {
          multipart: {
            file: {
              name: 'replacement.png',
              mimeType: 'image/png',
              buffer: imageBuffer,
            },
            version: '1',
          },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Cannot edit images in BUILD stage');
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  test.describe('GET /api/projects/[projectId]/tickets/[id]/images (View - Always Allowed)', () => {
    test('allows viewing images in INBOX stage', async ({ request , projectId }) => {
      const response = await request.get(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketInbox}/images`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.images).toHaveLength(1);
      expect(body.images[0]).toHaveProperty('index', 0);
    });

    test('allows viewing images in SPECIFY stage', async ({ request , projectId }) => {
      const response = await request.get(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketSpecify}/images`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.images).toHaveLength(1);
    });

    test('allows viewing images in PLAN stage', async ({ request , projectId }) => {
      const response = await request.get(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketPlan}/images`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.images).toHaveLength(1);
    });

    test('allows viewing images in BUILD stage', async ({ request , projectId }) => {
      const response = await request.get(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketBuild}/images`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.images).toHaveLength(1);
    });
  });
});
