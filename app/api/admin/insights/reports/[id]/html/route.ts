import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import {
  AdminAccessDenied,
  requireAdmin,
} from '@/lib/admin/admin-auth';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import {
  streamInsightsReportHtml,
  uploadInsightsReportHtml,
} from '@/app/lib/blob/client';
import { ARTIFACT_MAX_BYTES } from '@/app/lib/logs/schema';
import { buildInsightsReportArtifactKey } from '@/lib/admin/insights/artifact-key';

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

const HTML_RESPONSE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'self' 'unsafe-inline' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Frame-Options': 'DENY',
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse | Response> {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccessDenied) return notFound();
    throw error;
  }

  const { id: idString } = await context.params;
  const id = Number.parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return notFound();
  }

  const report = await prisma.adminInsightsReport.findUnique({
    where: { id },
    select: { id: true, status: true, htmlBlobKey: true },
  });
  if (!report || report.status !== 'COMPLETED' || !report.htmlBlobKey) {
    return notFound();
  }

  let stream: { stream: ReadableStream<Uint8Array>; size: number } | null;
  try {
    stream = await streamInsightsReportHtml(report.htmlBlobKey);
  } catch (error) {
    console.error(
      '[GET /api/admin/insights/reports/:id/html] Blob backend error',
      error
    );
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_READ_FAILED' },
      { status: 502 }
    );
  }
  if (!stream) {
    return notFound();
  }

  return new Response(stream.stream, {
    status: 200,
    headers: HTML_RESPONSE_HEADERS,
  });
}

export async function PUT(
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

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('text/html')) {
    return NextResponse.json(
      {
        error: 'Content-Type must be text/html',
        code: 'UNSUPPORTED_MEDIA_TYPE',
      },
      { status: 415 }
    );
  }

  const lengthHeader = request.headers.get('content-length');
  const advertisedSize = lengthHeader ? Number.parseInt(lengthHeader, 10) : NaN;
  if (Number.isFinite(advertisedSize) && advertisedSize > ARTIFACT_MAX_BYTES) {
    return NextResponse.json(
      { error: 'Artifact exceeds 25 MB limit', code: 'PAYLOAD_TOO_LARGE' },
      { status: 413 }
    );
  }

  const report = await prisma.adminInsightsReport.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!report) {
    return NextResponse.json(
      { error: 'Insights report not found' },
      { status: 404 }
    );
  }
  if (report.status !== 'RUNNING') {
    return NextResponse.json(
      { error: 'Run already finalized', status: report.status },
      { status: 409 }
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

  const key = buildInsightsReportArtifactKey(id);
  try {
    await uploadInsightsReportHtml(key, buffer, buffer.byteLength);
  } catch (error) {
    console.error(
      '[PUT /api/admin/insights/reports/:id/html] Blob upload failed',
      error
    );
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_UPLOAD_FAILED' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { htmlBlobKey: key, htmlBlobSize: buffer.byteLength },
    { status: 201 }
  );
}
