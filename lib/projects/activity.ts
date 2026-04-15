import { Agent, JobStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { NextRequest } from 'next/server';

export const PROJECTS_ACTIVITY_DEFAULT_FILTERS = {
  year: 'rolling',
  agent: 'all',
} as const;

type ProjectsActivityYearFilter = typeof PROJECTS_ACTIVITY_DEFAULT_FILTERS.year | `${number}`;
type ProjectsActivityAgentFilter = 'all' | Agent;

interface ActivityFiltersInput {
  year?: string;
  agent?: string;
}

interface ActivityPeriod {
  value: ProjectsActivityYearFilter;
  label: string;
  startDate: Date;
  endDate: Date;
}

export interface ProjectsActivityFilterOption {
  value: string;
  label: string;
}

export interface ProjectsActivityDay {
  date: string;
  dayOfWeek: number;
  jobCount: number;
  shippedTickets: number;
  totalCostUsd: number | null;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface ProjectsActivityWeek {
  monthLabel: string | null;
  days: Array<ProjectsActivityDay | null>;
}

export interface ProjectsActivityResponse {
  filters: {
    year: ProjectsActivityYearFilter;
    agent: ProjectsActivityAgentFilter;
  };
  generatedAt: string;
  availableAgents: ProjectsActivityFilterOption[];
  periodOptions: ProjectsActivityFilterOption[];
  summary: {
    totalJobs: number;
    ticketsShipped: number;
    periodLabel: string;
  };
  heatmap: {
    hasActivity: boolean;
    firstDate: string;
    lastDate: string;
    totalWeeks: number;
    weeks: ProjectsActivityWeek[];
  };
}

type ActivityJobRecord = {
  completedAt: Date;
  costUsd: number | null;
  command: string;
  status: JobStatus;
  ticketId: number;
};

type DaySummary = {
  jobCount: number;
  shippedTicketIds: Set<number>;
  totalCostUsd: number;
  hasMissingCost: boolean;
};

const TERMINAL_JOB_STATUSES: JobStatus[] = [
  JobStatus.COMPLETED,
  JobStatus.FAILED,
  JobStatus.CANCELLED,
];

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeekSunday(date: Date): Date {
  return addDays(date, -date.getUTCDay());
}

function endOfWeekSaturday(date: Date): Date {
  return addDays(date, 6 - date.getUTCDay());
}

function buildRollingPeriod(now: Date): ActivityPeriod {
  const endDate = startOfDay(now);
  const startDate = addDays(endDate, -364);

  return {
    value: 'rolling',
    label: 'Last 12 months',
    startDate,
    endDate,
  };
}

function buildYearPeriods(userCreatedAt: Date, now: Date): ActivityPeriod[] {
  const periods: ActivityPeriod[] = [buildRollingPeriod(now)];
  const createdYear = userCreatedAt.getUTCFullYear();
  const currentYear = now.getUTCFullYear();

  if (createdYear === currentYear) {
    return periods;
  }

  for (let year = createdYear; year <= currentYear; year += 1) {
    periods.push({
      value: String(year) as `${number}`,
      label: String(year),
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year, 11, 31)),
    });
  }

  return periods;
}

function buildAgentFilterWhere(agent: ProjectsActivityAgentFilter): Prisma.JobWhereInput['ticket'] | undefined {
  if (agent === 'all') {
    return undefined;
  }

  return {
    is: {
      OR: [
        { agent },
        {
          agent: null,
          project: {
            is: {
              defaultAgent: agent,
            },
          },
        },
      ],
    },
  };
}

function normalizeYearFilter(
  requestedYear: string | undefined,
  periods: ActivityPeriod[]
): ActivityPeriod {
  if (!requestedYear) {
    return periods[0]!;
  }

  return periods.find((period) => period.value === requestedYear) ?? periods[0]!;
}

function normalizeAgentFilter(
  requestedAgent: string | undefined,
  availableAgents: ProjectsActivityFilterOption[]
): ProjectsActivityAgentFilter {
  if (!requestedAgent) {
    return PROJECTS_ACTIVITY_DEFAULT_FILTERS.agent;
  }

  return availableAgents.some((option) => option.value === requestedAgent)
    ? (requestedAgent as ProjectsActivityAgentFilter)
    : PROJECTS_ACTIVITY_DEFAULT_FILTERS.agent;
}

function computeIntensity(jobCount: number, maxJobsPerDay: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0 || maxJobsPerDay <= 0) {
    return 0;
  }

  if (jobCount === maxJobsPerDay) {
    return 4;
  }

  return Math.max(1, Math.ceil((jobCount / maxJobsPerDay) * 4)) as 1 | 2 | 3 | 4;
}

function getDayTotalCost(summary: DaySummary | undefined): number | null {
  if (summary == null) {
    return 0;
  }

  if (summary.hasMissingCost) {
    return null;
  }

  return Math.round(summary.totalCostUsd * 100) / 100;
}

function getMonthLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00.000Z`)
  );
}

async function getAccessibleProjectIds(userId: string): Promise<number[]> {
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

  return projects.map((project) => project.id);
}

async function getAvailableAgents(projectIds: number[]): Promise<ProjectsActivityFilterOption[]> {
  if (projectIds.length === 0) {
    return [{ value: 'all', label: 'All agents' }];
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: { in: projectIds },
      jobs: {
        some: {
          completedAt: { not: null },
          status: { in: TERMINAL_JOB_STATUSES },
        },
      },
    },
    select: {
      agent: true,
      project: {
        select: {
          defaultAgent: true,
        },
      },
    },
  });

  const distinctAgents = new Set<Agent>();
  for (const ticket of tickets) {
    distinctAgents.add(ticket.agent ?? ticket.project.defaultAgent);
  }

  return [
    { value: 'all', label: 'All agents' },
    ...Array.from(distinctAgents)
      .sort((left, right) => getAgentLabel(left).localeCompare(getAgentLabel(right)))
      .map((agent) => ({
        value: agent,
        label: getAgentLabel(agent),
      })),
  ];
}

async function getActivityJobs(
  projectIds: number[],
  period: ActivityPeriod,
  agent: ProjectsActivityAgentFilter
): Promise<ActivityJobRecord[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const agentWhere = buildAgentFilterWhere(agent);

  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: { in: TERMINAL_JOB_STATUSES },
      completedAt: {
        gte: period.startDate,
        lte: addDays(period.endDate, 1),
      },
      ...(agentWhere ? { ticket: agentWhere } : {}),
    },
    select: {
      completedAt: true,
      costUsd: true,
      command: true,
      status: true,
      ticketId: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  return jobs.filter((job): job is ActivityJobRecord => job.completedAt !== null);
}

function buildHeatmap(
  jobs: ActivityJobRecord[],
  period: ActivityPeriod
): ProjectsActivityResponse['heatmap'] {
  const daySummaries = new Map<string, DaySummary>();

  for (const job of jobs) {
    const dayKey = formatDate(job.completedAt);
    const current = daySummaries.get(dayKey) ?? {
      jobCount: 0,
      shippedTicketIds: new Set<number>(),
      totalCostUsd: 0,
      hasMissingCost: false,
    };

    current.jobCount += 1;
    if (job.command === 'ship' && job.status === JobStatus.COMPLETED) {
      current.shippedTicketIds.add(job.ticketId);
    }
    if (job.costUsd == null) {
      current.hasMissingCost = true;
    } else {
      current.totalCostUsd += job.costUsd;
    }

    daySummaries.set(dayKey, current);
  }

  const maxJobsPerDay = Array.from(daySummaries.values()).reduce(
    (maxJobs, entry) => Math.max(maxJobs, entry.jobCount),
    0
  );

  const visibleStart = startOfWeekSunday(period.startDate);
  const visibleEnd = endOfWeekSaturday(period.endDate);
  const weeks: ProjectsActivityWeek[] = [];

  for (let weekStart = visibleStart; weekStart <= visibleEnd; weekStart = addDays(weekStart, 7)) {
    const days: Array<ProjectsActivityDay | null> = [];

    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(weekStart, offset);
      if (date < period.startDate || date > period.endDate) {
        days.push(null);
        continue;
      }

      const dayKey = formatDate(date);
      const summary = daySummaries.get(dayKey);
      const jobCount = summary?.jobCount ?? 0;

      days.push({
        date: dayKey,
        dayOfWeek: date.getUTCDay(),
        jobCount,
        shippedTickets: summary?.shippedTicketIds.size ?? 0,
        totalCostUsd: getDayTotalCost(summary),
        intensity: computeIntensity(jobCount, maxJobsPerDay),
      });
    }

    const monthAnchor = days.find((day) => day !== null && day.date.slice(8, 10) === '01');

    weeks.push({
      monthLabel: monthAnchor ? getMonthLabel(monthAnchor.date) : null,
      days,
    });
  }

  return {
    hasActivity: jobs.length > 0,
    firstDate: formatDate(period.startDate),
    lastDate: formatDate(period.endDate),
    totalWeeks: weeks.length,
    weeks,
  };
}

export async function getProjectsActivityData(
  filters: ActivityFiltersInput = {},
  request?: NextRequest
): Promise<ProjectsActivityResponse> {
  const now = new Date();
  const userId = await requireAuth(request);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    throw new Error('Unauthorized');
  }

  const periodOptions = buildYearPeriods(user.createdAt, now);
  const projectIds = await getAccessibleProjectIds(userId);
  const availableAgents = await getAvailableAgents(projectIds);

  const period = normalizeYearFilter(filters.year, periodOptions);
  const agent = normalizeAgentFilter(filters.agent, availableAgents);
  const jobs = await getActivityJobs(projectIds, period, agent);
  const heatmap = buildHeatmap(jobs, period);
  const shippedTicketIds = new Set<number>();

  for (const job of jobs) {
    if (job.command === 'ship' && job.status === JobStatus.COMPLETED) {
      shippedTicketIds.add(job.ticketId);
    }
  }

  return {
    filters: {
      year: period.value,
      agent,
    },
    generatedAt: now.toISOString(),
    availableAgents,
    periodOptions: periodOptions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    summary: {
      totalJobs: jobs.length,
      ticketsShipped: shippedTicketIds.size,
      periodLabel: period.label,
    },
    heatmap,
  };
}
