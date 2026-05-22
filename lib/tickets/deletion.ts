import { Octokit } from '@octokit/rest';
import { Stage, JobStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { deleteBranchAndPRs } from '@/lib/github/delete-branch-and-prs';

export interface BulkDeleteResult {
  results: {
    succeeded: Array<{ ticketId: number; ticketKey: string }>;
    skipped: Array<{ ticketId: number; ticketKey: string; reason: string }>;
  };
  summary: { total: number; succeeded: number; skipped: number };
}

export async function bulkDeleteInboxTickets(
  projectId: number,
  ticketIds: number[]
): Promise<BulkDeleteResult> {
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ticketIds }, projectId, stage: Stage.INBOX },
    select: { id: true, ticketKey: true },
  });

  const foundIds = new Set(tickets.map((t) => t.id));
  const skipped: BulkDeleteResult['results']['skipped'] = [];

  for (const id of ticketIds) {
    if (!foundIds.has(id)) {
      skipped.push({ ticketId: id, ticketKey: `unknown-${id}`, reason: 'Ticket not found or not in INBOX' });
    }
  }

  const activeJobs = await prisma.job.findMany({
    where: {
      ticketId: { in: tickets.map((t) => t.id) },
      status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
    },
    select: { ticketId: true, status: true },
  });
  const activeJobByTicketId = new Map<number, JobStatus>();
  for (const job of activeJobs) {
    if (job.ticketId == null) continue;
    if (!activeJobByTicketId.has(job.ticketId)) {
      activeJobByTicketId.set(job.ticketId, job.status);
    }
  }

  const deletable: Array<{ ticketId: number; ticketKey: string }> = [];
  for (const ticket of tickets) {
    const status = activeJobByTicketId.get(ticket.id);
    if (status) {
      skipped.push({
        ticketId: ticket.id,
        ticketKey: ticket.ticketKey,
        reason: `Ticket has an active job (${status})`,
      });
    } else {
      deletable.push({ ticketId: ticket.id, ticketKey: ticket.ticketKey });
    }
  }

  if (deletable.length > 0) {
    // Constrain by projectId + stage so a ticket that leaves INBOX (or the
    // project) between the findMany above and this delete is no longer
    // eligible — protects against races where a concurrent transition would
    // otherwise still see its row deleted.
    await prisma.ticket.deleteMany({
      where: {
        id: { in: deletable.map((d) => d.ticketId) },
        projectId,
        stage: Stage.INBOX,
      },
    });
  }

  return {
    results: { succeeded: deletable, skipped },
    summary: { total: ticketIds.length, succeeded: deletable.length, skipped: skipped.length },
  };
}

/** Discriminated result for deleteTicketWithCleanup. */
export type DeleteTicketResult =
  | { ok: true; prsClosed: number }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Delete a ticket, enforcing stage/active-job constraints and cleaning up
 * the GitHub branch + associated PRs when the ticket has a branch.
 *
 * Rules:
 *  - SHIP tickets cannot be deleted
 *  - Tickets with PENDING/RUNNING jobs cannot be deleted
 *  - When ticket.branch is set: requires GITHUB_TOKEN + project GitHub config;
 *    calls deleteBranchAndPRs and surfaces failures as 500 GITHUB_API_ERROR
 */
export async function deleteTicketWithCleanup(
  ticket: { id: number; projectId: number; stage: Stage; branch: string | null }
): Promise<DeleteTicketResult> {
  if (ticket.stage === Stage.SHIP) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Cannot delete SHIP stage tickets', code: 'INVALID_STAGE' },
    };
  }

  const [hasActiveJob, project] = await Promise.all([
    prisma.job.findFirst({
      where: {
        ticketId: ticket.id,
        status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
      },
    }),
    ticket.branch
      ? prisma.project.findUnique({
          where: { id: ticket.projectId },
          select: { githubOwner: true, githubRepo: true },
        })
      : Promise.resolve(null),
  ]);

  if (hasActiveJob) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Cannot delete ticket while job is in progress', code: 'ACTIVE_JOB' },
    };
  }

  let prsClosed = 0;

  if (ticket.branch) {
    if (!project) {
      return {
        ok: false,
        status: 404,
        body: { error: 'Project not found', code: 'NOT_FOUND' },
      };
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return {
        ok: false,
        status: 500,
        body: { error: 'GitHub integration not configured', code: 'GITHUB_CONFIG_ERROR' },
      };
    }

    const octokit = new Octokit({ auth: githubToken });

    try {
      const result = await deleteBranchAndPRs(
        octokit,
        project.githubOwner,
        project.githubRepo,
        ticket.branch
      );
      prsClosed = result.prsClosed;
    } catch (error) {
      console.error('GitHub cleanup failed:', error);
      return {
        ok: false,
        status: 500,
        body: {
          error: 'Failed to delete GitHub artifacts. Please try again.',
          code: 'GITHUB_API_ERROR',
          details: {
            operation: 'delete_branch_and_prs',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      };
    }
  }

  await prisma.ticket.delete({ where: { id: ticket.id } });

  return { ok: true, prsClosed };
}
