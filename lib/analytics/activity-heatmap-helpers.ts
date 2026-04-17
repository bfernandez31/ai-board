import type { Agent } from '@prisma/client';

export type HeatmapPeriod =
  | { kind: 'rolling12m' }
  | { kind: 'calendarYear'; year: number };

export type HeatmapAgentFilter = 'all' | Agent;

export interface HeatmapShippedTicket {
  ticketId: number | null;
  title: string | null;
}

export interface HeatmapDayCell {
  date: string;
  jobCount: number;
  costUsd: number | null;
  nullCostJobCount: number;
  shippedTickets: HeatmapShippedTicket[];
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapResponse {
  period: {
    kind: 'rolling12m' | 'calendarYear';
    year?: number;
    startDate: string;
    endDate: string;
    timezone: string;
  };
  counters: {
    jobCount: number;
    shippedTicketCount: number;
  };
  cells: HeatmapDayCell[];
  intensityThresholds: [number, number, number, number];
  availableAgents: Agent[];
  yearSelector: {
    calendarYears: number[];
    currentYear: number;
  };
}

export function isValidTimezone(tz: string): boolean {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone === tz;
  } catch {
    return false;
  }
}

export function normalizeTimezone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  return isValidTimezone(tz) ? tz : 'UTC';
}

export function formatISODay(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function dateFromISODay(iso: string): Date {
  const parts = iso.split('-');
  const y = parseInt(parts[0] ?? '1970', 10);
  const m = parseInt(parts[1] ?? '1', 10) - 1;
  const d = parseInt(parts[2] ?? '1', 10);
  return new Date(Date.UTC(y, m, d));
}

export function listDays(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  let current = dateFromISODay(startISO);
  const end = dateFromISODay(endISO);
  while (current.getTime() <= end.getTime()) {
    const y = current.getUTCFullYear().toString().padStart(4, '0');
    const m = (current.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = current.getUTCDate().toString().padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    current = addDaysUTC(current, 1);
  }
  return days;
}

export function buildPeriodBounds(
  period: HeatmapPeriod,
  now: Date,
  tz: string
): { startDate: string; endDate: string; timezone: string; kind: 'rolling12m' | 'calendarYear'; year?: number } {
  const timezone = normalizeTimezone(tz);

  if (period.kind === 'calendarYear') {
    const year = period.year;
    return {
      startDate: `${year.toString().padStart(4, '0')}-01-01`,
      endDate: `${year.toString().padStart(4, '0')}-12-31`,
      timezone,
      kind: 'calendarYear',
      year,
    };
  }

  const endISO = formatISODay(now, timezone);
  const endDate = dateFromISODay(endISO);
  const startDate = new Date(endDate);
  startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
  startDate.setUTCDate(startDate.getUTCDate() + 1);
  const y = startDate.getUTCFullYear().toString().padStart(4, '0');
  const m = (startDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = startDate.getUTCDate().toString().padStart(2, '0');

  return {
    startDate: `${y}-${m}-${d}`,
    endDate: endISO,
    timezone,
    kind: 'rolling12m',
  };
}

export interface JobForBucket {
  startedAt: Date;
  costUsd: number | null;
}

export function bucketJobsByLocalDay(
  jobs: JobForBucket[],
  tz: string
): Map<string, { jobCount: number; costSum: number | null; nullCostJobCount: number }> {
  const timezone = normalizeTimezone(tz);
  const buckets = new Map<
    string,
    { jobCount: number; costSum: number | null; nullCostJobCount: number }
  >();

  for (const job of jobs) {
    const day = formatISODay(job.startedAt, timezone);
    const existing = buckets.get(day) ?? { jobCount: 0, costSum: null, nullCostJobCount: 0 };
    existing.jobCount += 1;
    if (job.costUsd === null || job.costUsd === undefined) {
      existing.nullCostJobCount += 1;
    } else {
      existing.costSum = (existing.costSum ?? 0) + job.costUsd;
    }
    buckets.set(day, existing);
  }

  return buckets;
}

export function computeIntensityThresholds(
  max: number
): [number, number, number, number] {
  if (max <= 0) return [0, 0, 0, 0];
  return [
    Math.max(1, Math.ceil(max * 0.25)),
    Math.max(1, Math.ceil(max * 0.5)),
    Math.max(1, Math.ceil(max * 0.75)),
    max,
  ];
}

export function assignIntensity(
  jobCount: number,
  thresholds: [number, number, number, number]
): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0) return 0;
  if (jobCount <= thresholds[0]) return 1;
  if (jobCount <= thresholds[1]) return 2;
  if (jobCount <= thresholds[2]) return 3;
  return 4;
}

export function resolveYearSelectorOptions(
  createdAt: Date,
  now: Date
): { calendarYears: number[]; currentYear: number } {
  const currentYear = now.getUTCFullYear();
  const createdYear = createdAt.getUTCFullYear();
  const minYear = Math.min(createdYear, currentYear);

  if (minYear === currentYear) {
    return { calendarYears: [], currentYear };
  }

  const years: number[] = [];
  for (let y = currentYear; y >= minYear; y--) {
    years.push(y);
  }
  return { calendarYears: years, currentYear };
}

export function assertHeatmapInvariants(response: HeatmapResponse): void {
  const sum = response.cells.reduce((acc, c) => acc + c.jobCount, 0);
  if (sum !== response.counters.jobCount) {
    console.warn(
      `[activity-heatmap] invariant violation: cells sum ${sum} !== counters.jobCount ${response.counters.jobCount}`
    );
  }
  const expectedDays = listDays(response.period.startDate, response.period.endDate).length;
  if (response.cells.length !== expectedDays) {
    console.warn(
      `[activity-heatmap] invariant violation: cells length ${response.cells.length} !== expected ${expectedDays}`
    );
  }
  for (const cell of response.cells) {
    const zeroIntensity = cell.intensity === 0;
    const zeroJobs = cell.jobCount === 0;
    if (zeroIntensity !== zeroJobs) {
      console.warn(
        `[activity-heatmap] invariant violation on ${cell.date}: intensity=${cell.intensity} jobCount=${cell.jobCount}`
      );
    }
  }
}
