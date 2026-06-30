import {
  countAnalyzableClaudeSessions,
  countExpectedClaudeSessions,
} from '@/app/lib/insights/predicate';
import {
  getLastCompletedRunEnd,
  getRunningReport,
} from '@/app/lib/insights/repository';

export interface PreflightSnapshot {
  canTrigger: boolean;
  /** AIB-852: uncovered Claude sessions with a fetchable transcript. */
  analyzableSessions: number;
  /** AIB-852: in-scope sessions incl. those whose transcript isn't available. */
  expectedSessions: number;
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
 * AIB-852: the gate is keyed on **sessions** (FR-015) from the same predicate
 * the workflow enumerates (FR-016/SC-006). A period with only
 * transcript-pending sessions (analyzable === 0) cannot be analyzed yet.
 */
export async function computePreflightSnapshot(): Promise<PreflightSnapshot> {
  const prevEnd = await getLastCompletedRunEnd();
  const analyzableSessions = await countAnalyzableClaudeSessions();
  const expectedSessions = await countExpectedClaudeSessions();
  const running = await getRunningReport();

  let refusal: PreflightSnapshot['refusal'] = null;
  if (running) {
    refusal = {
      refusalCode: 'ALREADY_RUNNING',
      message: `Already running since ${running.createdAt.toISOString()}`,
    };
  } else if (analyzableSessions === 0) {
    if (prevEnd === null) {
      refusal = {
        refusalCode: 'NO_CLAUDE_SESSIONS',
        message: 'No analyzable Claude sessions to analyze yet',
      };
    } else {
      refusal = {
        refusalCode: 'NO_NEW_SESSIONS',
        message: `No new Claude sessions since last run on ${prevEnd.toISOString()}`,
      };
    }
  }

  return {
    canTrigger: refusal === null,
    analyzableSessions,
    expectedSessions,
    previousRunEnd: prevEnd?.toISOString() ?? null,
    runningSince: running?.createdAt.toISOString() ?? null,
    refusal,
  };
}
