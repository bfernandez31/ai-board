import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import {
  countExpectedClaudeSessions,
  listAnalyzableClaudeSessions,
} from '@/app/lib/insights/predicate';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

/**
 * GET /api/admin/insights/jobs?periodStart=…&periodEnd=… — workflow-driven
 * enumeration of EVERY analyzable Claude session in the window (AIB-852,
 * FR-001/2/16): multiple sessions per ticket, no SHIP filter, no project
 * filter. Also returns `expectedCount` (incl. transcript-pending sessions)
 * for reconciliation/gap reporting (FR-011).
 *
 * The predicate comes from `app/lib/insights/predicate.ts` so the trigger
 * pre-flight, the /preflight endpoint, and this enumeration cannot drift
 * (P1, SC-006).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    periodStart: searchParams.get('periodStart'),
    periodEnd: searchParams.get('periodEnd'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'periodStart and periodEnd are required ISO datetimes' },
      { status: 400 }
    );
  }

  const start = new Date(parsed.data.periodStart);
  const end = new Date(parsed.data.periodEnd);
  if (start >= end) {
    return NextResponse.json(
      { error: 'periodStart must be earlier than periodEnd' },
      { status: 400 }
    );
  }

  const window = { start, end };
  const jobs = await listAnalyzableClaudeSessions(window);
  const expectedCount = await countExpectedClaudeSessions(window);
  return NextResponse.json({ jobs, expectedCount });
}
