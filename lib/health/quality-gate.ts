import { prisma } from '@/lib/db/client';
import { DIMENSION_CONFIG, parseQualityScoreDetails } from '@/lib/quality-score';
import type { ThresholdDistribution } from './types';
import type { Stage, WorkflowType } from '@prisma/client';

export interface QualityGateDimension {
  name: string;
  averageScore: number | null;
  weight: number;
}

export interface QualityGateTicket {
  ticketKey: string;
  title: string;
  score: number;
  completedAt: string;
}

export interface QualityGateTrendPoint {
  ticketKey: string;
  score: number;
  date: string;
}

export interface QualityGateDetails {
  averageScore: number | null;
  ticketCount: number;
  trend: 'up' | 'down' | 'stable' | null;
  trendDelta: number | null;
  distribution: ThresholdDistribution;
  dimensions: QualityGateDimension[];
  recentTickets: QualityGateTicket[];
  trendData: QualityGateTrendPoint[];
}

/**
 * Compute the threshold distribution for a set of scores.
 */
export function computeDistribution(scores: number[]): ThresholdDistribution {
  const distribution: ThresholdDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
  for (const score of scores) {
    if (score >= 90) distribution.excellent++;
    else if (score >= 70) distribution.good++;
    else if (score >= 50) distribution.fair++;
    else distribution.poor++;
  }
  return distribution;
}

/**
 * Compute trend direction comparing current vs previous average.
 * Threshold of 1 point for stability.
 */
export function computeTrend(
  currentAvg: number | null,
  previousAvg: number | null,
): { trend: 'up' | 'down' | 'stable' | null; trendDelta: number | null } {
  if (currentAvg === null || previousAvg === null) {
    return { trend: null, trendDelta: null };
  }
  const delta = Math.round(currentAvg - previousAvg);
  if (delta > 1) return { trend: 'up', trendDelta: delta };
  if (delta < -1) return { trend: 'down', trendDelta: delta };
  return { trend: 'stable', trendDelta: delta };
}

/**
 * Compute per-dimension averages from qualityScoreDetails JSON across jobs.
 */
export function computeDimensionAverages(
  detailsArray: (string | null)[],
): QualityGateDimension[] {
  const sums = new Map<string, { total: number; count: number }>();

  for (const raw of detailsArray) {
    const parsed = parseQualityScoreDetails(raw);
    if (!parsed?.dimensions) continue;
    for (const dim of parsed.dimensions) {
      const existing = sums.get(dim.agentId) ?? { total: 0, count: 0 };
      existing.total += dim.score;
      existing.count += 1;
      sums.set(dim.agentId, existing);
    }
  }

  return DIMENSION_CONFIG.map((config) => {
    const data = sums.get(config.agentId);
    return {
      name: config.name,
      averageScore: data ? Math.round(data.total / data.count) : null,
      weight: config.weight,
    };
  });
}

/**
 * Get aggregated Quality Gate data for a project.
 * Queries COMPLETED verify jobs from FULL-workflow SHIP tickets in last 30 days.
 */
export async function getQualityGateData(projectId: number): Promise<QualityGateDetails> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const baseWhere = {
    command: 'verify',
    status: 'COMPLETED' as const,
    qualityScore: { not: null },
    ticket: {
      is: {
        projectId,
        workflowType: 'FULL' as WorkflowType,
        stage: 'SHIP' as Stage,
      },
    },
  };

  // Current period (last 30 days)
  const currentJobs = await prisma.job.findMany({
    where: {
      ...baseWhere,
      completedAt: { gte: thirtyDaysAgo },
    },
    include: { ticket: { select: { ticketKey: true, title: true } } },
    orderBy: { completedAt: 'desc' },
  });

  // Previous period (30-60 days ago)
  const previousJobs = await prisma.job.findMany({
    where: {
      ...baseWhere,
      completedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
    },
    select: { qualityScore: true },
  });

  const currentScores = currentJobs
    .map((j) => j.qualityScore)
    .filter((s): s is number => s !== null);

  const previousScores = previousJobs
    .map((j) => j.qualityScore)
    .filter((s): s is number => s !== null);

  const currentAvg =
    currentScores.length > 0
      ? Math.round(currentScores.reduce((a, b) => a + b, 0) / currentScores.length)
      : null;

  const previousAvg =
    previousScores.length > 0
      ? Math.round(previousScores.reduce((a, b) => a + b, 0) / previousScores.length)
      : null;

  const { trend, trendDelta } = computeTrend(currentAvg, previousAvg);

  const distribution = computeDistribution(currentScores);

  const dimensions = computeDimensionAverages(
    currentJobs.map((j) => j.qualityScoreDetails),
  );

  const recentTickets: QualityGateTicket[] = currentJobs.map((j) => ({
    ticketKey: j.ticket.ticketKey,
    title: j.ticket.title,
    score: j.qualityScore!,
    completedAt: j.completedAt!.toISOString(),
  }));

  const trendData: QualityGateTrendPoint[] = [...currentJobs]
    .sort((a, b) => (a.completedAt!.getTime() - b.completedAt!.getTime()))
    .map((j) => ({
      ticketKey: j.ticket.ticketKey,
      score: j.qualityScore!,
      date: j.completedAt!.toISOString(),
    }));

  return {
    averageScore: currentAvg,
    ticketCount: currentScores.length,
    trend,
    trendDelta,
    distribution,
    dimensions,
    recentTickets,
    trendData,
  };
}
