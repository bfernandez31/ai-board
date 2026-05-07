import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { deleteJobLogArtifact, uploadJobLogArtifact } from '@/app/lib/blob/client';
import { ARTIFACT_MAX_BYTES } from '@/app/lib/logs/schema';
import { buildJobLogRawArtifactKey } from '@/app/lib/logs/artifact-key';

// AIB-776: Native Claude Code session JSONL upload (raw, pre-normalization).
//
// Mirrors PUT /api/jobs/:id/logs/artifact but stores under a `.native.jsonl.gz`
// suffix so retention and the read API can address each artifact independently.
// Only CLAUDE jobs are accepted — for other agents this endpoint returns 422
// rather than 4xx-erroring so the runner can call it unconditionally.
export async function PUT(
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

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/gzip')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/gzip', code: 'UNSUPPORTED_MEDIA_TYPE' },
      { status: 415 }
    );
  }

  const lengthHeader = request.headers.get('content-length');
  const advertisedSize = lengthHeader ? parseInt(lengthHeader, 10) : NaN;
  if (Number.isFinite(advertisedSize) && advertisedSize > ARTIFACT_MAX_BYTES) {
    return NextResponse.json(
      { error: 'Artifact exceeds 25 MB limit', code: 'PAYLOAD_TOO_LARGE' },
      { status: 413 }
    );
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      projectId: true,
      ticketId: true,
      ticket: {
        select: {
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
    },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const effectiveAgent = job.ticket.agent ?? job.ticket.project.defaultAgent;
  if (effectiveAgent !== 'CLAUDE') {
    return NextResponse.json(
      { error: 'Native session capture is only supported for CLAUDE jobs', code: 'AGENT_NOT_SUPPORTED' },
      { status: 422 }
    );
  }

  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return NextResponse.json({ error: 'Failed to read body' }, { status: 400 });
  }
  const buffer = Buffer.from(body);
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  }
  if (buffer.byteLength > ARTIFACT_MAX_BYTES) {
    return NextResponse.json(
      { error: 'Artifact exceeds 25 MB limit', code: 'PAYLOAD_TOO_LARGE' },
      { status: 413 }
    );
  }

  const rawArtifactKey = buildJobLogRawArtifactKey(job.projectId, job.ticketId, jobId);
  const existingLog = await prisma.jobLog.findUnique({
    where: { jobId },
    select: { rawArtifactKey: true },
  });
  if (existingLog?.rawArtifactKey === rawArtifactKey) {
    console.info('[PUT /jobs/:id/logs/artifact-raw] Overwriting existing native artifact for retried job run', {
      jobId,
      rawArtifactKey,
    });
  }
  try {
    await uploadJobLogArtifact(rawArtifactKey, buffer, buffer.byteLength);
  } catch (error) {
    console.error('[PUT /jobs/:id/logs/artifact-raw] Blob upload failed', error);
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_UPLOAD_FAILED' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { rawArtifactKey, rawArtifactSize: buffer.byteLength },
    { status: 201 }
  );
}

export async function DELETE(
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

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { projectId: true, ticketId: true },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const rawArtifactKey = buildJobLogRawArtifactKey(job.projectId, job.ticketId, jobId);
  try {
    const result = await deleteJobLogArtifact(rawArtifactKey);
    return NextResponse.json({ deleted: result.deleted }, { status: 200 });
  } catch (error) {
    console.error('[DELETE /jobs/:id/logs/artifact-raw] Blob delete failed', error);
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_DELETE_FAILED' },
      { status: 502 }
    );
  }
}
