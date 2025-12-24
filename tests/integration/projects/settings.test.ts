/**
 * Integration Tests: Project Settings
 *
 * Migrated from: tests/api/project-policy.spec.ts
 * Tests for project clarificationPolicy API endpoints.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { ClarificationPolicy } from '@prisma/client';

describe('Project Settings - clarificationPolicy', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/projects/:id - clarificationPolicy field', () => {
    it('should return clarificationPolicy with default AUTO', async () => {
      const response = await ctx.api.get<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('clarificationPolicy');
      expect(response.data.clarificationPolicy).toBe('AUTO');
    });

    it('should return clarificationPolicy for CONSERVATIVE', async () => {
      // Update project to CONSERVATIVE
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
      });

      const response = await ctx.api.get<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`
      );

      expect(response.data.clarificationPolicy).toBe('CONSERVATIVE');
    });

    it('should return clarificationPolicy for PRAGMATIC', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { clarificationPolicy: ClarificationPolicy.PRAGMATIC },
      });

      const response = await ctx.api.get<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`
      );

      expect(response.data.clarificationPolicy).toBe('PRAGMATIC');
    });

    it('should return clarificationPolicy for INTERACTIVE', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { clarificationPolicy: ClarificationPolicy.INTERACTIVE },
      });

      const response = await ctx.api.get<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`
      );

      expect(response.data.clarificationPolicy).toBe('INTERACTIVE');
    });
  });

  describe('PATCH /api/projects/:id - clarificationPolicy updates', () => {
    it('should update to CONSERVATIVE', async () => {
      const initialProject = await prisma.project.findUnique({ where: { id: ctx.projectId } });
      expect(initialProject?.clarificationPolicy).toBe('AUTO');

      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'CONSERVATIVE' }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('CONSERVATIVE');

      // Verify database state
      const dbProject = await prisma.project.findUnique({ where: { id: ctx.projectId } });
      expect(dbProject?.clarificationPolicy).toBe('CONSERVATIVE');
    });

    it('should update to PRAGMATIC', async () => {
      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'PRAGMATIC' }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('PRAGMATIC');
    });

    it('should update to INTERACTIVE', async () => {
      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'INTERACTIVE' }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('INTERACTIVE');
    });

    it('should update back to AUTO', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
      });

      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'AUTO' }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('AUTO');
    });

    it('should return 400 for invalid policy', async () => {
      const response = await ctx.api.patch<{ error: string; issues: unknown[] }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'INVALID_POLICY' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
      expect(response.data.issues).toBeDefined();
      expect(Array.isArray(response.data.issues)).toBe(true);
    });

    it('should return 400 for null policy', async () => {
      const response = await ctx.api.patch<{ error: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: null }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
    });

    it('should not affect clarificationPolicy when updating other fields', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
      });

      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`,
        { name: '[e2e] Updated Project Name' }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('CONSERVATIVE');
    });

    it('should persist policy across multiple updates', async () => {
      // Update 1: AUTO → CONSERVATIVE
      await ctx.api.patch(`/api/projects/${ctx.projectId}`, {
        clarificationPolicy: 'CONSERVATIVE',
      });

      // Update 2: CONSERVATIVE → PRAGMATIC
      await ctx.api.patch(`/api/projects/${ctx.projectId}`, {
        clarificationPolicy: 'PRAGMATIC',
      });

      // Update 3: PRAGMATIC → AUTO
      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'AUTO' }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('AUTO');

      // Verify database
      const dbProject = await prisma.project.findUnique({ where: { id: ctx.projectId } });
      expect(dbProject?.clarificationPolicy).toBe('AUTO');
    });
  });

  describe('PATCH /api/projects/:id - Response Format', () => {
    it('should include all expected project fields in response', async () => {
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
});
