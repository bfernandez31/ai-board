import { countShippedClaudeTicketsSince } from '@/app/lib/insights/predicate';
import {
  getLastCompletedRunEnd,
  getRunningReport,
} from '@/app/lib/insights/repository';

export interface PreflightSnapshot {
  canTrigger: boolean;
  shippedSincePreviousRun: number;
  previousRunEnd: string | null;
  runningSince: string | null;
  refusal: {
    refusalCode: 'NO_CLAUDE_JOBS' | 'NO_NEW_SHIPPED' | 'ALREADY_RUNNING';
    message: string;
  } | null;
}

/**
 * Shared preflight computation used by both the SSR page render and the
 * `/api/admin/insights/preflight` polling endpoint. Co-locating the logic
 * prevents the two surfaces from drifting on refusal phrasing or branch
 * semantics — the UI consumes the same shape regardless of source.
 */
export async function computePreflightSnapshot(): Promise<PreflightSnapshot> {
  const prevEnd = await getLastCompletedRunEnd();
  const shippedSince = await countShippedClaudeTicketsSince(prevEnd);
  const running = await getRunningReport();

  let refusal: PreflightSnapshot['refusal'] = null;
  if (running) {
    refusal = {
      refusalCode: 'ALREADY_RUNNING',
      message: `Already running since ${running.createdAt.toISOString()}`,
    };
  } else if (shippedSince === 0) {
    if (prevEnd === null) {
      refusal = {
        refusalCode: 'NO_CLAUDE_JOBS',
        message: 'No shipped Claude tickets to analyze yet',
      };
    } else {
      refusal = {
        refusalCode: 'NO_NEW_SHIPPED',
        message: `No new shipped tickets since last run on ${prevEnd.toISOString()}`,
      };
    }
  }

  return {
    canTrigger: refusal === null,
    shippedSincePreviousRun: shippedSince,
    previousRunEnd: prevEnd?.toISOString() ?? null,
    runningSince: running?.createdAt.toISOString() ?? null,
    refusal,
  };
}
