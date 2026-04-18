import { JobStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { NamedAgent } from '@/lib/analytics/types';
import type { HeatmapAgentOption, HeatmapData, HeatmapDayData, HeatmapFilters } from './types';
import { DEFAULT_HEATMAP_PERIOD } from './types';

function buildEffectiveAgentWhere(agent: string): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent: agent as NamedAgent },
      {
        agent: null,
        project: { is: { defaultAgent: agent as NamedAgent } },
      },
    ],
  };
}

function computePeriodBounds(period: string, now: Date): { start: Date; end: Date } {
  if (period === DEFAULT_HEATMAP_PERIOD) {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  const year = parseInt(period, 10);
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getAvailableAgents(userId: string): Promise<HeatmapAgentOption[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      project: {
        OR: [
          { userId },
          { members: { some: { userId } } },
        ],
      },
      jobs: { some: {} },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
    },
    distinct: ['agent', 'projectId'],
  });

  const agents = new Set<NamedAgent>();
  for (const ticket of tickets) {
    agents.add((ticket.agent ?? ticket.project.defaultAgent) as NamedAgent);
  }

  if (agents.size <= 1) return [];

  const options: HeatmapAgentOption[] = [{ value: 'all', label: 'All agents' }];
  for (const agent of ALL_AGENTS) {
    if (agents.has(agent)) {
      options.push({ value: agent, label: getAgentLabel(agent) });
    }
  }
  return options;
}

export async function getHeatmapData(
  userId: string,
  filters: HeatmapFilters
): Promise<HeatmapData> {
  const now = new Date();
  const { start, end } = computePeriodBounds(filters.period, now);

  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  const projectWhere: Prisma.ProjectWhereInput = {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };

  const ticketWhere: Prisma.TicketWhereInput = {
    project: { is: projectWhere },
    ...(agentWhere ?? {}),
  };

  const [jobs, shipJobs, availableAgents, user] = await Promise.all([
    prisma.job.findMany({
      where: {
        status: JobStatus.COMPLETED,
        completedAt: { gte: start, lte: end },
        ticket: { is: ticketWhere },
      },
      select: {
        completedAt: true,
        costUsd: true,
      },
    }),
    prisma.job.findMany({
      where: {
        command: 'ship',
        status: JobStatus.COMPLETED,
        completedAt: { gte: start, lte: end },
        ticket: { is: ticketWhere },
      },
      select: {
        completedAt: true,
        ticket: {
          select: { ticketKey: true, title: true },
        },
      },
    }),
    getAvailableAgents(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
  ]);

  const days: Record<string, HeatmapDayData> = {};

  const getOrCreate = (dateKey: string): HeatmapDayData => {
    let day = days[dateKey];
    if (!day) {
      day = { date: dateKey, jobCount: 0, costUsd: null, shippedTickets: [] };
      days[dateKey] = day;
    }
    return day;
  };

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const key = toDateKey(job.completedAt);
    const day = getOrCreate(key);
    day.jobCount++;
    if (job.costUsd != null) {
      day.costUsd = (day.costUsd ?? 0) + job.costUsd;
    }
  }

  const shippedSet = new Set<string>();
  for (const job of shipJobs) {
    if (!job.completedAt) continue;
    const key = toDateKey(job.completedAt);
    const day = getOrCreate(key);
    const label = `${job.ticket.ticketKey}: ${job.ticket.title}`;
    if (!day.shippedTickets.includes(label)) {
      day.shippedTickets.push(label);
    }
    shippedSet.add(job.ticket.ticketKey);
  }

  for (const day of Object.values(days)) {
    if (day.costUsd != null) {
      day.costUsd = Math.round(day.costUsd * 100) / 100;
    }
  }

  return {
    days,
    totalJobs: jobs.length,
    totalShipped: shippedSet.size,
    availableAgents,
    periodStart: toDateKey(start),
    periodEnd: toDateKey(end),
    userCreatedAt: user?.createdAt.toISOString() ?? now.toISOString(),
    filters,
  };
}
