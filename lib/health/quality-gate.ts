import { prisma } from '@/lib/db/client';
import { parseQualityScoreDetails, getScoreThreshold, DIMENSION_CONFIG } from '@/lib/quality-score';
import type {
  QualityGateAggregate,
  QualityGateTrend,
  ThresholdDistribution,
  DimensionAverage,
  QualityGateTicketItem,
  TrendDataPoint,
} from './types';

interface VerifyJobRow {
  ticketId: number;
  qualityScore: number;
  qualityScoreDetails: string | null;
  completedAt: Date;
  ticketKey: string;
  title: string;
}

/**
 * Query qualifying verify jobs for a project within a date range.
 * Returns only the most recent COMPLETED verify job per ticket with a non-null qualityScore.
 */
async function queryVerifyJobs(
  projectId: number,
  fromDate: Date,
  toDate: Date,
): Promise<VerifyJobRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ticket: { projectId, stage: 'SHIP' },
      command: 'verify',
      status: 'COMPLETED',
      qualityScore: { not: null },
      completedAt: { gte: fromDate, lte: toDate },
    },
    orderBy: { completedAt: 'desc' },
    select: {
      ticketId: true,
      qualityScore: true,
      qualityScoreDetails: true,
      completedAt: true,
      ticket: {
        select: { ticketKey: true, title: true },
      },
    },
  });

  // Deduplicate: keep most recent per ticket (already ordered desc)
  const seen = new Set<number>();
  const unique: VerifyJobRow[] = [];
  for (const job of jobs) {
    if (!seen.has(job.ticketId)) {
      seen.add(job.ticketId);
      unique.push({
        ticketId: job.ticketId,
        qualityScore: job.qualityScore!,
        qualityScoreDetails: job.qualityScoreDetails,
        completedAt: job.completedAt!,
        ticketKey: job.ticket.ticketKey,
        title: job.ticket.title,
      });
    }
  }

  return unique;
}

function computeDistribution(scores: number[]): ThresholdDistribution {
  const dist: ThresholdDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
  for (const s of scores) {
    if (s >= 90) dist.excellent++;
    else if (s >= 70) dist.good++;
    else if (s >= 50) dist.fair++;
    else dist.poor++;
  }
  return dist;
}

function computeDimensionAverages(jobs: VerifyJobRow[]): DimensionAverage[] {
  const dimensionSums = new Map<string, { total: number; count: number; weight: number }>();

  // Initialize from DIMENSION_CONFIG
  for (const dim of DIMENSION_CONFIG) {
    dimensionSums.set(dim.name, { total: 0, count: 0, weight: dim.weight });
  }

  for (const job of jobs) {
    const details = parseQualityScoreDetails(job.qualityScoreDetails);
    if (!details) continue;
    for (const dim of details.dimensions) {
      const entry = dimensionSums.get(dim.name);
      if (entry && dim.score != null) {
        entry.total += dim.score;
        entry.count++;
      }
    }
  }

  return DIMENSION_CONFIG.map((dim) => {
    const entry = dimensionSums.get(dim.name)!;
    return {
      name: dim.name,
      averageScore: entry.count > 0 ? Math.round(entry.total / entry.count) : null,
      weight: dim.weight,
    };
  });
}

function computeTrend(
  currentAvg: number | null,
  previousAvg: number | null,
  currentCount: number,
  previousCount: number,
): QualityGateTrend {
  if (currentCount === 0) {
    return { type: 'no_data', currentAverage: null, previousAverage: null, delta: null };
  }
  if (previousCount === 0) {
    return { type: 'new', currentAverage: currentAvg, previousAverage: null, delta: null };
  }
  const delta = currentAvg! - previousAvg!;
  let type: QualityGateTrend['type'];
  if (delta > 0) type = 'improvement';
  else if (delta < 0) type = 'regression';
  else type = 'stable';

  return { type, currentAverage: currentAvg, previousAverage: previousAvg, delta };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMondayOfWeek(d: Date): Date {
  const monday = new Date(d);
  const day = d.getDay();
  monday.setDate(d.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}-${sunday.getDate()}`;
}

function computeWeeklyTrend(jobs: VerifyJobRow[]): TrendDataPoint[] {
  if (jobs.length === 0) return [];

  const weekMap = new Map<string, { total: number; count: number; startDate: Date }>();

  for (const job of jobs) {
    const monday = getMondayOfWeek(job.completedAt);
    const key = monday.toISOString().slice(0, 10);
    const existing = weekMap.get(key);
    if (existing) {
      existing.total += job.qualityScore;
      existing.count++;
    } else {
      weekMap.set(key, { total: job.qualityScore, count: 1, startDate: monday });
    }
  }

  const sorted = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([, data]) => ({
    week: getWeekLabel(data.startDate),
    averageScore: Math.round(data.total / data.count),
    ticketCount: data.count,
  }));
}

function buildRecentTickets(jobs: VerifyJobRow[]): QualityGateTicketItem[] {
  return jobs.map((job) => ({
    ticketKey: job.ticketKey,
    title: job.title,
    score: job.qualityScore,
    label: getScoreThreshold(job.qualityScore),
    completedAt: job.completedAt.toISOString(),
  }));
}

/**
 * Compute the Quality Gate aggregate for a project.
 * Queries SHIP tickets with COMPLETED verify jobs in the last 30 days,
 * computes averages, distribution, trend, dimensions, and weekly data points.
 */
export async function getQualityGateAggregate(projectId: number): Promise<QualityGateAggregate> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [currentJobs, previousJobs] = await Promise.all([
    queryVerifyJobs(projectId, thirtyDaysAgo, now),
    queryVerifyJobs(projectId, sixtyDaysAgo, thirtyDaysAgo),
  ]);

  const currentScores = currentJobs.map((j) => j.qualityScore);
  const previousScores = previousJobs.map((j) => j.qualityScore);

  const currentAvg = currentScores.length > 0
    ? Math.round(currentScores.reduce((a, b) => a + b, 0) / currentScores.length)
    : null;
  const previousAvg = previousScores.length > 0
    ? Math.round(previousScores.reduce((a, b) => a + b, 0) / previousScores.length)
    : null;

  return {
    averageScore: currentAvg,
    ticketCount: currentJobs.length,
    trend: computeTrend(currentAvg, previousAvg, currentJobs.length, previousJobs.length),
    distribution: computeDistribution(currentScores),
    dimensions: computeDimensionAverages(currentJobs),
    recentTickets: buildRecentTickets(currentJobs),
    trendData: computeWeeklyTrend(currentJobs),
  };
}
