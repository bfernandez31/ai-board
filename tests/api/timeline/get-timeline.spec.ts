import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: GET /api/projects/[projectId]/tickets/[id]/timeline
 * Validates unified timeline API (comments + job events)
 */

test.describe('GET /api/projects/[projectId]/tickets/[id]/timeline - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';
  let testTicketId: number;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);

    // Ensure worker project exists
    const { ensureProjectExists } = await import('../../helpers/db-cleanup');
    await ensureProjectExists(projectId);

    // Create test ticket using worker-specific project
    const { getProjectKey } = await import('../../helpers/db-cleanup');
    const projectKey = getProjectKey(projectId);

    const testTicket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test Ticket',
        description: 'Test ticket for timeline',
        projectId,
        ticketNumber: 1,
        ticketKey: `${projectKey}-1`,
        updatedAt: new Date(),
      },
    });
    testTicketId = testTicket.id;
  });

  test('should return 200 with empty timeline for ticket with no events', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/timeline`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('timeline');
    expect(body).toHaveProperty('mentionedUsers');
    expect(Array.isArray(body.timeline)).toBe(true);
    expect(body.timeline.length).toBe(0);
  });

  test('should return comments and jobs in reverse chronological order (newest first)', async ({ request, projectId }) => {
    // Create comments with different timestamps
    await prisma.comment.createMany({
      data: [
        {
          ticketId: testTicketId,
          userId: 'test-user-id',
          content: 'First comment',
          createdAt: new Date('2025-01-22T10:00:00Z'),
        },
        {
          ticketId: testTicketId,
          userId: 'test-user-id',
          content: 'Second comment',
          createdAt: new Date('2025-01-22T11:00:00Z'),
        },
      ],
    });

    // Create job with different timestamps
    await prisma.job.create({
      data: {
        ticketId: testTicketId,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2025-01-22T09:00:00Z'),
        completedAt: new Date('2025-01-22T09:30:00Z'),
        branch: '001-test',
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/timeline`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should have 4 events: 2 comments + 2 job events (start + complete)
    expect(body.timeline.length).toBe(4);

    // Verify reverse chronological order (newest first)
    expect(body.timeline[0].type).toBe('comment');
    expect(body.timeline[0].data.content).toBe('Second comment');

    expect(body.timeline[1].type).toBe('comment');
    expect(body.timeline[1].data.content).toBe('First comment');

    expect(body.timeline[2].type).toBe('job');
    expect(body.timeline[2].eventType).toBe('complete');

    expect(body.timeline[3].type).toBe('job');
    expect(body.timeline[3].eventType).toBe('start');
  });

  test('should include job events with start and complete types', async ({ request , projectId }) => {
    // Create completed job
    await prisma.job.create({
      data: {
        ticketId: testTicketId,
        projectId,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2025-01-22T10:00:00Z'),
        completedAt: new Date('2025-01-22T10:30:00Z'),
        branch: '001-test',
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/timeline`);
    const body = await response.json();

    // Should have 2 job events: start + complete
    expect(body.timeline.length).toBe(2);

    const startEvent = body.timeline.find(
      (e: any) => e.type === 'job' && e.eventType === 'start'
    );
    const completeEvent = body.timeline.find(
      (e: any) => e.type === 'job' && e.eventType === 'complete'
    );

    expect(startEvent).toBeDefined();
    expect(startEvent.data.command).toBe('specify');
    expect(startEvent.data.status).toBe('COMPLETED');

    expect(completeEvent).toBeDefined();
    expect(completeEvent.data.command).toBe('specify');
    expect(completeEvent.data.status).toBe('COMPLETED');
  });

  test('should only include start event for running jobs (no completedAt)', async ({ request , projectId }) => {
    // Create running job (no completedAt)
    await prisma.job.create({
      data: {
        ticketId: testTicketId,
        projectId,
        command: 'implement',
        status: 'RUNNING',
        startedAt: new Date('2025-01-22T10:00:00Z'),
        branch: '001-test',
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/timeline`);
    const body = await response.json();

    // Should have only 1 job event: start (no complete)
    expect(body.timeline.length).toBe(1);
    expect(body.timeline[0].type).toBe('job');
    expect(body.timeline[0].eventType).toBe('start');
    expect(body.timeline[0].data.status).toBe('RUNNING');
  });

  test('should include user data in comment events', async ({ request , projectId }) => {
    await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: 'test-user-id',
        content: 'Test comment with user data',
      },
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/timeline`);
    const body = await response.json();

    expect(body.timeline.length).toBe(1);
    expect(body.timeline[0].type).toBe('comment');
    expect(body.timeline[0].data.user).toBeDefined();
    expect(body.timeline[0].data.user.name).toBe('E2E Test User');
    expect(body.timeline[0].data.user.email).toBe('test@e2e.local');
  });

  test('should return 400 for invalid project ID', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/abc/tickets/1/timeline`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid project ID');
  });

  test('should return 400 for invalid ticket ID', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/abc/timeline`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid');
  });

  test('should return 404 for non-existent ticket', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/999999/timeline`);

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Ticket not found');
  });

  test('should include VERIFY jobs but exclude SHIP stage jobs from timeline', async ({ request , projectId }) => {
    // Create jobs for different stages
    await prisma.job.createMany({
      data: [
        {
          ticketId: testTicketId,
          projectId,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-22T10:00:00Z'),
          completedAt: new Date('2025-01-22T10:30:00Z'),
          branch: '001-test',
          updatedAt: new Date(),
        },
        {
          ticketId: testTicketId,
          projectId,
          command: 'verify',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-22T11:00:00Z'),
          completedAt: new Date('2025-01-22T11:30:00Z'),
          branch: '001-test',
          updatedAt: new Date(),
        },
        {
          ticketId: testTicketId,
          projectId,
          command: 'ship',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-22T12:00:00Z'),
          completedAt: new Date('2025-01-22T12:30:00Z'),
          branch: '001-test',
          updatedAt: new Date(),
        },
      ],
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/timeline`);
    const body = await response.json();

    // Should include specify + verify job events (4 events: 2 start + 2 complete)
    expect(body.timeline.length).toBe(4);

    // Verify both specify and verify commands are present
    const commands = body.timeline.map((e: any) => e.data.command);
    expect(commands.filter((c: string) => c === 'specify').length).toBe(2); // start + complete
    expect(commands.filter((c: string) => c === 'verify').length).toBe(2); // start + complete

    // Verify ship command is NOT present
    expect(commands.includes('ship')).toBe(false);
  });

  test('should include mentionedUsers map for @mentions in comments', async ({ request , projectId }) => {
    // Create another user to mention
    await prisma.user.upsert({
      where: { id: 'mentioned-user-id' },
      update: {},
      create: {
        id: 'mentioned-user-id',
        email: 'mentioned@e2e.local',
        name: 'Mentioned User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create comment with mention
    await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: 'test-user-id',
        content: 'Hey @[mentioned-user-id:Mentioned User], check this out!',
      },
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/timeline`);
    const body = await response.json();

    expect(body.mentionedUsers).toBeDefined();
    expect(body.mentionedUsers['mentioned-user-id']).toBeDefined();
    expect(body.mentionedUsers['mentioned-user-id'].name).toBe('Mentioned User');
  });
});
