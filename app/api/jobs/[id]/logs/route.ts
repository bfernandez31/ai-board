import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { JobLogUploadRequestSchema, JobLogUploadResponseSchema } from '@/app/lib/schemas/job-logs';
import { normalizeProviderLog } from '@/lib/job-logs/normalize';
import { upsertJobExecutionLog } from '@/lib/job-logs/storage';

const CAPTURABLE_STATUSES = new Set(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const jobId = Number.parseInt(id, 10);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        { error: 'Invalid job ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = JobLogUploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        ticketId: true,
        projectId: true,
        status: true,
        completedAt: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found', code: 'JOB_NOT_FOUND' }, { status: 404 });
    }

    if (!CAPTURABLE_STATUSES.has(job.status)) {
      return NextResponse.json(
        { error: 'Job is not in a capturable state', code: 'JOB_NOT_CAPTURABLE' },
        { status: 400 }
      );
    }

    const normalized = normalizeProviderLog({
      availability: parsed.data.availability,
      events: parsed.data.events ?? null,
      summary: parsed.data.summary,
      partialReason: parsed.data.partialReason ?? null,
      unavailableReason: parsed.data.unavailableReason ?? null,
    });
    const log = await upsertJobExecutionLog({
      job,
      payload: parsed.data,
      normalized,
    });

    const response = JobLogUploadResponseSchema.parse({
      jobId,
      availability: log.availability,
      capturedAt: log.capturedAt.toISOString(),
      retainedUntil: log.retainedUntil.toISOString(),
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Job Log Upload] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
