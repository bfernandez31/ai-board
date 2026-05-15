import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  adminNotFoundResponse,
  requireAdminOrNotFound,
} from '@/app/lib/auth/admin';
import { getReportById, toListEntry } from '@/app/lib/insights/repository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/insights/reports/:id — single report metadata (AIB-791).
 * Missing rows return byte-equivalent 404 (FR-003, D-10).
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
  if (!row) {
    return adminNotFoundResponse();
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  return NextResponse.json(toListEntry(row, owner, repo));
}
