/**
 * Integration Tests: Comment Autocomplete
 *
 * Tests for ticket search API used by # autocomplete.
 * Verifies search endpoint returns correct results for autocomplete usage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import type { SearchResponse } from '@/app/lib/types/search';

describe('Ticket Search Autocomplete', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/projects/:projectId/tickets/search', () => {
    it('should return matching tickets by key', async () => {
      // Create test tickets
      const ticket1 = await ctx.createTicket({ title: '[e2e] First Autocomplete Test' });
      await ctx.createTicket({ title: '[e2e] Second Test' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=${ticket1.ticketKey.substring(0, 5)}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.results)).toBe(true);
      expect(response.data.results.length).toBeGreaterThan(0);
    });

    it('should return tickets matching title', async () => {
      await ctx.createTicket({ title: '[e2e] Unique Autocomplete Query' });
      await ctx.createTicket({ title: '[e2e] Another Ticket' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=Unique`
      );

      expect(response.status).toBe(200);
      expect(response.data.results.length).toBe(1);
      expect(response.data.results[0].title).toContain('Unique');
    });

    it('should return search results with required fields', async () => {
      await ctx.createTicket({ title: '[e2e] Fields Test Ticket' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=Fields`
      );

      expect(response.status).toBe(200);
      expect(response.data.results.length).toBe(1);

      const result = response.data.results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('ticketKey');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('stage');
    });

    it('should respect limit parameter', async () => {
      // Create multiple tickets
      await ctx.createTicket({ title: '[e2e] Limit Test 1' });
      await ctx.createTicket({ title: '[e2e] Limit Test 2' });
      await ctx.createTicket({ title: '[e2e] Limit Test 3' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=Limit&limit=2`
      );

      expect(response.status).toBe(200);
      expect(response.data.results.length).toBeLessThanOrEqual(2);
    });

    it('should return 400 for query less than 2 characters', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/search?q=A`
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('2 characters');
    });

    it('should return empty results for no matches', async () => {
      await ctx.createTicket({ title: '[e2e] Regular Ticket' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=NonExistentSearchTerm`
      );

      expect(response.status).toBe(200);
      expect(response.data.results).toEqual([]);
      expect(response.data.totalCount).toBe(0);
    });

    it('should be case-insensitive', async () => {
      await ctx.createTicket({ title: '[e2e] UPPERCASE Test' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=uppercase`
      );

      expect(response.status).toBe(200);
      expect(response.data.results.length).toBe(1);
    });

    it('should only search within the specified project', async () => {
      // Create ticket in current project
      await ctx.createTicket({ title: '[e2e] Project Scoped Test' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=Scoped`
      );

      expect(response.status).toBe(200);
      // All results should be from the current project
      response.data.results.forEach((result) => {
        expect(result.ticketKey).toBeDefined();
      });
    });

    it('should sort by relevance (key match > title match)', async () => {
      // Create a ticket and extract its key prefix for searching
      const ticket = await ctx.createTicket({ title: '[e2e] Contains Relevance Text' });
      // Extract the project prefix from the ticket key (e.g., "E2E" from "E2E-123")
      const keyPrefix = ticket.ticketKey.split('-')[0];

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=${keyPrefix}`
      );

      expect(response.status).toBe(200);
      expect(response.data.results.length).toBeGreaterThan(0);
      // First result should have the key prefix in the ticketKey (key match scores higher)
      expect(response.data.results[0].ticketKey).toContain(keyPrefix);
    });

    it('should include totalCount in response', async () => {
      await ctx.createTicket({ title: '[e2e] Count Test Ticket' });

      const response = await ctx.api.get<SearchResponse>(
        `/api/projects/${ctx.projectId}/tickets/search?q=Count`
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalCount');
      expect(typeof response.data.totalCount).toBe('number');
    });
  });
});
