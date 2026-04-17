import type { Agent } from '@prisma/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type {
  HeatmapAgentOption,
  HeatmapDay,
  HeatmapGridRange,
  HeatmapYearOption,
  HeatmapYearSelection,
} from './heatmap-types';

export interface BucketJobInput {
  completedAt: Date;
  ticketId: number;
  command: string;
  status: 'COMPLETED' | 'FAILED';
  costUsd: number | null;
}

interface DayAccumulator {
  jobCount: number;
  ticketsShippedSet: Set<number>;
  costSum: number;
  hasCost: boolean;
}

export function formatLocalDate(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

export function getIntensityLevel(jobCount: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0) return 0;
  if (jobCount === 1) return 1;
  if (jobCount <= 3) return 2;
  if (jobCount <= 7) return 3;
  return 4;
}

export function getIntensityClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return 'aurora-cell-0';
    case 1:
      return 'aurora-cell-1';
    case 2:
      return 'aurora-cell-2';
    case 3:
      return 'aurora-cell-3';
    case 4:
      return 'aurora-cell-4';
  }
}

function parseIsoDate(iso: string): Date {
  const parts = iso.split('-').map((part) => Number.parseInt(part, 10));
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

function dayOfWeekUtc(iso: string): number {
  return parseIsoDate(iso).getUTCDay();
}

export function bucketJobsByLocalDay(
  jobs: BucketJobInput[],
  timezone: string,
  range: { startDate: string; endDate: string }
): HeatmapDay[] {
  const byDate = new Map<string, DayAccumulator>();

  let cursor = range.startDate;
  while (cursor <= range.endDate) {
    byDate.set(cursor, {
      jobCount: 0,
      ticketsShippedSet: new Set<number>(),
      costSum: 0,
      hasCost: false,
    });
    cursor = addDaysIso(cursor, 1);
  }

  for (const job of jobs) {
    const localDate = formatLocalDate(job.completedAt, timezone);
    const bucket = byDate.get(localDate);
    if (!bucket) continue;

    bucket.jobCount += 1;
    if (job.command === 'ship' && job.status === 'COMPLETED') {
      bucket.ticketsShippedSet.add(job.ticketId);
    }
    if (job.costUsd !== null && job.costUsd !== undefined) {
      bucket.costSum += job.costUsd;
      bucket.hasCost = true;
    }
  }

  const days: HeatmapDay[] = [];
  let iter = range.startDate;
  while (iter <= range.endDate) {
    const bucket = byDate.get(iter)!;
    const day: HeatmapDay = {
      date: iter,
      jobCount: bucket.jobCount,
      ticketsShipped: bucket.ticketsShippedSet.size,
      intensity: getIntensityLevel(bucket.jobCount),
    };
    if (bucket.hasCost) {
      day.totalCostUsd = Math.round(bucket.costSum * 100) / 100;
    }
    days.push(day);
    iter = addDaysIso(iter, 1);
  }

  return days;
}

export function buildGridSkeleton(startDate: string, endDate: string): HeatmapGridRange {
  const startDow = dayOfWeekUtc(startDate);
  const endDow = dayOfWeekUtc(endDate);
  const gridStart = addDaysIso(startDate, -startDow);
  const gridEnd = addDaysIso(endDate, 6 - endDow);
  return { startDate, endDate, gridStart, gridEnd };
}

export function buildYearOptions(
  userCreatedAt: Date,
  now: Date
): HeatmapYearOption[] {
  const currentYear = now.getUTCFullYear();
  const createdYear = userCreatedAt.getUTCFullYear();
  const options: HeatmapYearOption[] = [
    { value: 'last-12-months', label: 'Last 12 months', isDefault: true },
  ];

  if (createdYear >= currentYear) {
    return options;
  }

  for (let y = currentYear; y >= createdYear; y -= 1) {
    options.push({ value: `${y}` as HeatmapYearSelection, label: `${y}`, isDefault: false });
  }

  return options;
}

export function buildAgentOptions(
  historicalCounts: Map<Agent, number>
): HeatmapAgentOption[] {
  let total = 0;
  for (const count of historicalCounts.values()) {
    total += count;
  }

  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', historicalJobCount: total },
  ];

  for (const agent of ALL_AGENTS) {
    const count = historicalCounts.get(agent) ?? 0;
    if (count > 0) {
      options.push({
        value: agent,
        label: getAgentLabel(agent),
        historicalJobCount: count,
      });
    }
  }

  return options;
}

export function computeYearRange(
  year: HeatmapYearSelection,
  now: Date
): { startDate: string; endDate: string } {
  if (year === 'last-12-months') {
    const end = now;
    const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
    const startIso = toIso(start);
    const endIso = toIso(end);
    return { startDate: startIso, endDate: endIso };
  }

  const y = Number.parseInt(year, 10);
  return {
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
  };
}

export function buildPeriodLabel(year: HeatmapYearSelection): string {
  return year === 'last-12-months' ? 'in the last year' : `in ${year}`;
}
