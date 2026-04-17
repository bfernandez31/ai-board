/**
 * Activity Heatmap Query Helpers
 *
 * Read-only Prisma queries that aggregate jobs and shipped tickets across all projects
 * the current user owns or is a member of, then bucket them into calendar days for the
 * heatmap UI.
 */

import { JobStatus } from '@prisma/client';
import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import {
  addDays,
  diffInDays,
  getAvailableYears,
  getPeriodBoundaries,
  toIsoDate,
} from './aggregations';
import type {
  HeatmapAgentFilter,
  HeatmapAgentOption,
  HeatmapData,
  HeatmapDayCell,
  HeatmapFilters,
  HeatmapTicketSummary,
  NamedAgent,
} from './types';

/** Build the OR clause that matches a ticket's "effective" agent (explicit OR project default). */
function buildEffectiveAgentTicketWhere(
  agent: HeatmapAgentFilter
): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      { agent: null, project: { is: { defaultAgent: agent } } },
    ],
  };
}

async function getAccessibleProjectIds(userId: string): Promise<number[]> {
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

function normalizeFilters(
  raw: Partial<HeatmapFilters>,
  availableYears: number[]
): HeatmapFilters {
  const period = raw.period ?? 'last-12-months';
  const isInvalidYear = typeof period === 'number' && !availableYears.includes(period);
  return {
    period: isInvalidYear ? 'last-12-months' : period,
    agent: raw.agent ?? 'all',
  };
}

function emptyData(
  filters: HeatmapFilters,
  availableYears: number[],
  now: Date
): HeatmapData {
  const { start, end } = getPeriodBoundaries(filters.period, now);
  const days = buildDayBuckets(start, end);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    totalJobs: 0,
    totalTicketsShipped: 0,
    days,
    availableAgents: [{ value: 'all', label: 'All agents', jobCount: 0 }],
    availableYears,
    filters,
    generatedAt: now.toISOString(),
  };
}

function buildDayBuckets(start: Date, end: Date): HeatmapDayCell[] {
  const dayCount = diffInDays(start, end) + 1;
  const days: HeatmapDayCell[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    days.push({
      date: toIsoDate(addDays(start, i)),
      jobCount: 0,
      totalCostUsd: 0,
      hasCost: false,
      shippedTickets: [],
    });
  }
  return days;
}

export interface GetHeatmapOptions {
  filters?: Partial<HeatmapFilters>;
  request?: NextRequest;
  /** Optional now-injection for tests. */
  now?: Date;
}

export async function getActivityHeatmap(options: GetHeatmapOptions = {}): Promise<HeatmapData> {
  const userId = await requireAuth(options.request);
  return getActivityHeatmapForUser(userId, options.filters, options.now);
}

export async function getActivityHeatmapForUser(
  userId: string,
  rawFilters: Partial<HeatmapFilters> = {},
  now: Date = new Date()
): Promise<HeatmapData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const accountCreatedYear = user
    ? user.createdAt.getUTCFullYear()
    : now.getUTCFullYear();
  const availableYears = getAvailableYears(accountCreatedYear, now);
  const filters = normalizeFilters(rawFilters, availableYears);

  const projectIds = await getAccessibleProjectIds(userId);
  if (projectIds.length === 0) {
    return emptyData(filters, availableYears, now);
  }

  const { start, end } = getPeriodBoundaries(filters.period, now);
  const rangeEnd = addDays(end, 1); // exclusive upper bound for completedAt
  const days = buildDayBuckets(start, end);
  const dayIndex = new Map<string, HeatmapDayCell>();
  for (const day of days) dayIndex.set(day.date, day);

  const baseJobWhere: Prisma.JobWhereInput = {
    projectId: { in: projectIds },
    status: JobStatus.COMPLETED,
    completedAt: { gte: start, lt: rangeEnd },
  };

  // Available agents — built BEFORE the user's filter is applied so the dropdown
  // reflects the full set of agents represented in the period.
  const availableAgents = await getHeatmapAvailableAgents(projectIds, start, rangeEnd);

  const ticketWhere = buildEffectiveAgentTicketWhere(filters.agent);
  const filteredJobWhere: Prisma.JobWhereInput = ticketWhere
    ? { ...baseJobWhere, ticket: { is: ticketWhere } }
    : baseJobWhere;

  const [jobRows, shipRows] = await Promise.all([
    prisma.job.findMany({
      where: filteredJobWhere,
      select: { completedAt: true, costUsd: true },
    }),
    prisma.job.findMany({
      where: { ...filteredJobWhere, command: 'ship' },
      select: {
        completedAt: true,
        ticket: {
          select: {
            ticketKey: true,
            title: true,
            project: { select: { key: true } },
          },
        },
      },
    }),
  ]);

  let totalJobs = 0;
  for (const job of jobRows) {
    if (!job.completedAt) continue;
    const dateKey = toIsoDate(job.completedAt);
    const day = dayIndex.get(dateKey);
    if (!day) continue;
    day.jobCount += 1;
    if (job.costUsd != null) {
      day.totalCostUsd += job.costUsd;
      day.hasCost = true;
    }
    totalJobs += 1;
  }

  // Dedupe shipped tickets globally so re-ships after a rollback don't inflate the total.
  // Per-day lists still dedupe within a day so the tooltip shows each ticket once per cell.
  const shippedSeenGlobal = new Set<string>();
  const shippedSeenPerDay = new Map<string, Set<string>>();
  for (const row of shipRows) {
    if (!row.completedAt) continue;
    const dateKey = toIsoDate(row.completedAt);
    const day = dayIndex.get(dateKey);
    if (!day) continue;
    let seen = shippedSeenPerDay.get(dateKey);
    if (!seen) {
      seen = new Set<string>();
      shippedSeenPerDay.set(dateKey, seen);
    }
    if (seen.has(row.ticket.ticketKey)) continue;
    seen.add(row.ticket.ticketKey);
    const summary: HeatmapTicketSummary = {
      ticketKey: row.ticket.ticketKey,
      title: row.ticket.title,
      projectKey: row.ticket.project.key,
    };
    day.shippedTickets.push(summary);
    shippedSeenGlobal.add(row.ticket.ticketKey);
  }
  const totalTicketsShipped = shippedSeenGlobal.size;

  // Round per-day cost to cents for clean display.
  for (const day of days) {
    day.totalCostUsd = Math.round(day.totalCostUsd * 100) / 100;
  }

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    totalJobs,
    totalTicketsShipped,
    days,
    availableAgents,
    availableYears,
    filters,
    generatedAt: now.toISOString(),
  };
}

async function getHeatmapAvailableAgents(
  projectIds: number[],
  start: Date,
  rangeEndExclusive: Date
): Promise<HeatmapAgentOption[]> {
  // Aggregate by effective agent across the user's jobs in the period.
  const rows = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: JobStatus.COMPLETED,
      completedAt: { gte: start, lt: rangeEndExclusive },
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

  const counts = new Map<NamedAgent, number>();
  for (const row of rows) {
    const agent = row.ticket.agent ?? row.ticket.project.defaultAgent;
    counts.set(agent, (counts.get(agent) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);
  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: total },
  ];
  for (const agent of ALL_AGENTS) {
    const count = counts.get(agent) ?? 0;
    if (count > 0) {
      options.push({ value: agent, label: getAgentLabel(agent), jobCount: count });
    }
  }
  return options;
}
