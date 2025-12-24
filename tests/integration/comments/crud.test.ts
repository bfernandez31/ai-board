/**
 * Integration Tests: Comments CRUD
 *
 * Migrated from: tests/api/comments/*.spec.ts
 * Tests for comment API endpoints using Vitest integration test infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('Comments CRUD', () => {
  let ctx: TestContext;
  let ticketId: number;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Create a test ticket for comments
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Comments',
        description: 'Test ticket for comment CRUD testing',
      }
    );
    ticketId = createResponse.data.id;
  });

  describe('POST /api/projects/:projectId/tickets/:ticketId/comments', () => {
    it('should create comment and return 201', async () => {
      const response = await ctx.api.post<{
        id: number;
        ticketId: number;
        content: string;
        userId: string;
        createdAt: string;
        updatedAt: string;
        user: { name: string; image: string | null };
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`, {
        content: 'This is a test comment',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.ticketId).toBe(ticketId);
      expect(response.data.content).toBe('This is a test comment');
      expect(response.data).toHaveProperty('userId');
      expect(response.data).toHaveProperty('createdAt');
      expect(response.data).toHaveProperty('updatedAt');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).toHaveProperty('name');
    });

    it('should return 400 for empty content', async () => {
      const response = await ctx.api.post<{ error: string; issues: unknown[] }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: '' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
      expect(Array.isArray(response.data.issues)).toBe(true);
    });

    it('should return 400 for content exceeding 2000 characters', async () => {
      const longContent = 'a'.repeat(2001);

      const response = await ctx.api.post<{ error: string; issues: unknown[] }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: longContent }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
    });

    it('should return 400 for missing content field', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        {}
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
    });

    it('should return 400 for whitespace-only content', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: '   ' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/comments`,
        { content: 'Comment on non-existent ticket' }
      );

      expect(response.status).toBe(404);
      expect(response.data.error).toContain('Ticket not found');
    });

    it('should trim whitespace from content', async () => {
      const response = await ctx.api.post<{ content: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: '  Test comment with whitespace  ' }
      );

      expect(response.status).toBe(201);
      expect(response.data.content).toBe('Test comment with whitespace');
    });

    it('should accept content at max length (2000 chars)', async () => {
      const maxContent = 'a'.repeat(2000);

      const response = await ctx.api.post<{ content: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: maxContent }
      );

      expect(response.status).toBe(201);
      expect(response.data.content.length).toBe(2000);
    });
  });

  describe('GET /api/projects/:projectId/tickets/:ticketId/comments', () => {
    it('should return empty array when no comments exist', async () => {
      const response = await ctx.api.get<unknown[]>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBe(0);
    });

    it('should return comments for ticket', async () => {
      // Create a comment first
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`, {
        content: 'First test comment',
      });

      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`, {
        content: 'Second test comment',
      });

      const response = await ctx.api.get<Array<{ id: number; content: string }>>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBe(2);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/comments`
      );

      expect(response.status).toBe(404);
    });

    it('should include user information in comments', async () => {
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`, {
        content: 'Comment with user info',
      });

      const response = await ctx.api.get<Array<{ user: { name: string; image: string | null } }>>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`
      );

      expect(response.status).toBe(200);
      expect(response.data[0]).toHaveProperty('user');
      expect(response.data[0].user).toHaveProperty('name');
    });
  });

  describe('DELETE /api/projects/:projectId/tickets/:ticketId/comments/:commentId', () => {
    it('should delete comment', async () => {
      // Create a comment first
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`,
        { content: 'Comment to delete' }
      );
      const commentId = createResponse.data.id;

      // Delete the comment
      const deleteResponse = await ctx.api.delete(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments/${commentId}`
      );

      expect(deleteResponse.status).toBe(200);

      // Verify deletion
      const listResponse = await ctx.api.get<unknown[]>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments`
      );
      expect(listResponse.data.length).toBe(0);
    });

    it('should return 404 for non-existent comment', async () => {
      const response = await ctx.api.delete(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/comments/999999`
      );

      expect(response.status).toBe(404);
    });
  });
});
