import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { calculateGlobalScore } from '@/lib/health/score-calculator';
import type { HealthScanStatus, HealthScanType } from '@prisma/client';

const statusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  score: z.number().int().min(0).max(100).optional(),
  report: z.string().optional(),
  issuesFound: z.number().int().min(0).optional(),
  issuesFixed: z.number().int().min(0).optional(),
  headCommit: z.string().length(40).optional(),
  durationMs: z.number().int().min(0).optional(),
  tokensUsed: z.number().int().min(0).optional(),
  costUsd: z.number().min(0).optional(),
  errorMessage: z.string().max(2000).optional(),
});

const VALID_TRANSITIONS: Record<string, HealthScanStatus[]> = {
  PENDING: ['RUNNING', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
};

const SCAN_TYPE_TO_SCORE_FIELD: Record<HealthScanType, string> = {
  SECURITY: 'securityScore',
  COMPLIANCE: 'complianceScore',
  TESTS: 'testsScore',
  SPEC_SYNC: 'specSyncScore',
};

const SCAN_TYPE_TO_DATE_FIELD: Record<HealthScanType, string> = {
  SECURITY: 'lastSecurityScan',
  COMPLIANCE: 'lastComplianceScan',
  TESTS: 'lastTestsScan',
  SPEC_SYNC: 'lastSpecSyncScan',
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
    if (data.status === 'COMPLETED' && data.score === undefined) {
      return NextResponse.json(
        { error: 'Score required for completed scans' },
        { status: 400 }
      );
    }

    // Find the scan
    const scan = await prisma.healthScan.findFirst({
      where: { id: scanId, projectId },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Idempotent: same status returns current state
    if (scan.status === data.status) {
      return NextResponse.json({
        scan: { id: scan.id, status: scan.status, score: scan.score },
      });
    }

    // Validate state transition
    const allowed = VALID_TRANSITIONS[scan.status] || [];
    if (!allowed.includes(data.status)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 409 }
      );
    }

    // Build update data
    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: data.status,
    };

    if (data.status === 'RUNNING') {
      updateData.startedAt = now;
    }

    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
      updateData.completedAt = now;
    }

    const optionalFields = [
      'score', 'report', 'issuesFound', 'issuesFixed',
      'headCommit', 'durationMs', 'tokensUsed', 'costUsd', 'errorMessage',
    ] as const;
    for (const field of optionalFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    // Update scan record
    const updatedScan = await prisma.healthScan.update({
      where: { id: scanId },
      data: updateData,
    });

    // On COMPLETED: update HealthScore aggregate
    if (data.status === 'COMPLETED' && data.score !== undefined) {
      const scoreField = SCAN_TYPE_TO_SCORE_FIELD[scan.scanType];
      const dateField = SCAN_TYPE_TO_DATE_FIELD[scan.scanType];

      const scoreUpdate: Record<string, unknown> = {
        [scoreField]: data.score,
        [dateField]: now,
      };

      await prisma.healthScore.upsert({
        where: { projectId },
        update: scoreUpdate,
        create: { projectId, ...scoreUpdate },
      });

      // Recalculate global score
      const healthScore = await prisma.healthScore.findUnique({
        where: { projectId },
      });

      if (healthScore) {
        const globalScore = calculateGlobalScore({
          securityScore: healthScore.securityScore,
          complianceScore: healthScore.complianceScore,
          testsScore: healthScore.testsScore,
          specSyncScore: healthScore.specSyncScore,
          qualityGate: healthScore.qualityGate,
        });

        await prisma.healthScore.update({
          where: { projectId },
          data: { globalScore },
        });
      }
    }

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
