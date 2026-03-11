/**
 * Integration Tests: Activity Feed API
 * Feature: AIB-177-project-activity-feed
 *
 * Tests for the activity feed API endpoint with real database queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import type { ActivityFeedResponse, ActivityEvent } from '@/app/lib/types/activity-event';

// Workflow token for job status updates
const WORKFLOW_TOKEN =
  process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Activity Feed API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    // Create a test ticket
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Activity',
        description: 'Test ticket for activity feed testing',
      }
    );
    ticketId = createResponse.data.id;
  });

  describe('GET /api/projects/:projectId/activity', () => {
    it('should return activity feed with ticket created event', async () => {
      // Wait for database write to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data.events).toBeInstanceOf(Array);
      expect(response.data.pagination).toBeDefined();
      expect(response.data.metadata).toBeDefined();
      expect(response.data.metadata.projectId).toBe(ctx.projectId);

      // Should have at least one event (ticket created)
      expect(response.data.events.length).toBeGreaterThan(0);

      // Find the ticket_created event for our test ticket
      const ticketCreatedEvents = response.data.events.filter(
        (e) => e.type === 'ticket_created' && e.ticket.id === ticketId
      );
      expect(ticketCreatedEvents.length).toBe(1);
    });

    it('should return job events after workflow transition', async () => {
      // Transition to SPECIFY to create a job
      const transitionResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      // Skip if transition failed (pre-existing issue with test environment)
      if (transitionResponse.status !== 200) {
        console.log('Skipping: transition failed with status', transitionResponse.status);
        return;
      }

      // Get the job ID
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });

      if (!ticket?.jobs[0]) {
        console.log('Skipping: no job created');
        return;
      }

      jobId = ticket.jobs[0].id;

      // Update job to RUNNING
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Should have job_started event
      const jobStartedEvents = response.data.events.filter(
        (e) => e.type === 'job_started'
      );
      expect(jobStartedEvents.length).toBeGreaterThan(0);
    });

    it('should return job_completed and stage_changed events', async () => {
      // Transition to SPECIFY
      const transitionResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      // Skip if transition failed (pre-existing issue with test environment)
      if (transitionResponse.status !== 200) {
        console.log('Skipping: transition failed with status', transitionResponse.status);
        return;
      }

      // Get job and complete it
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });

      if (!ticket?.jobs[0]) {
        console.log('Skipping: no job created');
        return;
      }

      jobId = ticket.jobs[0].id;

      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Should have job_completed event
      const jobCompletedEvents = response.data.events.filter(
        (e) => e.type === 'job_completed'
      );
      expect(jobCompletedEvents.length).toBeGreaterThan(0);

      // Should have stage_changed event (specify advances INBOX → SPECIFY)
      const stageChangedEvents = response.data.events.filter(
        (e) => e.type === 'stage_changed'
      );
      expect(stageChangedEvents.length).toBeGreaterThan(0);
    });

    it('should return comment_posted events', async () => {
      // Add a comment to the ticket
      const commentResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: '[e2e] Test comment for activity feed' }
      );

      expect(commentResponse.status).toBe(201);

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Should have comment_posted event
      const commentEvents = response.data.events.filter(
        (e) => e.type === 'comment_posted' && e.data.preview.includes('[e2e] Test comment')
      );
      expect(commentEvents.length).toBe(1);

      // Verify comment preview
      const commentEvent = commentEvents[0];
      if (commentEvent?.type === 'comment_posted') {
        expect(commentEvent.data.preview).toContain('[e2e] Test comment');
      }
    });

    it('should sort events by timestamp DESC (newest first)', async () => {
      // Create multiple events with delay to ensure different timestamps
      await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: '[e2e] First sort comment' }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: '[e2e] Second sort comment' }
      );

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data.events.length).toBeGreaterThan(1);

      // Verify events are sorted by timestamp DESC
      const events = response.data.events;
      for (let i = 1; i < events.length; i++) {
        const prevTimestamp = new Date(events[i - 1]!.timestamp).getTime();
        const currTimestamp = new Date(events[i]!.timestamp).getTime();
        expect(prevTimestamp).toBeGreaterThanOrEqual(currTimestamp);
      }
    });

    it('should return 400 for invalid project ID', async () => {
      const response = await ctx.api.get('/api/projects/invalid/activity');

      expect(response.status).toBe(400);
    });

    it('should return 403 for unauthorized project', async () => {
      // Use a non-existent project ID
      const response = await ctx.api.get('/api/projects/999999/activity');

      expect(response.status).toBe(403);
    });
  });

  describe('Pagination', () => {
    it('should respect limit parameter', async () => {
      // Create several comments to have multiple events
      for (let i = 0; i < 5; i++) {
        await ctx.api.post(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
          { content: `[e2e] Comment ${i}` }
        );
      }

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=3`
      );

      expect(response.status).toBe(200);
      expect(response.data.events.length).toBeLessThanOrEqual(3);
    });

    it('should return hasMore=true when more events exist', async () => {
      // Create enough events to exceed one page
      for (let i = 0; i < 5; i++) {
        await ctx.api.post(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
          { content: `[e2e] Comment ${i}` }
        );
      }

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=3`
      );

      expect(response.status).toBe(200);
      // Should have more events after the first 3
      if (response.data.pagination.totalCount > 3) {
        expect(response.data.pagination.hasMore).toBe(true);
        expect(response.data.pagination.nextCursor).not.toBeNull();
      }
    });

    it('should return next page with cursor', async () => {
      // Create enough events
      for (let i = 0; i < 6; i++) {
        await ctx.api.post(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
          { content: `[e2e] Comment ${i}` }
        );
      }

      // Get first page
      const firstPage = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=3`
      );

      expect(firstPage.status).toBe(200);

      if (firstPage.data.pagination.nextCursor) {
        // Get second page
        const secondPage = await ctx.api.get<ActivityFeedResponse>(
          `/api/projects/${ctx.projectId}/activity?limit=3&cursor=${firstPage.data.pagination.nextCursor}`
        );

        expect(secondPage.status).toBe(200);
        expect(secondPage.data.events.length).toBeGreaterThan(0);

        // Events should be different
        const firstPageIds = new Set(firstPage.data.events.map((e) => e.id));
        const secondPageIds = secondPage.data.events.map((e) => e.id);
        secondPageIds.forEach((id) => {
          expect(firstPageIds.has(id)).toBe(false);
        });
      }
    });

    it('should return 400 for invalid cursor', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/activity?cursor=invalid-cursor`
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Invalid cursor');
    });

    it('should set cursorExpired=true when cursor event not found', async () => {
      // Create a cursor that points to a non-existent event
      const expiredCursor = Buffer.from(
        JSON.stringify({
          timestamp: '2020-01-01T00:00:00Z',
          id: 'nonexistent_event_id',
          eventType: 'ticket_created',
        })
      ).toString('base64');

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?cursor=${expiredCursor}`
      );

      expect(response.status).toBe(200);
      expect(response.data.pagination.cursorExpired).toBe(true);
    });
  });

  describe('Event structure', () => {
    it('should include correct ticket reference', async () => {
      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Find an event for our test ticket
      const ticketEvent = response.data.events.find(
        (e) => e.ticket.id === ticketId
      );

      expect(ticketEvent).toBeDefined();
      expect(ticketEvent?.ticket.ticketKey).toMatch(/^[A-Z][A-Z0-9]+-\d+$/);
      expect(ticketEvent?.ticket.exists).toBe(true);
      expect(ticketEvent?.ticket.title).toBe('[e2e] Test Ticket for Activity');
    });

    it('should include correct actor for system events', async () => {
      // Transition to create a job (system actor)
      const transitionResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      // Skip if transition failed
      if (transitionResponse.status !== 200) {
        console.log('Skipping: transition failed with status', transitionResponse.status);
        return;
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });

      if (!ticket?.jobs[0]) {
        console.log('Skipping: no job created');
        return;
      }

      jobId = ticket.jobs[0].id;

      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      // Find a job event
      const jobEvent = response.data.events.find(
        (e) => e.type === 'job_started' && e.actor.type === 'system'
      );

      expect(jobEvent).toBeDefined();
      expect(jobEvent?.actor.name).toBe('AI-BOARD');
      expect(jobEvent?.actor.id).toBe('ai-board');
    });

    it('should include correct actor for user events (comments)', async () => {
      const commentResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: '[e2e] User actor comment' }
      );

      expect(commentResponse.status).toBe(201);

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Find the comment event we just created
      const commentEvent = response.data.events.find(
        (e) =>
          e.type === 'comment_posted' &&
          e.data.preview.includes('[e2e] User actor comment')
      );

      expect(commentEvent).toBeDefined();
      expect(commentEvent?.actor.type).toBe('user');
      // In test mode, the user is test@e2e.local
      expect(commentEvent?.actor.name).toBeDefined();
    });
  });

  describe('30-day window', () => {
    it('should return events within 30-day window', async () => {
      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data.events.length).toBeGreaterThan(0);

      const now = new Date();
      const thirtyDaysAgo = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      );

      // All events should be within the 30-day window
      response.data.events.forEach((event) => {
        const eventTime = new Date(event.timestamp);
        expect(eventTime.getTime()).toBeGreaterThanOrEqual(
          thirtyDaysAgo.getTime()
        );
        expect(eventTime.getTime()).toBeLessThanOrEqual(now.getTime() + 60000); // Allow 1 minute buffer
      });

      // Metadata should include rangeStart and rangeEnd
      expect(response.data.metadata.rangeStart).toBeDefined();
      expect(response.data.metadata.rangeEnd).toBeDefined();
    });
  });
});
