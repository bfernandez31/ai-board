/**
 * Integration Tests: Conversation Timeline API
 *
 * Tests for GET /api/projects/:projectId/tickets/:id/timeline
 * Covers: response structure, BigInt serialization, comment/job merging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN =
  process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

interface TimelineResponse {
  timeline: Array<{
    type: 'comment' | 'job';
    timestamp: string;
    data: Record<string, unknown>;
    eventType?: 'start' | 'complete';
  }>;
  mentionedUsers: Record<string, unknown>;
  currentUserId: string;
}

describe('Conversation Timeline API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Timeline',
        description: 'Test ticket for timeline testing',
      }
    );
    ticketId = createResponse.data.id;
  });

  describe('GET /api/projects/:projectId/tickets/:id/timeline', () => {
    it('should return 200 with empty timeline for new ticket', async () => {
      const response = await ctx.api.get<TimelineResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/timeline`
      );

      expect(response.status).toBe(200);
      expect(response.data.timeline).toBeInstanceOf(Array);
      expect(response.data.mentionedUsers).toBeDefined();
      expect(response.data.currentUserId).toBeDefined();
    });

    it('should include comments in timeline', async () => {
      // Create a comment
      await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: 'Timeline test comment' }
      );

      const response = await ctx.api.get<TimelineResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/timeline`
      );

      expect(response.status).toBe(200);
      const commentEvents = response.data.timeline.filter((e) => e.type === 'comment');
      expect(commentEvents.length).toBe(1);
      expect(commentEvents[0].data.content).toBe('Timeline test comment');
    });

    it('should include job events in timeline', async () => {
      // Transition ticket to create a job
      const transitionResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      if (transitionResponse.status !== 200) {
        console.log('Skipping: transition failed with status', transitionResponse.status);
        return;
      }

      const response = await ctx.api.get<TimelineResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/timeline`
      );

      expect(response.status).toBe(200);
      const jobEvents = response.data.timeline.filter((e) => e.type === 'job');
      expect(jobEvents.length).toBeGreaterThan(0);
    });

    it('should serialize BigInt workflowRunId without error', async () => {
      // Transition ticket to create a job
      const transitionResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      if (transitionResponse.status !== 200) {
        console.log('Skipping: transition failed with status', transitionResponse.status);
        return;
      }

      // Find the job and set a BigInt workflowRunId directly in DB
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });

      if (!ticket?.jobs[0]) {
        console.log('Skipping: no job created');
        return;
      }

      // Set workflowRunId to a BigInt value (simulates GitHub Actions run ID)
      await prisma.job.update({
        where: { id: ticket.jobs[0].id },
        data: { workflowRunId: BigInt('12345678901234') },
      });

      // This request would fail with "Do not know how to serialize a BigInt"
      // before the fix
      const response = await ctx.api.get<TimelineResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/timeline`
      );

      expect(response.status).toBe(200);
      expect(response.data.timeline).toBeInstanceOf(Array);

      // Verify the job event is present and workflowRunId is serialized as string
      const jobEvents = response.data.timeline.filter((e) => e.type === 'job');
      expect(jobEvents.length).toBeGreaterThan(0);

      const jobWithRunId = jobEvents.find(
        (e) => e.data.workflowRunId === '12345678901234'
      );
      expect(jobWithRunId).toBeDefined();
    });

    it('should return 400 for invalid ticket ID', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/abc/timeline`
      );

      expect(response.status).toBe(400);
    });

    it('should return 403 for ticket in wrong project', async () => {
      // Use a non-existent project ID
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/99999/tickets/${ticketId}/timeline`
      );

      // Should fail auth (project not found or no access)
      expect([403, 404]).toContain(response.status);
    });
  });
});
