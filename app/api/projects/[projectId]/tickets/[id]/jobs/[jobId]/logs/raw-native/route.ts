import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { streamJobLogArtifact } from '@/app/lib/blob/client';
import {
  buildJobLogRawArtifactKey,
  buildJobLogRawNativeUrl,
} from '@/app/lib/logs/artifact-key';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string; jobId: string }> }
): Promise<NextResponse | Response> {
  const { projectId: projectIdString, id: ticketIdString, jobId: jobIdString } =
    await context.params;
  const projectId = parseInt(projectIdString, 10);
  const ticketId = parseInt(ticketIdString, 10);
  const jobId = parseInt(jobIdString, 10);

  if (![projectId, ticketId, jobId].every((n) => Number.isFinite(n) && n > 0)) {
    return NextResponse.json({ error: 'Invalid path parameters' }, { status: 400 });
  }

  let ticket;
  try {
    ticket = await verifyTicketAccess(ticketId, request);
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
    select: {
      id: true,
      ticketId: true,
      projectId: true,
      ticket: { select: { agent: true } },
    },
  });
  if (!job || job.ticketId !== ticketId || job.projectId !== projectId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  if (job.ticket?.agent !== 'CLAUDE') {
    return NextResponse.json({ error: 'Artifact not available' }, { status: 404 });
  }

  const log = await prisma.jobLog.findUnique({
    where: { jobId },
    select: { captureStatus: true, rawArtifactKey: true },
  });
  if (!log || log.captureStatus !== 'CAPTURED' || !log.rawArtifactKey) {
    return NextResponse.json({ error: 'Artifact not available' }, { status: 404 });
  }

  const artifactKey = buildJobLogRawArtifactKey(projectId, ticketId, jobId);
  if (log.rawArtifactKey !== artifactKey) {
    console.error('[GET /logs/raw-native] Stored artifact key mismatch', {
      jobId,
      expectedArtifactKey: artifactKey,
      actualArtifactKey: log.rawArtifactKey,
      rawUrl: buildJobLogRawNativeUrl(projectId, ticketId, jobId),
    });
    return NextResponse.json(
      { error: 'Artifact key mismatch', code: 'ARTIFACT_KEY_MISMATCH' },
      { status: 500 }
    );
  }

  let result;
  try {
    result = await streamJobLogArtifact(artifactKey);
  } catch (error) {
    console.error('[GET /logs/raw-native] Blob stream failed', error);
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_UNREACHABLE' },
      { status: 502 }
    );
  }
  if (!result) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const isDownload = url.searchParams.get('format') === 'jsonl';
  const ticketKey = ticket.ticketKey ?? `ticket-${ticketId}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/gzip',
    'Cache-Control': 'private, max-age=60',
    'Content-Length': String(result.size),
  };
  if (isDownload) {
    headers['Content-Disposition'] = `attachment; filename="${ticketKey}-job-${jobId}-raw.jsonl.gz"`;
  }

  return new Response(result.stream, { status: 200, headers });
}
