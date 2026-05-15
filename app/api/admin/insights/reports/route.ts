import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminOrNotFound } from '@/app/lib/auth/admin';
import { reconcileOrphanedRunningReports } from '@/app/lib/insights/reconcile';
import { listReports, toListEntry } from '@/app/lib/insights/repository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/insights/reports — list past Insights reports (AIB-791
 * US1/US4). Reconciles orphaned RUNNING rows first (P-7) so the list is
 * always self-consistent. Capped at 200 rows at the DB layer (FR-017,
 * SC-007). `artifactKey` is never included in the response — clients fetch
 * HTML via /reports/:id/html.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrNotFound(request);
  if (!auth.ok) return auth.response;

  await reconcileOrphanedRunningReports(new Date());
  const rows = await listReports(200);
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  return NextResponse.json({ reports: rows.map((r) => toListEntry(r, owner, repo)) });
}
