import { Octokit } from '@octokit/rest';
import { Stage, JobStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { deleteBranchAndPRs } from '@/lib/github/delete-branch-and-prs';

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
  ticket: { id: number; projectId: number; stage: string; branch: string | null }
): Promise<DeleteTicketResult> {
  if (ticket.stage === Stage.SHIP) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Cannot delete SHIP stage tickets', code: 'INVALID_STAGE' },
    };
  }

  const hasActiveJob = await prisma.job.findFirst({
    where: {
      ticketId: ticket.id,
      status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
    },
  });

  if (hasActiveJob) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Cannot delete ticket while job is in progress', code: 'ACTIVE_JOB' },
    };
  }

  let prsClosed = 0;

  if (ticket.branch) {
    const project = await prisma.project.findUnique({
      where: { id: ticket.projectId },
      select: { githubOwner: true, githubRepo: true },
    });

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
