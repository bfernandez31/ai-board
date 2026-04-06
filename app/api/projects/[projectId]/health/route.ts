import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { calculateGlobalScore, getScoreLabel, getScoreColorConfig } from '@/lib/health/score-calculator';
import { getQualityGateData } from '@/lib/health/quality-gate';
import type { HealthResponse, HealthModuleStatus } from '@/lib/health/types';
import type { HealthScanType } from '@prisma/client';

function buildModuleStatus(
  score: number | null,
  lastScanDate: Date | null,
  scanStatus: string | null,
  issuesFound: number | null,
  skipReason?: string | null,
): HealthModuleStatus {
  let label: string | null = null;
  let summary: string;

  if (scanStatus === 'SKIPPED') {
    label = score !== null ? getScoreLabel(score) : null;
    summary = skipReason ? `Skipped: ${skipReason}` : 'Skipped';
    return {
      score,
      label,
      lastScanDate: lastScanDate?.toISOString() ?? null,
      scanStatus,
      issuesFound: null,
      summary,
      skipReason: skipReason ?? null,
    };
  }

  if (score !== null) {
    label = getScoreLabel(score);
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

    // Auto-fail stale scans stuck in PENDING/RUNNING for >65 minutes
    // (workflow timeout is 60min + 5min buffer for the FAILED status update step)
    const staleThreshold = new Date(Date.now() - 65 * 60 * 1000);
    await prisma.healthScan.updateMany({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING'] },
        createdAt: { lt: staleThreshold },
      },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: 'Scan timed out — workflow did not report back',
      },
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

    // Get latest completed scan status per module type
    const latestCompletedScans = await prisma.healthScan.findMany({
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
      latestCompletedScans.map(s => [s.scanType, s])
    );

    // Get latest terminal scan per module type (COMPLETED or SKIPPED) to detect SKIPPED
    const latestTerminalScans = await prisma.healthScan.findMany({
      where: {
        projectId,
        status: { in: ['COMPLETED', 'SKIPPED'] },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['scanType'],
      select: {
        scanType: true,
        status: true,
        report: true,
      },
    });

    const latestTerminalMap = new Map(
      latestTerminalScans.map(s => [s.scanType, s])
    );

    // Active scan status map (for modules currently scanning)
    const activeScanMap = new Map(
      activeScans.map(s => [s.scanType, s.status])
    );

    // Derive Quality Gate from 30-day average of SHIP tickets
    const qualityGateData = await getQualityGateData(projectId);
    const qualityGateScore = qualityGateData.averageScore;
    const firstTicket = qualityGateData.recentTickets[0];
    const qualityGateDate = firstTicket
      ? new Date(firstTicket.completedAt)
      : null;

    // Helper to extract skip reason from a terminal scan's report JSON
    function getSkipReason(scanType: string): string | null {
      const terminal = latestTerminalMap.get(scanType as HealthScanType);
      if (!terminal || terminal.status !== 'SKIPPED') return null;
      if (terminal.report) {
        try {
          const parsed = JSON.parse(terminal.report);
          return parsed.skipReason ?? null;
        } catch (parseError) {
          console.warn('Failed to parse scan report JSON for skip reason:', { scanType, error: parseError });
        }
      }
      return null;
    }

    // Determine effective scan status: active scan overrides, then latest terminal scan
    function getEffectiveScanStatus(scanType: string): string | null {
      const active = activeScanMap.get(scanType as HealthScanType);
      if (active) return active;
      const terminal = latestTerminalMap.get(scanType as HealthScanType);
      if (terminal) return terminal.status;
      return null;
    }

    // Build module statuses
    const securityScan = scanStatusMap.get('SECURITY');
    const complianceScan = scanStatusMap.get('COMPLIANCE');
    const testsScan = scanStatusMap.get('TESTS');
    const specSyncScan = scanStatusMap.get('SPEC_SYNC');
    const reviewQualityScan = scanStatusMap.get('REVIEW_QUALITY');

    const modules: HealthResponse['modules'] = {
      security: buildModuleStatus(
        healthScore?.securityScore ?? null,
        healthScore?.lastSecurityScan ?? null,
        getEffectiveScanStatus('SECURITY'),
        securityScan?.issuesFound ?? null,
        getSkipReason('SECURITY'),
      ),
      compliance: buildModuleStatus(
        healthScore?.complianceScore ?? null,
        healthScore?.lastComplianceScan ?? null,
        getEffectiveScanStatus('COMPLIANCE'),
        complianceScan?.issuesFound ?? null,
        getSkipReason('COMPLIANCE'),
      ),
      tests: buildModuleStatus(
        healthScore?.testsScore ?? null,
        healthScore?.lastTestsScan ?? null,
        getEffectiveScanStatus('TESTS'),
        testsScan?.issuesFound ?? null,
        getSkipReason('TESTS'),
      ),
      specSync: buildModuleStatus(
        healthScore?.specSyncScore ?? null,
        healthScore?.lastSpecSyncScan ?? null,
        getEffectiveScanStatus('SPEC_SYNC'),
        specSyncScan?.issuesFound ?? null,
        getSkipReason('SPEC_SYNC'),
      ),
      qualityGate: {
        score: qualityGateScore,
        label: qualityGateScore !== null ? getScoreLabel(qualityGateScore) : null,
        lastScanDate: qualityGateDate?.toISOString() ?? null,
        passive: true,
        summary: qualityGateData.ticketCount > 0
          ? `${qualityGateData.ticketCount} ticket${qualityGateData.ticketCount !== 1 ? 's' : ''} — ${getScoreLabel(qualityGateScore!)}`
          : 'No verify jobs yet',
        ticketCount: qualityGateData.ticketCount,
        trend: qualityGateData.trend,
        trendDelta: qualityGateData.trendDelta,
        distribution: qualityGateData.distribution,
      },
      reviewQuality: buildModuleStatus(
        healthScore?.reviewQualityScore ?? null,
        healthScore?.lastReviewQualityScan ?? null,
        getEffectiveScanStatus('REVIEW_QUALITY'),
        reviewQualityScan?.issuesFound ?? null,
        getSkipReason('REVIEW_QUALITY'),
      ),
    };

    // Calculate global score
    const globalScore = calculateGlobalScore({
      securityScore: healthScore?.securityScore ?? null,
      complianceScore: healthScore?.complianceScore ?? null,
      testsScore: healthScore?.testsScore ?? null,
      specSyncScore: healthScore?.specSyncScore ?? null,
      qualityGate: qualityGateScore,
      reviewQualityScore: healthScore?.reviewQualityScore ?? null,
    });

    // Find last full scan date (most recent completed scan of any type)
    const lastScanDates = [
      healthScore?.lastSecurityScan,
      healthScore?.lastComplianceScan,
      healthScore?.lastTestsScan,
      healthScore?.lastSpecSyncScan,
      healthScore?.lastReviewQualityScan,
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
