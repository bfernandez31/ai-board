import type { Agent, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { getAgentLabel, resolveEffectiveAgent } from '@/app/lib/utils/agent-resolution';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import {
  DEFAULT_ACTIVITY_HEATMAP_AGENT,
  DEFAULT_ACTIVITY_HEATMAP_VIEW,
  type ActivityHeatmapAgentScopeValue,
  type ActivityHeatmapYearViewValue,
  type AgentScopeOption,
  type HeatmapDay,
  type HeatmapLegendBucket,
  type ProjectsActivityHeatmapResponse,
  type YearViewOption,
} from './activity-heatmap-types';

interface DailyAggregate {
  jobCount: number;
  ticketsShipped: number;
  costUsd: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface WorkspaceProject {
  id: number;
  defaultAgent: Agent;
}

interface JobActivityRow {
  startedAt: Date;
  costUsd: number | null;
  ticket: {
    agent: Agent | null;
    project: {
      defaultAgent: Agent;
    };
  };
}

interface ShippedTicketActivityRow {
  updatedAt: Date;
  agent: Agent | null;
  project: {
    defaultAgent: Agent;
  };
}

interface ActivityHeatmapFilters {
  view?: ActivityHeatmapYearViewValue;
  agent?: ActivityHeatmapAgentScopeValue;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return startOfUtcDay(next);
}

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getRollingRange(now: Date): DateRange {
  const end = startOfUtcDay(now);
  return {
    start: addUtcDays(end, -364),
    end,
  };
}

function getCalendarYearRange(year: number): DateRange {
  return {
    start: createUtcDate(year, 0, 1),
    end: createUtcDate(year, 11, 31),
  };
}

function resolveRange(view: ActivityHeatmapYearViewValue, now: Date): DateRange {
  if (view === DEFAULT_ACTIVITY_HEATMAP_VIEW) {
    return getRollingRange(now);
  }

  const year = Number.parseInt(view.replace('year-', ''), 10);
  return getCalendarYearRange(year);
}

function enumerateDays(range: DateRange): Date[] {
  const days: Date[] = [];
  for (let cursor = range.start; cursor <= range.end; cursor = addUtcDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

function buildViewOption(
  view: ActivityHeatmapYearViewValue,
  range: DateRange
): YearViewOption {
  return {
    value: view,
    label: view === DEFAULT_ACTIVITY_HEATMAP_VIEW ? 'Last 12 months' : view.replace('year-', ''),
    startDate: getDateKey(range.start),
    endDate: getDateKey(range.end),
    isDefault: view === DEFAULT_ACTIVITY_HEATMAP_VIEW,
  };
}

function createEmptyAggregate(): DailyAggregate {
  return {
    jobCount: 0,
    ticketsShipped: 0,
    costUsd: 0,
  };
}

function getBucketThresholds(maxCount: number): Array<{ min: number; max: number | null }> {
  if (maxCount <= 4) {
    return [
      { min: 1, max: 1 },
      { min: 2, max: 2 },
      { min: 3, max: 3 },
      { min: 4, max: null },
    ];
  }

  const q1 = Math.ceil(maxCount / 4);
  const q2 = Math.ceil(maxCount / 2);
  const q3 = Math.ceil((maxCount * 3) / 4);

  return [
    { min: 1, max: q1 },
    { min: q1 + 1, max: q2 },
    { min: q2 + 1, max: q3 },
    { min: q3 + 1, max: null },
  ];
}

function resolveIntensityLevel(jobCount: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0) {
    return 0;
  }

  if (maxCount <= 4) {
    return Math.min(4, jobCount) as 1 | 2 | 3 | 4;
  }

  const thresholds = getBucketThresholds(maxCount);
  for (const [index, bucket] of thresholds.entries()) {
    if (bucket.max === null) {
      return (index + 1) as 1 | 2 | 3 | 4;
    }

    if (jobCount >= bucket.min && jobCount <= bucket.max) {
      return (index + 1) as 1 | 2 | 3 | 4;
    }
  }

  return 4;
}

function buildLegend(maxCount: number): HeatmapLegendBucket[] {
  const thresholds = getBucketThresholds(maxCount);

  return [
    {
      level: 0,
      label: 'No jobs',
      minJobs: 0,
      maxJobs: 0,
    },
    ...thresholds.map((bucket, index) => {
      const label =
        bucket.max === null
          ? `${bucket.min}+ jobs`
          : bucket.min === bucket.max
            ? `${bucket.min} job${bucket.min === 1 ? '' : 's'}`
            : `${bucket.min}-${bucket.max} jobs`;

      return {
        level: (index + 1) as 1 | 2 | 3 | 4,
        label,
        minJobs: bucket.min,
        maxJobs: bucket.max,
      };
    }),
  ];
}

function buildDayGrid(
  range: DateRange,
  aggregates: Map<string, DailyAggregate>
): HeatmapDay[] {
  const days = enumerateDays(range);
  const maxJobs = days.reduce((max, day) => {
    const jobCount = aggregates.get(getDateKey(day))?.jobCount ?? 0;
    return Math.max(max, jobCount);
  }, 0);

  return days.map((day, index) => {
    const dayKey = getDateKey(day);
    const aggregate = aggregates.get(dayKey) ?? createEmptyAggregate();
    const previousDay = index > 0 ? days[index - 1] : null;
    const monthLabel =
      index === 0 || previousDay?.getUTCMonth() !== day.getUTCMonth()
        ? formatMonthLabel(day)
        : null;

    return {
      date: dayKey,
      weekday: day.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      weekIndex: Math.floor(index / 7),
      monthLabel,
      jobCount: aggregate.jobCount,
      ticketsShipped: aggregate.ticketsShipped,
      costUsd: Number(aggregate.costUsd.toFixed(2)),
      intensityLevel: resolveIntensityLevel(aggregate.jobCount, maxJobs),
      isInPrimaryRange: true,
      displayDate: formatDisplayDate(day),
    };
  });
}

function summarizeDays(days: HeatmapDay[]) {
  return days.reduce(
    (summary, day) => {
      summary.jobCount += day.jobCount;
      summary.ticketsShipped += day.ticketsShipped;
      summary.costUsd += day.costUsd;
      return summary;
    },
    { jobCount: 0, ticketsShipped: 0, costUsd: 0 }
  );
}

function getRangeLabel(view: ActivityHeatmapYearViewValue): string {
  return view === DEFAULT_ACTIVITY_HEATMAP_VIEW ? 'the last year' : view.replace('year-', '');
}

function normalizeCost(costUsd: number | null): number {
  return costUsd ?? 0;
}

async function getWorkspaceProjects(request?: NextRequest): Promise<WorkspaceProject[]> {
  const userId = await requireAuth(request);

  return prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      defaultAgent: true,
    },
  });
}

async function getHistoryBounds(
  projectIds: number[]
): Promise<{ earliestYear: number | null }> {
  if (projectIds.length === 0) {
    return { earliestYear: null };
  }

  const [firstJob, firstTicket] = await Promise.all([
    prisma.job.findFirst({
      where: { projectId: { in: projectIds } },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    }),
    prisma.ticket.findFirst({
      where: {
        projectId: { in: projectIds },
        stage: 'SHIP',
      },
      orderBy: { updatedAt: 'asc' },
      select: { updatedAt: true },
    }),
  ]);

  const candidates = [firstJob?.startedAt, firstTicket?.updatedAt].filter(
    (value): value is Date => Boolean(value)
  );

  if (candidates.length === 0) {
    return { earliestYear: null };
  }

  return {
    earliestYear: Math.min(...candidates.map((value) => value.getUTCFullYear())),
  };
}

function buildAvailableViews(
  now: Date,
  earliestYear: number | null
): YearViewOption[] {
  const currentYear = now.getUTCFullYear();
  const views: YearViewOption[] = [
    buildViewOption(DEFAULT_ACTIVITY_HEATMAP_VIEW, getRollingRange(now)),
  ];

  const firstYear = earliestYear ?? currentYear;
  for (let year = currentYear; year >= firstYear; year -= 1) {
    views.push(buildViewOption(`year-${year}`, getCalendarYearRange(year)));
  }

  return views;
}

async function fetchActivityRows(
  projects: WorkspaceProject[],
  range: DateRange
): Promise<{
  jobs: JobActivityRow[];
  shippedTickets: ShippedTicketActivityRow[];
}> {
  const projectIds = projects.map((project) => project.id);
  if (projectIds.length === 0) {
    return { jobs: [], shippedTickets: [] };
  }

  const [jobs, shippedTickets] = await Promise.all([
    prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        startedAt: {
          gte: range.start,
          lt: addUtcDays(range.end, 1),
        },
      },
      select: {
        startedAt: true,
        costUsd: true,
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
    prisma.ticket.findMany({
      where: {
        projectId: { in: projectIds },
        stage: 'SHIP',
        updatedAt: {
          gte: range.start,
          lt: addUtcDays(range.end, 1),
        },
      },
      select: {
        updatedAt: true,
        agent: true,
        project: {
          select: {
            defaultAgent: true,
          },
        },
      },
    }),
  ]);

  return { jobs, shippedTickets };
}

function createAggregateMap(range: DateRange): Map<string, DailyAggregate> {
  return new Map(
    enumerateDays(range).map((day) => [getDateKey(day), createEmptyAggregate()])
  );
}

function matchesAgent(
  effectiveAgent: Agent,
  selectedAgent: ActivityHeatmapAgentScopeValue
): boolean {
  return selectedAgent === DEFAULT_ACTIVITY_HEATMAP_AGENT || effectiveAgent === selectedAgent;
}

function buildAvailableAgentOptions(
  jobs: JobActivityRow[],
  selectedAgent: ActivityHeatmapAgentScopeValue
): AgentScopeOption[] {
  const counts = new Map<Agent, number>();

  for (const job of jobs) {
    const effectiveAgent = resolveEffectiveAgent(
      job.ticket.agent,
      job.ticket.project.defaultAgent
    );
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + 1);
  }

  const options: AgentScopeOption[] = [
    {
      value: DEFAULT_ACTIVITY_HEATMAP_AGENT,
      label: 'All agents',
      jobCount: jobs.length,
      isDefault: true,
    },
  ];

  for (const [agent, jobCount] of Array.from(counts.entries()).sort((left, right) =>
    getAgentLabel(left[0]).localeCompare(getAgentLabel(right[0]))
  )) {
    if (jobCount <= 0) {
      continue;
    }

    options.push({
      value: agent,
      label: getAgentLabel(agent),
      jobCount,
      isDefault: false,
    });
  }

  if (
    selectedAgent !== DEFAULT_ACTIVITY_HEATMAP_AGENT &&
    !options.some((option) => option.value === selectedAgent)
  ) {
    options.push({
      value: selectedAgent,
      label: getAgentLabel(selectedAgent),
      jobCount: 0,
      isDefault: false,
    });
  }

  return options;
}

function buildAggregates(
  range: DateRange,
  jobs: JobActivityRow[],
  shippedTickets: ShippedTicketActivityRow[],
  selectedAgent: ActivityHeatmapAgentScopeValue
): Map<string, DailyAggregate> {
  const aggregates = createAggregateMap(range);

  for (const job of jobs) {
    const effectiveAgent = resolveEffectiveAgent(
      job.ticket.agent,
      job.ticket.project.defaultAgent
    );

    if (!matchesAgent(effectiveAgent, selectedAgent)) {
      continue;
    }

    const dateKey = getDateKey(startOfUtcDay(job.startedAt));
    const aggregate = aggregates.get(dateKey);
    if (!aggregate) {
      continue;
    }

    aggregate.jobCount += 1;
    aggregate.costUsd += normalizeCost(job.costUsd);
  }

  for (const ticket of shippedTickets) {
    const effectiveAgent = resolveEffectiveAgent(ticket.agent, ticket.project.defaultAgent);
    if (!matchesAgent(effectiveAgent, selectedAgent)) {
      continue;
    }

    const dateKey = getDateKey(startOfUtcDay(ticket.updatedAt));
    const aggregate = aggregates.get(dateKey);
    if (!aggregate) {
      continue;
    }

    aggregate.ticketsShipped += 1;
  }

  return aggregates;
}

export async function getProjectsActivityHeatmap(
  filters: ActivityHeatmapFilters = {},
  request?: NextRequest
): Promise<ProjectsActivityHeatmapResponse> {
  const now = startOfUtcDay(new Date());
  const view = filters.view ?? DEFAULT_ACTIVITY_HEATMAP_VIEW;
  const agent = filters.agent ?? DEFAULT_ACTIVITY_HEATMAP_AGENT;
  const selectedRange = resolveRange(view, now);

  const projects = await getWorkspaceProjects(request);
  const projectIds = projects.map((project) => project.id);
  const { earliestYear } = await getHistoryBounds(projectIds);

  const { jobs, shippedTickets } = await fetchActivityRows(projects, selectedRange);
  const availableViews = buildAvailableViews(now, earliestYear);

  const aggregates = buildAggregates(selectedRange, jobs, shippedTickets, agent);
  const days = buildDayGrid(selectedRange, aggregates);
  const summary = summarizeDays(days);
  const availableAgents = buildAvailableAgentOptions(jobs, agent);
  const maxJobs = days.reduce((max, day) => Math.max(max, day.jobCount), 0);

  return {
    view: buildViewOption(view, selectedRange),
    availableViews,
    filters: { agent },
    availableAgents,
    summary: {
      jobCount: summary.jobCount,
      ticketsShipped: summary.ticketsShipped,
      costUsd: Number(summary.costUsd.toFixed(2)),
      hasAnyActivity: summary.jobCount > 0 || summary.ticketsShipped > 0,
      rangeLabel: getRangeLabel(view),
    },
    legend: buildLegend(maxJobs),
    days,
    generatedAt: new Date().toISOString(),
  };
}

export function isValidActivityHeatmapYearView(
  value: string,
  now: Date = new Date()
): value is ActivityHeatmapYearViewValue {
  if (value === DEFAULT_ACTIVITY_HEATMAP_VIEW) {
    return true;
  }

  if (!/^year-\d{4}$/.test(value)) {
    return false;
  }

  const year = Number.parseInt(value.replace('year-', ''), 10);
  return year <= now.getUTCFullYear();
}

export function buildActivityHeatmapErrorResponse(
  error: unknown
): Prisma.JsonObject {
  if (error instanceof Error && error.message === 'Unauthorized') {
    return { error: 'Unauthorized', code: 'AUTH_ERROR' };
  }

  return { error: 'Failed to fetch activity heatmap', code: 'INTERNAL_ERROR' };
}
