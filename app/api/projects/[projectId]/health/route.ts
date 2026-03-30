import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { calculateGlobalScore, getScoreLabel, getScoreColorConfig } from '@/lib/health/score-calculator';
import { getQualityGateAggregate } from '@/lib/health/quality-gate';
import { getLastCleanAggregate } from '@/lib/health/last-clean';
import type { HealthResponse, HealthModuleStatus, QualityGateModuleStatus, LastCleanModuleStatus } from '@/lib/health/types';

function getScoreDisplayLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

function buildModuleStatus(
  score: number | null,
  lastScanDate: Date | null,
  scanStatus: string | null,
  issuesFound: number | null,
): HealthModuleStatus {
  let label: string | null = null;
  let summary: string;

  if (score !== null) {
    label = getScoreDisplayLabel(score);
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

    // Fetch cached health score
    const healthScore = await prisma.healthScore.findUnique({
      where: { projectId },
    });

    // Fetch active scans (PENDING or RUNNING)
    const activeScans = await prisma.healthScan.findMany({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      select: {
        id: true,
        scanType: true,
        status: true,
        startedAt: true,
      },
    });

    // Get latest scan status per active module type
    const latestScans = await prisma.healthScan.findMany({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['scanType'],
      select: {
        scanType: true,
        status: true,
        issuesFound: true,
      },
    });

    const scanStatusMap = new Map(
      latestScans.map(s => [s.scanType, s])
    );

    // Active scan status map (for modules currently scanning)
    const activeScanMap = new Map(
      activeScans.map(s => [s.scanType, s.status])
    );

    // Derive Quality Gate aggregate from 30-day SHIP ticket data
    const qgAggregate = await getQualityGateAggregate(projectId);
    const qualityGateScore = qgAggregate.averageScore;
    const firstTicket = qgAggregate.recentTickets[0];
    const qualityGateDate = firstTicket ? new Date(firstTicket.completedAt) : null;

    // Derive Last Clean aggregate from completed cleanup jobs
    const lcAggregate = await getLastCleanAggregate(projectId);
    const firstHistory = lcAggregate.history[0];
    const lastCleanJobId = firstHistory ? firstHistory.jobId : null;

    // Build module statuses
    const securityScan = scanStatusMap.get('SECURITY');
    const complianceScan = scanStatusMap.get('COMPLIANCE');
    const testsScan = scanStatusMap.get('TESTS');
    const specSyncScan = scanStatusMap.get('SPEC_SYNC');

    const modules: HealthResponse['modules'] = {
      security: buildModuleStatus(
        healthScore?.securityScore ?? null,
        healthScore?.lastSecurityScan ?? null,
        activeScanMap.get('SECURITY') ?? securityScan?.status ?? null,
        securityScan?.issuesFound ?? null,
      ),
      compliance: buildModuleStatus(
        healthScore?.complianceScore ?? null,
        healthScore?.lastComplianceScan ?? null,
        activeScanMap.get('COMPLIANCE') ?? complianceScan?.status ?? null,
        complianceScan?.issuesFound ?? null,
      ),
      tests: buildModuleStatus(
        healthScore?.testsScore ?? null,
        healthScore?.lastTestsScan ?? null,
        activeScanMap.get('TESTS') ?? testsScan?.status ?? null,
        testsScan?.issuesFound ?? null,
      ),
      specSync: buildModuleStatus(
        healthScore?.specSyncScore ?? null,
        healthScore?.lastSpecSyncScan ?? null,
        activeScanMap.get('SPEC_SYNC') ?? specSyncScan?.status ?? null,
        specSyncScan?.issuesFound ?? null,
      ),
      qualityGate: {
        score: qualityGateScore,
        label: qualityGateScore !== null ? getScoreDisplayLabel(qualityGateScore) : null,
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
