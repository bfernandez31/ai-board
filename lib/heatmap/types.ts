export interface ActivityDayData {
  jobCount: number;
  shippedCount: number;
  costUsd: number | null;
}

export interface IntensityThresholds {
  q25: number;
  q50: number;
  q75: number;
  q90: number;
}

export interface AgentOption {
  value: string;
  label: string;
}

export interface HeatmapFilters {
  year: string;
  agent: string;
}

export interface ActivityHeatmapResponse {
  days: Record<string, ActivityDayData>;
  thresholds: IntensityThresholds;
  summary: {
    totalJobs: number;
    ticketsShipped: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  availableYears: string[];
  availableAgents: AgentOption[];
  filters: HeatmapFilters;
}

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export const HEATMAP_INTENSITY_CLASSES: Record<IntensityLevel, string> = {
  0: 'bg-ctp-surface0/50',
  1: 'bg-violet-900/60',
  2: 'bg-violet-700/70',
  3: 'bg-violet-500/80',
  4: 'bg-violet-400',
};

export const DEFAULT_HEATMAP_FILTERS: HeatmapFilters = {
  year: 'rolling',
  agent: 'all',
};

export function getIntensityLevel(
  count: number,
  thresholds: IntensityThresholds
): IntensityLevel {
  if (count === 0) return 0;

  const allSame =
    thresholds.q25 === thresholds.q50 &&
    thresholds.q50 === thresholds.q75 &&
    thresholds.q75 === thresholds.q90;
  if (allSame) return 2;

  if (count <= thresholds.q25) return 1;
  if (count <= thresholds.q50) return 2;
  if (count <= thresholds.q90) return 3;
  return 4;
}

export function computePeriodDates(
  year: string,
  now: Date = new Date()
): { startDate: Date; endDate: Date } {
  if (year === 'rolling') {
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setDate(startDate.getDate() + 1);
    return { startDate, endDate };
  }

  const yearNum = parseInt(year, 10);
  const currentYear = now.getFullYear();
  const startDate = new Date(yearNum, 0, 1);
  const endDate =
    yearNum === currentYear
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(yearNum, 11, 31);

  return { startDate, endDate };
}

export function computeQuantileThresholds(counts: number[]): IntensityThresholds {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);

  if (nonZero.length === 0) {
    return { q25: 1, q50: 2, q75: 3, q90: 4 };
  }

  if (nonZero.every((c) => c === nonZero[0])) {
    const val = nonZero[0]!;
    return { q25: val, q50: val, q75: val, q90: val };
  }

  const quantile = (sorted: number[], q: number): number => {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base]! + rest * (sorted[base + 1]! - sorted[base]!);
    }
    return sorted[base]!;
  };

  return {
    q25: quantile(nonZero, 0.25),
    q50: quantile(nonZero, 0.5),
    q75: quantile(nonZero, 0.75),
    q90: quantile(nonZero, 0.9),
  };
}

export function generateGridDates(
  startDate: Date,
  endDate: Date
): { date: Date; inRange: boolean }[] {
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(endDate);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const dates: { date: Date; inRange: boolean }[] = [];
  const current = new Date(gridStart);

  while (current <= gridEnd) {
    const inRange = current >= startDate && current <= endDate;
    dates.push({ date: new Date(current), inRange });
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const VALID_AGENTS = ['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'] as const;
export type HeatmapAgentFilter = (typeof VALID_AGENTS)[number];

export function isValidAgent(value: string): value is HeatmapAgentFilter {
  return (VALID_AGENTS as readonly string[]).includes(value);
}
