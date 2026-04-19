import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { ActivityHeatmapResponse } from '@/lib/db/activity';

describe('Activity Heatmap API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return empty data when no activity exists', async () => {
    const response = await ctx.api.get<ActivityHeatmapResponse>('/api/activity');

    expect(response.status).toBe(200);
    expect(response.data.data).toEqual([]);
    expect(response.data.availableAgents).toEqual([]);
    expect(response.data.stats.totalJobs).toBe(0);
    expect(response.data.stats.totalTicketsShipped).toBe(0);
  });

  it('should aggregate job activity correctly', async () => {
    const ticket = await ctx.createTicket({ title: '[e2e] Heatmap Ticket' });
    
    // Create some jobs
    await prisma.job.create({
      data: {
        projectId: ctx.projectId,
        ticketId: ticket.id,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        costUsd: 0.05,
        updatedAt: new Date(),
      }
    });

    await prisma.job.create({
      data: {
        projectId: ctx.projectId,
        ticketId: ticket.id,
        command: 'ship',
        status: 'COMPLETED',
        startedAt: new Date(),
        costUsd: 0.01,
        updatedAt: new Date(),
      }
    });

    const response = await ctx.api.get<ActivityHeatmapResponse>('/api/activity');

    expect(response.status).toBe(200);
    expect(response.data.data.length).toBe(1);
    expect(response.data.data[0].jobCount).toBe(2);
    expect(response.data.data[0].totalCost).toBeCloseTo(0.06);
    expect(response.data.data[0].shippedTickets.length).toBe(1);
    expect(response.data.data[0].shippedTickets[0].ticketKey).toBe(ticket.ticketKey);
    expect(response.data.stats.totalJobs).toBe(2);
    expect(response.data.stats.totalTicketsShipped).toBe(1);
  });

  it('should filter by agent correctly', async () => {
    // Project 1 (worker project) has defaultAgent CLAUDE usually
    const project = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    const defaultAgent = project?.defaultAgent || 'CLAUDE';

    const ticket1 = await ctx.createTicket({ title: '[e2e] Agent 1' });
    const ticket2 = await ctx.createTicket({ title: '[e2e] Agent 2' });
    
    // Update ticket2 to use a different agent if possible, 
    // or just rely on another project with different defaultAgent
    await prisma.ticket.update({
      where: { id: ticket2.id },
      data: { agent: 'GEMINI' }
    });

    await prisma.job.create({
      data: {
        projectId: ctx.projectId,
        ticketId: ticket1.id,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    await prisma.job.create({
      data: {
        projectId: ctx.projectId,
        ticketId: ticket2.id,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // All agents
    const responseAll = await ctx.api.get<ActivityHeatmapResponse>('/api/activity');
    expect(responseAll.data.stats.totalJobs).toBe(2);
    expect(responseAll.data.availableAgents.length).toBe(2);

    // Filter by GEMINI
    const responseGemini = await ctx.api.get<ActivityHeatmapResponse>('/api/activity?agent=GEMINI');
    expect(responseGemini.data.stats.totalJobs).toBe(1);
    
    // Filter by default (CLAUDE)
    const responseClaude = await ctx.api.get<ActivityHeatmapResponse>(`/api/activity?agent=${defaultAgent}`);
    expect(responseClaude.data.stats.totalJobs).toBe(1);
  });
});
