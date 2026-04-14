import type { Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { AGENT_FILTER_VALUES, type AgentFilter } from '@/lib/analytics/types';
import { ALL_AGENTS, getAgentLabel, resolveEffectiveAgent } from '@/app/lib/utils/agent-resolution';

export type ProjectActivityYearFilter = 'rolling' | `${number}`;

export interface ProjectActivityHeatmapFilters {
  year: ProjectActivityYearFilter;
  agent: AgentFilter;
}

export interface ProjectActivityAgentOption {
  value: AgentFilter;
  label: string;
  jobCount: number;
}

export interface ProjectActivitySummary {
  jobCount: number;
  shippedCount: number;
  totalCost: number;
  label: string;
}

export interface ProjectActivityDay {
  date: string;
  weekIndex: number;
  dayIndex: number;
  jobCount: number;
  shippedCount: number;
  totalCost: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  isOutsidePeriod?: boolean;
}

export interface ProjectActivityMonthLabel {
  weekIndex: number;
  label: string;
}

export interface ProjectActivityHeatmapData {
  filters: ProjectActivityHeatmapFilters;
  availableYears: number[];
  availableAgents: ProjectActivityAgentOption[];
  summary: ProjectActivitySummary;
  days: ProjectActivityDay[];
  monthLabels: ProjectActivityMonthLabel[];
  weeks: number;
  maxJobCount: number;
  generatedAt: string;
}

interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

interface ActivityPoint {
  jobCount: number;
  shippedCount: number;
  totalCost: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC',
});

function isSupportedActivityAgent(value: string): value is AgentFilter {
  return AGENT_FILTER_VALUES.includes(value as AgentFilter);
}

export function parseProjectActivityFilters(input: {
  year?: string | null;
  agent?: string | null;
}): ProjectActivityHeatmapFilters | null {
  const year = input.year ?? 'rolling';
  const agent = input.agent ?? 'all';

  if (!isSupportedActivityAgent(agent)) {
    return null;
  }

  if (year !== 'rolling' && !/^\d{4}$/.test(year)) {
    return null;
  }

  return {
    year: year as ProjectActivityYearFilter,
    agent,
  };
}

function toUtcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

function previousSunday(value: Date): Date {
  return addUtcDays(value, -value.getUTCDay());
}

function nextSaturday(value: Date): Date {
  return addUtcDays(value, 6 - value.getUTCDay());
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function formatIsoDate(value: Date): string {
  return value.toISOString().split('T')[0] ?? '';
}

function buildPeriodRange(filters: ProjectActivityHeatmapFilters, now: Date): PeriodRange {
  if (filters.year === 'rolling') {
    const end = toUtcDate(now);
    return {
      start: addUtcDays(end, -364),
      end,
      label: 'in the last year',
    };
  }

  const year = Number(filters.year);
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
    label: `in ${year}`,
  };
}

function buildAgentWhere(agent: AgentFilter) {
  if (agent === 'all') {
    return {};
  }

  return {
    OR: [
      { ticket: { is: { agent } } },
      {
        ticket: {
          is: {
            agent: null,
            project: {
              is: {
                defaultAgent: agent,
              },
            },
          },
        },
      },
    ],
  };
}

function getAvailableYears(
  now: Date,
  earliestJobAt: Date | null,
  earliestShipAt: Date | null
): number[] {
  const currentYear = now.getUTCFullYear();
  const earliestAt = [earliestJobAt, earliestShipAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => left.getTime() - right.getTime())[0];

  const earliestYear = earliestAt ? earliestAt.getUTCFullYear() : currentYear;
  const years: number[] = [];
  for (let year = currentYear; year >= earliestYear; year -= 1) {
    years.push(year);
  }
  return years;
}

function getIntensityLevel(jobCount: number, maxJobCount: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount === 0 || maxJobCount === 0) {
    return 0;
  }

  const ratio = jobCount / maxJobCount;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function getMonthLabels(days: ProjectActivityDay[]): ProjectActivityMonthLabel[] {
  const labels = new Map<number, string>();

  for (const day of days) {
    if (day.isOutsidePeriod) {
      continue;
    }

    const date = new Date(`${day.date}T00:00:00.000Z`);
    if (date.getUTCDate() === 1 || labels.size === 0) {
      labels.set(day.weekIndex, MONTH_FORMATTER.format(date));
    }
  }

  return Array.from(labels.entries()).map(([weekIndex, label]) => ({
    weekIndex,
    label,
  }));
}

function createHeatmapDays(
  range: PeriodRange,
  points: Map<string, ActivityPoint>
): Pick<ProjectActivityHeatmapData, 'days' | 'weeks' | 'monthLabels' | 'maxJobCount'> {
  const displayStart = previousSunday(range.start);
  const displayEnd = nextSaturday(range.end);
  const days: ProjectActivityDay[] = [];
  let cursor = displayStart;
  let maxJobCount = 0;

  while (cursor.getTime() <= displayEnd.getTime()) {
    const date = formatIsoDate(cursor);
    const point = points.get(date) ?? { jobCount: 0, shippedCount: 0, totalCost: 0 };
    const isOutsidePeriod = cursor.getTime() < range.start.getTime() || cursor.getTime() > range.end.getTime();
    maxJobCount = Math.max(maxJobCount, point.jobCount);

    days.push({
      date,
      weekIndex: Math.floor(daysBetween(displayStart, cursor) / 7),
      dayIndex: cursor.getUTCDay(),
      jobCount: point.jobCount,
      shippedCount: point.shippedCount,
      totalCost: Math.round(point.totalCost * 100) / 100,
      intensityLevel: 0,
      ...(isOutsidePeriod ? { isOutsidePeriod: true } : {}),
    });

    cursor = addUtcDays(cursor, 1);
  }

  const normalizedDays = days.map((day) => ({
    ...day,
    intensityLevel: getIntensityLevel(day.jobCount, maxJobCount),
  }));

  return {
    days: normalizedDays,
    weeks: normalizedDays.length / 7,
    monthLabels: getMonthLabels(normalizedDays),
    maxJobCount,
  };
}

export async function getProjectActivityHeatmap(
  filters: ProjectActivityHeatmapFilters,
  options?: { request?: NextRequest; now?: Date }
): Promise<ProjectActivityHeatmapData> {
  const userId = await requireAuth(options?.request);
  const now = toUtcDate(options?.now ?? new Date());

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
    },
  });

  const projectIds = projects.map((project) => project.id);
  const range = buildPeriodRange(filters, now);

  if (projectIds.length === 0) {
    const emptyHeatmap = createHeatmapDays(range, new Map());
    return {
      filters,
      availableYears: [now.getUTCFullYear()],
      availableAgents: [{ value: 'all', label: 'All agents', jobCount: 0 }],
      summary: {
        jobCount: 0,
        shippedCount: 0,
        totalCost: 0,
        label: range.label,
      },
      generatedAt: new Date().toISOString(),
      ...emptyHeatmap,
    };
  }

  const [allJobs, jobs, shippedTickets, earliestJob, earliestShip] = await Promise.all([
    prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        completedAt: { not: null },
      },
      select: {
        ticket: {
          select: {
            agent: true,
            project: {
              select: {
                defaultAgent: true,
              },
            },
          },
        },
      },
    }),
    prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        completedAt: {
          gte: range.start,
          lte: addUtcDays(range.end, 1),
        },
        ...buildAgentWhere(filters.agent),
      },
      select: {
        completedAt: true,
        costUsd: true,
      },
    }),
    prisma.ticket.findMany({
      where: {
        projectId: { in: projectIds },
        stage: 'SHIP',
        updatedAt: {
          gte: range.start,
          lte: addUtcDays(range.end, 1),
        },
        ...(filters.agent === 'all'
          ? {}
          : {
              OR: [
                { agent: filters.agent },
                {
                  agent: null,
                  project: {
                    is: {
                      defaultAgent: filters.agent,
                    },
                  },
                },
              ],
            }),
      },
      select: {
        updatedAt: true,
      },
    }),
    prisma.job.findFirst({
      where: {
        projectId: { in: projectIds },
        completedAt: { not: null },
      },
      orderBy: {
        completedAt: 'asc',
      },
      select: {
        completedAt: true,
      },
    }),
    prisma.ticket.findFirst({
      where: {
        projectId: { in: projectIds },
        stage: 'SHIP',
      },
      orderBy: {
        updatedAt: 'asc',
      },
      select: {
        updatedAt: true,
      },
    }),
  ]);

  const counts = new Map<Agent, number>(ALL_AGENTS.map((agent) => [agent, 0] as const));
  for (const job of allJobs) {
    const effectiveAgent = resolveEffectiveAgent(
      job.ticket.agent,
      job.ticket.project.defaultAgent
    );
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + 1);
  }

  const availableAgents: ProjectActivityAgentOption[] = [
    {
      value: 'all',
      label: 'All agents',
      jobCount: allJobs.length,
    },
    ...ALL_AGENTS.filter((agent) => (counts.get(agent) ?? 0) > 0).map((agent) => ({
      value: agent,
      label: getAgentLabel(agent),
      jobCount: counts.get(agent) ?? 0,
    })),
  ];

  const points = new Map<string, ActivityPoint>();

  for (const job of jobs) {
    if (!job.completedAt) {
      continue;
    }
    const date = formatIsoDate(toUtcDate(job.completedAt));
    const existing = points.get(date) ?? { jobCount: 0, shippedCount: 0, totalCost: 0 };
    existing.jobCount += 1;
    existing.totalCost += job.costUsd ?? 0;
    points.set(date, existing);
  }

  for (const ticket of shippedTickets) {
    const date = formatIsoDate(toUtcDate(ticket.updatedAt));
    const existing = points.get(date) ?? { jobCount: 0, shippedCount: 0, totalCost: 0 };
    existing.shippedCount += 1;
    points.set(date, existing);
  }

  const heatmap = createHeatmapDays(range, points);

  return {
    filters,
    availableYears: getAvailableYears(now, earliestJob?.completedAt ?? null, earliestShip?.updatedAt ?? null),
    availableAgents,
    summary: {
      jobCount: jobs.length,
      shippedCount: shippedTickets.length,
      totalCost: Math.round(
        jobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0) * 100
      ) / 100,
      label: range.label,
    },
    generatedAt: new Date().toISOString(),
    ...heatmap,
  };
}
