/**
 * Backfill ticket outcomes for historical shipped tickets.
 *
 * Idempotent and resumable: each ticket is captured via captureOutcomeForTicket
 * which short-circuits when a row already exists. Safe to re-run while the
 * system serves live traffic.
 *
 * Rate limiting: a small delay between GitHub-touching captures keeps us well
 * under the 5000 req/hr authenticated quota. Tickets without a branch don't
 * call GitHub at all.
 */

import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';
import { captureOutcomeForTicket } from './capture';

const DEFAULT_DELAY_MS = 200;

export interface BackfillResult {
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
  failures: Array<{ ticketId: number; error: string }>;
}

export interface BackfillOptions {
  /** Process at most N tickets (useful for chunked runs). */
  limit?: number;
  /** Sleep between GitHub-touching captures, in ms. Defaults to 200ms. */
  delayMs?: number;
  /** Optional shared Octokit (otherwise uses GITHUB_TOKEN). */
  octokit?: Octokit;
}

function buildSharedOctokit(provided?: Octokit): Octokit | undefined {
  if (provided) return provided;
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.includes('test') || token.includes('placeholder')) return undefined;
  return new Octokit({ auth: token });
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfill outcomes for all shipped tickets in a project that don't yet have
 * one. Returns a summary suitable for direct API response.
 */
export async function backfillProjectOutcomes(
  projectId: number,
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const sharedOctokit = buildSharedOctokit(options.octokit);

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId,
      stage: 'SHIP',
      outcome: { is: null },
    },
    select: { id: true, branch: true },
    orderBy: { id: 'asc' },
    ...(options.limit ? { take: options.limit } : {}),
  });

  const result: BackfillResult = {
    scanned: tickets.length,
    created: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const ticket of tickets) {
    try {
      const captureResult = await captureOutcomeForTicket(ticket.id, {
        ...(sharedOctokit ? { octokit: sharedOctokit } : {}),
      });
      if (captureResult.status === 'created') result.created += 1;
      else result.skipped += 1;
    } catch (error) {
      result.failed += 1;
      result.failures.push({
        ticketId: ticket.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    // Only sleep between calls that may have hit GitHub.
    if (ticket.branch) await sleep(delayMs);
  }

  return result;
}
