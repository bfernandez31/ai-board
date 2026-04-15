import {
  differenceInCalendarWeeks,
  eachDayOfInterval,
  format,
  getDay,
  isWithinInterval,
  startOfWeek,
} from 'date-fns';
import { prisma } from './client';
import type { Project, ClarificationPolicy, Agent } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { requireAuth } from './users';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import {
  ensureProjectsActivityAgentOptions,
  getProjectsActivityDateRange,
  parseProjectsActivityFilters,
  type ProjectsActivityFilterInput,
} from '@/app/lib/utils/projects-activity-filters';
import type {
  ProjectsActivityAgentFilter,
  ProjectsActivityDayCell,
  ProjectsActivityHeatmapResponse,
  ProjectsActivityShippedTicket,
} from '@/app/lib/types/project';
import { resolveEffectiveAgent } from '@/app/lib/utils/agent-resolution';

const LEGEND_LEVELS = [0, 1, 2, 3, 4] as const;

interface ProjectsActivityQueryOptions {
  request?: NextRequest;
  strict?: boolean;
  now?: Date;
}

interface MutableProjectsActivityDayCell extends Omit<ProjectsActivityDayCell, 'shippedTickets'> {
  shippedTickets: ProjectsActivityShippedTicket[];
  shippedTicketIds: Set<number>;
}

function getProjectsAccessWhere(userId: string) {
  return {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };
}

function buildSummaryLabel(
  totalJobs: number,
  totalShippedTickets: number,
  period: ProjectsActivityHeatmapResponse['filters']
): string {
  const periodLabel =
    period.period === 'year' && period.year !== null
      ? `in ${period.year}`
      : 'in the last 12 months';

  return `${totalJobs} jobs · ${totalShippedTickets} tickets shipped ${periodLabel}`;
}

function createEmptyDayCells(start: Date, end: Date): MutableProjectsActivityDayCell[] {
  const intervalDays = eachDayOfInterval({ start, end });
  const firstWeekStart = startOfWeek(start, { weekStartsOn: 0 });

  return intervalDays.map((day) => ({
    date: format(day, 'yyyy-MM-dd'),
    weekIndex: differenceInCalendarWeeks(day, firstWeekStart, { weekStartsOn: 0 }),
    weekdayIndex: getDay(day),
    monthLabel:
      day.getUTCDate() === 1 || format(day, 'yyyy-MM-dd') === format(start, 'yyyy-MM-dd')
        ? format(day, 'MMM')
        : null,
    jobCount: 0,
    shippedTicketCount: 0,
    costUsd: null,
    intensityLevel: 0,
    shippedTickets: [],
    shippedTicketIds: new Set<number>(),
  }));
}

function applyIntensityLevels(days: MutableProjectsActivityDayCell[]): ProjectsActivityDayCell[] {
  const uniquePositiveJobCounts = Array.from(
    new Set(days.map((day) => day.jobCount).filter((count) => count > 0))
  ).sort((left, right) => left - right);

  let getIntensityLevel = (jobCount: number): 0 | 1 | 2 | 3 | 4 => (jobCount > 0 ? 1 : 0);

  if (uniquePositiveJobCounts.length > 4) {
    const lastIndex = uniquePositiveJobCounts.length - 1;
    const q1 = uniquePositiveJobCounts[Math.floor(lastIndex * 0.25)]!;
    const q2 = uniquePositiveJobCounts[Math.floor(lastIndex * 0.5)]!;
    const q3 = uniquePositiveJobCounts[Math.floor(lastIndex * 0.75)]!;

    getIntensityLevel = (jobCount: number): 0 | 1 | 2 | 3 | 4 => {
      if (jobCount <= 0) {
        return 0;
      }
      if (jobCount <= q1) {
        return 1;
      }
      if (jobCount <= q2) {
        return 2;
      }
      if (jobCount <= q3) {
        return 3;
      }
      return 4;
    };
  } else if (uniquePositiveJobCounts.length > 0) {
    getIntensityLevel = (jobCount: number): 0 | 1 | 2 | 3 | 4 => {
      if (jobCount <= 0) {
        return 0;
      }

      return (uniquePositiveJobCounts.indexOf(jobCount) + 1) as 1 | 2 | 3 | 4;
    };
  }

  return days.map(({ shippedTicketIds, ...day }) => ({
    ...day,
    intensityLevel: getIntensityLevel(day.jobCount),
  }));
}

function isDateInRange(date: Date | null, start: Date, end: Date): boolean {
  if (!date) {
    return false;
  }

  return isWithinInterval(date, { start, end });
}

/**
 * Retrieve a project by its ID
 * @param projectId - The project ID to look up
 * @returns The project if found, null otherwise
 * @deprecated Use getProject instead for authentication
 */
export async function getProjectById(
  projectId: number
): Promise<Project | null> {
  return await prisma.project.findUnique({
    where: { id: projectId },
  });
}

/**
 * Get all projects for the current user
 * Returns projects where user is owner OR member
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param request - Optional NextRequest for Bearer token extraction
 */
export async function getUserProjects(request?: NextRequest) {
  const userId = await requireAuth(request);

  return prisma.project.findMany({
    where: {
      ...getProjectsAccessWhere(userId),
    },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      githubOwner: true,
      githubRepo: true,
      deploymentUrl: true,
      updatedAt: true,
      createdAt: true,
      userId: true,
      clarificationPolicy: true,
      defaultAgent: true,
      _count: {
        select: { tickets: true },
      },
      tickets: {
        where: { stage: 'SHIP' },              // Only shipped tickets
        orderBy: { updatedAt: 'desc' },        // Most recent first
        take: 1,                               // Only last shipped ticket
        select: {
          id: true,
          ticketKey: true,
          title: true,
          updatedAt: true,
        }
      },
      healthScore: {
        select: {
          globalScore: true,
          securityScore: true,
          complianceScore: true,
          testsScore: true,
          specSyncScore: true,
          qualityGate: true,
          reviewQualityScore: true,
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get a single project by ID
 * Ensures the current user has access (owner OR member)
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param projectId - The project ID to retrieve
 * @param request - Optional NextRequest for Bearer token extraction
 * @throws Error if project not found or user doesn't have access
 */
export async function getProject(projectId: number, request?: NextRequest) {
  const userId = await requireAuth(request);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...getProjectsAccessWhere(userId),
    },
    include: {
      tickets: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  if (!project) {
    throw new Error('Project not found'); // Returns 404
  }

  return project;
}

/**
 * Fetch the cross-project activity heatmap for the current user.
 */
export async function getProjectsActivityHeatmap(
  input: ProjectsActivityFilterInput = {},
  options?: ProjectsActivityQueryOptions
): Promise<ProjectsActivityHeatmapResponse> {
  const now = options?.now ?? new Date();
  const userId = await requireAuth(options?.request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    throw new Error('Unauthorized');
  }

  const parseOptions =
    options?.strict === undefined ? { now } : { now, strict: options.strict };
  const { filters, periodOptions } = parseProjectsActivityFilters(
    input,
    user.createdAt,
    parseOptions
  );
  const { start, end } = getProjectsActivityDateRange(filters, now);
  const accessibleProjects = await prisma.project.findMany({
    where: getProjectsAccessWhere(userId),
    select: {
      id: true,
      defaultAgent: true,
    },
  });

  const dayCells = createEmptyDayCells(start, end);
  const dayCellMap = new Map(dayCells.map((day) => [day.date, day]));

  if (accessibleProjects.length === 0) {
    const days = applyIntensityLevels(dayCells);

    return {
      filters,
      periodOptions,
      agentOptions: ensureProjectsActivityAgentOptions([], filters.agent),
      summary: {
        totalJobs: 0,
        totalShippedTickets: 0,
        summaryLabel: buildSummaryLabel(0, 0, filters),
      },
      days,
      legendLevels: LEGEND_LEVELS,
      hasActivity: false,
      generatedAt: now.toISOString(),
    };
  }

  const projectIds = accessibleProjects.map((project) => project.id);
  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      OR: [
        {
          startedAt: {
            gte: start,
            lte: end,
          },
        },
        {
          command: 'ship',
          status: 'COMPLETED',
          completedAt: {
            gte: start,
            lte: end,
          },
        },
      ],
    },
    select: {
      id: true,
      command: true,
      status: true,
      startedAt: true,
      completedAt: true,
      costUsd: true,
      ticket: {
        select: {
          id: true,
          ticketKey: true,
          title: true,
          agent: true,
          project: {
            select: {
              defaultAgent: true,
            },
          },
        },
      },
    },
  });

  const seenAgents = new Set<ProjectsActivityAgentFilter>();

  for (const job of jobs) {
    const effectiveAgent = resolveEffectiveAgent(
      job.ticket.agent,
      job.ticket.project.defaultAgent
    );
    const matchesSelectedAgent =
      filters.agent === 'all' || effectiveAgent === filters.agent;

    if (
      isDateInRange(job.startedAt, start, end) ||
      (job.command === 'ship' &&
        job.status === 'COMPLETED' &&
        isDateInRange(job.completedAt, start, end))
    ) {
      seenAgents.add(effectiveAgent);
    }

    if (!matchesSelectedAgent) {
      continue;
    }

    if (isDateInRange(job.startedAt, start, end)) {
      const dayKey = format(job.startedAt, 'yyyy-MM-dd');
      const dayCell = dayCellMap.get(dayKey);

      if (dayCell) {
        dayCell.jobCount += 1;

        if (job.costUsd !== null) {
          dayCell.costUsd = (dayCell.costUsd ?? 0) + job.costUsd;
        }
      }
    }

    if (
      job.command === 'ship' &&
      job.status === 'COMPLETED' &&
      isDateInRange(job.completedAt, start, end) &&
      job.completedAt
    ) {
      const shipDayKey = format(job.completedAt, 'yyyy-MM-dd');
      const dayCell = dayCellMap.get(shipDayKey);

      if (dayCell && !dayCell.shippedTicketIds.has(job.ticket.id)) {
        dayCell.shippedTicketIds.add(job.ticket.id);
        dayCell.shippedTicketCount += 1;
        dayCell.shippedTickets.push({
          ticketId: job.ticket.id,
          ticketKey: job.ticket.ticketKey,
          title: job.ticket.title,
        });
      }
    }
  }

  const normalizedDays = applyIntensityLevels(dayCells).map((day) => ({
    ...day,
    costUsd: day.costUsd === null ? null : Number(day.costUsd.toFixed(2)),
  }));
  const totalJobs = normalizedDays.reduce((total, day) => total + day.jobCount, 0);
  const totalShippedTickets = normalizedDays.reduce(
    (total, day) => total + day.shippedTicketCount,
    0
  );

  return {
    filters,
    periodOptions,
    agentOptions: ensureProjectsActivityAgentOptions(
      Array.from(seenAgents).sort(),
      filters.agent
    ),
    summary: {
      totalJobs,
      totalShippedTickets,
      summaryLabel: buildSummaryLabel(totalJobs, totalShippedTickets, filters),
    },
    days: normalizedDays,
    legendLevels: LEGEND_LEVELS,
    hasActivity: normalizedDays.some((day) => day.jobCount > 0),
    generatedAt: now.toISOString(),
  };
}

/**
 * Create a new project for the current user
 * Automatically adds AI-BOARD as a project member
 */
export async function createProject(data: {
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  key: string;
}) {
  const userId = await requireAuth();
  const aiBoardUserId = await getAIBoardUserId();

  // Create project and AI-BOARD membership atomically
  return prisma.$transaction(async (tx) => {
    // Create project
    const newProject = await tx.project.create({
      data: {
        ...data,
        userId, // ← CRITICAL: inject userId
        updatedAt: new Date(), // Required field
      },
    });

    // Add AI-BOARD as project member
    await tx.projectMember.create({
      data: {
        projectId: newProject.id,
        userId: aiBoardUserId,
        role: 'member',
      },
    });

    console.log(
      `[projects] Added AI-BOARD as member to project ${newProject.id}`
    );

    return newProject;
  });
}

/**
 * Update a project
 * Ensures the project belongs to the current user
 */
export async function updateProject(
  projectId: number,
  data: {
    name?: string | undefined;
    description?: string | undefined;
    githubOwner?: string | undefined;
    githubRepo?: string | undefined;
    clarificationPolicy?: ClarificationPolicy | undefined;
    defaultAgent?: Agent | undefined;
    deploymentUrl?: string | null | undefined;
  }
) {
  const userId = await requireAuth();

  // Verify ownership first
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Filter out undefined values for exactOptionalPropertyTypes
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.githubOwner !== undefined) updateData.githubOwner = data.githubOwner;
  if (data.githubRepo !== undefined) updateData.githubRepo = data.githubRepo;
  if (data.clarificationPolicy !== undefined) updateData.clarificationPolicy = data.clarificationPolicy;
  if (data.defaultAgent !== undefined) updateData.defaultAgent = data.defaultAgent;
  if (data.deploymentUrl !== undefined) updateData.deploymentUrl = data.deploymentUrl;

  return prisma.project.update({
    where: { id: projectId },
    data: updateData,
  });
}

/**
 * Delete a project
 * Ensures the project belongs to the current user
 */
export async function deleteProject(projectId: number) {
  const userId = await requireAuth();

  // Verify ownership first
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return prisma.project.delete({
    where: { id: projectId },
  });
}
