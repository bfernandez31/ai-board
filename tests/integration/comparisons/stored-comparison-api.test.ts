/**
 * Integration Tests: Stored Comparisons API
 *
 * Tests for the DB-backed comparison storage and retrieval endpoints.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
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

interface StoredComparisonResponse {
  id: number;
  projectId: number;
  sourceTicketKey: string;
  recommendation: string;
  winnerTicketKey: string | null;
  createdAt: string;
  entries: Array<{
    ticketKey: string;
    rank: number;
    score: number;
    keyDifferentiator: string;
    linesAdded: number;
    linesRemoved: number;
    sourceFiles: number;
    testFiles: number;
    complianceScore: number | null;
    compliancePrinciples: unknown[] | null;
    decisionPoints: unknown[] | null;
  }>;
}

interface ListResponse {
  comparisons: StoredComparisonResponse[];
  total: number;
}

const sampleComparison = {
  sourceTicketKey: 'TST-1',
  recommendation: 'Ship TST-1, close TST-2',
  winnerTicketKey: 'TST-1',
  entries: [
    {
      ticketKey: 'TST-1',
      rank: 1,
      score: 92,
      keyDifferentiator: 'Better tests and types',
      linesAdded: 150,
      linesRemoved: 20,
      sourceFiles: 5,
      testFiles: 2,
      complianceScore: 95,
      compliancePrinciples: [
        { name: 'TypeScript-First', section: 'I', passed: true, notes: 'Strict types' },
      ],
      decisionPoints: [
        {
          name: 'State Management',
          approaches: { 'TST-1': 'TanStack Query', 'TST-2': 'useState' },
          verdict: 'TanStack Query provides proper caching',
          bestTicket: 'TST-1',
        },
      ],
    },
    {
      ticketKey: 'TST-2',
      rank: 2,
      score: 65,
      keyDifferentiator: 'Missing tests',
      linesAdded: 200,
      linesRemoved: 10,
      sourceFiles: 8,
      testFiles: 0,
    },
  ],
};

describe('Stored Comparisons API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();
  });

  describe('POST /api/projects/:projectId/comparisons/stored', () => {
    it('should create a stored comparison with workflow auth', async () => {
      const response = await workflowApi.post<StoredComparisonResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored`,
        sampleComparison
      );

      expect(response.status).toBe(201);
      expect(response.data.sourceTicketKey).toBe('TST-1');
      expect(response.data.winnerTicketKey).toBe('TST-1');
      expect(response.data.recommendation).toBe('Ship TST-1, close TST-2');
      expect(response.data.entries).toHaveLength(2);
      expect(response.data.entries[0].rank).toBe(1);
      expect(response.data.entries[0].score).toBe(92);
      expect(response.data.entries[1].rank).toBe(2);
    });

    it('should reject invalid data', async () => {
      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons/stored`,
        { sourceTicketKey: 'TST-1', entries: [] }
      );

      expect(response.status).toBe(400);
    });

    it('should require at least 2 entries', async () => {
      const response = await workflowApi.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons/stored`,
        {
          ...sampleComparison,
          entries: [sampleComparison.entries[0]],
        }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/comparisons/stored', () => {
    it('should list stored comparisons', async () => {
      // Create a comparison first
      await workflowApi.post(
        `/api/projects/${ctx.projectId}/comparisons/stored`,
        sampleComparison
      );

      const response = await ctx.api.get<ListResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored`
      );

      expect(response.status).toBe(200);
      expect(response.data.total).toBe(1);
      expect(response.data.comparisons).toHaveLength(1);
      expect(response.data.comparisons[0].sourceTicketKey).toBe('TST-1');
    });

    it('should filter by ticketKey', async () => {
      await workflowApi.post(
        `/api/projects/${ctx.projectId}/comparisons/stored`,
        sampleComparison
      );

      // Should find via entry ticketKey
      const response = await ctx.api.get<ListResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored?ticketKey=TST-2`
      );

      expect(response.status).toBe(200);
      expect(response.data.total).toBe(1);

      // Should not find a non-participating ticket
      const response2 = await ctx.api.get<ListResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored?ticketKey=TST-999`
      );

      expect(response2.status).toBe(200);
      expect(response2.data.total).toBe(0);
    });

    it('should return empty list when no comparisons exist', async () => {
      const response = await ctx.api.get<ListResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored`
      );

      expect(response.status).toBe(200);
      expect(response.data.total).toBe(0);
      expect(response.data.comparisons).toEqual([]);
    });
  });

  describe('GET /api/projects/:projectId/comparisons/stored/:id', () => {
    it('should return enriched comparison detail', async () => {
      const createResponse = await workflowApi.post<StoredComparisonResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored`,
        sampleComparison
      );

      const comparisonId = createResponse.data.id;

      const response = await ctx.api.get<StoredComparisonResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored/${comparisonId}`
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(comparisonId);
      expect(response.data.entries).toHaveLength(2);
      expect(response.data.entries[0].ticketKey).toBe('TST-1');
      expect(response.data.entries[0].score).toBe(92);
    });

    it('should return 404 for non-existent comparison', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/comparisons/stored/999999`
      );

      expect(response.status).toBe(404);
    });

    it('should parse JSON fields in response', async () => {
      const createResponse = await workflowApi.post<StoredComparisonResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored`,
        sampleComparison
      );

      const response = await ctx.api.get<StoredComparisonResponse>(
        `/api/projects/${ctx.projectId}/comparisons/stored/${createResponse.data.id}`
      );

      expect(response.status).toBe(200);
      // Check compliance principles were stored and retrieved correctly
      expect(response.data.entries[0].compliancePrinciples).toEqual([
        { name: 'TypeScript-First', section: 'I', passed: true, notes: 'Strict types' },
      ]);
      // Check decision points
      expect(response.data.entries[0].decisionPoints).toEqual([
        {
          name: 'State Management',
          approaches: { 'TST-1': 'TanStack Query', 'TST-2': 'useState' },
          verdict: 'TanStack Query provides proper caching',
          bestTicket: 'TST-1',
        },
      ]);
      // Entry without optional fields should have null
      expect(response.data.entries[1].compliancePrinciples).toBeNull();
      expect(response.data.entries[1].decisionPoints).toBeNull();
    });
  });
});
