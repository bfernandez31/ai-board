import { prisma } from '@/lib/db/client';

/**
 * Single source of truth for "which Claude agent sessions should Insights
 * analyze?" (AIB-852, supersedes the AIB-791 shipped-ticket predicate).
 *
 * AIB-852 reworks selection in three ways:
 *   1. Decoupled from SHIP — selection joins `Job → Ticket → Project`
 *      directly, NOT through `TicketOutcome`. In-progress / abandoned /
 *      rolled-back tickets are now in scope (D2, FR-008).
 *   2. Every captured session — no per-ticket dedup. A ticket with an
 *      implement + iterate + verify session contributes all three (FR-001/2).
 *   3. Coverage-driven — a session is "already analyzed" iff an
 *      `InsightsSessionCoverage` row exists for its job (D1, FR-004/6),
 *      replacing the single global `periodEnd` cursor.
 *
 * The effective-agent rule (P2, FR-009) is:
 *     effectiveAgent = ticket.agent ?? project.defaultAgent ?? 'CLAUDE'
 * A session is "Claude" iff this resolves to 'CLAUDE'.
 *
 * Every count/enumeration export funnels through the single private
 * `querySessionRows` so the pre-flight count cannot drift from the workflow's
 * enumeration (P1, FR-016, SC-006).
 */

export interface JobRef {
  jobId: number;
  projectId: number;
  ticketId: number;
  rawArtifactKey: string;
}

/**
 * Half-open selection window. Both bounds optional:
 *   - `end === null` → no upper bound (pre-flight unbounded probe)
 *   - `start === null` → no lower bound
 * Bounds are applied to a session's *completion* timestamp (see
 * `completionOf`). The lower bound is only honored for explicit re-analysis
 * (`ignoreCoverage`); fresh selection relies on the coverage marker plus the
 * half-open upper bound for exactly-once placement (D7).
 */
export interface SessionWindow {
  start: Date | null;
  end: Date | null;
}

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;

interface SessionRow {
  jobId: number;
  projectId: number;
  ticketId: number;
  completion: Date;
  /** capture was attempted and the raw transcript is fetchable */
  analyzable: boolean;
  rawArtifactKey: string | null;
}

/**
 * A session's completion instant for window placement: `completedAt`, falling
 * back to `updatedAt` then `startedAt` for legacy terminal rows where
 * `completedAt` is null (D3). `startedAt` is always set.
 */
export function completionOf(job: {
  completedAt: Date | null;
  updatedAt: Date;
  startedAt: Date;
}): Date {
  return job.completedAt ?? job.updatedAt ?? job.startedAt;
}

function isClaude(ticketAgent: string | null, projectDefaultAgent: string | null): boolean {
  const effective = ticketAgent ?? projectDefaultAgent ?? 'CLAUDE';
  return effective === 'CLAUDE';
}

/**
 * The one inner query. Loads every terminal Claude session belonging to a
 * ticket that has a `JobLog` row (capture was attempted), applies the
 * effective-agent rule and window bounds in JS (the completion fallback chain
 * cannot be expressed in a single Prisma `where`), and reports per-row whether
 * the raw transcript is actually fetchable (`analyzable`).
 *
 * `ignoreCoverage`:
 *   - false (fresh, default): exclude sessions that already have a coverage
 *     row; honor only the half-open upper bound (`completion < end`). The
 *     lower bound is NOT applied — correctness comes from the coverage marker,
 *     so a gap session that was uncovered in an earlier run is re-picked up
 *     regardless of when it completed (FR-010, D7).
 *   - true (explicit re-analysis): include covered sessions and honor the
 *     full `[start, end)` window (D8, FR-006 exception).
 */
async function querySessionRows(
  window: SessionWindow,
  ignoreCoverage: boolean
): Promise<SessionRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      status: { in: [...TERMINAL_STATUSES] },
      ticketId: { not: null },
      log: { isNot: null },
      ...(ignoreCoverage ? {} : { insightsCoverage: { is: null } }),
    },
    select: {
      id: true,
      projectId: true,
      ticketId: true,
      completedAt: true,
      updatedAt: true,
      startedAt: true,
      ticket: {
        select: {
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
      log: { select: { captureStatus: true, rawArtifactKey: true } },
    },
  });

  const rows: SessionRow[] = [];
  for (const job of jobs) {
    if (job.ticketId === null || !job.ticket || !job.log) continue;
    if (!isClaude(job.ticket.agent, job.ticket.project.defaultAgent)) continue;

    const completion = completionOf(job);
    if (window.end !== null && completion >= window.end) continue;
    if (ignoreCoverage && window.start !== null && completion < window.start) {
      continue;
    }

    const analyzable =
      job.log.captureStatus === 'CAPTURED' && job.log.rawArtifactKey !== null;

    rows.push({
      jobId: job.id,
      projectId: job.projectId,
      ticketId: job.ticketId,
      completion,
      analyzable,
      rawArtifactKey: job.log.rawArtifactKey,
    });
  }
  return rows;
}

/**
 * Count of analyzable (transcript-present, uncovered) Claude sessions. Drives
 * the pre-flight gate (`analyzableSessions > 0`) and the workflow's
 * reconciliation count. With no window this counts every uncovered analyzable
 * session (periodEnd === now means all terminal sessions qualify).
 */
export async function countAnalyzableClaudeSessions(
  window: SessionWindow = { start: null, end: null }
): Promise<number> {
  const rows = await querySessionRows(window, false);
  return rows.filter((r) => r.analyzable).length;
}

/**
 * Count of *expected* Claude sessions = uncovered terminal sessions with a
 * `JobLog` row, INCLUDING those whose transcript is not (yet) fetchable
 * (FR-011). `expectedSessions >= analyzableSessions` always.
 */
export async function countExpectedClaudeSessions(
  window: SessionWindow = { start: null, end: null }
): Promise<number> {
  const rows = await querySessionRows(window, false);
  return rows.length;
}

/**
 * Every analyzable Claude session in the window (multiple per ticket allowed,
 * no SHIP filter, no project filter). Used by the workflow's `/jobs`
 * enumeration so the analyzer sees exactly the same set the pre-flight
 * counted (FR-001/2/16). Pass `{ ignoreCoverage: true }` for explicit
 * re-analysis of a chosen window (D8).
 */
export async function listAnalyzableClaudeSessions(
  window: SessionWindow,
  opts: { ignoreCoverage?: boolean } = {}
): Promise<JobRef[]> {
  const rows = await querySessionRows(window, opts.ignoreCoverage ?? false);
  return rows
    .filter((r) => r.analyzable && r.rawArtifactKey !== null)
    .map((r) => ({
      jobId: r.jobId,
      projectId: r.projectId,
      ticketId: r.ticketId,
      rawArtifactKey: r.rawArtifactKey as string,
    }));
}

/**
 * Earliest completion across all terminal Claude sessions with a `JobLog`
 * row — the timestamp of the oldest available Claude Code session. Used as
 * the first-run `periodStart` floor (FR-014) when no coverage exists yet.
 * Ignores the coverage marker so the floor reflects the whole corpus.
 */
export async function getEarliestClaudeSessionCompletion(): Promise<Date | null> {
  const rows = await querySessionRows({ start: null, end: null }, true);
  let earliest: Date | null = null;
  for (const row of rows) {
    if (earliest === null || row.completion < earliest) {
      earliest = row.completion;
    }
  }
  return earliest;
}
