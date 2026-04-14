/**
 * Integration Tests: Activity Heatmap API
 * Feature: AIB-648 - Activity Heatmap on Projects Page
 *
 * Tests for the heatmap API endpoint that aggregates job and ticket data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { HeatmapResponse } from '@/app/api/activity/heatmap/route';

describe('Activity Heatmap API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/activity/heatmap', () => {
    it('should return heatmap data with correct structure', async () => {
      const response = await ctx.api.get<HeatmapResponse>(
        '/api/activity/heatmap'
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('days');
      expect(response.data).toHaveProperty('totalJobs');
      expect(response.data).toHaveProperty('totalShipped');
      expect(response.data).toHaveProperty('yearStart');
      expect(response.data).toHaveProperty('yearEnd');
      expect(response.data).toHaveProperty('availableYears');
      expect(Array.isArray(response.data.days)).toBe(true);
      expect(Array.isArray(response.data.availableYears)).toBe(true);
    });

    it('should return data for rolling 12 months by default', async () => {
      const response = await ctx.api.get<HeatmapResponse>(
        '/api/activity/heatmap'
      );

      expect(response.status).toBe(200);

      const yearStart = new Date(response.data.yearStart);
      const yearEnd = new Date(response.data.yearEnd);
      const diffMs = yearEnd.getTime() - yearStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      // Should be approximately 365 days
      expect(diffDays).toBeGreaterThanOrEqual(364);
      expect(diffDays).toBeLessThanOrEqual(367);
    });

    it('should support year filter', async () => {
      const currentYear = new Date().getFullYear();
      const response = await ctx.api.get<HeatmapResponse>(
        `/api/activity/heatmap?year=${currentYear}`
      );

      expect(response.status).toBe(200);
      const yearStart = new Date(response.data.yearStart);
      expect(yearStart.getUTCFullYear()).toBe(currentYear);
      expect(yearStart.getUTCMonth()).toBe(0);
      expect(yearStart.getUTCDate()).toBe(1);
    });

    it('should support agent filter', async () => {
      const response = await ctx.api.get<HeatmapResponse>(
        '/api/activity/heatmap?agent=CLAUDE'
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('days');
    });

    it('should aggregate jobs per day correctly', async () => {
      // Create a ticket, then create jobs directly via prisma
      const ticket = await ctx.createTicket({
        title: '[e2e] Heatmap test ticket',
      });

      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);

      await prisma.job.createMany({
        data: [
          {
            ticketId: ticket.id,
            projectId: ctx.projectId,
            command: 'specify',
            status: 'COMPLETED',
            startedAt: today,
            completedAt: today,
            costUsd: 0.50,
            updatedAt: today,
          },
          {
            ticketId: ticket.id,
            projectId: ctx.projectId,
            command: 'plan',
            status: 'COMPLETED',
            startedAt: today,
            completedAt: today,
            costUsd: 0.75,
            updatedAt: today,
          },
        ],
      });

      const response = await ctx.api.get<HeatmapResponse>(
        '/api/activity/heatmap'
      );

      expect(response.status).toBe(200);

      const todayStr = today.toISOString().slice(0, 10);
      const todayData = response.data.days.find((d) => d.date === todayStr);

      expect(todayData).toBeDefined();
      expect(todayData!.jobCount).toBeGreaterThanOrEqual(2);
      expect(todayData!.totalCost).toBeGreaterThanOrEqual(1.25);
    });

    it('should count shipped tickets', async () => {
      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);

      // Create a shipped ticket with closedAt set to today
      const ticket = await ctx.createTicket({
        title: '[e2e] Shipped heatmap ticket',
        stage: 'SHIP',
      });

      // Update the closedAt to today
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { closedAt: today },
      });

      const response = await ctx.api.get<HeatmapResponse>(
        '/api/activity/heatmap'
      );

      expect(response.status).toBe(200);

      const todayStr = today.toISOString().slice(0, 10);
      const todayData = response.data.days.find((d) => d.date === todayStr);

      expect(todayData).toBeDefined();
      expect(todayData!.shippedCount).toBeGreaterThanOrEqual(1);
      expect(response.data.totalShipped).toBeGreaterThanOrEqual(1);
    });

    it('should reject invalid year parameter', async () => {
      const response = await ctx.api.get<{ error: string }>(
        '/api/activity/heatmap?year=1900'
      );

      expect(response.status).toBe(400);
    });

    it('should reject invalid agent parameter', async () => {
      const response = await ctx.api.get<{ error: string }>(
        '/api/activity/heatmap?agent=INVALID'
      );

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await ctx.api.get<{ error: string }>(
        '/api/activity/heatmap',
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
        }
      );

      expect(response.status).toBe(401);
    });
  });
});
