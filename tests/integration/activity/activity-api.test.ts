/**
 * Integration Tests: Activity Feed API
 * Feature: AIB-181-copy-of-project
 *
 * Tests for the activity feed API endpoint:
 * GET /api/projects/[projectId]/activity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { ActivityFeedResponse, ActivityEvent } from '@/app/lib/types/activity-event';

describe('Activity Feed API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/projects/:projectId/activity', () => {
    it('should return empty events array for project with no activity', async () => {
      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data.events).toEqual([]);
      expect(response.data.hasMore).toBe(false);
      expect(response.data.offset).toBe(0);
    });

    it('should return ticket_created events when tickets exist', async () => {
      // Create a test ticket
      const ticket = await ctx.createTicket({
        title: '[e2e] Test Ticket for Activity',
        description: 'Test description',
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data.events.length).toBeGreaterThanOrEqual(1);

      // Find the ticket_created event
      const ticketCreatedEvent = response.data.events.find(
        (e: ActivityEvent) => e.type === 'ticket_created' && e.ticketKey === ticket.ticketKey
      );
      expect(ticketCreatedEvent).toBeDefined();
      expect(ticketCreatedEvent?.ticketTitle).toBe('[e2e] Test Ticket for Activity');
      expect(ticketCreatedEvent?.actor.type).toBe('system');
      expect(ticketCreatedEvent?.actor.name).toBe('AI-BOARD');
    });

    it('should return comment events when comments exist', async () => {
      // Create a test ticket
      const ticket = await ctx.createTicket({
        title: '[e2e] Test Ticket for Comment Activity',
      });

      // Create a comment
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/comments`, {
        content: 'Test comment for activity feed',
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Find the comment event
      const commentEvent = response.data.events.find(
        (e: ActivityEvent) => e.type === 'comment'
      );
      expect(commentEvent).toBeDefined();
      expect(commentEvent?.type).toBe('comment');
      expect(commentEvent?.actor.type).toBe('user');
    });

    it('should return job events when jobs exist', async () => {
      // Create a test ticket
      const ticket = await ctx.createTicket({
        title: '[e2e] Test Ticket for Job Activity',
      });

      // Create a job directly in database
      const prisma = getPrismaClient();
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Find job events (should have both start and complete)
      const jobEvents = response.data.events.filter((e: ActivityEvent) => e.type === 'job');
      expect(jobEvents.length).toBeGreaterThanOrEqual(2); // start + complete events

      // Verify job event structure
      const jobEvent = jobEvents[0];
      expect(jobEvent).toBeDefined();
      expect(jobEvent?.type).toBe('job');
      expect(jobEvent?.actor.type).toBe('system');
      expect(jobEvent?.actor.name).toBe('AI-BOARD');

      // Verify data field structure for job event
      if (jobEvent?.type === 'job') {
        expect(jobEvent.data.jobId).toBeDefined();
        expect(jobEvent.data.command).toBe('specify');
        expect(jobEvent.data.displayName).toBe('Specification generation');
        expect(['start', 'complete']).toContain(jobEvent.data.eventType);
      }
    });

    it('should sort events by timestamp (newest first)', async () => {
      // Create multiple tickets to generate events
      const ticket1 = await ctx.createTicket({ title: '[e2e] First Ticket' });
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      const ticket2 = await ctx.createTicket({ title: '[e2e] Second Ticket' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Events should be sorted newest first
      const events = response.data.events;
      if (events.length >= 2) {
        for (let i = 0; i < events.length - 1; i++) {
          const currentTime = new Date(events[i].timestamp).getTime();
          const nextTime = new Date(events[i + 1].timestamp).getTime();
          expect(currentTime).toBeGreaterThanOrEqual(nextTime);
        }
      }

      // Second ticket should appear before first (newer)
      const event1Index = events.findIndex(e => e.ticketKey === ticket1.ticketKey);
      const event2Index = events.findIndex(e => e.ticketKey === ticket2.ticketKey);
      expect(event2Index).toBeLessThan(event1Index);
    });

    it('should respect limit query parameter', async () => {
      // Create multiple tickets
      await ctx.createTicket({ title: '[e2e] Ticket 1' });
      await ctx.createTicket({ title: '[e2e] Ticket 2' });
      await ctx.createTicket({ title: '[e2e] Ticket 3' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=2`
      );

      expect(response.status).toBe(200);
      expect(response.data.events.length).toBe(2);
      expect(response.data.hasMore).toBe(true);
    });

    it('should respect offset query parameter', async () => {
      // Create tickets
      await ctx.createTicket({ title: '[e2e] Ticket 1' });
      await ctx.createTicket({ title: '[e2e] Ticket 2' });
      await ctx.createTicket({ title: '[e2e] Ticket 3' });

      // Get first page
      const firstPageResponse = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=1`
      );
      expect(firstPageResponse.status).toBe(200);
      const firstEvent = firstPageResponse.data.events[0];

      // Get second page
      const secondPageResponse = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity?limit=1&offset=1`
      );
      expect(secondPageResponse.status).toBe(200);
      const secondEvent = secondPageResponse.data.events[0];

      // Events should be different
      expect(secondEvent.ticketKey).not.toBe(firstEvent.ticketKey);
    });

    it('should include ticketDeleted flag for closed tickets', async () => {
      // Create and close a ticket
      const ticket = await ctx.createTicket({ title: '[e2e] Closed Ticket' });

      const prisma = getPrismaClient();
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { closedAt: new Date() },
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      const closedTicketEvent = response.data.events.find(
        (e: ActivityEvent) => e.ticketKey === ticket.ticketKey
      );
      expect(closedTicketEvent).toBeDefined();
      expect(closedTicketEvent?.ticketDeleted).toBe(true);
    });

    it('should return 400 for invalid project ID', async () => {
      const response = await ctx.api.get<{ error: string }>(
        '/api/projects/invalid/activity'
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Invalid project ID');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get<{ error: string }>(
        '/api/projects/999999/activity'
      );

      expect(response.status).toBe(404);
      expect(response.data.error).toBe('Project not found');
    });

    it('should return 400 for limit exceeding max 100', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/activity?limit=200`
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Invalid query parameters');
    });

    it('should use default limit of 50 when not specified', async () => {
      // Create tickets to exceed default limit
      for (let i = 0; i < 55; i++) {
        await ctx.createTicket({ title: `[e2e] Ticket ${i}` });
      }

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);
      expect(response.data.events.length).toBe(50);
      expect(response.data.hasMore).toBe(true);
    });
  });

  describe('Event data structure validation', () => {
    it('should include required fields in all events', async () => {
      // Create ticket and comment to generate events
      const ticket = await ctx.createTicket({ title: '[e2e] Test Event Structure' });
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/comments`, {
        content: 'Test comment',
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      expect(response.status).toBe(200);

      // Validate all events have required fields
      for (const event of response.data.events) {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('ticketKey');
        expect(event).toHaveProperty('ticketTitle');
        expect(event).toHaveProperty('ticketId');
        expect(event).toHaveProperty('ticketDeleted');
        expect(event).toHaveProperty('actor');
        expect(event).toHaveProperty('data');

        // Validate actor structure
        expect(event.actor).toHaveProperty('type');
        expect(event.actor).toHaveProperty('name');
        expect(['user', 'system']).toContain(event.actor.type);
      }
    });

    it('should include workflow type in ticket_created events', async () => {
      await ctx.createTicket({ title: '[e2e] Test Workflow Type' });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      const ticketCreatedEvent = response.data.events.find(
        (e: ActivityEvent) => e.type === 'ticket_created'
      );

      expect(ticketCreatedEvent).toBeDefined();
      if (ticketCreatedEvent?.type === 'ticket_created') {
        expect(ticketCreatedEvent.data).toHaveProperty('workflowType');
      }
    });

    it('should truncate long comment content', async () => {
      const ticket = await ctx.createTicket({ title: '[e2e] Test Long Comment' });

      // Create a long comment
      const longContent = 'A'.repeat(200);
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/comments`, {
        content: longContent,
      });

      const response = await ctx.api.get<ActivityFeedResponse>(
        `/api/projects/${ctx.projectId}/activity`
      );

      const commentEvent = response.data.events.find(
        (e: ActivityEvent) => e.type === 'comment'
      );

      expect(commentEvent).toBeDefined();
      if (commentEvent?.type === 'comment') {
        // Content should be truncated to ~100 chars + ellipsis
        expect(commentEvent.data.content.length).toBeLessThanOrEqual(103);
        expect(commentEvent.data.content).toContain('...');
      }
    });
  });
});
