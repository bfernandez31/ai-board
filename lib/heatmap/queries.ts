import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { AgentOption, NamedAgent } from '@/lib/analytics/types';
import type { HeatmapData, HeatmapDay, HeatmapFilters, ShippedTicketInfo } from './types';
import type { Prisma } from '@prisma/client';

function getDateRange(filters: HeatmapFilters, now: Date): { start: Date; end: Date } {
  if (filters.year === 'rolling') {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 364);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }

  const year = parseInt(filters.year, 10);
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

function getPeriodLabel(filters: HeatmapFilters): string {
  return filters.year === 'rolling' ? 'in the last year' : `in ${filters.year}`;
}

function buildEffectiveAgentWhere(agent: string): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent: agent as NamedAgent },
      { agent: null, project: { is: { defaultAgent: agent as NamedAgent } } },
    ],
  };
}

function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getIntensityLevel(jobCount: number, quartiles: number[]): number {
  if (jobCount === 0) return 0;
  if (quartiles.length === 0) return 0;
  const [q1, q2, q3] = quartiles;
  if (jobCount <= q1!) return 1;
  if (jobCount <= q2!) return 2;
  if (jobCount <= q3!) return 3;
  return 4;
}

export function computeQuartiles(jobCounts: number[]): number[] {
  const nonZero = jobCounts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [];
  const q = (p: number) => {
    const idx = (p / 100) * (nonZero.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return nonZero[lo]!;
    return nonZero[lo]! + (nonZero[hi]! - nonZero[lo]!) * (idx - lo);
  };
  return [q(25), q(50), q(75)];
}

export async function getHeatmapData(
  userId: string,
  filters: HeatmapFilters
): Promise<HeatmapData> {
  const now = new Date();
  const { start, end } = getDateRange(filters, now);

  // Get all project IDs where user is owner or member
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });

  const projectIds = projects.map((p) => p.id);

  if (projectIds.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    return {
      days: [],
      totalJobs: 0,
      totalShipped: 0,
      agents: [{ value: 'all', label: 'All agents', jobCount: 0, isDefault: true }],
      periodLabel: getPeriodLabel(filters),
      userCreatedYear: user?.createdAt.getUTCFullYear() ?? now.getUTCFullYear(),
    };
  }

  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  // Fetch jobs with activity data
  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: { not: 'PENDING' },
      startedAt: { gte: start, lte: end },
      ...(agentWhere ? { ticket: { is: agentWhere } } : {}),
    },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      costUsd: true,
      command: true,
      status: true,
      ticketId: true,
      ticket: {
        select: {
          ticketKey: true,
          title: true,
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
    },
  });

  // Group jobs by day
  const dayMap = new Map<string, {
    jobCount: number;
    costs: (number | null)[];
    shippedTickets: Map<number, ShippedTicketInfo>;
  }>();

  // Track agents
  const agentCounts = new Map<string, number>();

  for (const job of jobs) {
    const dateKey = formatDateUTC(job.startedAt);

    let dayData = dayMap.get(dateKey);
    if (!dayData) {
      dayData = { jobCount: 0, costs: [], shippedTickets: new Map() };
      dayMap.set(dateKey, dayData);
    }

    dayData.jobCount++;
    dayData.costs.push(job.costUsd);

    // Track shipped tickets (completedAt-based day attribution)
    if (job.command === 'ship' && job.status === 'COMPLETED' && job.completedAt) {
      const shipDateKey = formatDateUTC(job.completedAt);
      let shipDayData = dayMap.get(shipDateKey);
      if (!shipDayData) {
        shipDayData = { jobCount: 0, costs: [], shippedTickets: new Map() };
        dayMap.set(shipDateKey, shipDayData);
      }
      if (!shipDayData.shippedTickets.has(job.ticketId)) {
        shipDayData.shippedTickets.set(job.ticketId, {
          ticketKey: job.ticket.ticketKey,
          title: job.ticket.title,
        });
      }
    }

    // Count agents
    const effectiveAgent = (job.ticket.agent ?? job.ticket.project.defaultAgent) as string;
    agentCounts.set(effectiveAgent, (agentCounts.get(effectiveAgent) ?? 0) + 1);
  }

  // Build days array
  const days: HeatmapDay[] = Array.from(dayMap.entries())
    .map(([date, data]) => {
      const nonNullCosts = data.costs.filter((c): c is number => c !== null);
      return {
        date,
        jobCount: data.jobCount,
        costUsd: nonNullCosts.length === 0 ? null : nonNullCosts.reduce((s, c) => s + c, 0),
        shippedTickets: Array.from(data.shippedTickets.values()),
      };
    })
    .filter((d) => d.jobCount > 0 || d.shippedTickets.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate totals
  const totalJobs = days.reduce((sum, d) => sum + d.jobCount, 0);

  // Deduplicate shipped tickets across all days
  const allShippedTicketKeys = new Set<string>();
  for (const day of days) {
    for (const st of day.shippedTickets) {
      allShippedTicketKeys.add(st.ticketKey);
    }
  }
  const totalShipped = allShippedTicketKeys.size;

  // Build agent options
  const totalAgentJobs = Array.from(agentCounts.values()).reduce((s, c) => s + c, 0);
  const agents: AgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: totalAgentJobs, isDefault: true },
  ];
  for (const agent of ALL_AGENTS) {
    const count = agentCounts.get(agent) ?? 0;
    if (count > 0) {
      agents.push({ value: agent, label: getAgentLabel(agent), jobCount: count, isDefault: false });
    }
  }

  // Fetch user createdAt
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  return {
    days,
    totalJobs,
    totalShipped,
    agents,
    periodLabel: getPeriodLabel(filters),
    userCreatedYear: user?.createdAt.getUTCFullYear() ?? now.getUTCFullYear(),
  };
}
