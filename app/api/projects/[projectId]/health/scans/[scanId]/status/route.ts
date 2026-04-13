import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { calculateGlobalScore } from '@/lib/health/score-calculator';
import { getQualityGateData } from '@/lib/health/quality-gate';
import type { HealthScanStatus, HealthScanType } from '@prisma/client';
import { Prisma } from '@prisma/client';

const statusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED']),
  score: z.number().int().min(0).max(100).optional().nullable(),
  report: z.string().optional(),
  issuesFound: z.number().int().min(0).optional(),
  issuesFixed: z.number().int().min(0).optional(),
  headCommit: z.string().length(40).optional(),
  durationMs: z.number().int().min(0).optional(),
  tokensUsed: z.number().int().min(0).optional(),
  costUsd: z.number().min(0).optional(),
  errorMessage: z.string().max(2000).optional(),
  skipReason: z.string().max(500).optional(),
});

const VALID_TRANSITIONS: Record<string, HealthScanStatus[]> = {
  PENDING: ['RUNNING', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED', 'SKIPPED'],
  COMPLETED: [],
  FAILED: [],
  SKIPPED: [],
};

type HealthScoreFields = {
  securityScore?: number;
  complianceScore?: number;
  testsScore?: number;
  specSyncScore?: number;
  reviewQualityScore?: number;
  qualityGate?: number;
  lastSecurityScan?: Date;
  lastComplianceScan?: Date;
  lastTestsScan?: Date;
  lastSpecSyncScan?: Date;
  lastReviewQualityScan?: Date;
};

function buildHealthScoreUpdate(
  scanType: HealthScanType,
  score: number,
  scanDate: Date,
  qualityGateScore: number | null
): HealthScoreFields {
  const qg = qualityGateScore !== null ? { qualityGate: qualityGateScore } : {};
  switch (scanType) {
    case 'SECURITY': return { ...qg, securityScore: score, lastSecurityScan: scanDate };
    case 'COMPLIANCE': return { ...qg, complianceScore: score, lastComplianceScan: scanDate };
    case 'TESTS': return { ...qg, testsScore: score, lastTestsScan: scanDate };
    case 'SPEC_SYNC': return { ...qg, specSyncScore: score, lastSpecSyncScan: scanDate };
    case 'REVIEW_QUALITY': return { ...qg, reviewQualityScore: score, lastReviewQualityScan: scanDate };
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; scanId: string }> }
) {
  try {
    // Validate workflow auth
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdStr, scanId: scanIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    const scanId = parseInt(scanIdStr, 10);

    if (isNaN(projectId) || projectId <= 0 || isNaN(scanId) || scanId <= 0) {
      return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Require score for COMPLETED
    if (data.status === 'COMPLETED' && data.score == null) {
      return NextResponse.json(
        { error: 'Score required for completed scans' },
        { status: 400 }
      );
    }

    // Find the scan (needed for scanType-based guards)
    const scan = await prisma.healthScan.findFirst({
      where: { id: scanId, projectId },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Defensive guard: COMPLIANCE and TESTS scans cannot be SKIPPED — coerce to COMPLETED
    let effectiveStatus: HealthScanStatus = data.status;
    if (data.status === 'SKIPPED' && (scan.scanType === 'COMPLIANCE' || scan.scanType === 'TESTS')) {
      if (data.score == null) {
        return NextResponse.json(
          { error: 'Score required — COMPLIANCE and TESTS scans cannot be skipped' },
          { status: 400 }
        );
      }
      effectiveStatus = 'COMPLETED';
    }

    // SKIPPED must NOT have a score (checked after coercion guard)
    if (effectiveStatus === 'SKIPPED' && data.score != null) {
      return NextResponse.json(
        { error: 'Score must not be provided for skipped scans' },
        { status: 400 }
      );
    }

    // Idempotent: same status returns current state
    if (scan.status === effectiveStatus) {
      return NextResponse.json({
        scan: { id: scan.id, status: scan.status, score: scan.score },
      });
    }

    // Validate state transition
    const allowed = VALID_TRANSITIONS[scan.status] || [];
    if (!allowed.includes(effectiveStatus)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 409 }
      );
    }

    // Build update data
    const now = new Date();
    const isTerminal = effectiveStatus === 'COMPLETED' || effectiveStatus === 'FAILED' || effectiveStatus === 'SKIPPED';

    let reportValue = data.report;
    // Persist skipReason inside the report JSON for SKIPPED scans
    if (effectiveStatus === 'SKIPPED' && data.skipReason) {
      let reportPayload: Record<string, unknown> = {};
      if (typeof reportValue === 'string') {
        try {
          const parsed = JSON.parse(reportValue);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            reportPayload = parsed as Record<string, unknown>;
          }
        } catch { /* ignore parse errors */ }
      }
      reportValue = JSON.stringify({ ...reportPayload, skipReason: data.skipReason });
    }

    const updateData: Prisma.HealthScanUpdateInput = {
      status: effectiveStatus,
      ...(effectiveStatus === 'RUNNING' && { startedAt: now }),
      ...(isTerminal && { completedAt: now }),
      ...(data.score !== undefined && { score: data.score }),
      ...(reportValue !== undefined && { report: reportValue }),
      ...(data.issuesFound !== undefined && { issuesFound: data.issuesFound }),
      ...(data.issuesFixed !== undefined && { issuesFixed: data.issuesFixed }),
      ...(data.headCommit !== undefined && { headCommit: data.headCommit }),
      ...(data.durationMs !== undefined && { durationMs: data.durationMs }),
      ...(data.tokensUsed !== undefined && { tokensUsed: data.tokensUsed }),
      ...(data.costUsd !== undefined && { costUsd: data.costUsd }),
      ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
    };

    // Compute Quality Gate score before the transaction (read-only query)
    let qualityGateScore: number | null = null;
    if (effectiveStatus === 'COMPLETED' && data.score != null) {
      try {
        const qgData = await getQualityGateData(projectId);
        qualityGateScore = qgData.averageScore;
      } catch (qualityGateError) {
        console.error('[Health Scan Status] Failed to compute Quality Gate score:', qualityGateError);
        qualityGateScore = null;
      }
    }

    // Update scan and HealthScore aggregate in a single transaction
    const updatedScan = await prisma.$transaction(async (tx) => {
      const scanResult = await tx.healthScan.update({
        where: { id: scanId },
        data: updateData,
      });

      // On COMPLETED: update HealthScore aggregate
      if (effectiveStatus === 'COMPLETED' && data.score != null) {
        const scoreUpdate = buildHealthScoreUpdate(scan.scanType, data.score, now, qualityGateScore);

        const healthScore = await tx.healthScore.upsert({
          where: { projectId },
          update: scoreUpdate,
          create: { projectId, ...scoreUpdate },
        });

        // Recalculate global score including Quality Gate
        const globalScore = calculateGlobalScore({
          securityScore: healthScore.securityScore,
          complianceScore: healthScore.complianceScore,
          testsScore: healthScore.testsScore,
          specSyncScore: healthScore.specSyncScore,
          qualityGate: qualityGateScore,
          reviewQualityScore: healthScore.reviewQualityScore,
        });

        await tx.healthScore.update({
          where: { projectId },
          data: { globalScore },
        });
      }

      return scanResult;
    });

    return NextResponse.json({
      scan: {
        id: updatedScan.id,
        status: updatedScan.status,
        score: updatedScan.score,
      },
    });
  } catch (error) {
    console.error('[Health Scan Status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
