/**
 * Integration Tests: Comparisons API
 *
 * Tests for ticket comparison API endpoints.
 * Note: In test mode, GitHub API calls return mock data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('Comparisons API', () => {
  let ctx: TestContext;
  let ticketId: number;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Create a test ticket with branch for comparison tests
    const createResponse = await ctx.api.post<{ id: number; ticketKey: string }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test comparison ticket',
        description: 'Ticket for testing comparison API',
      }
    );
    ticketId = createResponse.data.id;
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons', () => {
    it('should return empty list for ticket without comparisons', async () => {
      const response = await ctx.api.get<{
        comparisons: unknown[];
        total: number;
        limit: number;
        offset: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comparisons`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('comparisons');
      expect(response.data.comparisons).toEqual([]);
      expect(response.data.total).toBe(0);
    });

    it('should return 400 for invalid ticket ID', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/invalid/comparisons`
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/comparisons`
      );

      expect(response.status).toBe(404);
      expect(response.data.code).toBe('TICKET_NOT_FOUND');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/999999/tickets/${ticketId}/comparisons`
      );

      expect(response.status).toBe(404);
      expect(response.data.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should respect limit parameter', async () => {
      const response = await ctx.api.get<{
        comparisons: unknown[];
        limit: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comparisons?limit=5`);

      expect(response.status).toBe(200);
      expect(response.data.limit).toBe(5);
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons/check', () => {
    it('should return hasComparisons false for ticket without comparisons', async () => {
      const response = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
        latestReport: string | null;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comparisons/check`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('hasComparisons');
      expect(response.data.hasComparisons).toBe(false);
      expect(response.data.count).toBe(0);
      expect(response.data.latestReport).toBeNull();
    });

    it('should return 400 for invalid ticket ID', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/invalid/comparisons/check`
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/comparisons/check`
      );

      expect(response.status).toBe(404);
      expect(response.data.code).toBe('TICKET_NOT_FOUND');
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons/:filename', () => {
    it('should return 400 for invalid filename format', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comparisons/invalid-filename.md`
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
      expect(response.data.error).toContain('filename');
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/comparisons/20260102-120000-vs-ABC-123.md`
      );

      expect(response.status).toBe(404);
      expect(response.data.code).toBe('TICKET_NOT_FOUND');
    });

    it('should accept valid filename format', async () => {
      // In test mode, this will return 404 for comparison not available
      // (ticket has no branch), which is expected behavior
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comparisons/20260102-120000-vs-ABC-123.md`
      );

      // Either 404 (no branch/comparison) or 200 (mock content) is acceptable
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Cross-project access', () => {
    it('should return 403 when accessing ticket from wrong project', async () => {
      // Create ticket in project 1
      const project1Ticket = await ctx.api.post<{ id: number }>(
        `/api/projects/1/tickets`,
        {
          title: '[e2e] Project 1 ticket',
          description: 'Ticket in project 1',
        }
      );

      // Try to access from project 2 (ctx.projectId is 2)
      if (ctx.projectId !== 1) {
        const response = await ctx.api.get<{ error: string; code: string }>(
          `/api/projects/${ctx.projectId}/tickets/${project1Ticket.data.id}/comparisons`
        );

        expect(response.status).toBe(403);
        expect(response.data.code).toBe('WRONG_PROJECT');
      }
    });
  });
});
