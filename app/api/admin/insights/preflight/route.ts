import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminOrNotFound } from '@/app/lib/auth/admin';
import {
  countShippedClaudeTicketsSince,
  getEarliestClaudeJobTimestamp,
} from '@/app/lib/insights/predicate';
import {
  getLastCompletedRunEnd,
  getRunningReport,
} from '@/app/lib/insights/repository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/insights/preflight — non-mutating UI check (AIB-791 US3).
 * Mirrors the trigger endpoint's pre-flight logic so the button can disable
 * itself and show a refusal message without firing a POST.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrNotFound(request);
  if (!auth.ok) return auth.response;

  const prevEnd = await getLastCompletedRunEnd();
  const shippedSince = await countShippedClaudeTicketsSince(prevEnd);
  const running = await getRunningReport();

  let refusal:
    | { refusalCode: 'NO_CLAUDE_JOBS' | 'NO_NEW_SHIPPED' | 'ALREADY_RUNNING'; message: string }
    | null = null;

  if (running) {
    refusal = {
      refusalCode: 'ALREADY_RUNNING',
      message: `Already running since ${running.createdAt.toISOString()}`,
    };
  } else if (shippedSince === 0) {
    if (prevEnd === null) {
      const earliest = await getEarliestClaudeJobTimestamp();
      if (!earliest) {
        refusal = {
          refusalCode: 'NO_CLAUDE_JOBS',
          message: 'No shipped Claude tickets to analyze yet',
        };
      } else {
        refusal = {
          refusalCode: 'NO_NEW_SHIPPED',
          message: `No new shipped tickets since last run on ${earliest.toISOString()}`,
        };
      }
    } else {
      refusal = {
        refusalCode: 'NO_NEW_SHIPPED',
        message: `No new shipped tickets since last run on ${prevEnd.toISOString()}`,
      };
    }
  }

  return NextResponse.json({
    canTrigger: refusal === null,
    shippedSincePreviousRun: shippedSince,
    previousRunEnd: prevEnd?.toISOString() ?? null,
    runningSince: running?.createdAt.toISOString() ?? null,
    refusal,
  });
}
