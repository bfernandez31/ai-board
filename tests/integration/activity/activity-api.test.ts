/**
 * Integration Tests: Activity Feed API
 * Feature: AIB-172 Project Activity Feed
 *
 * Tests for GET /api/projects/:projectId/activity endpoint:
 * - Authorization (owner and member access)
 * - Pagination (offset, limit)
 * - 30-day window filtering
 * - Event type coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import type { ActivityFeedResponse } from '@/app/lib/types/activity-event';

// Workflow token for job status updates
const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

/**
 * Create an API client with workflow token authentication
 */
function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Activity Feed API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/projects/:projectId/activity - Authorization', () => {
    it('should return activity for project owner', async () => {
      // Create a ticket to generate activity
      await ctx.createTicket({ title: '[e2e] Activity Test Ticket' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('events');
      expect(response.data).toHaveProperty('pagination');
      expect(response.data).toHaveProperty('actors');
      expect(Array.isArray(response.data.events)).toBe(true);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get('/api/projects/999999/activity');

      expect(response.status).toBe(404);
    });

    // Skip: Test mode auto-logs in users, so 401 cannot be tested in integration tests
    // The auth behavior is validated at the unit level and E2E tests with browser sessions
    it.skip('should return 401 for unauthenticated request', async () => {
      // Create an unauthenticated client
      const unauthClient = createAPIClient({
        defaultHeaders: {}, // No auth headers
      });

      const response = await unauthClient.get(`/api/projects/${ctx.projectId}/activity`);

      // Expect 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects/:projectId/activity - Pagination', () => {
    beforeEach(async () => {
      // Create multiple tickets to generate events
      for (let i = 0; i < 5; i++) {
        await ctx.createTicket({ title: `[e2e] Activity Test ${i + 1}` });
      }
    });

    it('should return default 50 events per page', async () => {
      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data.pagination.limit).toBe(50);
      expect(response.data.pagination.offset).toBe(0);
    });

    it('should respect custom limit parameter', async () => {
      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=3`
      );

      expect(response.status).toBe(200);
      expect(response.data.pagination.limit).toBe(3);
      expect(response.data.events.length).toBeLessThanOrEqual(3);
    });

    it('should respect offset parameter', async () => {
      // Get first page
      const firstPage = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=2`
      );

      // Get second page
      const secondPage = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=2&offset=2`
      );

      expect(firstPage.status).toBe(200);
      expect(secondPage.status).toBe(200);
      expect(secondPage.data.pagination.offset).toBe(2);

      // Events should be different
      if (firstPage.data.events.length > 0 && secondPage.data.events.length > 0) {
        expect(firstPage.data.events[0].id).not.toBe(secondPage.data.events[0].id);
      }
    });

    it('should indicate hasMore when more events exist', async () => {
      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=2`
      );

      expect(response.status).toBe(200);
      // With 5 tickets creating events, and limit 2, should have more
      if (response.data.pagination.total > 2) {
        expect(response.data.pagination.hasMore).toBe(true);
      }
    });

    it('should reject limit greater than 100', async () => {
      const response = await ctx.api.get(
        `/api/projects/${ctx.projectId}/activity?limit=150`
      );

      expect(response.status).toBe(400);
    });

    it('should reject negative offset', async () => {
      const response = await ctx.api.get(
        `/api/projects/${ctx.projectId}/activity?offset=-1`
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/activity - 30-day Window', () => {
    it('should only return events from the last 30 days', async () => {
      // Create a recent ticket
      const { id: recentTicketId } = await ctx.createTicket({
        title: '[e2e] Recent Ticket',
      });

      // Create an old ticket directly in the database (bypassing API)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      // Get next ticket number for the project
      const maxTicket = await prisma.ticket.findFirst({
        where: { projectId: ctx.projectId },
        orderBy: { ticketNumber: 'desc' },
        select: { ticketNumber: true },
      });
      const nextTicketNumber = (maxTicket?.ticketNumber ?? 0) + 1000;

      const oldTicket = await prisma.ticket.create({
        data: {
          ticketKey: `OLD-${Date.now()}`,
          title: '[e2e] Old Ticket',
          description: 'Old ticket description',
          projectId: ctx.projectId,
          ticketNumber: nextTicketNumber,
          stage: 'INBOX',
          createdAt: oldDate,
          updatedAt: oldDate,
        },
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Recent ticket should be in results
      const hasRecentTicket = response.data.events.some(
        (e) => e.ticket.ticketId === recentTicketId.toString()
      );
      expect(hasRecentTicket).toBe(true);

      // Old ticket should NOT be in results
      const hasOldTicket = response.data.events.some(
        (e) => e.ticket.ticketId === oldTicket.id.toString()
      );
      expect(hasOldTicket).toBe(false);

      // Cleanup old ticket
      await prisma.ticket.delete({ where: { id: oldTicket.id } });
    });

    it('should return total count for events in 30-day window', async () => {
      await ctx.createTicket({ title: '[e2e] Count Test Ticket' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(typeof response.data.pagination.total).toBe('number');
      expect(response.data.pagination.total).toBeGreaterThan(0);
    });
  });

  describe('GET /api/projects/:projectId/activity - Event Types', () => {
    it('should include ticket_created events', async () => {
      await ctx.createTicket({ title: '[e2e] Event Type Test' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      const ticketCreatedEvents = response.data.events.filter(
        (e) => e.type === 'ticket_created'
      );
      expect(ticketCreatedEvents.length).toBeGreaterThan(0);
    });

    it('should include job events when jobs exist', async () => {
      const workflowApi = createWorkflowClient();

      // Create ticket and transition to generate a job
      const { id: ticketId } = await ctx.createTicket({ title: '[e2e] Job Event Test' });

      // Transition to SPECIFY to create a job
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      // Get the job and set it to RUNNING then COMPLETED
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });
      const jobId = ticket!.jobs[0]!.id;

      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      const jobEvents = response.data.events.filter((e) =>
        ['job_started', 'job_completed', 'job_failed'].includes(e.type)
      );
      expect(jobEvents.length).toBeGreaterThan(0);
    });

    it('should include comment_posted events when comments exist', async () => {
      // Create ticket and add a comment
      const { id: ticketId } = await ctx.createTicket({ title: '[e2e] Comment Event Test' });

      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`, {
        content: '[e2e] Test comment for activity feed',
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      const commentEvents = response.data.events.filter(
        (e) => e.type === 'comment_posted'
      );
      expect(commentEvents.length).toBeGreaterThan(0);
    });

    it('should sort events by timestamp (newest first)', async () => {
      // Create multiple tickets with delay
      await ctx.createTicket({ title: '[e2e] First Ticket' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await ctx.createTicket({ title: '[e2e] Second Ticket' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      if (response.data.events.length >= 2) {
        const timestamps = response.data.events.map((e) =>
          new Date(e.timestamp).getTime()
        );
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
        }
      }
    });
  });

  describe('GET /api/projects/:projectId/activity - Actor Information', () => {
    it('should include actors lookup map', async () => {
      await ctx.createTicket({ title: '[e2e] Actor Test' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(typeof response.data.actors).toBe('object');
    });

    it('should reference actors by ID in events', async () => {
      await ctx.createTicket({ title: '[e2e] Actor Reference Test' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      if (response.data.events.length > 0) {
        const event = response.data.events[0];
        expect(event.actor).toHaveProperty('id');
        expect(event.actor).toHaveProperty('name');
        expect(event.actor).toHaveProperty('email');
      }
    });
  });

  describe('GET /api/projects/:projectId/activity - Empty State', () => {
    it('should return empty events array for project with no activity', async () => {
      // Use a fresh project state (cleanup ensures clean state)
      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.events)).toBe(true);
      expect(response.data.pagination.hasMore).toBe(false);
    });
  });
});
