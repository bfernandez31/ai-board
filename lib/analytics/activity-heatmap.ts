import type { Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { resolveEffectiveAgent, ALL_AGENTS } from '@/app/lib/utils/agent-resolution';
import {
  addDaysUTC,
  assertHeatmapInvariants,
  assignIntensity,
  bucketJobsByLocalDay,
  buildPeriodBounds,
  computeIntensityThresholds,
  dateFromISODay,
  formatISODay,
  listDays,
  resolveYearSelectorOptions,
  type HeatmapAgentFilter,
  type HeatmapDayCell,
  type HeatmapPeriod,
  type HeatmapResponse,
  type HeatmapShippedTicket,
} from '@/lib/analytics/activity-heatmap-helpers';

export {
  assertHeatmapInvariants,
  assignIntensity,
  bucketJobsByLocalDay,
  buildPeriodBounds,
  computeIntensityThresholds,
  resolveYearSelectorOptions,
};
export type {
  HeatmapAgentFilter,
  HeatmapDayCell,
  HeatmapPeriod,
  HeatmapResponse,
  HeatmapShippedTicket,
};

export interface GetHeatmapDataInput {
  userId: string;
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
  tz: string;
  now?: Date;
}

export async function getHeatmapData(
  input: GetHeatmapDataInput
): Promise<HeatmapResponse> {
  const { userId, period, agent } = input;
  const now = input.now ?? new Date();
  const bounds = buildPeriodBounds(period, now, input.tz);
  const { startDate, endDate, timezone } = bounds;

  const projects = await prisma.project.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: { id: true, defaultAgent: true },
  });

  const projectIds = projects.map((p) => p.id);
  const defaultAgentByProjectId = new Map<number, Agent>(
    projects.map((p) => [p.id, p.defaultAgent])
  );

  const rangeStart = dateFromISODay(startDate);
  const rangeEnd = addDaysUTC(dateFromISODay(endDate), 1);

  const allCellDays = listDays(startDate, endDate);
  const buckets = new Map<
    string,
    {
      jobCount: number;
      costSum: number | null;
      nullCostJobCount: number;
      shippedTickets: HeatmapShippedTicket[];
    }
  >();
  for (const day of allCellDays) {
    buckets.set(day, {
      jobCount: 0,
      costSum: null,
      nullCostJobCount: 0,
      shippedTickets: [],
    });
  }

  if (projectIds.length === 0) {
    return finalizeResponse({
      buckets,
      bounds,
      availableAgents: [],
      yearSelectorRef: now,
      userCreatedAt: now,
    });
  }

  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      startedAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: {
      startedAt: true,
      costUsd: true,
      projectId: true,
      ticket: { select: { agent: true } },
    },
  });

  const shipJobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      command: 'ship',
      status: 'COMPLETED',
      completedAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: {
      id: true,
      ticketId: true,
      completedAt: true,
      projectId: true,
      ticket: {
        select: {
          id: true,
          title: true,
          agent: true,
        },
      },
    },
  });

  function effectiveAgentOf(job: {
    projectId: number;
    ticket: { agent: Agent | null } | null;
  }): Agent {
    return resolveEffectiveAgent(
      job.ticket?.agent ?? null,
      defaultAgentByProjectId.get(job.projectId) ?? 'CLAUDE'
    );
  }

  const availableAgentSet = new Set<Agent>();
  for (const j of jobs) {
    availableAgentSet.add(effectiveAgentOf(j));
  }
  const availableAgents: Agent[] = ALL_AGENTS.filter((a) => availableAgentSet.has(a));

  const matchesAgent = (j: { projectId: number; ticket: { agent: Agent | null } | null }) =>
    agent === 'all' || effectiveAgentOf(j) === agent;

  const filteredJobs = jobs.filter(matchesAgent);
  const filteredShipJobs = shipJobs.filter(matchesAgent);

  const bucketed = bucketJobsByLocalDay(filteredJobs, timezone);

  for (const day of allCellDays) {
    const bucket = bucketed.get(day);
    if (bucket) {
      buckets.set(day, {
        jobCount: bucket.jobCount,
        costSum: bucket.costSum,
        nullCostJobCount: bucket.nullCostJobCount,
        shippedTickets: [],
      });
    }
  }

  const shippedByDay = new Map<string, Map<number, HeatmapShippedTicket>>();
  for (const sj of filteredShipJobs) {
    if (!sj.completedAt) continue;
    const day = formatISODay(sj.completedAt, timezone);
    if (!buckets.has(day)) continue;
    let dayMap = shippedByDay.get(day);
    if (!dayMap) {
      dayMap = new Map();
      shippedByDay.set(day, dayMap);
    }
    const ticket = sj.ticket;
    if (ticket) {
      if (!dayMap.has(ticket.id)) {
        dayMap.set(ticket.id, { ticketId: ticket.id, title: ticket.title });
      }
    } else {
      dayMap.set(-sj.id, { ticketId: null, title: null });
    }
  }

  for (const [day, ticketMap] of shippedByDay) {
    const existing = buckets.get(day);
    if (existing) {
      existing.shippedTickets = Array.from(ticketMap.values());
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  return finalizeResponse({
    buckets,
    bounds,
    availableAgents,
    yearSelectorRef: now,
    userCreatedAt: user?.createdAt ?? now,
  });
}

function finalizeResponse(args: {
  buckets: Map<
    string,
    { jobCount: number; costSum: number | null; nullCostJobCount: number; shippedTickets: HeatmapShippedTicket[] }
  >;
  bounds: ReturnType<typeof buildPeriodBounds>;
  availableAgents: Agent[];
  yearSelectorRef: Date;
  userCreatedAt: Date;
}): HeatmapResponse {
  const { buckets, bounds, availableAgents, yearSelectorRef, userCreatedAt } = args;

  let max = 0;
  for (const b of buckets.values()) {
    if (b.jobCount > max) max = b.jobCount;
  }
  const intensityThresholds = computeIntensityThresholds(max);

  const cells: HeatmapDayCell[] = [];
  let totalJobs = 0;
  let totalShipped = 0;
  for (const day of listDays(bounds.startDate, bounds.endDate)) {
    const b = buckets.get(day) ?? {
      jobCount: 0,
      costSum: null,
      nullCostJobCount: 0,
      shippedTickets: [],
    };
    const intensity = assignIntensity(b.jobCount, intensityThresholds);
    cells.push({
      date: day,
      jobCount: b.jobCount,
      costUsd: b.costSum,
      nullCostJobCount: b.nullCostJobCount,
      shippedTickets: b.shippedTickets,
      intensity,
    });
    totalJobs += b.jobCount;
    totalShipped += b.shippedTickets.length;
  }

  const yearSelector = resolveYearSelectorOptions(userCreatedAt, yearSelectorRef);

  const response: HeatmapResponse = {
    period: {
      kind: bounds.kind,
      ...(bounds.year !== undefined ? { year: bounds.year } : {}),
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      timezone: bounds.timezone,
    },
    counters: {
      jobCount: totalJobs,
      shippedTicketCount: totalShipped,
    },
    cells,
    intensityThresholds,
    availableAgents,
    yearSelector,
  };

  if (process.env.NODE_ENV !== 'production') {
    assertHeatmapInvariants(response);
  }

  return response;
}

export async function getInitialHeatmapData(options?: {
  period?: HeatmapPeriod;
  agent?: HeatmapAgentFilter;
  tz?: string;
}): Promise<{ data: HeatmapResponse | null; errored: boolean }> {
  try {
    const userId = await requireAuth();
    const data = await getHeatmapData({
      userId,
      period: options?.period ?? { kind: 'rolling12m' },
      agent: options?.agent ?? 'all',
      tz: options?.tz ?? 'UTC',
    });
    return { data, errored: false };
  } catch (err) {
    console.error('Activity heatmap SSR error:', err);
    return { data: null, errored: true };
  }
}
