/**
 * Integration Tests: DB-backed Comparisons API
 *
 * Tests for POST/GET comparison API endpoints backed by Prisma models.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

function buildComparisonPayload(ticketId1: number, ticketId2: number) {
  return {
    sourceTicketId: ticketId1,
    recommendation: 'Ticket 1 is the best implementation overall.',
    notes: 'Comparison of 2 implementations.',
    entries: [
      {
        ticketId: ticketId1,
        rank: 1,
        score: 87.5,
        isWinner: true,
        keyDifferentiators: 'Best test coverage, clean architecture',
        linesAdded: 450,
        linesRemoved: 30,
        sourceFileCount: 12,
        testFileCount: 8,
        testRatio: 0.85,
        complianceData: '{"principles":[{"name":"TypeScript-First","passed":true,"notes":"All types explicit"}]}',
      },
      {
        ticketId: ticketId2,
        rank: 2,
        score: 72.0,
        isWinner: false,
        keyDifferentiators: 'Fast implementation, minimal changes',
        linesAdded: 200,
        linesRemoved: 10,
        sourceFileCount: 6,
        testFileCount: 2,
        testRatio: 0.33,
        complianceData: '{"principles":[{"name":"TypeScript-First","passed":true,"notes":""}]}',
      },
    ],
    decisionPoints: [
      {
        topic: 'Error handling approach',
        verdict: 'Ticket 1 has superior error handling',
        approaches: '{"T1":{"approach":"try-catch with Zod","assessment":"Follows rules"},"T2":{"approach":"Minimal catch","assessment":"Missing validation"}}',
      },
    ],
  };
}

describe('DB-backed Comparisons API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId1: number;
  let ticketId2: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();

    // Clean up comparisons before standard cleanup (which deletes tickets)
    await prisma.comparison.deleteMany({ where: { projectId: ctx.projectId } });

    await ctx.cleanup();

    // Create two test tickets
    const t1 = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: '[e2e] Comparison ticket 1', description: 'First ticket for comparison' }
    );
    const t2 = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: '[e2e] Comparison ticket 2', description: 'Second ticket for comparison' }
    );
    ticketId1 = t1.data.id;
    ticketId2 = t2.data.id;
  });

  describe('POST /api/projects/:projectId/comparisons', () => {
    it('should save a comparison with entries and decision points', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);

      const response = await workflowApi.post<{
        id: number;
        projectId: number;
        sourceTicketId: number;
        recommendation: string;
        notes: string;
        createdAt: string;
        entries: Array<{ id: number; ticketId: number; rank: number; score: number; isWinner: boolean }>;
      }>(`/api/projects/${ctx.projectId}/comparisons`, payload);

      expect(response.status).toBe(201);
      expect(response.data.id).toBeGreaterThan(0);
      expect(response.data.projectId).toBe(ctx.projectId);
      expect(response.data.sourceTicketId).toBe(ticketId1);
      expect(response.data.recommendation).toBe(payload.recommendation);
      expect(response.data.notes).toBe(payload.notes);
      expect(response.data.entries).toHaveLength(2);
      expect(response.data.entries[0]!.isWinner).toBe(true);
      expect(response.data.entries[0]!.rank).toBe(1);
      expect(response.data.entries[1]!.isWinner).toBe(false);

      // Verify decision points were saved
      const decisionPoints = await prisma.comparisonDecisionPoint.findMany({
        where: { comparisonId: response.data.id },
      });
      expect(decisionPoints).toHaveLength(1);
      expect(decisionPoints[0]!.topic).toBe('Error handling approach');
    });

    it('should reject invalid payload (Zod validation)', async () => {
      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons`,
        { sourceTicketId: 'invalid', recommendation: '' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
    });

    it('should reject payload with fewer than 2 entries', async () => {
      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons`,
        {
          sourceTicketId: ticketId1,
          recommendation: 'Test',
          entries: [{
            ticketId: ticketId1, rank: 1, score: 90, isWinner: true,
            keyDifferentiators: 'Best', linesAdded: 100, linesRemoved: 10,
            sourceFileCount: 5, testFileCount: 3, testRatio: 0.6,
            complianceData: '{"principles":[]}',
          }],
          decisionPoints: [],
        }
      );

      expect(response.status).toBe(400);
    });

    it('should return 401 without Bearer token', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons`,
        payload
      );

      expect(response.status).toBe(401);
    });

    it('should return 422 when no winner is marked', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      payload.entries[0]!.isWinner = false;

      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons`,
        payload
      );

      expect(response.status).toBe(422);
      expect(response.data.error).toContain('winner');
    });

    it('should return 422 for duplicate ticket IDs in entries', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      payload.entries[1]!.ticketId = ticketId1; // Duplicate

      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons`,
        payload
      );

      expect(response.status).toBe(422);
      expect(response.data.error).toContain('Duplicate');
    });

    it('should return 422 when entry ticket is not in the project', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      payload.entries[1]!.ticketId = 999999;

      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons`,
        payload
      );

      expect(response.status).toBe(422);
    });

    it('should return 404 for non-existent project', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);

      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/999999/comparisons`,
        payload
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/comparisons?source=db', () => {
    it('should return empty list when no comparisons exist', async () => {
      const response = await ctx.api.get<{
        comparisons: unknown[];
        total: number;
        limit: number;
        offset: number;
      }>(`/api/projects/${ctx.projectId}/comparisons?source=db`);

      expect(response.status).toBe(200);
      expect(response.data.comparisons).toEqual([]);
      expect(response.data.total).toBe(0);
    });

    it('should list saved comparisons with entryCount and winner info', async () => {
      // Save a comparison first
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, payload);

      const response = await ctx.api.get<{
        comparisons: Array<{
          id: number;
          sourceTicketKey: string;
          recommendation: string;
          entryCount: number;
          winnerScore: number;
          winnerTicketKey: string;
        }>;
        total: number;
      }>(`/api/projects/${ctx.projectId}/comparisons?source=db`);

      expect(response.status).toBe(200);
      expect(response.data.total).toBe(1);
      expect(response.data.comparisons).toHaveLength(1);

      const comp = response.data.comparisons[0]!;
      expect(comp.entryCount).toBe(2);
      expect(comp.winnerScore).toBe(87.5);
      expect(comp.recommendation).toBe(payload.recommendation);
    });

    it('should paginate results', async () => {
      // Create 3 comparisons
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, payload);
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, {
        ...payload,
        recommendation: 'Second comparison',
      });
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, {
        ...payload,
        recommendation: 'Third comparison',
      });

      const response = await ctx.api.get<{
        comparisons: Array<{ id: number }>;
        total: number;
        limit: number;
        offset: number;
      }>(`/api/projects/${ctx.projectId}/comparisons?source=db&limit=2&offset=0`);

      expect(response.status).toBe(200);
      expect(response.data.comparisons).toHaveLength(2);
      expect(response.data.total).toBe(3);
      expect(response.data.limit).toBe(2);
      expect(response.data.offset).toBe(0);

      // Page 2
      const page2 = await ctx.api.get<{
        comparisons: Array<{ id: number }>;
        total: number;
      }>(`/api/projects/${ctx.projectId}/comparisons?source=db&limit=2&offset=2`);

      expect(page2.data.comparisons).toHaveLength(1);
      expect(page2.data.total).toBe(3);
    });

    it('should reject unauthorized access', async () => {
      const unauthClient = createAPIClient({
        includeTestUserHeader: false,
        enableTestAuthOverride: false,
      });

      const response = await unauthClient.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons?source=db`
      );

      // Auth failure surfaces as 401 or 500 depending on auth layer
      expect(response.ok).toBe(false);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons/db', () => {
    it('should return empty list for ticket without comparisons', async () => {
      const response = await ctx.api.get<{
        comparisons: unknown[];
        total: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId1}/comparisons/db`);

      expect(response.status).toBe(200);
      expect(response.data.comparisons).toEqual([]);
      expect(response.data.total).toBe(0);
    });

    it('should list comparisons for a participating ticket (bidirectional)', async () => {
      // Create a comparison where ticketId2 is source but ticketId1 participates
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, payload);

      // ticketId1 should see the comparison (it's an entry)
      const r1 = await ctx.api.get<{
        comparisons: Array<{
          id: number;
          ticketRank: number;
          ticketScore: number;
          ticketIsWinner: boolean;
          winnerTicketKey: string;
          entryCount: number;
        }>;
        total: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId1}/comparisons/db`);

      expect(r1.status).toBe(200);
      expect(r1.data.total).toBe(1);
      expect(r1.data.comparisons[0]!.ticketRank).toBe(1);
      expect(r1.data.comparisons[0]!.ticketIsWinner).toBe(true);
      expect(r1.data.comparisons[0]!.entryCount).toBe(2);

      // ticketId2 should also see it
      const r2 = await ctx.api.get<{
        comparisons: Array<{
          ticketRank: number;
          ticketIsWinner: boolean;
        }>;
        total: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId2}/comparisons/db`);

      expect(r2.status).toBe(200);
      expect(r2.data.total).toBe(1);
      expect(r2.data.comparisons[0]!.ticketRank).toBe(2);
      expect(r2.data.comparisons[0]!.ticketIsWinner).toBe(false);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/comparisons/db`
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons/db/check', () => {
    it('should return false when no comparisons exist', async () => {
      const response = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId1}/comparisons/db/check`);

      expect(response.status).toBe(200);
      expect(response.data.hasComparisons).toBe(false);
      expect(response.data.count).toBe(0);
    });

    it('should return true with count when comparisons exist', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, payload);

      const response = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId1}/comparisons/db/check`);

      expect(response.status).toBe(200);
      expect(response.data.hasComparisons).toBe(true);
      expect(response.data.count).toBe(1);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/comparisons/db/check`
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/comparisons/:comparisonId', () => {
    it('should return enriched comparison detail with entries and decision points', async () => {
      const payload = buildComparisonPayload(ticketId1, ticketId2);
      const created = await workflowApi.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/comparisons`,
        payload
      );

      const response = await ctx.api.get<{
        id: number;
        projectId: number;
        sourceTicketKey: string;
        recommendation: string;
        entries: Array<{
          id: number;
          rank: number;
          score: number;
          isWinner: boolean;
          keyDifferentiators: string;
          metrics: { linesAdded: number; linesRemoved: number; sourceFileCount: number; testFileCount: number; testRatio: number };
          complianceData: Array<{ name: string; passed: boolean; notes?: string }>;
          ticket: { id: number; ticketKey: string; title: string } | null;
          telemetry: null;
          qualityScore: null;
        }>;
        decisionPoints: Array<{
          id: number;
          topic: string;
          verdict: string;
          approaches: Record<string, { approach: string; assessment: string }>;
        }>;
      }>(`/api/projects/${ctx.projectId}/comparisons/${created.data.id}`);

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(created.data.id);
      expect(response.data.recommendation).toBe(payload.recommendation);
      expect(response.data.entries).toHaveLength(2);

      // Winner entry
      const winner = response.data.entries.find((e) => e.isWinner);
      expect(winner).toBeDefined();
      expect(winner!.rank).toBe(1);
      expect(winner!.score).toBe(87.5);
      expect(winner!.metrics.linesAdded).toBe(450);
      expect(winner!.complianceData).toHaveLength(1);
      expect(winner!.complianceData[0]!.name).toBe('TypeScript-First');

      // Ticket metadata enrichment
      expect(winner!.ticket).not.toBeNull();
      expect(winner!.ticket!.title).toBe('[e2e] Comparison ticket 1');

      // No telemetry or quality scores (no jobs exist)
      expect(winner!.telemetry).toBeNull();
      expect(winner!.qualityScore).toBeNull();

      // Decision points with parsed approaches
      expect(response.data.decisionPoints).toHaveLength(1);
      expect(response.data.decisionPoints[0]!.topic).toBe('Error handling approach');
      expect(response.data.decisionPoints[0]!.approaches).toHaveProperty('T1');
    });

    it('should return 404 for non-existent comparison', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons/999999`
      );

      expect(response.status).toBe(404);
    });
  });

  describe('Multiple comparisons per ticket (US4)', () => {
    it('should list multiple comparisons for the same ticket ordered by most recent first', async () => {
      // Create a third ticket for a second comparison
      const t3 = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: '[e2e] Comparison ticket 3', description: 'Third ticket' }
      );

      // First comparison: ticket1 vs ticket2
      const payload1 = buildComparisonPayload(ticketId1, ticketId2);
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, payload1);

      // Second comparison: ticket1 vs ticket3
      const payload2 = {
        ...buildComparisonPayload(ticketId1, t3.data.id),
        recommendation: 'Second comparison result',
      };
      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, payload2);

      // ticket1 participates in both comparisons
      const response = await ctx.api.get<{
        comparisons: Array<{ id: number; recommendation: string }>;
        total: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId1}/comparisons/db`);

      expect(response.status).toBe(200);
      expect(response.data.total).toBe(2);
      expect(response.data.comparisons).toHaveLength(2);

      // Most recent first
      expect(response.data.comparisons[0]!.recommendation).toBe('Second comparison result');
      expect(response.data.comparisons[1]!.recommendation).toBe(payload1.recommendation);
    });

    it('should return accurate count for check endpoint with multiple comparisons', async () => {
      const t3 = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: '[e2e] Comparison ticket 3b', description: 'Third ticket' }
      );

      await workflowApi.post(
        `/api/projects/${ctx.projectId}/comparisons`,
        buildComparisonPayload(ticketId1, ticketId2)
      );
      await workflowApi.post(
        `/api/projects/${ctx.projectId}/comparisons`,
        buildComparisonPayload(ticketId1, t3.data.id)
      );

      const response = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId1}/comparisons/db/check`);

      expect(response.status).toBe(200);
      expect(response.data.hasComparisons).toBe(true);
      expect(response.data.count).toBe(2);

      // ticket2 only participates in 1
      const r2 = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId2}/comparisons/db/check`);

      expect(r2.data.count).toBe(1);
    });
  });
});
