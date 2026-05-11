import type { NextRequest } from 'next/server';
import {
  adminNotFoundResponse,
  requireAdminOrNotFound,
} from '@/app/lib/auth/admin';
import { getReportById } from '@/app/lib/insights/repository';
import { streamInsightsReportArtifact } from '@/app/lib/blob/client';

export const dynamic = 'force-dynamic';

// FR-024 stable placeholder served when the row exists but its blob artifact
// is missing (e.g. retention prune ran). Distinct from a 404 because the row
// still exists; the host UI uses this to render a clear "no longer available"
// message inside the iframe.
const MISSING_ARTIFACT_PLACEHOLDER =
  '<!DOCTYPE html><html lang="en"><body><p>Report content is no longer available.</p></body></html>';

// The admin shell iframes this endpoint, so transient blob errors must
// render as readable HTML rather than a raw JSON body bleeding through the
// iframe (review #5). A `Retry-After` header signals the client may try
// again once the upstream recovers.
const BLOB_UNREACHABLE_PLACEHOLDER =
  '<!DOCTYPE html><html lang="en"><body><p>Report content is temporarily unavailable. Please retry shortly.</p></body></html>';

const REPORT_HEADERS: HeadersInit = {
  'Content-Type': 'text/html; charset=utf-8',
  // The admin shell page may frame this endpoint; the sandboxed iframe is
  // what isolates the report from host state (D-9). X-Frame-Options is
  // intentionally NOT set here — it would block the iframe.
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Cache-Control': 'private, max-age=300',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * GET /api/admin/insights/reports/:id/html — stream the HTML artifact for
 * a COMPLETED report (AIB-791 US1, D-9, FR-024).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdminOrNotFound(request);
  if (!auth.ok) return auth.response;

  const { id: idString } = await context.params;
  const id = Number.parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return adminNotFoundResponse();
  }

  const row = await getReportById(id);
  if (!row || row.status !== 'COMPLETED' || !row.artifactKey) {
    return adminNotFoundResponse();
  }

  let result;
  try {
    result = await streamInsightsReportArtifact(row.artifactKey);
  } catch (error) {
    console.error('[GET /admin/insights/.../html] Blob backend unavailable', error);
    return new Response(BLOB_UNREACHABLE_PLACEHOLDER, {
      status: 502,
      headers: { ...REPORT_HEADERS, 'Retry-After': '30' },
    });
  }

  if (!result) {
    return new Response(MISSING_ARTIFACT_PLACEHOLDER, {
      status: 200,
      headers: REPORT_HEADERS,
    });
  }

  return new Response(result.stream, { status: 200, headers: REPORT_HEADERS });
}
