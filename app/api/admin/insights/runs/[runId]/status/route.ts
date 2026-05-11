import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAccess } from '@/lib/db/admin-auth';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { prisma } from '@/lib/db/client';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['RUNNING', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED'],
};

const statusUpdateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('RUNNING'),
  }),
  z.object({
    status: z.literal('COMPLETED'),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    sessionCount: z.number().int().min(0),
    ticketCount: z.number().int().min(0),
    reportKey: z.string().min(1),
    reportSize: z.number().int().min(0),
  }),
  z.object({
    status: z.literal('FAILED'),
    errorMessage: z.string().min(1).max(2000),
  }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const isWorkflow = await verifyWorkflowToken(request);
    if (!isWorkflow) {
      await verifyAdminAccess(request);
    }

    const { runId: runIdStr } = await params;
    const runId = parseInt(runIdStr, 10);

    if (isNaN(runId) || runId <= 0) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = statusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid status update', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const run = await prisma.insightsRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const allowedTransitions = VALID_TRANSITIONS[run.status];
    if (!allowedTransitions || !allowedTransitions.includes(parsed.data.status)) {
      return NextResponse.json(
        {
          error: `Invalid transition from ${run.status} to ${parsed.data.status}`,
          code: 'INVALID_TRANSITION',
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
    };

    if (parsed.data.status === 'RUNNING') {
      updateData.startedAt = new Date();
    } else if (parsed.data.status === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.periodStart = parsed.data.periodStart;
      updateData.periodEnd = parsed.data.periodEnd;
      updateData.sessionCount = parsed.data.sessionCount;
      updateData.ticketCount = parsed.data.ticketCount;
      updateData.reportKey = parsed.data.reportKey;
      updateData.reportSize = parsed.data.reportSize;
    } else if (parsed.data.status === 'FAILED') {
      updateData.completedAt = new Date();
      updateData.errorMessage = parsed.data.errorMessage;
    }

    const updated = await prisma.insightsRun.update({
      where: { id: runId },
      data: updateData,
    });

    return NextResponse.json({ run: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Not found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    console.error('[Admin Insights Status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
