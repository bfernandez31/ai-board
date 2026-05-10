import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { adminInsightsReportStatusUpdateSchema } from '@/app/lib/admin/insights/status-update-validator';
import {
  canTransition,
} from '@/lib/admin/insights/state-machine';

interface CurrentStateResponse {
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  completedAt: string | null;
}

function toCurrentState(row: {
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  completedAt: Date | null;
}): CurrentStateResponse {
  return {
    id: row.id,
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idString } = await context.params;
  const id = Number.parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const validation = adminInsightsReportStatusUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        details: validation.error.issues.map((i) => ({
          message: i.message,
          path: i.path,
        })),
      },
      { status: 400 }
    );
  }

  const payload = validation.data;

  const existing = await prisma.adminInsightsReport.findUnique({
    where: { id },
    select: { id: true, status: true, completedAt: true, workflowRunId: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: 'Insights report not found' },
      { status: 404 }
    );
  }

  const currentStatus = existing.status;
  const requestedStatus = payload.status;

  // Idempotent same-status request.
  if (currentStatus === requestedStatus) {
    if (requestedStatus === 'RUNNING' && payload.workflowRunId) {
      // First-write-wins on workflowRunId for RUNNING callbacks.
      await prisma.adminInsightsReport.updateMany({
        where: { id, workflowRunId: null },
        data: { workflowRunId: payload.workflowRunId },
      });
    }
    return NextResponse.json(toCurrentState(existing), { status: 200 });
  }

  if (!canTransition(currentStatus, requestedStatus)) {
    return NextResponse.json(
      { error: `Invalid transition from ${currentStatus} to ${requestedStatus}` },
      { status: 400 }
    );
  }

  // Atomic conditional update — guarded by `status: 'RUNNING'` so a lost race
  // is a no-op. The post-fetch below returns the authoritative state either way.
  // requestedStatus is COMPLETED or FAILED here: same-status was handled above,
  // and non-RUNNING→RUNNING is rejected by canTransition.
  if (requestedStatus === 'COMPLETED') {
    await prisma.adminInsightsReport.updateMany({
      where: { id, status: 'RUNNING' },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        sessionsCount: payload.sessionsCount,
        ticketsCount: payload.ticketsCount,
        htmlBlobKey: payload.htmlBlobKey,
        htmlBlobSize: payload.htmlBlobSize,
      },
    });
  } else if (requestedStatus === 'FAILED') {
    await prisma.adminInsightsReport.updateMany({
      where: { id, status: 'RUNNING' },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorReason: payload.errorReason,
      },
    });
  }

  const after = await prisma.adminInsightsReport.findUnique({
    where: { id },
    select: { id: true, status: true, completedAt: true },
  });
  return NextResponse.json(toCurrentState(after!), { status: 200 });
}
