import { countEligibleUnanalyzedSessions } from '@/app/lib/insights/predicate';
import {
  getLastCompletedRunEnd,
  getRunningReport,
} from '@/app/lib/insights/repository';

export interface PreflightSnapshot {
  canTrigger: boolean;
  eligibleSessionsSincePreviousRun: number;
  previousRunEnd: string | null;
  runningSince: string | null;
  refusal: {
    refusalCode: 'NO_CLAUDE_SESSIONS' | 'NO_NEW_SESSIONS' | 'ALREADY_RUNNING';
    message: string;
  } | null;
}

/**
 * Shared preflight computation used by both the SSR page render and the
 * `/api/admin/insights/preflight` polling endpoint. Co-locating the logic
 * prevents the two surfaces from drifting on refusal phrasing or branch
 * semantics — the UI consumes the same shape regardless of source.
 *
 * AIB-856 (D-7, FR-012): the gate counts **eligible-unanalyzed sessions**
 * (marker anti-join) rather than newly-shipped tickets. `previousRunEnd` is
 * retained for display only (last COMPLETED run's `periodEnd`).
 */
export async function computePreflightSnapshot(): Promise<PreflightSnapshot> {
  const prevEnd = await getLastCompletedRunEnd();
  const eligibleSessions = await countEligibleUnanalyzedSessions();
  const running = await getRunningReport();

  let refusal: PreflightSnapshot['refusal'] = null;
  if (running) {
    refusal = {
      refusalCode: 'ALREADY_RUNNING',
      message: `Already running since ${running.createdAt.toISOString()}`,
    };
  } else if (eligibleSessions === 0) {
    if (prevEnd === null) {
      refusal = {
        refusalCode: 'NO_CLAUDE_SESSIONS',
        message: 'No Claude sessions to analyze yet',
      };
    } else {
      refusal = {
        refusalCode: 'NO_NEW_SESSIONS',
        message: `No new sessions since last run on ${prevEnd.toISOString()}`,
      };
    }
  }

  return {
    canTrigger: refusal === null,
    eligibleSessionsSincePreviousRun: eligibleSessions,
    previousRunEnd: prevEnd?.toISOString() ?? null,
    runningSince: running?.createdAt.toISOString() ?? null,
    refusal,
  };
}
