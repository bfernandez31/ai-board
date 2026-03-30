import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { calculateGlobalScore, getScoreLabel, getScoreColorConfig } from '@/lib/health/score-calculator';
import { getScoreThreshold } from '@/lib/quality-score';
import { getQualityGateAggregate } from '@/lib/health/quality-gate';
import { getLastCleanAggregate } from '@/lib/health/last-clean';
import type { HealthResponse, HealthModuleStatus, QualityGateModuleStatus, LastCleanModuleStatus } from '@/lib/health/types';

function buildModuleStatus(
  score: number | null,
  lastScanDate: Date | null,
  scanStatus: string | null,
  issuesFound: number | null,
): HealthModuleStatus {
  let label: string | null = null;
  let summary: string;

  if (score !== null) {
    label = getScoreThreshold(score);
    summary = issuesFound !== null && issuesFound > 0 ? `${issuesFound} issues found` : 'All clear';
  } else {
    summary = 'No scan yet';
  }

  return {
    score,
    label,
    lastScanDate: lastScanDate?.toISOString() ?? null,
    scanStatus: scanStatus ?? null,
    issuesFound: issuesFound ?? null,
    summary,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId, request);

    // Fetch all data in parallel
    const [healthScore, activeScans, latestScans, qgAggregate, lcAggregate] = await Promise.all([
      prisma.healthScore.findUnique({ where: { projectId } }),
      prisma.healthScan.findMany({
        where: { projectId, status: { in: ['PENDING', 'RUNNING'] } },
        select: { id: true, scanType: true, status: true, startedAt: true },
      }),
      prisma.healthScan.findMany({
        where: { projectId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        distinct: ['scanType'],
        select: { scanType: true, status: true, issuesFound: true },
      }),
      getQualityGateAggregate(projectId),
      getLastCleanAggregate(projectId),
    ]);

    const scanStatusMap = new Map(latestScans.map(s => [s.scanType, s]));
    const activeScanMap = new Map(activeScans.map(s => [s.scanType, s.status]));

    const qualityGateScore = qgAggregate.averageScore;
    const firstTicket = qgAggregate.recentTickets[0];
    const qualityGateDate = firstTicket ? new Date(firstTicket.completedAt) : null;
    const lastCleanJobId = lcAggregate.history[0]?.jobId ?? null;

    // Build module statuses
    const modules: HealthResponse['modules'] = {
      security: buildModuleStatus(
        healthScore?.securityScore ?? null,
        healthScore?.lastSecurityScan ?? null,
        activeScanMap.get('SECURITY') ?? scanStatusMap.get('SECURITY')?.status ?? null,
        scanStatusMap.get('SECURITY')?.issuesFound ?? null,
      ),
      compliance: buildModuleStatus(
        healthScore?.complianceScore ?? null,
        healthScore?.lastComplianceScan ?? null,
        activeScanMap.get('COMPLIANCE') ?? scanStatusMap.get('COMPLIANCE')?.status ?? null,
        scanStatusMap.get('COMPLIANCE')?.issuesFound ?? null,
      ),
      tests: buildModuleStatus(
        healthScore?.testsScore ?? null,
        healthScore?.lastTestsScan ?? null,
        activeScanMap.get('TESTS') ?? scanStatusMap.get('TESTS')?.status ?? null,
        scanStatusMap.get('TESTS')?.issuesFound ?? null,
      ),
      specSync: buildModuleStatus(
        healthScore?.specSyncScore ?? null,
        healthScore?.lastSpecSyncScan ?? null,
        activeScanMap.get('SPEC_SYNC') ?? scanStatusMap.get('SPEC_SYNC')?.status ?? null,
        scanStatusMap.get('SPEC_SYNC')?.issuesFound ?? null,
      ),
      qualityGate: {
        score: qualityGateScore,
        label: qualityGateScore !== null ? getScoreThreshold(qualityGateScore) : null,
        lastScanDate: qualityGateDate?.toISOString() ?? null,
        passive: true,
        summary: qgAggregate.ticketCount > 0
          ? `${qgAggregate.ticketCount} tickets in 30 days`
          : 'No qualifying tickets',
        ticketCount: qgAggregate.ticketCount,
        trend: {
          type: qgAggregate.trend.type,
          delta: qgAggregate.trend.delta,
          previousAverage: qgAggregate.trend.previousAverage,
        },
        distribution: qgAggregate.distribution,
        detail: qgAggregate.ticketCount > 0 ? {
          dimensions: qgAggregate.dimensions,
          recentTickets: qgAggregate.recentTickets,
          trendData: qgAggregate.trendData,
        } : null,
      } satisfies QualityGateModuleStatus,
      lastClean: {
        score: null,
        label: lcAggregate.status !== 'never' ? (lcAggregate.isOverdue ? 'Overdue' : 'OK') : null,
        lastCleanDate: lcAggregate.lastCleanDate,
        passive: true,
        jobId: lastCleanJobId,
        summary: lcAggregate.status === 'never'
          ? 'No cleanup yet'
          : `${lcAggregate.daysAgo} days ago`,
        filesCleaned: lcAggregate.filesCleaned,
        remainingIssues: lcAggregate.remainingIssues,
        daysAgo: lcAggregate.daysAgo,
        isOverdue: lcAggregate.isOverdue,
        status: lcAggregate.status,
        detail: lcAggregate.status !== 'never' ? {
          summary: lcAggregate.summary,
          history: lcAggregate.history,
        } : null,
      } satisfies LastCleanModuleStatus,
    };

    // Calculate global score
    const globalScore = calculateGlobalScore({
      securityScore: healthScore?.securityScore ?? null,
      complianceScore: healthScore?.complianceScore ?? null,
      testsScore: healthScore?.testsScore ?? null,
      specSyncScore: healthScore?.specSyncScore ?? null,
      qualityGate: qualityGateScore,
    });

    // Find last full scan date (most recent completed scan of any type)
    const lastScanDates = [
      healthScore?.lastSecurityScan,
      healthScore?.lastComplianceScan,
      healthScore?.lastTestsScan,
      healthScore?.lastSpecSyncScan,
    ].filter((d): d is Date => d != null);

    const lastFullScanDate = lastScanDates.length > 0
      ? new Date(Math.max(...lastScanDates.map(d => d.getTime()))).toISOString()
      : null;

    const response: HealthResponse = {
      globalScore,
      label: getScoreLabel(globalScore),
      color: getScoreColorConfig(globalScore),
      modules,
      lastFullScanDate,
      activeScans: activeScans.map(s => ({
        id: s.id,
        scanType: s.scanType,
        status: s.status,
        startedAt: s.startedAt?.toISOString() ?? null,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('[Health API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
