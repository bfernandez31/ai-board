import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { prisma } from '@/lib/db/client';
import { upsertHealthScore } from '@/lib/health/queries';
import type { HealthScanStatus } from '@prisma/client';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  scanId: z.coerce.number().int().positive(),
});

const patchBodySchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  score: z.number().int().min(0).max(100).optional(),
  report: z.record(z.string(), z.unknown()).optional(),
  issuesFound: z.number().int().min(0).optional(),
  issuesFixed: z.number().int().min(0).optional(),
  ticketsCreated: z.number().int().min(0).optional(),
  errorMessage: z.string().max(2000).optional(),
  durationMs: z.number().int().min(0).optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  costUsd: z.number().min(0).optional(),
});

type RouteParams = { projectId: string; scanId: string };

function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

const VALID_TRANSITIONS: Record<string, HealthScanStatus[]> = {
  PENDING: ['RUNNING'],
  RUNNING: ['COMPLETED', 'FAILED'],
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    // Workflow token auth
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return jsonError(401, authResult.error ?? 'Unauthorized', 'AUTH_REQUIRED');
    }

    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return jsonError(400, 'Invalid parameters', 'VALIDATION_ERROR');
    }

    const { scanId } = paramsResult.data;

    const body = await request.json();
    const bodyResult = patchBodySchema.safeParse(body);
    if (!bodyResult.success) {
      return jsonError(400, 'Invalid request body', 'VALIDATION_ERROR');
    }

    const { status: newStatus, score, report, issuesFound, issuesFixed, ticketsCreated, errorMessage, durationMs, inputTokens, outputTokens, costUsd } = bodyResult.data;

    // Find the scan
    const scan = await prisma.healthScan.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      return jsonError(404, 'Scan not found', 'SCAN_NOT_FOUND');
    }

    // Validate state transition
    const allowedTransitions = VALID_TRANSITIONS[scan.status];
    if (!allowedTransitions?.includes(newStatus)) {
      return jsonError(
        400,
        `Invalid status transition from ${scan.status} to ${newStatus}`,
        'INVALID_TRANSITION'
      );
    }

    // Validate COMPLETED requires score
    if (newStatus === 'COMPLETED' && score == null) {
      return jsonError(400, 'Score is required when status is COMPLETED', 'VALIDATION_ERROR');
    }

    // Validate FAILED requires errorMessage
    if (newStatus === 'FAILED' && !errorMessage) {
      return jsonError(400, 'errorMessage is required when status is FAILED', 'VALIDATION_ERROR');
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (newStatus === 'RUNNING') {
      updateData.startedAt = now;
    }

    if (newStatus === 'COMPLETED' || newStatus === 'FAILED') {
      updateData.completedAt = now;
    }

    if (score != null) updateData.score = score;
    if (report != null) updateData.report = report;
    if (issuesFound != null) updateData.issuesFound = issuesFound;
    if (issuesFixed != null) updateData.issuesFixed = issuesFixed;
    if (ticketsCreated != null) updateData.ticketsCreated = ticketsCreated;
    if (errorMessage != null) updateData.errorMessage = errorMessage;
    if (durationMs != null) updateData.durationMs = durationMs;
    if (inputTokens != null) updateData.inputTokens = inputTokens;
    if (outputTokens != null) updateData.outputTokens = outputTokens;
    if (costUsd != null) updateData.costUsd = costUsd;

    const updatedScan = await prisma.healthScan.update({
      where: { id: scanId },
      data: updateData,
    });

    // On COMPLETED: upsert health score cache
    if (newStatus === 'COMPLETED' && score != null) {
      await upsertHealthScore(scan.projectId, scan.scanType, score, now);
    }

    return NextResponse.json({ scan: updatedScan });
  } catch (error) {
    console.error('[scan-status] Error:', error);
    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}
