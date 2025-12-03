import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, getProjectKey } from '../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';
import { JobStatus } from '@prisma/client';

/**
 * API Contract Tests: DELETE /api/projects/:projectId/tickets/:id
 *
 * Tests verify the DELETE endpoint contract matches specification:
 * - Success responses (200)
 * - Business rule violations (400)
 * - Authorization failures (403, 404)
 * - GitHub API failures (500)
 */

test.describe('DELETE /api/projects/:projectId/tickets/:id', () => {
  let testUser: { id: string };
  let ticketCounter = 100; // Counter for unique ticket numbers

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);

    // Create test user for all tests
    testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {
        updatedAt: new Date(),
      },
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Ensure test project exists with correct key for this worker
    const projectKey = getProjectKey(projectId);
    await prisma.project.upsert({
      where: { id: projectId },
      update: {
        userId: testUser.id,
        updatedAt: new Date(),
      },
      create: {
        id: projectId,
        name: '[e2e] Test Project',
        key: projectKey,
        description: 'Test project for DELETE endpoint',
        githubOwner: 'test',
        githubRepo: `test${projectId}`,
        userId: testUser.id,
        updatedAt: new Date(),
      },
    });

    // Reset counter per test to avoid conflicts
    ticketCounter = 100 + projectId * 100;
  });

  // T014: API contract test for DELETE success (INBOX ticket)
  test('DELETE success - INBOX ticket (200 OK)', async ({ request, projectId }) => {
    // Create INBOX ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - INBOX',
        description: 'Test ticket for successful deletion',
        stage: 'INBOX',
        projectId,
        ticketNumber: 100,
        ticketKey: 'TST-100',
      },
    });

    // Send DELETE request
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    // Verify response
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('deleted');
    expect(json.deleted).toMatchObject({
      ticketId: ticket.id,
      ticketKey: 'TST-100',
      branch: null, // INBOX tickets have no branch
      prsClosed: 0, // No PRs for INBOX tickets
    });

    // Verify ticket no longer exists in database
    const deletedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(deletedTicket).toBeNull();
  });

  test('DELETE success - SPECIFY ticket without branch (200 OK)', async ({ request, projectId }) => {
    // Create SPECIFY ticket without branch (no GitHub cleanup needed)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - SPECIFY',
        description: 'Test ticket without branch',
        stage: 'SPECIFY',
        branch: null,
        projectId,
        ticketNumber: 101,
        ticketKey: 'TST-101',
      },
    });

    // Send DELETE request
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    // Verify response
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty('success', true);
    expect(json.deleted).toMatchObject({
      ticketId: ticket.id,
      ticketKey: 'TST-101',
      branch: null,
    });

    // Verify ticket deleted
    const deletedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(deletedTicket).toBeNull();
  });

  test('DELETE success - ticket with COMPLETED jobs (200 OK)', async ({ request, projectId }) => {
    // Create ticket with COMPLETED job (no branch to avoid GitHub dependencies)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - Completed Job',
        description: 'Ticket with completed job',
        stage: 'INBOX',
        branch: null,
        projectId,
        ticketNumber: 102,
        ticketKey: 'TST-102',
      },
    });

    // Create COMPLETED job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'build',
        status: JobStatus.COMPLETED,
        branch: null,
        updatedAt: new Date(),
      },
    });

    // Send DELETE request
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    // Verify response
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);

    // Verify ticket deleted
    const deletedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(deletedTicket).toBeNull();

    // Verify job also deleted (cascade)
    const deletedJob = await prisma.job.findFirst({
      where: { ticketId: ticket.id },
    });
    expect(deletedJob).toBeNull();
  });

  // T015: API contract test for DELETE rejected (SHIP stage)
  test('DELETE rejected - SHIP stage ticket (400 Bad Request)', async ({ request, projectId }) => {
    // Create SHIP ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - SHIP',
        description: 'SHIP stage ticket cannot be deleted',
        stage: 'SHIP',
        branch: '997-shipped',
        projectId,
        ticketNumber: 103,
        ticketKey: 'TST-103',
      },
    });

    // Send DELETE request
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    // Verify response
    expect(response.status()).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json.error).toContain('SHIP stage');
    expect(json).toHaveProperty('code', 'INVALID_STAGE');

    // Verify ticket still exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(existingTicket).not.toBeNull();
    expect(existingTicket?.stage).toBe('SHIP');

    // Cleanup
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  // T016: API contract test for DELETE rejected (active job)
  test('DELETE rejected - ticket with PENDING job (400 Bad Request)', async ({ request, projectId }) => {
    // Create ticket with PENDING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - Pending Job',
        description: 'Ticket with pending job',
        stage: 'BUILD',
        branch: '996-pending-job',
        projectId,
        ticketNumber: 104,
        ticketKey: 'TST-104',
      },
    });

    // Create PENDING job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'build',
        status: JobStatus.PENDING,
        branch: '996-pending-job',
        updatedAt: new Date(),
      },
    });

    // Send DELETE request
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    // Verify response
    expect(response.status()).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json.error).toContain('job is in progress');
    expect(json).toHaveProperty('code', 'ACTIVE_JOB');

    // Verify ticket still exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(existingTicket).not.toBeNull();

    // Cleanup
    await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('DELETE rejected - ticket with RUNNING job (400 Bad Request)', async ({ request, projectId }) => {
    // Create ticket with RUNNING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - Running Job',
        description: 'Ticket with running job',
        stage: 'VERIFY',
        branch: '995-running-job',
        projectId,
        ticketNumber: 105,
        ticketKey: 'TST-105',
      },
    });

    // Create RUNNING job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'verify',
        status: JobStatus.RUNNING,
        branch: '995-running-job',
        updatedAt: new Date(),
      },
    });

    // Send DELETE request
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    // Verify response
    expect(response.status()).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json.error).toContain('job is in progress');
    expect(json).toHaveProperty('code', 'ACTIVE_JOB');

    // Verify ticket still exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(existingTicket).not.toBeNull();

    // Cleanup
    await prisma.job.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('DELETE rejected - non-existent ticket (404 Not Found)', async ({ request, projectId }) => {
    const nonExistentId = 999999;

    // Send DELETE request for non-existent ticket
    const response = await request.delete(`/api/projects/${projectId}/tickets/${nonExistentId}`);

    // Verify response
    expect(response.status()).toBe(404);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json.error).toContain('not found');
    expect(json).toHaveProperty('code', 'NOT_FOUND');
  });

  test('DELETE rejected - ticket from different project (403 Forbidden)', async ({ request, projectId }) => {
    // Use a different project ID (project 3 is reserved for dev, use it as "other")
    // If current projectId is 3, skip this test (shouldn't happen with worker-isolation)
    const otherProjectId = projectId === 3 ? 8 : 3;
    const otherProjectKey = `OTH`;

    // Create second project
    await prisma.project.upsert({
      where: { id: otherProjectId },
      update: {
        userId: testUser.id,
        updatedAt: new Date(),
      },
      create: {
        id: otherProjectId,
        name: '[e2e] Test Project Other',
        key: otherProjectKey,
        description: 'Test project for cross-project tests',
        githubOwner: 'test',
        githubRepo: `test-other-${otherProjectId}`,
        userId: testUser.id,
        updatedAt: new Date(),
      },
    });

    // Create ticket in other project
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - Wrong Project',
        description: 'Ticket belongs to other project',
        stage: 'INBOX',
        projectId: otherProjectId,
        ticketNumber: 106,
        ticketKey: `${otherProjectKey}-106`,
      },
    });

    // Try to delete via current project endpoint (should be forbidden)
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    // Verify response
    expect(response.status()).toBe(403);

    const json = await response.json();
    expect(json).toHaveProperty('error', 'Forbidden');
    expect(json).toHaveProperty('code', 'FORBIDDEN');

    // Verify ticket still exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(existingTicket).not.toBeNull();
    expect(existingTicket?.projectId).toBe(otherProjectId);

    // Cleanup
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('DELETE with invalid project ID (400 Bad Request)', async ({ request, projectId }) => {
    const response = await request.delete('/api/projects/invalid/tickets/1');

    expect(response.status()).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  test('DELETE with invalid ticket ID (400 Bad Request)', async ({ request, projectId }) => {
    const response = await request.delete('/api/projects/${projectId}/tickets/invalid');

    expect(response.status()).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  test('DELETE with negative project ID (400 Bad Request)', async ({ request, projectId }) => {
    const response = await request.delete('/api/projects/-1/tickets/1');

    expect(response.status()).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  test('DELETE with negative ticket ID (400 Bad Request)', async ({ request, projectId }) => {
    const response = await request.delete('/api/projects/${projectId}/tickets/-1');

    expect(response.status()).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty('error');
    expect(json).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  test('DELETE cascades to related Jobs and Comments', async ({ request, projectId }) => {
    // Create ticket with job and comment (no branch to avoid GitHub dependencies)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - Cascade',
        description: 'Test cascading deletion',
        stage: 'INBOX',
        branch: null,
        projectId,
        ticketNumber: 107,
        ticketKey: 'TST-107',
      },
    });

    // Create completed job
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'build',
        status: JobStatus.COMPLETED,
        branch: null,
        updatedAt: new Date(),
      },
    });

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        userId: testUser.id,
        content: 'Test comment for cascade deletion',
      },
    });

    // Delete ticket
    const response = await request.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);

    expect(response.status()).toBe(200);

    // Verify ticket deleted
    const deletedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(deletedTicket).toBeNull();

    // Verify job cascaded
    const deletedJob = await prisma.job.findUnique({
      where: { id: job.id },
    });
    expect(deletedJob).toBeNull();

    // Verify comment cascaded
    const deletedComment = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(deletedComment).toBeNull();
  });

  test('DELETE multiple tickets consecutively (200 OK)', async ({ request, projectId }) => {
    // AIB-93: Test for bug where deleting multiple tickets in sequence fails
    // Create two INBOX tickets for consecutive deletion
    const ticket1 = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - First Ticket',
        description: 'First ticket to delete',
        stage: 'INBOX',
        projectId,
        ticketNumber: 108,
        ticketKey: 'TST-108',
      },
    });

    const ticket2 = await prisma.ticket.create({
      data: {
        title: '[e2e] DELETE Test - Second Ticket',
        description: 'Second ticket to delete',
        stage: 'INBOX',
        projectId,
        ticketNumber: 109,
        ticketKey: 'TST-109',
      },
    });

    // Delete first ticket
    const response1 = await request.delete(`/api/projects/${projectId}/tickets/${ticket1.id}`);
    expect(response1.status()).toBe(200);

    const json1 = await response1.json();
    expect(json1).toHaveProperty('success', true);
    expect(json1.deleted).toMatchObject({
      ticketId: ticket1.id,
      ticketKey: 'TST-108',
    });

    // Verify first ticket deleted
    const deletedTicket1 = await prisma.ticket.findUnique({
      where: { id: ticket1.id },
    });
    expect(deletedTicket1).toBeNull();

    // Delete second ticket (this is where the bug occurs)
    const response2 = await request.delete(`/api/projects/${projectId}/tickets/${ticket2.id}`);
    expect(response2.status()).toBe(200);

    const json2 = await response2.json();
    expect(json2).toHaveProperty('success', true);
    expect(json2.deleted).toMatchObject({
      ticketId: ticket2.id,
      ticketKey: 'TST-109',
    });

    // Verify second ticket deleted
    const deletedTicket2 = await prisma.ticket.findUnique({
      where: { id: ticket2.id },
    });
    expect(deletedTicket2).toBeNull();
  });
});
