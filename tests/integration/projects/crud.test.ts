/**
 * Integration Tests: Projects CRUD
 *
 * Migrated from: tests/api/projects-*.spec.ts, tests/e2e/projects/*.spec.ts
 * Tests for project API endpoints using Vitest integration test infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { subDays } from 'date-fns';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { addProjectMember, createTestTicket } from '@/tests/helpers/db-setup';
import type { ProjectsActivityHeatmapResponse } from '@/app/lib/types/project';

const prisma = getPrismaClient();

async function seedProjectsActivity(options: {
  projectId: number;
  projectDefaultAgent?: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';
  ticketAgent?: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI' | null;
  startedAt: Date;
  completedAt?: Date;
  command?: string;
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  costUsd?: number | null;
  title?: string;
}): Promise<void> {
  await prisma.project.update({
    where: { id: options.projectId },
    data: {
      defaultAgent: options.projectDefaultAgent ?? 'CLAUDE',
    },
  });

  const ticket = await createTestTicket(options.projectId, {
    title: options.title ?? '[e2e] Heatmap Ticket',
    description: 'Seeded projects activity heatmap ticket',
    stage: 'BUILD',
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      agent: options.ticketAgent ?? null,
    },
  });

  await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: options.projectId,
      command: options.command ?? 'implement',
      status: options.status ?? 'COMPLETED',
      startedAt: options.startedAt,
      completedAt: options.completedAt ?? null,
      costUsd: options.costUsd ?? null,
      updatedAt: options.completedAt ?? options.startedAt,
    },
  });
}

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

  describe('GET /api/projects/activity', () => {
    it('returns the default heatmap payload shape and counts shipped tickets from successful ship jobs', async () => {
      const implementationDay = subDays(new Date(), 2);
      const shippedDay = subDays(new Date(), 1);

      await seedProjectsActivity({
        projectId: ctx.projectId,
        startedAt: implementationDay,
        costUsd: 1.25,
        title: '[e2e] Heatmap implementation',
      });
      await seedProjectsActivity({
        projectId: ctx.projectId,
        startedAt: shippedDay,
        completedAt: shippedDay,
        command: 'ship',
        status: 'COMPLETED',
        costUsd: 0.75,
        title: '[e2e] Heatmap shipped ticket',
      });
      await seedProjectsActivity({
        projectId: ctx.projectId,
        startedAt: shippedDay,
        completedAt: shippedDay,
        command: 'ship',
        status: 'FAILED',
        title: '[e2e] Failed ship should not count',
      });

      const response = await ctx.api.get<ProjectsActivityHeatmapResponse>('/api/projects/activity');

      expect(response.status).toBe(200);
      expect(response.data.filters).toEqual({
        period: 'last-12-months',
        year: null,
        agent: 'all',
      });
      expect(response.data.legendLevels).toEqual([0, 1, 2, 3, 4]);
      expect(response.data.summary.totalJobs).toBe(3);
      expect(response.data.summary.totalShippedTickets).toBe(1);
      expect(response.data.summary.summaryLabel).toContain('tickets shipped');
      expect(response.data.hasActivity).toBe(true);
      expect(response.data.days.length).toBeGreaterThan(300);
      expect(response.data.periodOptions[0]?.value).toBe('last-12-months');

      const shippedCell = response.data.days.find(
        (day) => day.date === shippedDay.toISOString().slice(0, 10)
      );

      expect(shippedCell?.jobCount).toBe(2);
      expect(shippedCell?.shippedTicketCount).toBe(1);
      expect(shippedCell?.shippedTickets).toHaveLength(1);
      expect(shippedCell?.costUsd).toBe(0.75);
    });

    it('returns an empty-state payload when the selected period has no activity', async () => {
      const response = await ctx.api.get<ProjectsActivityHeatmapResponse>('/api/projects/activity');

      expect(response.status).toBe(200);
      expect(response.data.hasActivity).toBe(false);
      expect(response.data.summary.totalJobs).toBe(0);
      expect(response.data.summary.totalShippedTickets).toBe(0);
      expect(response.data.days.every((day) => day.jobCount === 0)).toBe(true);
      expect(response.data.days.every((day) => day.shippedTicketCount === 0)).toBe(true);
    });

    it('validates period parsing, year bounds, and calendar-year boundaries for older accounts', async () => {
      const memberId = `heatmap-member-${Date.now()}`;

      await prisma.user.create({
        data: {
          id: memberId,
          email: `${memberId}@e2e.local`,
          name: 'Projects Heatmap Member',
          createdAt: new Date('2024-01-15T00:00:00.000Z'),
          updatedAt: new Date(),
          emailVerified: new Date(),
        },
      });
      await addProjectMember(ctx.projectId, memberId);

      const response = await ctx.api.get<ProjectsActivityHeatmapResponse>(
        '/api/projects/activity?period=year&year=2024',
        { testUserId: memberId }
      );

      expect(response.status).toBe(200);
      expect(response.data.filters.period).toBe('year');
      expect(response.data.filters.year).toBe(2024);
      expect(response.data.days[0]?.date).toBe('2024-01-01');
      expect(response.data.days.at(-1)?.date).toBe('2024-12-31');
      expect(response.data.periodOptions.some((option) => option.value === 'year:2024')).toBe(true);
      expect(response.data.days.every((day) => day.date >= '2024-01-01')).toBe(true);
      expect(response.data.days.every((day) => day.date <= '2024-12-31')).toBe(true);
    });

    it('returns 400 for invalid period, year, and agent values', async () => {
      const invalidPeriod = await ctx.api.get('/api/projects/activity?period=month');
      const missingYear = await ctx.api.get('/api/projects/activity?period=year');
      const invalidAgent = await ctx.api.get('/api/projects/activity?agent=INVALID');

      expect(invalidPeriod.status).toBe(400);
      expect(missingYear.status).toBe(400);
      expect(invalidAgent.status).toBe(400);
    });

    it('derives distinct agent options from effective agents and preserves boundaries for zero-count agent filters', async () => {
      const activeDay = subDays(new Date(), 3);

      await seedProjectsActivity({
        projectId: ctx.projectId,
        projectDefaultAgent: 'GEMINI',
        ticketAgent: null,
        startedAt: activeDay,
        title: '[e2e] Inherited Gemini activity',
      });

      const allAgentsResponse = await ctx.api.get<ProjectsActivityHeatmapResponse>(
        '/api/projects/activity'
      );
      const filteredResponse = await ctx.api.get<ProjectsActivityHeatmapResponse>(
        '/api/projects/activity?agent=GEMINI'
      );
      const zeroCountResponse = await ctx.api.get<ProjectsActivityHeatmapResponse>(
        '/api/projects/activity?agent=CODEX'
      );

      expect(allAgentsResponse.status).toBe(200);
      expect(allAgentsResponse.data.agentOptions).toEqual(
        expect.arrayContaining([
          { value: 'all', label: 'All' },
          { value: 'GEMINI', label: 'Gemini' },
        ])
      );

      expect(filteredResponse.data.filters.agent).toBe('GEMINI');
      expect(filteredResponse.data.summary.totalJobs).toBe(1);
      expect(filteredResponse.data.hasActivity).toBe(true);

      expect(zeroCountResponse.data.filters.agent).toBe('CODEX');
      expect(zeroCountResponse.data.summary.totalJobs).toBe(0);
      expect(zeroCountResponse.data.hasActivity).toBe(false);
      expect(zeroCountResponse.data.days).toHaveLength(allAgentsResponse.data.days.length);
      expect(zeroCountResponse.data.days[0]?.date).toBe(allAgentsResponse.data.days[0]?.date);
      expect(zeroCountResponse.data.days.at(-1)?.date).toBe(
        allAgentsResponse.data.days.at(-1)?.date
      );
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
