/**
 * Heatmap Queries (AIB-690)
 *
 * User-scoped server-side aggregation for the /projects activity heatmap.
 * Read-only across existing Job / Ticket / Project / ProjectMember / User tables.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, AGENT_LABELS } from '@/app/lib/utils/agent-resolution';
import {
  assignIntensityBucket,
  computeQuantileBuckets,
  formatUTCDate,
  getHeatmapPeriodBounds,
} from './aggregations';
import { buildEffectiveAgentWhere } from './queries';
import type {
  AgentOption,
  DailyCell,
  HeatmapData,
  HeatmapFilters,
  NamedAgent,
} from './heatmap-types';

function buildPeriodLabel(
  period: HeatmapFilters['period'],
  year: number | undefined
): string {
  if (period.kind === 'year' && typeof year === 'number') {
    return `in ${year}`;
  }
  return 'in the last year';
}

async function getAvailableAgentsForUser(
  accessibleProjectIds: number[],
  periodStart: Date,
  periodEnd: Date
): Promise<AgentOption[]> {
  if (accessibleProjectIds.length === 0) {
    return [
      {
        value: 'all',
        label: 'All agents',
        jobCount: 0,
        isDefault: true,
      },
    ];
  }

  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: accessibleProjectIds },
      completedAt: { gte: periodStart, lte: periodEnd },
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

  const counts = new Map<NamedAgent, number>(
    ALL_AGENTS.map((agent) => [agent, 0] as const)
  );

  for (const job of jobs) {
    if (!job.ticket) continue;
    const effective = (job.ticket.agent ?? job.ticket.project.defaultAgent) as NamedAgent;
    counts.set(effective, (counts.get(effective) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);

  const options: AgentOption[] = [
    {
      value: 'all',
      label: 'All agents',
      jobCount: total,
      isDefault: true,
    },
  ];

  for (const agent of ALL_AGENTS) {
    const jobCount = counts.get(agent) ?? 0;
    if (jobCount > 0) {
      options.push({
        value: agent,
        label: AGENT_LABELS[agent],
        jobCount,
        isDefault: false,
      });
    }
  }

  return options;
}

function resolveEffectivePeriod(
  filters: HeatmapFilters,
  accountCreationYear: number,
  currentYear: number
): HeatmapFilters['period'] {
  if (filters.period.kind === 'year') {
    const { year } = filters.period;
    if (
      accountCreationYear >= currentYear ||
      year < accountCreationYear ||
      year > currentYear
    ) {
      return { kind: 'rolling12m', endDate: '' };
    }
  }
  return filters.period;
}

function forEachDayUTC(
  startDate: Date,
  endDate: Date,
  callback: (dateKey: string) => void
): void {
  const dayMs = 24 * 60 * 60 * 1000;
  const rawStart = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const rawEnd = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  );
  for (let ts = rawStart; ts <= rawEnd; ts += dayMs) {
    callback(formatUTCDate(new Date(ts)));
  }
}

function buildPeriodEnvelope(
  effectivePeriod: HeatmapFilters['period'],
  startDate: Date,
  endDate: Date
): HeatmapData['period'] {
  return {
    kind: effectivePeriod.kind,
    startDate: formatUTCDate(startDate),
    endDate: formatUTCDate(endDate),
    ...(effectivePeriod.kind === 'year' ? { year: effectivePeriod.year } : {}),
  };
}

function emptyCell(date: string): DailyCell {
  return {
    date,
    jobCount: 0,
    shipJobCount: 0,
    shippedTicketCount: 0,
    totalCostUsd: null,
    bucket: 0,
  };
}

export async function getHeatmapData(
  userId: string,
  filters: HeatmapFilters,
  now: Date = new Date()
): Promise<HeatmapData> {
  const [accessibleProjects, user] = await Promise.all([
    prisma.project.findMany({
      where: {
        OR: [{ userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
  ]);

  const accessibleProjectIds = accessibleProjects.map((p) => p.id);
  const currentYear = now.getUTCFullYear();
  const accountCreationYear = user?.createdAt
    ? user.createdAt.getUTCFullYear()
    : currentYear;

  const effectivePeriod = resolveEffectivePeriod(filters, accountCreationYear, currentYear);
  const { startDate, endDate } = getHeatmapPeriodBounds(effectivePeriod, now);
  const effectiveAgentTicketWhere = buildEffectiveAgentWhere(filters.agent);

  const jobWhere: Prisma.JobWhereInput = {
    projectId: { in: accessibleProjectIds },
    completedAt: { gte: startDate, lte: endDate },
    ...(effectiveAgentTicketWhere
      ? { ticket: { is: effectiveAgentTicketWhere } }
      : {}),
  };

  const shippedTicketWhere: Prisma.TicketWhereInput = {
    projectId: { in: accessibleProjectIds },
    stage: 'SHIP',
    updatedAt: { gte: startDate, lte: endDate },
    ...(effectiveAgentTicketWhere ?? {}),
  };

  if (accessibleProjectIds.length === 0) {
    return buildEmptyEnvelope(filters, effectivePeriod, startDate, endDate, accountCreationYear, currentYear, now);
  }

  const [jobs, shippedTickets, availableAgents] = await Promise.all([
    prisma.job.findMany({
      where: jobWhere,
      select: {
        completedAt: true,
        command: true,
        status: true,
        costUsd: true,
        ticketId: true,
      },
    }),
    prisma.ticket.findMany({
      where: shippedTicketWhere,
      select: {
        id: true,
        updatedAt: true,
      },
    }),
    getAvailableAgentsForUser(accessibleProjectIds, startDate, endDate),
  ]);

  const distinctShippedTickets = shippedTickets.length;

  interface DayAccumulator {
    jobCount: number;
    shipJobCount: number;
    shippedTicketIds: Set<number>;
    costSum: number;
    hasNullCost: boolean;
  }

  const byDate = new Map<string, DayAccumulator>();

  function getOrCreate(key: string): DayAccumulator {
    let entry = byDate.get(key);
    if (!entry) {
      entry = {
        jobCount: 0,
        shipJobCount: 0,
        shippedTicketIds: new Set<number>(),
        costSum: 0,
        hasNullCost: false,
      };
      byDate.set(key, entry);
    }
    return entry;
  }

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const key = formatUTCDate(job.completedAt);
    const entry = getOrCreate(key);
    entry.jobCount += 1;
    if (job.costUsd === null) {
      entry.hasNullCost = true;
    } else {
      entry.costSum += job.costUsd;
    }
    if (job.command === 'ship' && job.status === 'COMPLETED') {
      entry.shipJobCount += 1;
    }
  }

  for (const ticket of shippedTickets) {
    const key = formatUTCDate(ticket.updatedAt);
    const entry = getOrCreate(key);
    entry.shippedTicketIds.add(ticket.id);
  }

  const cells: DailyCell[] = [];
  forEachDayUTC(startDate, endDate, (dateKey) => {
    const acc = byDate.get(dateKey);
    if (!acc) {
      cells.push(emptyCell(dateKey));
      return;
    }
    const totalCostUsd = acc.hasNullCost
      ? null
      : Math.round(acc.costSum * 100) / 100;
    cells.push({
      date: dateKey,
      jobCount: acc.jobCount,
      shipJobCount: acc.shipJobCount,
      shippedTicketCount: acc.shippedTicketIds.size,
      totalCostUsd,
      bucket: 0,
    });
  });

  const nonZeroCounts = cells.filter((c) => c.jobCount > 0).map((c) => c.jobCount);
  const thresholds = computeQuantileBuckets(nonZeroCounts);
  for (const cell of cells) {
    cell.bucket = assignIntensityBucket(cell.jobCount, thresholds);
  }

  const totalJobs = cells.reduce((sum, c) => sum + c.jobCount, 0);
  const availableYears = buildAvailableYears(accountCreationYear, currentYear);

  return {
    period: buildPeriodEnvelope(effectivePeriod, startDate, endDate),
    filters: {
      period: effectivePeriod,
      agent: filters.agent,
    },
    cells,
    summary: {
      totalJobs,
      distinctShippedTickets,
      periodLabel: buildPeriodLabel(
        effectivePeriod,
        effectivePeriod.kind === 'year' ? effectivePeriod.year : undefined
      ),
    },
    thresholds,
    availableAgents,
    availableYears,
    generatedAt: now.toISOString(),
  };
}

function buildAvailableYears(accountCreationYear: number, currentYear: number): number[] {
  if (accountCreationYear >= currentYear) {
    return [];
  }
  const years: number[] = [];
  for (let year = currentYear; year >= accountCreationYear; year -= 1) {
    years.push(year);
  }
  return years;
}

function buildEmptyEnvelope(
  filters: HeatmapFilters,
  effectivePeriod: HeatmapFilters['period'],
  startDate: Date,
  endDate: Date,
  accountCreationYear: number,
  currentYear: number,
  now: Date
): HeatmapData {
  const cells: DailyCell[] = [];
  forEachDayUTC(startDate, endDate, (dateKey) => {
    cells.push(emptyCell(dateKey));
  });

  return {
    period: buildPeriodEnvelope(effectivePeriod, startDate, endDate),
    filters: {
      period: effectivePeriod,
      agent: filters.agent,
    },
    cells,
    summary: {
      totalJobs: 0,
      distinctShippedTickets: 0,
      periodLabel: buildPeriodLabel(
        effectivePeriod,
        effectivePeriod.kind === 'year' ? effectivePeriod.year : undefined
      ),
    },
    thresholds: { p25: 0, p50: 0, p75: 0, maxJobCount: 0 },
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 0, isDefault: true },
    ],
    availableYears: buildAvailableYears(accountCreationYear, currentYear),
    generatedAt: now.toISOString(),
  };
}
