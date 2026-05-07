import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { uploadJobLogArtifact } from '@/app/lib/blob/client';
import { ARTIFACT_MAX_BYTES } from '@/app/lib/logs/schema';
import { buildJobLogNativeArtifactKey } from '@/app/lib/logs/artifact-key';

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
    select: { id: true, projectId: true, ticketId: true },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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

  const nativeArtifactKey = buildJobLogNativeArtifactKey(job.projectId, job.ticketId, jobId);
  try {
    await uploadJobLogArtifact(nativeArtifactKey, buffer, buffer.byteLength);
  } catch (error) {
    console.error('[PUT /jobs/:id/logs/native-artifact] Blob upload failed', error);
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_UPLOAD_FAILED' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { nativeArtifactKey, nativeArtifactSize: buffer.byteLength },
    { status: 201 }
  );
}
