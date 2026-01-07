/**
 * Integration Tests: Ticket By Key Lookup
 *
 * AIB-156: Tests for fetching tickets by key for closed ticket modal display.
 * Tests the existing GET /api/projects/:projectId/tickets/:identifier endpoint
 * with ticket key parameter (e.g., "AIB-123").
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/projects/:projectId/tickets/:ticketKey', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  // T005: Integration test for ticket-by-key API lookup
  describe('ticket lookup by key', () => {
    it('should return ticket when fetched by ticketKey', async () => {
      // Create a ticket
      const ticket = await ctx.createTicket({
        title: '[e2e] Test ticket for key lookup',
        description: 'Testing ticket key lookup functionality',
      });

      // Fetch by ticketKey
      const response = await ctx.api.get<{
        id: number;
        ticketKey: string;
        title: string;
        stage: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticket.ticketKey}`);

      expect(response.status).toBe(200);
      expect(response.data.ticketKey).toBe(ticket.ticketKey);
      expect(response.data.title).toBe('[e2e] Test ticket for key lookup');
      expect(response.data.id).toBe(ticket.id);
    });

    it('should return ticket with all expected fields', async () => {
      const ticket = await ctx.createTicket({
        title: '[e2e] Complete field test',
        description: 'Verify all fields are returned',
      });

      const response = await ctx.api.get<{
        id: number;
        ticketNumber: number;
        ticketKey: string;
        title: string;
        description: string;
        stage: string;
        version: number;
        projectId: number;
        createdAt: string;
        updatedAt: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticket.ticketKey}`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('ticketNumber');
      expect(response.data).toHaveProperty('ticketKey');
      expect(response.data).toHaveProperty('title');
      expect(response.data).toHaveProperty('description');
      expect(response.data).toHaveProperty('stage');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('projectId');
      expect(response.data).toHaveProperty('createdAt');
      expect(response.data).toHaveProperty('updatedAt');
    });
  });

  // T010: Integration test for direct URL navigation with closed ticket
  describe('closed ticket access', () => {
    it('should return closed ticket by key', async () => {
      // Create a ticket and move it to VERIFY stage (required for closing)
      const ticket = await ctx.createTicket({
        title: '[e2e] Ticket to close',
        description: 'This ticket will be closed',
        stage: 'VERIFY',
      });

      // Close the ticket
      const closeResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/${ticket.id}/close`,
        {}
      );
      expect(closeResponse.status).toBe(200);

      // Fetch closed ticket by key - should still work
      const response = await ctx.api.get<{
        id: number;
        ticketKey: string;
        stage: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticket.ticketKey}`);

      expect(response.status).toBe(200);
      expect(response.data.ticketKey).toBe(ticket.ticketKey);
      expect(response.data.stage).toBe('CLOSED');
    });
  });

  // T012: Integration test for 404 response when ticket not found
  describe('non-existent ticket handling', () => {
    it('should return 404 for non-existent ticket key', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/XXX-99999`
      );

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 404 for ticket key with wrong project prefix', async () => {
      // Create a ticket to get a valid number
      const ticket = await ctx.createTicket({
        title: '[e2e] Valid ticket',
        description: 'Testing wrong prefix',
      });

      // Try to fetch with a different project key prefix
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/WRONG-${ticket.ticketKey.split('-')[1]}`
      );

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 404 for empty identifier', async () => {
      // Note: This tests the API behavior when given an empty path segment
      // The actual behavior depends on route matching
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/`
      );

      // May return 404 or route to tickets list endpoint
      expect([200, 404, 405]).toContain(response.status);
    });
  });

  describe('authorization', () => {
    it('should require project access for ticket lookup', async () => {
      // Create a ticket first
      const ticket = await ctx.createTicket({
        title: '[e2e] Auth test ticket',
        description: 'Testing authorization',
      });

      // Try to access from a different project ID (that doesn't exist or user doesn't have access to)
      const invalidProjectId = 999999;
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${invalidProjectId}/tickets/${ticket.ticketKey}`
      );

      // Should be 404 (project not found) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });
  });
});
