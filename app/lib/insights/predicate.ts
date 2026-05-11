import { prisma } from '@/lib/db/client';
import { buildJobLogRawArtifactKey } from '@/app/lib/logs/artifact-key';

/**
 * Single source of truth for "is this Job a Claude session worth analyzing?"
 * (AIB-791, D-6, D-7, FR-010, FR-025).
 *
 * The effective-agent rule mirrors the production predicate already used at
 * `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-62`:
 *     effectiveAgent = ticket.agent ?? ticket.project.defaultAgent ?? 'CLAUDE'
 * A job is "Claude" iff this resolves to 'CLAUDE'.
 *
 * Both exported functions (`countShippedClaudeTicketsSince` and
 * `listShippedClaudeJobsForWindow`) call the same private query so the
 * pre-flight count cannot drift from the workflow's enumeration — exactly
 * the AIB-787-class regression the spec forbids (FR-025, SC-006).
 *
 * "Shipped" is determined by `TicketOutcome.shippedAt`, the canonical
 * audit-row for ticket SHIP transitions.
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
  shippedAt: Date;
}

/**
 * Inner query that loads every Job belonging to a Ticket whose SHIP outcome
 * falls inside the requested window, with the agent fields needed to apply
 * the effective-agent predicate.
 *
 * Window semantics:
 *   - `start === null` → no lower bound (used by first-ever pre-flight)
 *   - half-open: shippedAt >= start, shippedAt < end (or no upper bound when
 *     end === null — used by pre-flight's "since X" probe)
 */
async function queryShippedJobs(
  start: Date | null,
  end: Date | null
): Promise<RawJobRow[]> {
  const shippedAtFilter: { gte?: Date; lt?: Date } = {};
  if (start !== null) shippedAtFilter.gte = start;
  if (end !== null) shippedAtFilter.lt = end;

  const outcomes = await prisma.ticketOutcome.findMany({
    where:
      Object.keys(shippedAtFilter).length > 0
        ? { shippedAt: shippedAtFilter }
        : {},
    select: {
      ticketId: true,
      projectId: true,
      shippedAt: true,
      ticket: {
        select: {
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
    },
  });

  if (outcomes.length === 0) return [];

  const ticketIds = outcomes.map((o) => o.ticketId);
  const jobs = await prisma.job.findMany({
    where: {
      ticketId: { in: ticketIds },
      status: 'COMPLETED',
    },
    select: {
      id: true,
      projectId: true,
      ticketId: true,
    },
  });

  const outcomeByTicket = new Map(outcomes.map((o) => [o.ticketId, o]));

  const result: RawJobRow[] = [];
  for (const job of jobs) {
    if (job.ticketId === null) continue;
    const outcome = outcomeByTicket.get(job.ticketId);
    if (!outcome) continue;
    result.push({
      jobId: job.id,
      projectId: job.projectId,
      ticketId: job.ticketId,
      ticketAgent: outcome.ticket.agent ?? null,
      projectDefaultAgent: outcome.ticket.project.defaultAgent ?? null,
      shippedAt: outcome.shippedAt,
    });
  }

  return result;
}

function isClaudeRow(row: RawJobRow): boolean {
  const effective =
    row.ticketAgent ?? row.projectDefaultAgent ?? 'CLAUDE';
  return effective === 'CLAUDE';
}

/**
 * Distinct count of Claude-agent tickets that shipped strictly AFTER
 * `since` (half-open: shippedAt > since when since is non-null; no lower
 * bound otherwise). Used by the trigger endpoint's pre-flight gate and the
 * `/preflight` UI endpoint.
 *
 * Note: the period semantic in `data-model.md` is "[prevEnd, now)". When
 * `since` is the previous run's `periodEnd`, this counts new ships since
 * that boundary (half-open: gte).
 */
export async function countShippedClaudeTicketsSince(
  since: Date | null
): Promise<number> {
  const rows = await queryShippedJobs(since, null);
  const claudeTicketIds = new Set<number>();
  for (const row of rows) {
    if (isClaudeRow(row)) claudeTicketIds.add(row.ticketId);
  }
  return claudeTicketIds.size;
}

/**
 * List of Claude Jobs whose Ticket shipped in [start, end). Used by the
 * insights workflow's enumeration step (T052) so the analyzer sees exactly
 * the same set of sessions the pre-flight counted.
 */
export async function listShippedClaudeJobsForWindow(
  start: Date,
  end: Date
): Promise<JobRef[]> {
  const rows = await queryShippedJobs(start, end);
  return rows.filter(isClaudeRow).map((row) => ({
    jobId: row.jobId,
    projectId: row.projectId,
    ticketId: row.ticketId,
    rawArtifactKey: buildJobLogRawArtifactKey(
      row.projectId,
      row.ticketId,
      row.jobId
    ),
  }));
}

/**
 * Timestamp of the oldest Claude Job ever recorded. Used by the trigger
 * endpoint as the first-run `periodStart` floor.
 */
export async function getEarliestClaudeJobTimestamp(): Promise<Date | null> {
  const rows = await queryShippedJobs(null, null);
  const claudeRows = rows.filter(isClaudeRow);
  const first = claudeRows[0];
  if (!first) return null;
  let earliest = first.shippedAt;
  for (const row of claudeRows) {
    if (row.shippedAt < earliest) earliest = row.shippedAt;
  }
  return earliest;
}
