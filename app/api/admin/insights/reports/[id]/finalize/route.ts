import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { uploadInsightsReportArtifact } from '@/app/lib/blob/client';
import { buildInsightsReportKey } from '@/app/lib/insights/blob-keys';
import { validateInsightsOutput } from '@/app/lib/insights/output-validation';
import { ARTIFACT_MAX_BYTES } from '@/app/lib/logs/schema';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/insights/reports/:id/finalize — workflow-driven HTML
 * artifact upload (AIB-791 US3, D-1, D-2, D-8, FR-026).
 *
 *  - Content-Type must start with `text/html` (415 on violation).
 *  - Body > 25 MB → 413 PAYLOAD_TOO_LARGE.
 *  - Server-side `validateInsightsOutput` runs BEFORE upload; failure → 422
 *    with `code: INVALID_OUTPUT` (the workflow then PATCHes /status to
 *    FAILED with the same reason).
 *  - On success returns the deterministic `artifactKey` and size.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idString } = await context.params;
  const id = Number.parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('text/html')) {
    return NextResponse.json(
      { error: 'Content-Type must be text/html', code: 'UNSUPPORTED_MEDIA_TYPE' },
      { status: 415 }
    );
  }

  const report = await prisma.insightsReport.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
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

  const validation = validateInsightsOutput(buffer.toString('utf-8'));
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: 'Insights output validation failed',
        code: 'INVALID_OUTPUT',
        reason: validation.reason,
      },
      { status: 422 }
    );
  }

  const artifactKey = buildInsightsReportKey(id);
  try {
    await uploadInsightsReportArtifact(artifactKey, buffer);
  } catch (error) {
    console.error('[PUT insights finalize] Blob upload failed', error);
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_UPLOAD_FAILED' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { artifactKey, artifactSize: buffer.byteLength },
    { status: 200 }
  );
}
