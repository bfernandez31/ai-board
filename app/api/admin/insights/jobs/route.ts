import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { listEligibleUnanalyzedSessions } from '@/app/lib/insights/predicate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/insights/jobs — workflow-driven enumeration of the analysis
 * corpus (AIB-856, D-5).
 *
 * Returns **all eligible-unanalyzed Claude sessions** across all tickets and
 * all projects, regardless of ticket outcome, in ascending `startedAt` order
 * (FR-002/FR-003/FR-007). Selection is driven by the per-session marker
 * anti-join, NOT by a time window: `periodStart`/`periodEnd` query params are
 * accepted for backward-compatible callers but are **ignored for selection**
 * (D-5).
 *
 * The predicate comes from `app/lib/insights/predicate.ts` so the trigger
 * pre-flight, the /preflight endpoint, and this enumeration cannot drift
 * (P-2).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobs = await listEligibleUnanalyzedSessions();
  return NextResponse.json({ jobs });
}
