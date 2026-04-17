/**
 * Activity Heatmap — server-side data aggregation for the projects-page heatmap.
 *
 * Aggregates jobs (completed or not) and shipped tickets for a user across all
 * their projects. A ticket "shipped on day D" iff its `ship` command job reached
 * COMPLETED status on day D — NOT when its stage changed to SHIP.
 */
import type { Agent, Prisma } from '@prisma/client';
import { JobStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';

export type AgentFilter = Agent | 'all';

export type HeatmapPeriod = { kind: 'rolling'; months: 12 } | { kind: 'year'; year: number };

export interface HeatmapCell {
  /** YYYY-MM-DD (UTC) */
  date: string;
  jobCount: number;
  /** Total USD cost across jobs that have a recorded cost. null if no jobs report cost. */
  totalCost: number | null;
  ticketsShipped: number;
}

export interface HeatmapAgentOption {
  value: AgentFilter;
  label: string;
  jobCount: number;
}

export interface HeatmapData {
  /** Inclusive start of period (ISO UTC, midnight) */
  startDate: string;
  /** Inclusive end of period (ISO UTC, midnight) */
  endDate: string;
  cells: HeatmapCell[];
  totalJobs: number;
  totalShipped: number;
  availableAgents: HeatmapAgentOption[];
  availableYears: number[];
  filters: {
    agent: AgentFilter;
    period: HeatmapPeriod;
  };
  /** ISO timestamp when data was generated */
  generatedAt: string;
}

export interface HeatmapFilters {
  agent?: AgentFilter;
  period?: HeatmapPeriod;
}

/** Format a Date as YYYY-MM-DD in UTC. */
export function formatUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** UTC midnight of the given date (does not mutate input). */
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function resolvePeriodRange(
  period: HeatmapPeriod,
  now: Date
): { start: Date; end: Date } {
  if (period.kind === 'year') {
    const start = new Date(Date.UTC(period.year, 0, 1));
    const end = new Date(Date.UTC(period.year, 11, 31));
    return { start, end };
  }

  // Rolling 12 months: end = today (UTC midnight), start = 364 days earlier
  const end = toUtcMidnight(now);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 364);
  return { start, end };
}

/**
 * Compute the years the user can select based on their account creation.
 * Always includes the current year if the account was created this year or earlier.
 * Returns years in descending order (most recent first).
 */
export function getAvailableYears(userCreatedAt: Date, now: Date): number[] {
  const createdYear = userCreatedAt.getUTCFullYear();
  const currentYear = now.getUTCFullYear();
  if (createdYear >= currentYear) {
    return [];
  }
  const years: number[] = [];
  for (let y = currentYear; y >= createdYear; y--) {
    years.push(y);
  }
  return years;
}

function buildEffectiveAgentWhere(agent: AgentFilter): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      {
        agent: null,
        project: { is: { defaultAgent: agent } },
      },
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

async function getAvailableAgents(projectIds: number[]): Promise<HeatmapAgentOption[]> {
  if (projectIds.length === 0) {
    return [{ value: 'all', label: 'All agents', jobCount: 0 }];
  }

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

  const counts = new Map<Agent, number>();
  for (const ticket of tickets) {
    const effectiveAgent = (ticket.agent ?? ticket.project.defaultAgent) as Agent;
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + ticket._count.jobs);
  }

  const totalJobs = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: totalJobs },
  ];

  for (const agent of ALL_AGENTS) {
    const count = counts.get(agent) ?? 0;
    if (count > 0) {
      options.push({ value: agent, label: getAgentLabel(agent), jobCount: count });
    }
  }

  return options;
}

/**
 * Build a daily bucket key map: YYYY-MM-DD → aggregates.
 * @internal exported for testing
 */
export function buildEmptyCells(start: Date, end: Date): Map<string, HeatmapCell> {
  const cells = new Map<string, HeatmapCell>();
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const key = formatUtcDateKey(cursor);
    cells.set(key, { date: key, jobCount: 0, totalCost: null, ticketsShipped: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

/**
 * Add a job's cost to the per-day cost accumulator.
 * Using `null` means "no job on this day had a recorded cost yet".
 */
function addCost(current: number | null, addition: number | null): number | null {
  if (addition == null) return current;
  return (current ?? 0) + addition;
}

/**
 * Return the jobs aggregated per-day for a user, filtered by agent.
 * Uses completedAt when available, else startedAt (in-flight jobs).
 */
async function aggregateJobs(
  projectIds: number[],
  agent: AgentFilter,
  start: Date,
  end: Date,
  cells: Map<string, HeatmapCell>
): Promise<number> {
  const agentWhere = buildEffectiveAgentWhere(agent);

  // Range is inclusive of end day — use < (end + 1 day) for the upper bound.
  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      startedAt: { gte: start, lt: endExclusive },
      ...(agentWhere ? { ticket: { is: agentWhere } } : {}),
    },
    select: {
      startedAt: true,
      completedAt: true,
      costUsd: true,
    },
  });

  let total = 0;
  for (const job of jobs) {
    const bucketDate = job.completedAt ?? job.startedAt;
    const key = formatUtcDateKey(bucketDate);
    const cell = cells.get(key);
    if (!cell) continue;
    cell.jobCount += 1;
    cell.totalCost = addCost(cell.totalCost, job.costUsd ?? null);
    total += 1;
  }
  return total;
}

/**
 * Count ship-job completions per day — this is the "shipped" signal,
 * NOT the ticket stage.
 */
async function aggregateShipped(
  projectIds: number[],
  agent: AgentFilter,
  start: Date,
  end: Date,
  cells: Map<string, HeatmapCell>
): Promise<number> {
  const agentWhere = buildEffectiveAgentWhere(agent);
  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const shipJobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      command: 'ship',
      status: JobStatus.COMPLETED,
      completedAt: { gte: start, lt: endExclusive },
      ...(agentWhere ? { ticket: { is: agentWhere } } : {}),
    },
    select: { completedAt: true, ticketId: true },
  });

  // Count each ticket's first completed ship job on that day only once
  const seen = new Map<string, Set<number>>();
  for (const job of shipJobs) {
    if (!job.completedAt) continue;
    const key = formatUtcDateKey(job.completedAt);
    const dayTickets = seen.get(key) ?? new Set<number>();
    if (dayTickets.has(job.ticketId)) continue;
    dayTickets.add(job.ticketId);
    seen.set(key, dayTickets);

    const cell = cells.get(key);
    if (!cell) continue;
    cell.ticketsShipped += 1;
  }

  let total = 0;
  for (const tickets of seen.values()) {
    total += tickets.size;
  }
  return total;
}

export async function getUserHeatmapData(
  userId: string,
  userCreatedAt: Date,
  filters: HeatmapFilters = {},
  now: Date = new Date()
): Promise<HeatmapData> {
  const period: HeatmapPeriod = filters.period ?? { kind: 'rolling', months: 12 };
  const agent: AgentFilter = filters.agent ?? 'all';

  const projectIds = await getAccessibleProjectIds(userId);
  const { start, end } = resolvePeriodRange(period, now);

  const cells = buildEmptyCells(start, end);

  const [totalJobs, totalShipped, availableAgents] = await Promise.all([
    aggregateJobs(projectIds, agent, start, end, cells),
    aggregateShipped(projectIds, agent, start, end, cells),
    getAvailableAgents(projectIds),
  ]);

  return {
    startDate: formatUtcDateKey(start),
    endDate: formatUtcDateKey(end),
    cells: Array.from(cells.values()),
    totalJobs,
    totalShipped,
    availableAgents,
    availableYears: getAvailableYears(userCreatedAt, now),
    filters: { agent, period },
    generatedAt: now.toISOString(),
  };
}
