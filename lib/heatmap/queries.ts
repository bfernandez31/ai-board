import { JobStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { buildEffectiveAgentWhere } from '@/lib/analytics/queries';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { NamedAgent } from '@/lib/analytics/types';
import type {
  HeatmapAgentOption,
  HeatmapCell,
  HeatmapData,
  HeatmapFilters,
} from './types';

function getDateRange(year: 'rolling' | string): { start: Date; end: Date } {
  const now = new Date();
  if (year === 'rolling') {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 364));
    return { start, end };
  }
  const y = parseInt(year, 10);
  return {
    start: new Date(Date.UTC(y, 0, 1)),
    end: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
  };
}

function toUTCDateString(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function computeThresholds(jobCounts: number[]): [number, number, number, number] {
  const nonZero = jobCounts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [1, 2, 3, 4];
  if (nonZero.length === 1) return [nonZero[0]!, nonZero[0]!, nonZero[0]!, nonZero[0]!];

  const percentile = (arr: number[], p: number): number => {
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)]!;
  };

  return [
    percentile(nonZero, 25),
    percentile(nonZero, 50),
    percentile(nonZero, 75),
    nonZero[nonZero.length - 1]!,
  ];
}

async function getUserProjectIds(userId: string): Promise<number[]> {
  const [owned, memberships] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      select: { id: true },
    }),
    prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    }),
  ]);

  const ids = new Set<number>();
  for (const p of owned) ids.add(p.id);
  for (const m of memberships) ids.add(m.projectId);
  return Array.from(ids);
}

export async function getHeatmapData(
  userId: string,
  filters: HeatmapFilters
): Promise<HeatmapData> {
  const { start, end } = getDateRange(filters.year);
  const projectIds = await getUserProjectIds(userId);

  if (projectIds.length === 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    const accountCreatedYear = user ? user.createdAt.getUTCFullYear() : new Date().getUTCFullYear();
    return {
      cells: [],
      summary: { totalJobs: 0, totalShipped: 0 },
      thresholds: [1, 2, 3, 4],
      availableAgents: [{ value: 'all', label: 'All agents', jobCount: 0, isDefault: true }],
      availableYears: buildAvailableYears(accountCreatedYear),
      accountCreatedYear,
      filters,
    };
  }

  const agentWhere = filters.agent !== 'all'
    ? buildEffectiveAgentWhere(filters.agent as NamedAgent)
    : undefined;

  const ticketFilter = agentWhere
    ? { ticket: { is: agentWhere } }
    : {};

  const [jobRows, shipRows, availableAgents, user] = await Promise.all([
    prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        createdAt: { gte: start, lte: end },
        ...ticketFilter,
      },
      select: {
        createdAt: true,
        costUsd: true,
      },
    }),
    prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        command: 'ship',
        status: JobStatus.COMPLETED,
        completedAt: { gte: start, lte: end },
        ...ticketFilter,
      },
      select: {
        completedAt: true,
      },
    }),
    getHeatmapAvailableAgents(projectIds),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);

  const cellMap = new Map<string, { jobCount: number; shippedCount: number; costSum: number; hasCost: boolean }>();

  for (const job of jobRows) {
    const dateKey = toUTCDateString(job.createdAt);
    const entry = cellMap.get(dateKey) ?? { jobCount: 0, shippedCount: 0, costSum: 0, hasCost: false };
    entry.jobCount++;
    if (job.costUsd != null) {
      entry.costSum += job.costUsd;
      entry.hasCost = true;
    }
    cellMap.set(dateKey, entry);
  }

  for (const job of shipRows) {
    if (!job.completedAt) continue;
    const dateKey = toUTCDateString(job.completedAt);
    const entry = cellMap.get(dateKey) ?? { jobCount: 0, shippedCount: 0, costSum: 0, hasCost: false };
    entry.shippedCount++;
    cellMap.set(dateKey, entry);
  }

  const cells: HeatmapCell[] = Array.from(cellMap.entries())
    .map(([date, data]) => ({
      date,
      jobCount: data.jobCount,
      shippedCount: data.shippedCount,
      totalCost: data.hasCost ? Math.round(data.costSum * 100) / 100 : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalJobs = cells.reduce((sum, c) => sum + c.jobCount, 0);
  const totalShipped = cells.reduce((sum, c) => sum + c.shippedCount, 0);
  const thresholds = computeThresholds(cells.map((c) => c.jobCount));

  const accountCreatedYear = user ? user.createdAt.getUTCFullYear() : new Date().getUTCFullYear();

  return {
    cells,
    summary: { totalJobs, totalShipped },
    thresholds,
    availableAgents,
    availableYears: buildAvailableYears(accountCreatedYear),
    accountCreatedYear,
    filters,
  };
}

function buildAvailableYears(accountCreatedYear: number): string[] {
  const currentYear = new Date().getUTCFullYear();
  const years: string[] = [];
  for (let y = accountCreatedYear; y <= currentYear; y++) {
    years.push(String(y));
  }
  return years;
}

async function getHeatmapAvailableAgents(projectIds: number[]): Promise<HeatmapAgentOption[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: { in: projectIds },
      jobs: { some: {} },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
      _count: { select: { jobs: true } },
    },
  });

  const counts = new Map<string, number>();
  for (const agent of ALL_AGENTS) counts.set(agent, 0);

  for (const ticket of tickets) {
    const effectiveAgent = (ticket.agent ?? ticket.project.defaultAgent) as string;
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + ticket._count.jobs);
  }

  const totalJobs = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);
  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: totalJobs, isDefault: true },
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
