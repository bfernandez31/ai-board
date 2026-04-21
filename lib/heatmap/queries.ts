/**
 * Server-side aggregation for the activity heatmap (AIB-704).
 *
 * Read-only. No new Prisma models. Reuses `formatDateForGrouping` and
 * mirrors `buildEffectiveAgentWhere` from the analytics module.
 */

import { JobStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { formatDateForGrouping } from '@/lib/analytics/aggregations';
import { ALL_AGENTS, getAgentLabel, resolveEffectiveAgent } from '@/app/lib/utils/agent-resolution';
import type { NamedAgent } from '@/lib/analytics/types';
import { bucketFor, computeIntensityThresholds } from './buckets';
import { getPeriodBoundaries } from './period';
import type {
  HeatmapAgentOption,
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
  ShippedTicket,
} from './types';

function buildEffectiveAgentWhere(
  agent: HeatmapFilters['agent']
): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      {
        agent: null,
        project: { is: { defaultAgent: agent } },
      },
    ],
  };
}

function ownerOrMemberWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

function enumerateDays(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const finish = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() <= finish.getTime()) {
    days.push(formatDateForGrouping(cursor, 'daily'));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function getAccountCreatedYear(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  return user?.createdAt.getUTCFullYear() ?? new Date().getUTCFullYear();
}

export async function getHeatmapInitialData(
  userId: string,
  filters: HeatmapFilters,
  now: Date = new Date()
): Promise<HeatmapData> {
  const boundaries = getPeriodBoundaries(filters.period, now);
  const startDate = boundaries.startDate;
  const endDate = boundaries.endDate;

  const projectScope = ownerOrMemberWhere(userId);
  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  const ticketScopeFiltered: Prisma.TicketWhereInput = {
    project: projectScope,
    ...(agentWhere ?? {}),
  };
  const ticketScopeAll: Prisma.TicketWhereInput = { project: projectScope };

  const [jobRows, shipRows, agentTickets, accountCreatedYear] = await Promise.all([
    prisma.job.findMany({
      where: {
        startedAt: { gte: startDate, lte: endDate },
        NOT: { status: JobStatus.PENDING },
        ticket: ticketScopeFiltered,
      },
      select: {
        startedAt: true,
        costUsd: true,
      },
    }),
    prisma.job.findMany({
      where: {
        command: 'ship',
        status: JobStatus.COMPLETED,
        completedAt: { gte: startDate, lte: endDate },
        ticket: ticketScopeFiltered,
      },
      select: {
        completedAt: true,
        ticket: { select: { ticketKey: true, title: true } },
      },
    }),
    prisma.ticket.findMany({
      where: {
        ...ticketScopeAll,
        jobs: {
          some: {
            startedAt: { gte: startDate, lte: endDate },
            NOT: { status: JobStatus.PENDING },
          },
        },
      },
      select: {
        agent: true,
        project: { select: { defaultAgent: true } },
        _count: {
          select: {
            jobs: {
              where: {
                startedAt: { gte: startDate, lte: endDate },
                NOT: { status: JobStatus.PENDING },
              },
            },
          },
        },
      },
    }),
    getAccountCreatedYear(userId),
  ]);

  const dayKeys = enumerateDays(startDate, endDate);
  const dayIndex = new Map<string, HeatmapDay>();
  for (const date of dayKeys) {
    dayIndex.set(date, {
      date,
      jobCount: 0,
      sumCostUsd: 0,
      hasAnyCost: false,
      shippedTickets: [],
      intensity: 0,
    });
  }

  for (const job of jobRows) {
    if (!job.startedAt) continue;
    const key = formatDateForGrouping(job.startedAt, 'daily');
    const day = dayIndex.get(key);
    if (!day) continue;
    day.jobCount += 1;
    if (job.costUsd != null) {
      day.hasAnyCost = true;
      day.sumCostUsd += job.costUsd;
    }
  }

  for (const day of dayIndex.values()) {
    day.sumCostUsd = Math.round(day.sumCostUsd * 100) / 100;
  }

  let ticketsShipped = 0;
  for (const ship of shipRows) {
    if (!ship.completedAt) continue;
    const key = formatDateForGrouping(ship.completedAt, 'daily');
    const day = dayIndex.get(key);
    if (!day) continue;
    const shipped: ShippedTicket = {
      ticketKey: ship.ticket.ticketKey,
      title: ship.ticket.title,
    };
    day.shippedTickets.push(shipped);
    ticketsShipped += 1;
  }

  const nonZeroCounts: number[] = [];
  for (const day of dayIndex.values()) {
    if (day.jobCount > 0) nonZeroCounts.push(day.jobCount);
  }
  const intensityThresholds = computeIntensityThresholds(nonZeroCounts);
  for (const day of dayIndex.values()) {
    day.intensity = bucketFor(day.jobCount, intensityThresholds);
  }

  const days: HeatmapDay[] = dayKeys.map((k) => dayIndex.get(k)!);
  const totalJobs = days.reduce((sum, d) => sum + d.jobCount, 0);

  const agentCounts = new Map<NamedAgent, number>();
  for (const ticket of agentTickets) {
    const effective = resolveEffectiveAgent(ticket.agent, ticket.project.defaultAgent) as NamedAgent;
    agentCounts.set(effective, (agentCounts.get(effective) ?? 0) + ticket._count.jobs);
  }
  const availableAgents: HeatmapAgentOption[] = ALL_AGENTS
    .map((agent) => ({
      value: agent,
      label: getAgentLabel(agent),
      jobCount: agentCounts.get(agent) ?? 0,
    }))
    .filter((option) => option.jobCount > 0);

  return {
    filters,
    period: {
      startDate: formatDateForGrouping(startDate, 'daily'),
      endDate: formatDateForGrouping(endDate, 'daily'),
      label: boundaries.label,
    },
    intensityThresholds,
    days,
    totals: {
      jobs: totalJobs,
      ticketsShipped,
    },
    availableAgents,
    accountCreatedYear,
    generatedAt: now.toISOString(),
  };
}
