/**
 * End-to-end ticket-outcome capture.
 *
 * Orchestrates: read ticket jobs → fetch diff (if branch known) → compute →
 * upsert. Idempotent: if an outcome row already exists for the ticket, the
 * call is a no-op (we never recompute past outcomes — they are snapshots).
 */

import type { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';
import { buildOutcome } from './compute';
import { computeJobSignals } from './jobs';
import { fetchTicketDiff } from './diff';
import type { ComputedOutcome, ProjectConfigLike } from './types';

export interface CaptureOutcomeOptions {
  /** Force recompute even if a row already exists (used by debug/testing). */
  force?: boolean;
  /** Optional shared Octokit (used by backfill to share rate-limit budget). */
  octokit?: Octokit;
}

export interface CaptureOutcomeResult {
  status: 'created' | 'skipped_existing' | 'ticket_not_shipped' | 'ticket_not_found';
  outcome?: ComputedOutcome;
  outcomeId?: number;
}

/**
 * Compute and persist the outcome for a single ticket.
 *
 * Designed to never throw on infrastructure failure (missing GitHub token,
 * deleted branch, rate limit) — those become `hasCommitData: false` rows
 * rather than blocking the SHIP transition. Real exceptions (DB errors,
 * Prisma validation) still propagate.
 */
export async function captureOutcomeForTicket(
  ticketId: number,
  options: CaptureOutcomeOptions = {}
): Promise<CaptureOutcomeResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      project: true,
      jobs: {
        // Older→newer is what computeJobSignals expects (it reads in reverse
        // to find the most recent verify quality score).
        orderBy: { startedAt: 'asc' },
      },
      outcome: true,
    },
  });

  if (!ticket) return { status: 'ticket_not_found' };
  if (ticket.stage !== 'SHIP') return { status: 'ticket_not_shipped' };
  if (ticket.outcome && !options.force) {
    return { status: 'skipped_existing', outcomeId: ticket.outcome.id };
  }

  const jobSignals = computeJobSignals({ jobs: ticket.jobs });

  // Diff fetch is best-effort: missing branch / token / network → null.
  const diff = ticket.branch
    ? await fetchTicketDiff({
        owner: ticket.project.githubOwner,
        repo: ticket.project.githubRepo,
        base: ticket.project.defaultBranch,
        head: ticket.branch,
        ...(options.octokit ? { octokit: options.octokit } : {}),
      })
    : null;

  const outcome = buildOutcome({
    jobSignals,
    diff,
    projectConfig: (ticket.project.config ?? null) as ProjectConfigLike | null,
  });

  // Upsert handles the force=true case (overwrite) without changing the
  // append-only contract for normal capture (which short-circuits above).
  const persisted = await prisma.ticketOutcome.upsert({
    where: { ticketId: ticket.id },
    create: {
      ticketId: ticket.id,
      projectId: ticket.projectId,
      ...outcome,
    },
    update: {
      ...outcome,
      computedAt: new Date(),
    },
    select: { id: true },
  });

  return { status: 'created', outcome, outcomeId: persisted.id };
}
