/**
 * Integration Tests: Tickets CRUD
 *
 * Migrated from: tests/api/tickets-*.spec.ts, tests/api/projects-tickets-*.spec.ts
 * Tests for ticket API endpoints using Vitest integration test infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('Tickets CRUD', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('POST /api/projects/:projectId/tickets', () => {
    it('should create ticket and return 201 with complete schema', async () => {
      const requestBody = {
        title: '[e2e] Fix authentication bug',
        description: 'Users cannot log in after password reset',
      };

      const response = await ctx.api.post<{
        id: number;
        title: string;
        description: string;
        stage: string;
        createdAt: string;
        updatedAt: string;
      }>(`/api/projects/${ctx.projectId}/tickets`, requestBody);

      expect(response.status).toBe(201);

      expect(response.data).toHaveProperty('id');
      expect(typeof response.data.id).toBe('number');
      expect(response.data.id).toBeGreaterThan(0);

      expect(response.data.title).toBe(requestBody.title);
      expect(response.data.description).toBe(requestBody.description);
      expect(response.data.stage).toBe('INBOX');

      expect(response.data).toHaveProperty('createdAt');
      expect(response.data).toHaveProperty('updatedAt');
    });

    it('should return 400 when description is missing', async () => {
      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: '[e2e] Add dark mode toggle' }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error.toLowerCase()).toContain('description');
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing title', async () => {
      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { description: 'This request has no title' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error.toLowerCase()).toContain('title');
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty title', async () => {
      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: ' ', description: 'Empty title should be rejected' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error.toLowerCase()).toContain('title');
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for title exceeding max length (100 chars)', async () => {
      const longTitle = 'A'.repeat(101);

      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: longTitle, description: 'Title is too long' }
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should accept title at max length (100 chars)', async () => {
      const maxTitle = 'A'.repeat(100);

      const response = await ctx.api.post<{ title: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: maxTitle, description: 'Title is at maximum allowed length' }
      );

      expect(response.status).toBe(201);
      expect(response.data.title).toBe(maxTitle);
      expect(response.data.title.length).toBe(100);
    });

    it('should return 400 for description exceeding max length (10000 chars)', async () => {
      const longDescription = 'B'.repeat(10001);

      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: '[e2e] Valid title', description: longDescription }
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should accept description at max length (10000 chars)', async () => {
      const maxDescription = 'B'.repeat(10000);

      const response = await ctx.api.post<{ description: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: '[e2e] Valid title', description: maxDescription }
      );

      expect(response.status).toBe(201);
      expect(response.data.description).toBe(maxDescription);
      expect(response.data.description.length).toBe(10000);
    });

    it('should handle allowed punctuation in title and description', async () => {
      const requestBody = {
        title: '[e2e] Fix bug - test, test? test! test.',
        description:
          'Description with allowed punctuation - comma, period. question? exclamation!',
      };

      const response = await ctx.api.post<{ title: string; description: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        requestBody
      );

      expect(response.status).toBe(201);
      expect(response.data.title).toBe(requestBody.title);
      expect(response.data.description).toBe(requestBody.description);
    });

    it('should handle concurrent ticket creation', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        title: `[e2e] Concurrent ticket ${i + 1}`,
        description: `Created concurrently number ${i + 1}`,
      }));

      const responses = await Promise.all(
        requests.map((data) => ctx.api.post(`/api/projects/${ctx.projectId}/tickets`, data))
      );

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // All IDs should be unique
      const ids = responses.map((r) => (r.data as { id: number }).id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('GET /api/projects/:projectId/tickets', () => {
    it('should return 200 with tickets grouped by stage', async () => {
      const response = await ctx.api.get<{
        INBOX: unknown[];
        SPECIFY: unknown[];
        PLAN: unknown[];
        BUILD: unknown[];
        VERIFY: unknown[];
        SHIP: unknown[];
      }>(`/api/projects/${ctx.projectId}/tickets`);

      expect(response.status).toBe(200);

      // Validate all 6 stages are present
      expect(response.data).toHaveProperty('INBOX');
      expect(response.data).toHaveProperty('SPECIFY');
      expect(response.data).toHaveProperty('PLAN');
      expect(response.data).toHaveProperty('BUILD');
      expect(response.data).toHaveProperty('VERIFY');
      expect(response.data).toHaveProperty('SHIP');

      // Each stage should be an array
      expect(Array.isArray(response.data.INBOX)).toBe(true);
      expect(Array.isArray(response.data.SPECIFY)).toBe(true);
      expect(Array.isArray(response.data.PLAN)).toBe(true);
      expect(Array.isArray(response.data.BUILD)).toBe(true);
      expect(Array.isArray(response.data.VERIFY)).toBe(true);
      expect(Array.isArray(response.data.SHIP)).toBe(true);
    });

    it('should return 400 for invalid projectId format', async () => {
      const response = await ctx.api.get<{ error: string }>(
        '/api/projects/abc/tickets'
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error).toContain('Invalid project ID');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        '/api/projects/999999/tickets'
      );

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error).toContain('Project not found');
      expect(response.data.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should return tickets with correct schema', async () => {
      // Create a test ticket first
      const createResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Test ticket for GET contract validation',
          description: 'This ticket validates the GET endpoint contract',
        }
      );
      expect(createResponse.status).toBe(201);

      // Fetch tickets
      const response = await ctx.api.get<{
        INBOX: Array<{
          id: number;
          title: string;
          description: string;
          stage: string;
          version: number;
          createdAt: string;
          updatedAt: string;
        }>;
      }>(`/api/projects/${ctx.projectId}/tickets`);

      expect(response.status).toBe(200);
      expect(response.data.INBOX.length).toBeGreaterThan(0);

      const ticket = response.data.INBOX[0];

      // Validate Ticket schema
      expect(ticket).toHaveProperty('id');
      expect(typeof ticket.id).toBe('number');

      expect(ticket).toHaveProperty('title');
      expect(typeof ticket.title).toBe('string');

      expect(ticket).toHaveProperty('description');
      expect(typeof ticket.description).toBe('string');

      expect(ticket).toHaveProperty('stage');
      expect(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']).toContain(ticket.stage);

      expect(ticket).toHaveProperty('version');
      expect(typeof ticket.version).toBe('number');

      expect(ticket).toHaveProperty('createdAt');
      expect(ticket).toHaveProperty('updatedAt');
    });

    it('should return empty arrays when project has no tickets', async () => {
      const response = await ctx.api.get<{
        INBOX: unknown[];
        SPECIFY: unknown[];
        PLAN: unknown[];
        BUILD: unknown[];
        VERIFY: unknown[];
        SHIP: unknown[];
      }>(`/api/projects/${ctx.projectId}/tickets`);

      expect(response.status).toBe(200);

      // All stages should be empty
      expect(response.data.INBOX).toEqual([]);
      expect(response.data.SPECIFY).toEqual([]);
      expect(response.data.PLAN).toEqual([]);
      expect(response.data.BUILD).toEqual([]);
      expect(response.data.VERIFY).toEqual([]);
      expect(response.data.SHIP).toEqual([]);
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id', () => {
    it('should get ticket by ID', async () => {
      // Create ticket first
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Test ticket for GET',
          description: 'Test ticket description',
        }
      );

      const ticketId = createResponse.data.id;

      const response = await ctx.api.get<{ id: number; title: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(ticketId);
      expect(response.data.title).toBe('[e2e] Test ticket for GET');
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/tickets/999999`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/projects/:projectId/tickets/:id', () => {
    it('should update ticket title', async () => {
      const createResponse = await ctx.api.post<{ id: number; version: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Original title',
          description: 'Test description',
        }
      );

      const ticketId = createResponse.data.id;
      const version = createResponse.data.version;
      const newTitle = '[e2e] Updated title';

      const response = await ctx.api.patch<{ title: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`,
        { title: newTitle, version }
      );

      expect(response.status).toBe(200);
      expect(response.data.title).toBe(newTitle);
    });

    it('should update ticket description', async () => {
      // Description can only be updated in INBOX stage
      const createResponse = await ctx.api.post<{ id: number; version: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Test ticket',
          description: 'Original description',
        }
      );

      const ticketId = createResponse.data.id;
      const version = createResponse.data.version;
      const newDescription = 'Updated description';

      const response = await ctx.api.patch<{ description: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`,
        { description: newDescription, version }
      );

      expect(response.status).toBe(200);
      expect(response.data.description).toBe(newDescription);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/tickets/999999`,
        { title: 'Should fail', version: 1 }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId/tickets/:id', () => {
    it('should delete ticket', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Ticket to delete',
          description: 'This ticket will be deleted',
        }
      );

      const ticketId = createResponse.data.id;

      const deleteResponse = await ctx.api.delete(`/api/projects/${ctx.projectId}/tickets/${ticketId}`);
      expect(deleteResponse.status).toBe(200);

      // Verify deletion
      const getResponse = await ctx.api.get(`/api/projects/${ctx.projectId}/tickets/${ticketId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.delete(`/api/projects/${ctx.projectId}/tickets/999999`);
      expect(response.status).toBe(404);
    });
  });
});
