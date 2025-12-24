/**
 * Integration Tests: Projects CRUD
 *
 * Tests for project API endpoints using Vitest integration test infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('Projects CRUD', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('Worker Isolation Verification', () => {
    it('should use isolated project ID for this worker', async () => {
      // Verify we have a valid project ID from worker isolation
      expect(ctx.projectId).toBeGreaterThan(0);
      expect([1, 2, 4, 5, 6, 7]).toContain(ctx.projectId);

      // Log for debugging parallel execution
      console.log(`Worker using project ID: ${ctx.projectId}`);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get project by ID', async () => {
      const response = await ctx.api.get(`/api/projects/${ctx.projectId}`);

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('id', ctx.projectId);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get('/api/projects/99999');

      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });
  });

  describe('GET /api/projects', () => {
    it('should list projects', async () => {
      const response = await ctx.api.get<{ id: number }[]>('/api/projects');

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update project description', async () => {
      const newDescription = `[e2e] Updated at ${Date.now()}`;
      const response = await ctx.api.patch(`/api/projects/${ctx.projectId}`, {
        description: newDescription,
      });

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);

      // Verify the update
      const getResponse = await ctx.api.get<{ description: string }>(
        `/api/projects/${ctx.projectId}`
      );
      expect(getResponse.data.description).toBe(newDescription);
    });
  });
});
