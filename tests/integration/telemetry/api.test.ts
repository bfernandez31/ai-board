/**
 * Integration Tests: Telemetry API
 *
 * Tests for the telemetry API endpoint that aggregates job metrics for ticket comparison.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { JobStatus } from '@prisma/client';

describe('Telemetry API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/projects/:projectId/telemetry', () => {
    it('should return telemetry for single ticket with completed jobs', async () => {
      // Create ticket
      const ticketRes = await ctx.api.post<{ id: number; ticketKey: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Test ticket for telemetry',
          description: 'Description',
        }
      );

      const ticketId = ticketRes.data.id;
      const ticketKey = ticketRes.data.ticketKey;

      // Create completed jobs with telemetry
      await prisma.job.createMany({
        data: [
          {
            ticketId,
            projectId: ctx.projectId,
            command: 'specify',
            status: JobStatus.COMPLETED,
            branch: 'test-branch',
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadTokens: 100,
            cacheCreationTokens: 50,
            costUsd: 0.15,
            durationMs: 30000,
            model: 'claude-sonnet-4',
            toolsUsed: ['Read', 'Edit'],
            updatedAt: new Date(),
          },
          {
            ticketId,
            projectId: ctx.projectId,
            command: 'plan',
            status: JobStatus.COMPLETED,
            branch: 'test-branch',
            inputTokens: 2000,
            outputTokens: 800,
            cacheReadTokens: 200,
            cacheCreationTokens: 100,
            costUsd: 0.25,
            durationMs: 45000,
            model: 'claude-sonnet-4',
            toolsUsed: ['Read', 'Write', 'Bash'],
            updatedAt: new Date(),
          },
        ],
      });

      // Fetch telemetry
      const response = await ctx.api.get<
        Record<
          string,
          {
            inputTokens: number;
            outputTokens: number;
            cacheReadTokens: number;
            cacheCreationTokens: number;
            costUsd: number;
            durationMs: number;
            models: string[];
            toolsUsed: string[];
            jobCount: number;
          }
        >
      >(`/api/projects/${ctx.projectId}/telemetry?ticketKeys=${ticketKey}`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty(ticketKey);

      const telemetry = response.data[ticketKey];
      expect(telemetry.inputTokens).toBe(3000);
      expect(telemetry.outputTokens).toBe(1300);
      expect(telemetry.cacheReadTokens).toBe(300);
      expect(telemetry.cacheCreationTokens).toBe(150);
      expect(telemetry.costUsd).toBe(0.4);
      expect(telemetry.durationMs).toBe(75000);
      expect(telemetry.models).toEqual(['claude-sonnet-4']);
      expect(telemetry.toolsUsed).toContain('Read');
      expect(telemetry.toolsUsed).toContain('Edit');
      expect(telemetry.toolsUsed).toContain('Write');
      expect(telemetry.toolsUsed).toContain('Bash');
      expect(telemetry.jobCount).toBe(2);
    });

    it('should return telemetry for multiple tickets', async () => {
      // Create two tickets
      const ticket1Res = await ctx.api.post<{ id: number; ticketKey: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Ticket 1',
          description: 'First ticket',
        }
      );

      const ticket2Res = await ctx.api.post<{ id: number; ticketKey: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Ticket 2',
          description: 'Second ticket',
        }
      );

      const ticket1Id = ticket1Res.data.id;
      const ticket1Key = ticket1Res.data.ticketKey;
      const ticket2Id = ticket2Res.data.id;
      const ticket2Key = ticket2Res.data.ticketKey;

      // Create jobs for both tickets
      await prisma.job.createMany({
        data: [
          {
            ticketId: ticket1Id,
            projectId: ctx.projectId,
            command: 'specify',
            status: JobStatus.COMPLETED,
            branch: 'branch-1',
            inputTokens: 1000,
            outputTokens: 500,
            costUsd: 0.1,
            durationMs: 20000,
            model: 'claude-sonnet-4',
            toolsUsed: ['Read'],
            updatedAt: new Date(),
          },
          {
            ticketId: ticket2Id,
            projectId: ctx.projectId,
            command: 'specify',
            status: JobStatus.COMPLETED,
            branch: 'branch-2',
            inputTokens: 2000,
            outputTokens: 1000,
            costUsd: 0.2,
            durationMs: 40000,
            model: 'claude-opus-4',
            toolsUsed: ['Write'],
            updatedAt: new Date(),
          },
        ],
      });

      // Fetch telemetry for both tickets
      const response = await ctx.api.get<Record<string, { inputTokens: number; costUsd: number }>>(
        `/api/projects/${ctx.projectId}/telemetry?ticketKeys=${ticket1Key},${ticket2Key}`
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty(ticket1Key);
      expect(response.data).toHaveProperty(ticket2Key);

      expect(response.data[ticket1Key].inputTokens).toBe(1000);
      expect(response.data[ticket1Key].costUsd).toBe(0.1);

      expect(response.data[ticket2Key].inputTokens).toBe(2000);
      expect(response.data[ticket2Key].costUsd).toBe(0.2);
    });

    it('should exclude pending and failed jobs from aggregation', async () => {
      // Create ticket
      const ticketRes = await ctx.api.post<{ id: number; ticketKey: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Mixed job statuses',
          description: 'Testing job filtering',
        }
      );

      const ticketId = ticketRes.data.id;
      const ticketKey = ticketRes.data.ticketKey;

      // Create jobs with different statuses
      await prisma.job.createMany({
        data: [
          {
            ticketId,
            projectId: ctx.projectId,
            command: 'specify',
            status: JobStatus.COMPLETED,
            branch: 'test-branch',
            inputTokens: 1000,
            outputTokens: 500,
            costUsd: 0.1,
            durationMs: 20000,
            updatedAt: new Date(),
          },
          {
            ticketId,
            projectId: ctx.projectId,
            command: 'plan',
            status: JobStatus.PENDING,
            branch: 'test-branch',
            inputTokens: 2000,
            outputTokens: 1000,
            costUsd: 0.2,
            durationMs: 40000,
            updatedAt: new Date(),
          },
          {
            ticketId,
            projectId: ctx.projectId,
            command: 'implement',
            status: JobStatus.FAILED,
            branch: 'test-branch',
            inputTokens: 3000,
            outputTokens: 1500,
            costUsd: 0.3,
            durationMs: 60000,
            updatedAt: new Date(),
          },
        ],
      });

      // Fetch telemetry
      const response = await ctx.api.get<
        Record<string, { inputTokens: number; costUsd: number; jobCount: number }>
      >(`/api/projects/${ctx.projectId}/telemetry?ticketKeys=${ticketKey}`);

      expect(response.status).toBe(200);

      const telemetry = response.data[ticketKey];
      // Should only count the COMPLETED job
      expect(telemetry.inputTokens).toBe(1000);
      expect(telemetry.costUsd).toBe(0.1);
      expect(telemetry.jobCount).toBe(1);
    });

    it('should return zero metrics for ticket with no jobs', async () => {
      // Create ticket without jobs
      const ticketRes = await ctx.api.post<{ id: number; ticketKey: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] No jobs ticket',
          description: 'Ticket with no jobs',
        }
      );

      const ticketKey = ticketRes.data.ticketKey;

      // Fetch telemetry
      const response = await ctx.api.get<
        Record<
          string,
          {
            inputTokens: number;
            outputTokens: number;
            costUsd: number;
            durationMs: number;
            jobCount: number;
          }
        >
      >(`/api/projects/${ctx.projectId}/telemetry?ticketKeys=${ticketKey}`);

      expect(response.status).toBe(200);

      const telemetry = response.data[ticketKey];
      expect(telemetry.inputTokens).toBe(0);
      expect(telemetry.outputTokens).toBe(0);
      expect(telemetry.costUsd).toBe(0);
      expect(telemetry.durationMs).toBe(0);
      expect(telemetry.jobCount).toBe(0);
    });

    it('should return zero metrics for non-existent ticket', async () => {
      const fakeTicketKey = 'TST-999';

      const response = await ctx.api.get<
        Record<string, { inputTokens: number; jobCount: number }>
      >(`/api/projects/${ctx.projectId}/telemetry?ticketKeys=${fakeTicketKey}`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty(fakeTicketKey);
      expect(response.data[fakeTicketKey].inputTokens).toBe(0);
      expect(response.data[fakeTicketKey].jobCount).toBe(0);
    });

    it('should return 400 when ticketKeys parameter is missing', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/telemetry`
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('ticketKeys');
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when ticketKeys is empty', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/telemetry?ticketKeys=`
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('ticketKeys');
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when more than 10 ticket keys are requested', async () => {
      const ticketKeys = Array.from({ length: 11 }, (_, i) => `TST-${i + 1}`).join(',');

      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/telemetry?ticketKeys=${ticketKeys}`
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Maximum 10 ticket keys');
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when project does not exist', async () => {
      const nonExistentProjectId = 99999;

      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${nonExistentProjectId}/telemetry?ticketKeys=TST-1`
      );

      expect(response.status).toBe(404);
      expect(response.data.error).toBe('Project not found');
      expect(response.data.code).toBe('NOT_FOUND');
    });
  });
});
