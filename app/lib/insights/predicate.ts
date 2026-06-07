import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * Single source of truth for "is this Job a Claude agent session worth
 * analyzing?" (AIB-856, D-3/D-5/P-2).
 *
 * A session is **eligible** iff:
 *   - `status = 'COMPLETED'`
 *   - `ticketId != null`        — excludes the insights-analyze jobs themselves
 *   - `log.rawArtifactKey != null` — the native transcript is fetchable (FR-009)
 *   - effective agent resolves to `'CLAUDE'`
 *
 * The effective-agent rule mirrors the production predicate already used at
 * `app/api/jobs/[id]/logs/raw-artifact/route.ts`:
 *     effectiveAgent = ticket.agent ?? ticket.project.defaultAgent ?? 'CLAUDE'
 *
 * Eligibility is **decoupled from `TicketOutcome` / shippedAt** entirely
 * (D-3, FR-007): shipped, in-progress, failed, abandoned and rolled-back
 * tickets all contribute their sessions. There is **no earliest-per-ticket
 * dedup** (FR-002/FR-003) — every eligible session of every ticket across all
 * projects is selected.
 *
 * Coverage is tracked by the per-session marker `InsightsAnalyzedSession`
 * (absence = not yet analyzed). The `unanalyzed` toggle adds the
 * `insightsAnalyzedSession: null` anti-join so a session is only ever offered
 * to one run (D-2, P-3).
 *
 * `countEligibleUnanalyzedSessions`, `listEligibleUnanalyzedSessions`, and
 * `getEarliestEligibleSessionTimestamp` all derive from the same private
 * `queryEligibleSessions` query so the pre-flight count cannot drift from the
 * workflow's enumeration — the AIB-787-class regression the spec forbids
 * (P-2, SC).
 */

export interface JobRef {
  jobId: number;
  projectId: number;
  ticketId: number;
  rawArtifactKey: string;
}

interface RawJobRow {
  jobId: number;
  projectId: number;
  ticketId: number;
  ticketAgent: string | null;
  projectDefaultAgent: string | null;
  jobStartedAt: Date;
  rawArtifactKey: string;
}

interface QueryEligibleOptions {
  /** When true, exclude sessions that already have an `InsightsAnalyzedSession`
   *  marker (eligible-unanalyzed). When false, return all eligible sessions
   *  regardless of marker (used only for diagnostics/parity). */
  unanalyzed?: boolean;
  /** Restrict to this set of job ids (marker-poisoning defense, P-4). */
  jobIds?: number[];
}

/**
 * Inner query loading every eligible Claude session, in ascending
 * `startedAt` order (deterministic enumeration). Applies the eligibility
 * predicate at the database layer and resolves the effective-agent rule in
 * memory from the included agent fields.
 */
async function queryEligibleSessions(
  opts: QueryEligibleOptions = {}
): Promise<RawJobRow[]> {
  const where: Prisma.JobWhereInput = {
    status: 'COMPLETED',
    ticketId: { not: null },
    log: { rawArtifactKey: { not: null } },
  };
  if (opts.unanalyzed) {
    where.insightsAnalyzedSession = null;
  }
  if (opts.jobIds) {
    where.id = { in: opts.jobIds };
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      projectId: true,
      ticketId: true,
      startedAt: true,
      log: { select: { rawArtifactKey: true } },
      ticket: {
        select: {
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
    },
  });

  const result: RawJobRow[] = [];
  for (const job of jobs) {
    if (job.ticketId === null || !job.ticket) continue;
    if (!job.log?.rawArtifactKey) continue;
    result.push({
      jobId: job.id,
      projectId: job.projectId,
      ticketId: job.ticketId,
      ticketAgent: job.ticket.agent ?? null,
      projectDefaultAgent: job.ticket.project.defaultAgent ?? null,
      jobStartedAt: job.startedAt,
      rawArtifactKey: job.log.rawArtifactKey,
    });
  }

  return result;
}

function isClaudeRow(row: RawJobRow): boolean {
  const effective = row.ticketAgent ?? row.projectDefaultAgent ?? 'CLAUDE';
  return effective === 'CLAUDE';
}

/**
 * Count of eligible-unanalyzed Claude sessions across all tickets and all
 * projects. Used by the trigger endpoint's pre-flight gate and the
 * `/preflight` UI endpoint.
 */
export async function countEligibleUnanalyzedSessions(): Promise<number> {
  const rows = await queryEligibleSessions({ unanalyzed: true });
  return rows.filter(isClaudeRow).length;
}

/**
 * List of every eligible-unanalyzed Claude session across all tickets and all
 * projects, in ascending `startedAt` order. Used by the insights workflow's
 * enumeration step. **No earliest-per-ticket dedup** (FR-002/FR-003) — a
 * ticket with five sessions contributes all five.
 */
export async function listEligibleUnanalyzedSessions(): Promise<JobRef[]> {
  const rows = await queryEligibleSessions({ unanalyzed: true });
  return rows.filter(isClaudeRow).map((row) => ({
    jobId: row.jobId,
    projectId: row.projectId,
    ticketId: row.ticketId,
    rawArtifactKey: row.rawArtifactKey,
  }));
}

/**
 * Filter a caller-supplied set of job ids down to those that are **currently
 * eligible Claude sessions** (COMPLETED + ticketId + rawArtifactKey +
 * effective-agent CLAUDE). Marker-poisoning defense in depth (P-4): a
 * buggy/compromised workflow must not be able to mark an arbitrary job as
 * analyzed and thereby exclude it from all future runs. Returns the subset
 * (deterministic ascending `startedAt` order).
 */
export async function filterEligibleClaudeSessionIds(
  jobIds: number[]
): Promise<number[]> {
  if (jobIds.length === 0) return [];
  const rows = await queryEligibleSessions({ jobIds });
  return rows.filter(isClaudeRow).map((row) => row.jobId);
}

/**
 * Earliest `Job.startedAt` across eligible-unanalyzed Claude sessions — the
 * timestamp of the oldest available session. Used by the trigger endpoint as
 * the display-only first-run `periodStart` (D-5). Rows are already sorted
 * ascending, so the first Claude row is the earliest.
 */
export async function getEarliestEligibleSessionTimestamp(): Promise<Date | null> {
  const rows = await queryEligibleSessions({ unanalyzed: true });
  const first = rows.find(isClaudeRow);
  return first?.jobStartedAt ?? null;
}
