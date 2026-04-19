import { JobStatus } from '@prisma/client';
import type { Agent, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type {
  ActivityDayData,
  ActivityHeatmapResponse,
  AgentOption,
  HeatmapFilters,
  IntensityThresholds,
} from './types';
import {
  computePeriodDates,
  computeQuantileThresholds,
  formatDateKey,
} from './types';

function buildEffectiveAgentWhere(
  agent: string
): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent: agent as Agent },
      { agent: null, project: { is: { defaultAgent: agent as Agent } } },
    ],
  };
}

function buildOwnershipWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

export async function getActivityHeatmapData(
  userId: string,
  filters: HeatmapFilters
): Promise<ActivityHeatmapResponse> {
  const now = new Date();
  const { startDate, endDate } = computePeriodDates(filters.year, now);

  const endDateExclusive = new Date(endDate);
  endDateExclusive.setDate(endDateExclusive.getDate() + 1);

  const agentWhere = buildEffectiveAgentWhere(filters.agent);
  const ticketWhere: Prisma.TicketWhereInput = {
    project: { is: buildOwnershipWhere(userId) },
    ...(agentWhere ?? {}),
  };

  const jobs = await prisma.job.findMany({
    where: {
      status: JobStatus.COMPLETED,
      completedAt: { gte: startDate, lt: endDateExclusive },
      ticket: { is: ticketWhere },
    },
    select: {
      completedAt: true,
      costUsd: true,
      command: true,
      ticketId: true,
    },
  });

  const days: Record<string, ActivityDayData> = {};
  const shippedTicketsByDay = new Map<string, Set<number>>();

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const dateKey = formatDateKey(job.completedAt);

    if (!days[dateKey]) {
      days[dateKey] = { jobCount: 0, shippedCount: 0, costUsd: null };
    }

    const day = days[dateKey]!;
    day.jobCount += 1;

    if (job.costUsd !== null) {
      day.costUsd = (day.costUsd ?? 0) + job.costUsd;
    }

    if (job.command === 'ship') {
      if (!shippedTicketsByDay.has(dateKey)) {
        shippedTicketsByDay.set(dateKey, new Set());
      }
      shippedTicketsByDay.get(dateKey)!.add(job.ticketId);
    }
  }

  for (const [dateKey, ticketIds] of shippedTicketsByDay) {
    if (days[dateKey]) {
      days[dateKey]!.shippedCount = ticketIds.size;
    }
  }

  if (days[formatDateKey(endDate)]?.costUsd !== undefined && days[formatDateKey(endDate)]?.costUsd !== null) {
    days[formatDateKey(endDate)]!.costUsd = Math.round(days[formatDateKey(endDate)]!.costUsd! * 100) / 100;
  }
  for (const day of Object.values(days)) {
    if (day.costUsd !== null) {
      day.costUsd = Math.round(day.costUsd * 100) / 100;
    }
  }

  const dailyCounts = Object.values(days).map((d) => d.jobCount);
  const thresholds: IntensityThresholds = computeQuantileThresholds(dailyCounts);

  const totalJobs = Object.values(days).reduce((sum, d) => sum + d.jobCount, 0);
  const ticketsShipped = new Set(
    Array.from(shippedTicketsByDay.values()).flatMap((s) => Array.from(s))
  ).size;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  const createdYear = user ? user.createdAt.getFullYear() : now.getFullYear();
  const currentYear = now.getFullYear();
  const availableYears: string[] = ['rolling'];
  for (let y = createdYear; y <= currentYear; y++) {
    availableYears.push(String(y));
  }

  const availableAgents = await getAvailableAgentsForUser(userId);

  return {
    days,
    thresholds,
    summary: { totalJobs, ticketsShipped },
    period: {
      startDate: formatDateKey(startDate),
      endDate: formatDateKey(endDate),
    },
    availableYears,
    availableAgents,
    filters,
  };
}

async function getAvailableAgentsForUser(userId: string): Promise<AgentOption[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      project: { is: buildOwnershipWhere(userId) },
      jobs: { some: { status: JobStatus.COMPLETED } },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
    },
  });

  const agentSet = new Set<string>();
  for (const ticket of tickets) {
    const effective = ticket.agent ?? ticket.project.defaultAgent;
    agentSet.add(effective);
  }

  const options: AgentOption[] = [{ value: 'all', label: 'All' }];
  for (const agent of ALL_AGENTS) {
    if (agentSet.has(agent)) {
      options.push({ value: agent, label: getAgentLabel(agent) });
    }
  }

  return options;
}
