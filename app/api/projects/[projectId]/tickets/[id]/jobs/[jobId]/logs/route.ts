import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { buildJobLogRawUrl, buildJobLogNativeRawUrl } from '@/app/lib/logs/artifact-key';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string; jobId: string }> }
): Promise<NextResponse> {
  const { projectId: projectIdString, id: ticketIdString, jobId: jobIdString } =
    await context.params;
  const projectId = parseInt(projectIdString, 10);
  const ticketId = parseInt(ticketIdString, 10);
  const jobId = parseInt(jobIdString, 10);

  if (![projectId, ticketId, jobId].every((n) => Number.isFinite(n) && n > 0)) {
    return NextResponse.json({ error: 'Invalid path parameters' }, { status: 400 });
  }

  try {
    await verifyTicketAccess(ticketId, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'Ticket not found') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, ticketId: true, projectId: true },
  });
  if (!job || job.ticketId !== ticketId || job.projectId !== projectId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const log = await prisma.jobLog.findUnique({
    where: { jobId },
  });
  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  }

  const rawUrl =
    log.captureStatus === 'CAPTURED' ? buildJobLogRawUrl(projectId, ticketId, jobId) : null;

  const nativeRawUrl =
    log.captureStatus === 'CAPTURED' && log.rawArtifactKey
      ? buildJobLogNativeRawUrl(projectId, ticketId, jobId)
      : null;

  return NextResponse.json(
    {
      captureStatus: log.captureStatus,
      preview: log.preview,
      schemaVersion: log.schemaVersion,
      eventCount: log.eventCount,
      errorCount: log.errorCount,
      artifactSize: log.artifactSize,
      capturedAt: log.capturedAt.toISOString(),
      rawUrl,
      nativeRawUrl,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
