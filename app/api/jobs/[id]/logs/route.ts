import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { buildJobLogRawNativeUrl, buildJobLogRawUrl } from '@/app/lib/logs/artifact-key';
import { JobLogSubmissionSchema, PREVIEW_MAX_CHARS } from '@/app/lib/logs/schema';
import { redactString } from '@/app/lib/logs/redactor';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobIdString } = await context.params;
  const jobId = parseInt(jobIdString, 10);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = JobLogSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const submission = parsed.data;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, projectId: true, ticketId: true },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  if (job.status === 'PENDING' || job.status === 'RUNNING') {
    return NextResponse.json(
      { error: 'Job is not in a terminal state', code: 'JOB_NOT_TERMINAL' },
      { status: 422 }
    );
  }

  const safePreview = redactString(submission.preview).slice(0, PREVIEW_MAX_CHARS);

  const data = {
    captureStatus: submission.captureStatus,
    preview: safePreview,
    schemaVersion: submission.schemaVersion,
    eventCount: submission.eventCount,
    errorCount: submission.errorCount,
    artifactKey: submission.artifactKey ?? null,
    artifactSize: submission.artifactSize ?? null,
    rawArtifactKey: submission.rawArtifactKey ?? null,
    rawArtifactSize: submission.rawArtifactSize ?? null,
    capturedAt: new Date(),
  };

  try {
    const row = await prisma.jobLog.upsert({
      where: { jobId },
      create: { jobId, ...data },
      update: data,
    });

    const rawUrl =
      row.captureStatus === 'CAPTURED'
        ? buildJobLogRawUrl(job.projectId, job.ticketId, jobId)
        : null;
    const rawNativeUrl = row.rawArtifactKey
      ? buildJobLogRawNativeUrl(job.projectId, job.ticketId, jobId)
      : null;

    return NextResponse.json(
      {
        captureStatus: row.captureStatus,
        preview: row.preview,
        schemaVersion: row.schemaVersion,
        eventCount: row.eventCount,
        errorCount: row.errorCount,
        artifactSize: row.artifactSize,
        rawArtifactSize: row.rawArtifactSize,
        capturedAt: row.capturedAt.toISOString(),
        rawUrl,
        rawNativeUrl,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('[POST /jobs/:id/logs] Prisma error', error.code, error.message);
    } else {
      console.error('[POST /jobs/:id/logs] Unexpected error', error);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
