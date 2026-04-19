import { JobStatus, type Prisma } from '@prisma/client';
import { endOfDay, format, startOfDay, subYears } from 'date-fns';
import { AGENT_FILTER_VALUES, type AgentFilter, type AgentOption, type NamedAgent } from '@/lib/analytics/types';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { ALL_AGENTS, getAgentLabel, resolveEffectiveAgent } from '@/app/lib/utils/agent-resolution';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_PROJECTS_ACTIVITY_HEATMAP_AGENT,
  DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD,
  type HeatmapPeriodOption,
  type ProjectsActivityHeatmapCell,
  type ProjectsActivityHeatmapData,
} from './activity-heatmap-types';
const FINAL_JOB_STATUSES: JobStatus[] = [
  JobStatus.COMPLETED,
  JobStatus.FAILED,
  JobStatus.CANCELLED,
];

interface ParsedPeriod {
  value: string;
  start: Date;
  end: Date;
  label: string;
}

interface GetProjectsActivityHeatmapDataOptions {
  now?: Date;
  strict?: boolean;
  request?: NextRequest;
}

type RawProjectsActivityHeatmapFilters = {
  period?: string | null | undefined;
  agent?: string | null | undefined;
};

function buildAccessibleProjectsWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { userId },
      {
        members: {
          some: {
            userId,
          },
        },
      },
    ],
  };
}

function isValidAgentFilter(agent: string | null | undefined): agent is AgentFilter {
  return AGENT_FILTER_VALUES.includes(agent as AgentFilter);
}

function buildEffectiveAgentTicketWhere(agent: AgentFilter): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') {
    return undefined;
  }

  return {
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
  };
}

function resolveAgentFilter(
  rawAgent: string | null | undefined,
  strict: boolean
): AgentFilter {
  if (!rawAgent) {
    return DEFAULT_PROJECTS_ACTIVITY_HEATMAP_AGENT;
  }

  if (isValidAgentFilter(rawAgent)) {
    return rawAgent;
  }

  if (strict) {
    throw new Error('Invalid heatmap filters');
  }

  return DEFAULT_PROJECTS_ACTIVITY_HEATMAP_AGENT;
}

function buildAvailablePeriods(userCreatedYear: number, now: Date): HeatmapPeriodOption[] {
  const currentYear = now.getUTCFullYear();
  const periods: HeatmapPeriodOption[] = [
    {
      value: DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD,
      label: 'Last 12 months',
    },
  ];

  if (userCreatedYear === currentYear) {
    return periods;
  }

  for (let year = currentYear; year >= userCreatedYear; year -= 1) {
    periods.push({
      value: String(year),
      label: String(year),
    });
  }

  return periods;
}

function parsePeriod(
  rawPeriod: string | null | undefined,
  availablePeriods: HeatmapPeriodOption[],
  now: Date,
  strict: boolean
): ParsedPeriod {
  const selectedPeriod = rawPeriod ?? DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD;
  const availablePeriodValues = new Set(availablePeriods.map((option) => option.value));

  if (!availablePeriodValues.has(selectedPeriod)) {
    if (strict) {
      throw new Error('Invalid heatmap filters');
    }

    return {
      value: DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD,
      start: startOfDay(subYears(now, 1)),
      end: endOfDay(now),
      label: 'in the last year',
    };
  }

  if (selectedPeriod === DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD) {
    return {
      value: selectedPeriod,
      start: startOfDay(subYears(now, 1)),
      end: endOfDay(now),
      label: 'in the last year',
    };
  }

  const year = Number.parseInt(selectedPeriod, 10);
  return {
    value: selectedPeriod,
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    label: `in ${selectedPeriod}`,
  };
}

async function getAvailableAgents(projectIds: number[]): Promise<AgentOption[]> {
  if (projectIds.length === 0) {
    return [
      {
        value: 'all',
        label: 'All agents',
        jobCount: 0,
        isDefault: true,
      },
    ];
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: {
        in: projectIds,
      },
      jobs: {
        some: {},
      },
    },
    select: {
      agent: true,
      project: {
        select: {
          defaultAgent: true,
        },
      },
      _count: {
        select: {
          jobs: true,
        },
      },
    },
  });

  const counts = new Map<NamedAgent, number>(
    ALL_AGENTS.map((agent) => [agent, 0] as const)
  );

  for (const ticket of tickets) {
    const effectiveAgent = resolveEffectiveAgent(ticket.agent, ticket.project.defaultAgent);
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + ticket._count.jobs);
  }

  const totalJobs = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const options: AgentOption[] = [
    {
      value: 'all',
      label: 'All agents',
      jobCount: totalJobs,
      isDefault: true,
    },
  ];

  for (const agent of ALL_AGENTS) {
    const jobCount = counts.get(agent) ?? 0;
    if (jobCount > 0) {
      options.push({
        value: agent,
        label: getAgentLabel(agent),
        jobCount,
        isDefault: false,
      });
    }
  }

  return options;
}

export async function getProjectsActivityHeatmapData(
  rawFilters: RawProjectsActivityHeatmapFilters = {},
  options: GetProjectsActivityHeatmapDataOptions = {}
): Promise<ProjectsActivityHeatmapData> {
  const now = options.now ?? new Date();
  const strict = options.strict ?? false;
  const userId = await requireAuth(options.request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error('Unauthorized');
  }

  const userCreatedYear = user.createdAt.getUTCFullYear();
  const availablePeriods = buildAvailablePeriods(userCreatedYear, now);
  const parsedPeriod = parsePeriod(rawFilters.period, availablePeriods, now, strict);
  const agent = resolveAgentFilter(rawFilters.agent, strict);
  const accessibleProjects = await prisma.project.findMany({
    where: buildAccessibleProjectsWhere(userId),
    select: {
      id: true,
    },
  });
  const projectIds = accessibleProjects.map((project) => project.id);
  const availableAgents = await getAvailableAgents(projectIds);
  const effectiveAgentWhere = buildEffectiveAgentTicketWhere(agent);

  if (projectIds.length === 0) {
    return {
      filters: {
        period: parsedPeriod.value,
        agent,
      },
      summary: {
        jobCount: 0,
        shippedTicketCount: 0,
        label: parsedPeriod.label,
      },
      periodStart: format(parsedPeriod.start, 'yyyy-MM-dd'),
      periodEnd: format(parsedPeriod.end, 'yyyy-MM-dd'),
      userCreatedYear,
      availablePeriods,
      availableAgents,
      cells: [],
      hasAnyActivity: false,
      generatedAt: now.toISOString(),
    };
  }

  const jobWhere: Prisma.JobWhereInput = {
    projectId: {
      in: projectIds,
    },
    status: {
      in: FINAL_JOB_STATUSES,
    },
    completedAt: {
      gte: parsedPeriod.start,
      lte: parsedPeriod.end,
    },
    ...(effectiveAgentWhere
      ? {
          ticket: {
            is: effectiveAgentWhere,
          },
        }
      : {}),
  };

  const shipJobWhere: Prisma.JobWhereInput = {
    projectId: {
      in: projectIds,
    },
    command: 'ship',
    status: JobStatus.COMPLETED,
    completedAt: {
      lte: parsedPeriod.end,
    },
    ...(effectiveAgentWhere
      ? {
          ticket: {
            is: effectiveAgentWhere,
          },
        }
      : {}),
  };

  const [jobs, shipJobs] = await Promise.all([
    prisma.job.findMany({
      where: jobWhere,
      select: {
        ticketId: true,
        completedAt: true,
        costUsd: true,
      },
      orderBy: {
        completedAt: 'asc',
      },
    }),
    prisma.job.findMany({
      where: shipJobWhere,
      select: {
        ticketId: true,
        completedAt: true,
      },
      orderBy: {
        completedAt: 'asc',
      },
    }),
  ]);

  const shippedDateByTicket = new Map<number, string>();

  for (const job of shipJobs) {
    if (!job.completedAt || shippedDateByTicket.has(job.ticketId)) {
      continue;
    }

    if (job.completedAt < parsedPeriod.start) {
      continue;
    }

    shippedDateByTicket.set(job.ticketId, format(job.completedAt, 'yyyy-MM-dd'));
  }

  const shippedCountsByDate = new Map<string, number>();
  for (const date of shippedDateByTicket.values()) {
    shippedCountsByDate.set(date, (shippedCountsByDate.get(date) ?? 0) + 1);
  }

  const cellsByDate = new Map<
    string,
    {
      date: string;
      jobCount: number;
      shippedTicketCount: number;
      totalCost: number | null;
      hasMissingCosts: boolean;
      knownCostTotal: number;
    }
  >();

  for (const job of jobs) {
    if (!job.completedAt) {
      continue;
    }

    const date = format(job.completedAt, 'yyyy-MM-dd');
    const existing = cellsByDate.get(date) ?? {
      date,
      jobCount: 0,
      shippedTicketCount: shippedCountsByDate.get(date) ?? 0,
      totalCost: 0,
      hasMissingCosts: false,
      knownCostTotal: 0,
    };

    existing.jobCount += 1;

    if (job.costUsd == null) {
      existing.hasMissingCosts = true;
    } else {
      existing.knownCostTotal += job.costUsd;
      existing.totalCost = existing.knownCostTotal;
    }

    cellsByDate.set(date, existing);
  }

  for (const [date, shippedTicketCount] of shippedCountsByDate.entries()) {
    if (cellsByDate.has(date)) {
      continue;
    }

    cellsByDate.set(date, {
      date,
      jobCount: 0,
      shippedTicketCount,
      totalCost: 0,
      hasMissingCosts: false,
      knownCostTotal: 0,
    });
  }

  const cells: ProjectsActivityHeatmapCell[] = Array.from(cellsByDate.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((cell) => ({
      date: cell.date,
      jobCount: cell.jobCount,
      shippedTicketCount: cell.shippedTicketCount,
      totalCost: cell.hasMissingCosts ? null : cell.totalCost,
      hasMissingCosts: cell.hasMissingCosts,
    }))
    .filter((cell) => cell.jobCount > 0 || cell.shippedTicketCount > 0);

  const shippedTicketCount = Array.from(shippedCountsByDate.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    filters: {
      period: parsedPeriod.value,
      agent,
    },
    summary: {
      jobCount: jobs.length,
      shippedTicketCount,
      label: parsedPeriod.label,
    },
    periodStart: format(parsedPeriod.start, 'yyyy-MM-dd'),
    periodEnd: format(parsedPeriod.end, 'yyyy-MM-dd'),
    userCreatedYear,
    availablePeriods,
    availableAgents,
    cells,
    hasAnyActivity: jobs.length > 0,
    generatedAt: now.toISOString(),
  };
}
