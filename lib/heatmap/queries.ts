import { JobStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { AgentOption, NamedAgent } from '@/lib/analytics/types';
import type { HeatmapData, HeatmapDayCell, HeatmapFilters } from './types';

const TERMINAL_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED];

function buildEffectiveAgentWhere(agent: NamedAgent | 'all'): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      { agent: null, project: { is: { defaultAgent: agent } } },
    ],
  };
}

function buildUserProjectWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };
}

function getDateRange(year: 'rolling' | number, now: Date): { start: Date; end: Date } {
  if (year === 'rolling') {
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  };
}

async function getDailyJobs(
  userId: string,
  filters: HeatmapFilters,
  now: Date
): Promise<Map<string, { jobCount: number; costUsd: number | null }>> {
  const { start, end } = getDateRange(filters.year, now);
  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  const jobs = await prisma.job.findMany({
    where: {
      status: { in: TERMINAL_STATUSES },
      startedAt: { gte: start, lt: end },
      ticket: {
        project: buildUserProjectWhere(userId),
        ...agentWhere,
      },
    },
    select: { startedAt: true, costUsd: true },
  });

  const map = new Map<string, { jobCount: number; costUsd: number | null }>();
  for (const job of jobs) {
    const dateKey = job.startedAt.toISOString().slice(0, 10);
    const existing = map.get(dateKey);
    if (existing) {
      existing.jobCount += 1;
      if (job.costUsd !== null) {
        existing.costUsd = (existing.costUsd ?? 0) + job.costUsd;
      }
    } else {
      map.set(dateKey, { jobCount: 1, costUsd: job.costUsd });
    }
  }
  return map;
}

async function getDailyShipped(
  userId: string,
  filters: HeatmapFilters,
  now: Date
): Promise<Map<string, number>> {
  const { start, end } = getDateRange(filters.year, now);
  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  const shipJobs = await prisma.job.findMany({
    where: {
      command: 'ship',
      status: JobStatus.COMPLETED,
      completedAt: { gte: start, lt: end },
      ticket: {
        project: buildUserProjectWhere(userId),
        ...agentWhere,
      },
    },
    select: { completedAt: true, ticketId: true },
  });

  // Count distinct tickets shipped per day
  const dayTickets = new Map<string, Set<number>>();
  for (const job of shipJobs) {
    if (!job.completedAt) continue;
    const dateKey = job.completedAt.toISOString().slice(0, 10);
    const set = dayTickets.get(dateKey) ?? new Set();
    set.add(job.ticketId);
    dayTickets.set(dateKey, set);
  }

  const map = new Map<string, number>();
  for (const [date, tickets] of dayTickets) {
    map.set(date, tickets.size);
  }
  return map;
}

async function getAvailableYears(userId: string): Promise<number[]> {
  const jobs = await prisma.job.findMany({
    where: {
      status: { in: TERMINAL_STATUSES },
      ticket: {
        project: buildUserProjectWhere(userId),
      },
    },
    select: { startedAt: true },
    distinct: ['startedAt'],
  });

  const yearSet = new Set<number>();
  for (const job of jobs) {
    yearSet.add(job.startedAt.getFullYear());
  }
  return Array.from(yearSet).sort();
}

async function getAvailableAgents(
  userId: string,
  filters: HeatmapFilters,
  now: Date
): Promise<AgentOption[]> {
  const { start, end } = getDateRange(filters.year, now);

  const jobs = await prisma.job.findMany({
    where: {
      status: { in: TERMINAL_STATUSES },
      startedAt: { gte: start, lt: end },
      ticket: {
        project: buildUserProjectWhere(userId),
      },
    },
    select: {
      ticket: {
        select: {
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
    },
  });

  const agentCounts = new Map<string, number>();
  let totalJobs = 0;
  for (const job of jobs) {
    const effectiveAgent = job.ticket.agent ?? job.ticket.project.defaultAgent;
    agentCounts.set(effectiveAgent, (agentCounts.get(effectiveAgent) ?? 0) + 1);
    totalJobs++;
  }

  const options: AgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: totalJobs, isDefault: true },
  ];

  for (const agent of ALL_AGENTS) {
    const count = agentCounts.get(agent);
    if (count) {
      options.push({
        value: agent,
        label: getAgentLabel(agent),
        jobCount: count,
        isDefault: false,
      });
    }
  }

  return options;
}

export async function getHeatmapData(
  userId: string,
  filters: HeatmapFilters
): Promise<HeatmapData> {
  const now = new Date();

  const [dailyJobs, dailyShipped, availableYears, availableAgents] = await Promise.all([
    getDailyJobs(userId, filters, now),
    getDailyShipped(userId, filters, now),
    getAvailableYears(userId),
    getAvailableAgents(userId, filters, now),
  ]);

  // Merge into cells
  const allDates = new Set([...dailyJobs.keys(), ...dailyShipped.keys()]);
  const cells: HeatmapDayCell[] = [];
  let totalJobs = 0;
  let totalTicketsShipped = 0;

  for (const date of allDates) {
    const jobData = dailyJobs.get(date);
    const shipped = dailyShipped.get(date) ?? 0;
    const jobCount = jobData?.jobCount ?? 0;
    const costUsd = jobData?.costUsd ?? null;

    cells.push({ date, jobCount, costUsd, ticketsShipped: shipped });
    totalJobs += jobCount;
    totalTicketsShipped += shipped;
  }

  cells.sort((a, b) => a.date.localeCompare(b.date));

  return {
    cells,
    summary: { totalJobs, totalTicketsShipped },
    filters,
    availableYears,
    availableAgents,
  };
}
