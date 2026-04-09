import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { calculateGlobalScore } from '@/lib/health/score-calculator';
import { getQualityGateData } from '@/lib/health/quality-gate';
import type { HealthScanStatus, HealthScanType } from '@prisma/client';

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

const SCAN_TYPE_TO_SCORE_FIELD: Record<HealthScanType, string> = {
  SECURITY: 'securityScore',
  COMPLIANCE: 'complianceScore',
  TESTS: 'testsScore',
  SPEC_SYNC: 'specSyncScore',
  REVIEW_QUALITY: 'reviewQualityScore',
};

const SCAN_TYPE_TO_DATE_FIELD: Record<HealthScanType, string> = {
  SECURITY: 'lastSecurityScan',
  COMPLIANCE: 'lastComplianceScan',
  TESTS: 'lastTestsScan',
  SPEC_SYNC: 'lastSpecSyncScan',
  REVIEW_QUALITY: 'lastReviewQualityScan',
};

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

    // Defensive guard: COMPLIANCE scans cannot be SKIPPED — coerce to COMPLETED
    let effectiveStatus: HealthScanStatus = data.status as HealthScanStatus;
    if (data.status === 'SKIPPED' && scan.scanType === 'COMPLIANCE') {
      if (data.score == null) {
        return NextResponse.json(
          { error: 'Score required — COMPLIANCE scans cannot be skipped' },
          { status: 400 }
        );
      }
      effectiveStatus = 'COMPLETED';
    }

    if (data.status === 'SKIPPED' && scan.scanType === 'TESTS' && !data.skipReason) {
      return NextResponse.json(
        { error: 'skipReason required for skipped TESTS scans' },
        { status: 400 }
      );
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
    const updateData: Record<string, unknown> = {
      status: effectiveStatus,
    };

    if (effectiveStatus === 'RUNNING') {
      updateData.startedAt = now;
    }

    if (effectiveStatus === 'COMPLETED' || effectiveStatus === 'FAILED' || effectiveStatus === 'SKIPPED') {
      updateData.completedAt = now;
    }

    const optionalFields = [
      'score', 'report', 'issuesFound', 'issuesFixed',
      'headCommit', 'durationMs', 'tokensUsed', 'costUsd', 'errorMessage',
    ] as const;
    for (const field of optionalFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    // Persist skipReason inside the report JSON for SKIPPED scans
    if (effectiveStatus === 'SKIPPED' && data.skipReason) {
      let reportPayload: Record<string, unknown> = {};
      if (typeof updateData.report === 'string') {
        try {
          const parsed = JSON.parse(updateData.report);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            reportPayload = parsed as Record<string, unknown>;
          }
        } catch { /* ignore parse errors */ }
      }
      updateData.report = JSON.stringify({ ...reportPayload, skipReason: data.skipReason });
    }

    // Compute Quality Gate score before the transaction (read-only query)
    let qualityGateScore: number | null = null;
    if (effectiveStatus === 'COMPLETED' && data.score !== undefined) {
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
      if (effectiveStatus === 'COMPLETED' && data.score !== undefined) {
        const scoreField = SCAN_TYPE_TO_SCORE_FIELD[scan.scanType];
        const dateField = SCAN_TYPE_TO_DATE_FIELD[scan.scanType];

        const scoreUpdate: Record<string, unknown> = {
          [scoreField]: data.score,
          [dateField]: now,
          ...(qualityGateScore !== null ? { qualityGate: qualityGateScore } : {}),
        };

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
