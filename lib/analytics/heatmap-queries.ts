import { Prisma, JobStatus, type Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { resolveEffectiveAgent, ALL_AGENTS } from '@/app/lib/utils/agent-resolution';
import type {
  HeatmapAgentFilter,
  HeatmapDay,
  HeatmapFilters,
  HeatmapIntensityThresholds,
  HeatmapMeta,
  HeatmapPayload,
  HeatmapPeriod,
  HeatmapShippedTicket,
} from './heatmap-types';

/**
 * Resolve accessible project IDs for a user (owner OR member).
 * Mirrors the OR clause used in lib/db/projects.ts:31-37 (getUserProjects).
 */
export async function getAccessibleProjectIds(userId: string): Promise<number[]> {
  const rows = await prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Resolve a HeatmapPeriod into a tz-local [rangeStart, rangeEnd] inclusive date-string
 * pair plus equivalent UTC millisecond boundaries usable in Prisma Date filters.
 *
 * `last-12-months`: [today - 364 days, today] in tz.
 * `calendar-year: Y`: [Y-01-01, Y-12-31] in tz; clamped to today if Y is current year.
 */
export function resolvePeriodRange(
  period: HeatmapPeriod,
  timezone: string,
  now: Date = new Date()
): {
  rangeStartKey: string;
  rangeEndKey: string;
  rangeStartUtc: Date;
  rangeEndUtcExclusive: Date;
  label: string;
} {
  const todayKey = formatDayKey(now, timezone);
  const todayYear = parseInt(todayKey.slice(0, 4), 10);

  if (period.kind === 'last-12-months') {
    const rangeEndKey = todayKey;
    const rangeStartKey = addDaysToKey(rangeEndKey, -364);
    return {
      rangeStartKey,
      rangeEndKey,
      rangeStartUtc: dayKeyToUtcStart(rangeStartKey, timezone),
      rangeEndUtcExclusive: dayKeyToUtcStart(addDaysToKey(rangeEndKey, 1), timezone),
      label: 'Last 12 months',
    };
  }

  const year = period.year;
  const rangeStartKey = `${year}-01-01`;
  const rawEndKey = `${year}-12-31`;
  const rangeEndKey = year === todayYear ? todayKey : rawEndKey;
  return {
    rangeStartKey,
    rangeEndKey,
    rangeStartUtc: dayKeyToUtcStart(rangeStartKey, timezone),
    rangeEndUtcExclusive: dayKeyToUtcStart(addDaysToKey(rangeEndKey, 1), timezone),
    label: String(year),
  };
}

/**
 * Format a UTC Date as a 'YYYY-MM-DD' key in the requested IANA timezone using
 * Intl.DateTimeFormat. Falls back to UTC if the timezone is rejected.
 */
export function formatDayKey(date: Date, timezone: string): string {
  const formatter = createDayFormatter(timezone);
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function createDayFormatter(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
}

function parseDayKey(key: string): { year: number; month: number; day: number } {
  const year = parseInt(key.slice(0, 4), 10);
  const month = parseInt(key.slice(5, 7), 10);
  const day = parseInt(key.slice(8, 10), 10);
  return { year, month, day };
}

function addDaysToKey(key: string, days: number): string {
  const { year, month, day } = parseDayKey(key);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert a tz-local day key ('YYYY-MM-DD') into the UTC Date that corresponds
 * to its 00:00:00 local-time boundary.
 */
function dayKeyToUtcStart(key: string, timezone: string): Date {
  const { year, month, day } = parseDayKey(key);
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const localAtGuess = formatDayKey(guess, timezone);
  if (localAtGuess === key) {
    return guess;
  }
  const offsetMs = tzOffsetMs(guess, timezone);
  return new Date(guess.getTime() - offsetMs);
}

function tzOffsetMs(date: Date, timezone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(date);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
    }
    const asUtc = Date.UTC(
      map.year ?? 1970,
      (map.month ?? 1) - 1,
      map.day ?? 1,
      map.hour ?? 0,
      map.minute ?? 0,
      map.second ?? 0
    );
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

/**
 * Effective-agent WHERE builder. Mirrors buildEffectiveAgentWhere in
 * lib/analytics/queries.ts:51-69 (research §P1, R6).
 *
 * Heatmap ship-counting MUST NOT use COMPLETED_TICKET_STAGES (research §P6).
 * FR-008: a ticket counts as shipped only when its `ship` Job completed
 * successfully — the heatmap aggregates jobs directly, ignoring Ticket.stage.
 */
function buildEffectiveAgentTicketWhere(
  agent: HeatmapAgentFilter
): Prisma.TicketWhereInput | undefined {
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

/**
 * Quartile-based intensity thresholds over non-zero day counts.
 * Guarantees t1 <= t2 <= t3 <= t4 with each >= 1, and strictly ascending when
 * possible (min t1+1, t2+1, t3+1 enforcement).
 */
export function computeIntensityThresholds(
  dayCounts: number[]
): HeatmapIntensityThresholds {
  const nonZero = dayCounts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) {
    return { t1: 1, t2: 2, t3: 3, t4: 4 };
  }

  const quantile = (arr: number[], q: number): number => {
    if (arr.length === 0) return 0;
    if (arr.length === 1) return arr[0] ?? 0;
    const pos = (arr.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const loVal = arr[lo] ?? 0;
    if (lo === hi) return loVal;
    const hiVal = arr[hi] ?? loVal;
    return loVal + (hiVal - loVal) * (pos - lo);
  };

  const t1Raw = Math.max(1, Math.ceil(quantile(nonZero, 0.25)));
  const t2Raw = Math.max(t1Raw + 1, Math.ceil(quantile(nonZero, 0.5)));
  const t3Raw = Math.max(t2Raw + 1, Math.ceil(quantile(nonZero, 0.75)));
  const maxNonZero = nonZero[nonZero.length - 1] ?? 1;
  const t4Raw = Math.max(t3Raw + 1, Math.ceil(maxNonZero));
  return { t1: t1Raw, t2: t2Raw, t3: t3Raw, t4: t4Raw };
}

export function bucketLevel(
  count: number,
  thresholds: HeatmapIntensityThresholds
): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= thresholds.t1) return 1;
  if (count <= thresholds.t2) return 2;
  if (count <= thresholds.t3) return 3;
  return 4;
}

/**
 * Build the full list of day keys between rangeStartKey and rangeEndKey inclusive.
 */
function buildDayKeyRange(rangeStartKey: string, rangeEndKey: string): string[] {
  const keys: string[] = [];
  let current = rangeStartKey;
  while (current <= rangeEndKey) {
    keys.push(current);
    current = addDaysToKey(current, 1);
  }
  return keys;
}

function computeAvailableYears(userCreatedAt: Date, now: Date = new Date()): number[] {
  const startYear = userCreatedAt.getFullYear();
  const currentYear = now.getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= startYear; y -= 1) {
    years.push(y);
  }
  return years;
}

export interface GetActivityHeatmapInput {
  userId: string;
  filters: HeatmapFilters;
  now?: Date;
}

export async function getActivityHeatmap(
  input: GetActivityHeatmapInput
): Promise<HeatmapPayload> {
  const { userId, filters, now = new Date() } = input;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const userCreatedAt = user?.createdAt ?? now;
  const availableYears = computeAvailableYears(userCreatedAt, now);

  const accessibleProjectIds = await getAccessibleProjectIds(userId);

  const { rangeStartKey, rangeEndKey, rangeStartUtc, rangeEndUtcExclusive, label } =
    resolvePeriodRange(filters.period, filters.timezone, now);

  const meta: HeatmapMeta = {
    rangeStart: rangeStartKey,
    rangeEnd: rangeEndKey,
    label,
  };

  if (accessibleProjectIds.length === 0) {
    return emptyPayload(filters, meta, rangeStartKey, rangeEndKey, availableYears);
  }

  const ticketAgentWhere = buildEffectiveAgentTicketWhere(filters.agent);

  const jobWhere: Prisma.JobWhereInput = {
    projectId: { in: accessibleProjectIds },
    completedAt: {
      gte: rangeStartUtc,
      lt: rangeEndUtcExclusive,
    },
    ...(ticketAgentWhere ? { ticket: { is: ticketAgentWhere } } : {}),
  };

  const jobs = await prisma.job.findMany({
    where: jobWhere,
    select: {
      id: true,
      command: true,
      status: true,
      costUsd: true,
      completedAt: true,
      ticket: {
        select: {
          id: true,
          ticketKey: true,
          title: true,
        },
      },
    },
  });

  const dayKeys = buildDayKeyRange(rangeStartKey, rangeEndKey);
  const dayIndex = new Map<string, number>();
  dayKeys.forEach((k, i) => dayIndex.set(k, i));

  interface DayAccumulator {
    date: string;
    jobCount: number;
    costSum: number;
    hasCost: boolean;
    shipped: Map<string, HeatmapShippedTicket>;
    shippedOrder: string[];
  }
  const acc: DayAccumulator[] = dayKeys.map((date) => ({
    date,
    jobCount: 0,
    costSum: 0,
    hasCost: false,
    shipped: new Map(),
    shippedOrder: [],
  }));

  const shippedTicketIds = new Set<string>();

  for (const j of jobs) {
    if (!j.completedAt) continue;
    const key = formatDayKey(j.completedAt, filters.timezone);
    const idx = dayIndex.get(key);
    if (idx === undefined) continue;
    const bucket = acc[idx];
    if (!bucket) continue;
    bucket.jobCount += 1;
    if (j.costUsd !== null && j.costUsd !== undefined) {
      bucket.costSum += j.costUsd;
      bucket.hasCost = true;
    }
    if (j.command === 'ship' && j.status === JobStatus.COMPLETED && j.ticket) {
      const tk = j.ticket.ticketKey;
      if (!bucket.shipped.has(tk)) {
        bucket.shipped.set(tk, { ticketKey: tk, title: j.ticket.title });
        bucket.shippedOrder.push(tk);
      }
      shippedTicketIds.add(tk);
    }
  }

  const dayCounts = acc.map((a) => a.jobCount);
  const thresholds = computeIntensityThresholds(dayCounts);

  const days: HeatmapDay[] = acc.map((a) => ({
    date: a.date,
    jobCount: a.jobCount,
    totalCost: a.hasCost ? roundCost(a.costSum) : null,
    shippedTickets: a.shippedOrder.map((tk) => a.shipped.get(tk)!),
    level: bucketLevel(a.jobCount, thresholds),
  }));

  const totals = {
    jobs: dayCounts.reduce((s, n) => s + n, 0),
    shippedTickets: shippedTicketIds.size,
  };

  const distinctAgents = await computeDistinctAgents({
    accessibleProjectIds,
    rangeStartUtc,
    rangeEndUtcExclusive,
  });

  return {
    filters,
    meta,
    days,
    totals,
    thresholds,
    distinctAgents,
    availableYears,
  };
}

function roundCost(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function emptyPayload(
  filters: HeatmapFilters,
  meta: HeatmapMeta,
  rangeStartKey: string,
  rangeEndKey: string,
  availableYears: number[]
): HeatmapPayload {
  const days: HeatmapDay[] = buildDayKeyRange(rangeStartKey, rangeEndKey).map((date) => ({
    date,
    jobCount: 0,
    totalCost: null,
    shippedTickets: [],
    level: 0,
  }));
  return {
    filters,
    meta,
    days,
    totals: { jobs: 0, shippedTickets: 0 },
    thresholds: { t1: 1, t2: 2, t3: 3, t4: 4 },
    distinctAgents: [],
    availableYears,
  };
}

/**
 * Compute the distinct set of effective agents across in-scope tickets
 * (those with at least one job whose completedAt falls within the range).
 * Computed WITHOUT applying the agent filter (research §R8).
 */
async function computeDistinctAgents(args: {
  accessibleProjectIds: number[];
  rangeStartUtc: Date;
  rangeEndUtcExclusive: Date;
}): Promise<Agent[]> {
  const { accessibleProjectIds, rangeStartUtc, rangeEndUtcExclusive } = args;
  if (accessibleProjectIds.length === 0) return [];

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: { in: accessibleProjectIds },
      jobs: {
        some: {
          completedAt: {
            gte: rangeStartUtc,
            lt: rangeEndUtcExclusive,
          },
        },
      },
    },
    select: {
      agent: true,
      project: {
        select: { defaultAgent: true },
      },
    },
  });

  const set = new Set<Agent>();
  for (const t of tickets) {
    const effective = resolveEffectiveAgent(t.agent, t.project.defaultAgent);
    set.add(effective);
  }

  const order = ALL_AGENTS;
  return order.filter((a) => set.has(a));
}
