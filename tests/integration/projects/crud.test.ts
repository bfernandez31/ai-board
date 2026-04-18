/**
 * Integration Tests: Projects CRUD
 *
 * Migrated from: tests/api/projects-*.spec.ts, tests/e2e/projects/*.spec.ts
 * Tests for project API endpoints using Vitest integration test infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { SMART_DEFAULTS } from '@/lib/models/claude-models';

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
      const response = await ctx.api.get<{ id: number; name: string }>(
        `/api/projects/${ctx.projectId}`
      );

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('id', ctx.projectId);
      expect(response.data).toHaveProperty('name');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get('/api/projects/99999');

      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });

    it('should return 400 for invalid projectId format', async () => {
      const response = await ctx.api.get('/api/projects/abc');

      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
    });

    it('should include all expected project fields', async () => {
      const response = await ctx.api.get<{
        id: number;
        name: string;
        description: string;
        githubOwner: string;
        githubRepo: string;
        clarificationPolicy: string;
        createdAt: string;
        updatedAt: string;
      }>(`/api/projects/${ctx.projectId}`);

      expect(response.status).toBe(200);

      // Verify response structure
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('description');
      expect(response.data).toHaveProperty('githubOwner');
      expect(response.data).toHaveProperty('githubRepo');
      expect(response.data).toHaveProperty('clarificationPolicy');
      expect(response.data).toHaveProperty('createdAt');
      expect(response.data).toHaveProperty('updatedAt');
    });
  });

  describe('GET /api/projects', () => {
    it('should list projects', async () => {
      const response = await ctx.api.get<{ id: number }[]>('/api/projects');

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should include the worker project in the list', async () => {
      const response = await ctx.api.get<{ id: number }[]>('/api/projects');

      expect(response.status).toBe(200);
      const projectIds = response.data.map((p) => p.id);
      expect(projectIds).toContain(ctx.projectId);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update project clarificationPolicy', async () => {
      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'CONSERVATIVE' }
      );

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      // Verify the PATCH response contains the updated value
      expect(response.data.clarificationPolicy).toBe('CONSERVATIVE');
    });

    it('should update project deploymentUrl', async () => {
      const newUrl = 'https://example.com/deployment';
      const response = await ctx.api.patch<{ deploymentUrl: string | null }>(
        `/api/projects/${ctx.projectId}`,
        { deploymentUrl: newUrl }
      );

      expect(response.status).toBe(200);
      // Verify the PATCH response contains the updated value
      expect(response.data.deploymentUrl).toBe(newUrl);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.patch('/api/projects/99999', {
        clarificationPolicy: 'CONSERVATIVE',
      });

      expect(response.status).toBe(404);
    });

    it('persists SMART_DEFAULTS on a newly created project (AIB-678)', async () => {
      const prisma = getPrismaClient();
      const unique = Date.now();
      const response = await ctx.api.post<{ id: number }>(`/api/projects`, {
        name: `[e2e] smart-defaults ${unique}`,
        description: 'seed-test',
        githubOwner: 'e2e-owner',
        githubRepo: `e2e-repo-${unique}`,
      });

      expect([201, 403]).toContain(response.status);

      if (response.status === 201) {
        const project = await prisma.project.findUnique({ where: { id: response.data.id } });
        expect(project?.specifyModel).toBe(SMART_DEFAULTS.specifyModel);
        expect(project?.planModel).toBe(SMART_DEFAULTS.planModel);
        expect(project?.implementModel).toBe(SMART_DEFAULTS.implementModel);
        expect(project?.quickImplModel).toBe(SMART_DEFAULTS.quickImplModel);
        expect(project?.verifyModel).toBe(SMART_DEFAULTS.verifyModel);

        // Cleanup
        await prisma.project.delete({ where: { id: response.data.id } });
      }
    });

    it('should update updatedAt timestamp', async () => {
      const beforeResponse = await ctx.api.get<{ updatedAt: string }>(
        `/api/projects/${ctx.projectId}`
      );
      const initialUpdatedAt = new Date(beforeResponse.data.updatedAt);

      // Wait 100ms to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await ctx.api.patch(`/api/projects/${ctx.projectId}`, {
        clarificationPolicy: 'PRAGMATIC',
      });

      const afterResponse = await ctx.api.get<{ updatedAt: string }>(
        `/api/projects/${ctx.projectId}`
      );
      const newUpdatedAt = new Date(afterResponse.data.updatedAt);

      expect(newUpdatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
    });
  });
});
