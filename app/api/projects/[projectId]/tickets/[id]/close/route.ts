import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { Stage } from '@/lib/stage-transitions';
import { closePRsForBranch } from '@/lib/github/close-prs';
import { Octokit } from '@octokit/rest';
import { isProjectLocked } from '@/lib/transition-lock';

/**
 * POST /api/projects/[projectId]/tickets/[id]/close
 *
 * Close a ticket from VERIFY stage, transitioning it to CLOSED terminal state.
 * Closes associated GitHub PRs but preserves the git branch.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId, id } = await params;
    const ticketId = parseInt(id, 10);
    const projId = parseInt(projectId, 10);

    if (isNaN(ticketId) || isNaN(projId)) {
      return NextResponse.json(
        { error: 'Invalid ticket or project ID' },
        { status: 400 }
      );
    }

    // Authorization - verifies user has access to ticket
    await verifyTicketAccess(ticketId);

    // Check cleanup lock
    const lockActive = await isProjectLocked(projId);
    if (lockActive) {
      return NextResponse.json(
        {
          error: 'Project cleanup is in progress. Please wait for it to complete.',
          code: 'CLEANUP_LOCKED',
        },
        { status: 423 }
      );
    }

    // Get ticket with project and jobs
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        project: true,
        jobs: {
          where: { status: { in: ['PENDING', 'RUNNING'] } },
          take: 1,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Validate stage
    if (ticket.stage !== Stage.VERIFY) {
      return NextResponse.json(
        { error: 'Can only close tickets in VERIFY stage', code: 'INVALID_STAGE' },
        { status: 400 }
      );
    }

    // Check for active jobs
    if (ticket.jobs.length > 0) {
      return NextResponse.json(
        { error: 'Cannot close ticket with active jobs', code: 'ACTIVE_JOBS' },
        { status: 400 }
      );
    }

    // Close GitHub PRs (best-effort)
    let prsClosed = 0;
    if (ticket.branch && ticket.project.githubOwner && ticket.project.githubRepo) {
      try {
        const token = process.env.GITHUB_TOKEN;
        if (token) {
          const octokit = new Octokit({ auth: token });
          const result = await closePRsForBranch(
            octokit,
            ticket.project.githubOwner,
            ticket.project.githubRepo,
            ticket.branch,
            `Closed by ai-board - ticket ${ticket.ticketKey} moved to CLOSED state`
          );
          prsClosed = result.prsClosed;
        }
      } catch (error) {
        console.error('GitHub PR close failed (non-blocking):', error);
        // Continue with local transition even if GitHub fails
      }
    }

    // Update ticket to CLOSED
    const closedTicket = await prisma.ticket.update({
      where: { id: ticketId, version: ticket.version },
      data: {
        stage: Stage.CLOSED,
        closedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return NextResponse.json({
      id: closedTicket.id,
      ticketKey: ticket.ticketKey,
      stage: closedTicket.stage,
      closedAt: closedTicket.closedAt?.toISOString(),
      version: closedTicket.version,
      prsClosed,
    });
  } catch (error: unknown) {
    // Handle Prisma version conflict
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        {
          error: 'Ticket was modified by another user. Please refresh and try again.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 }
      );
    }

    // Handle authorization errors
    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.error('Close ticket error:', error);
    return NextResponse.json(
      { error: 'Failed to close ticket' },
      { status: 500 }
    );
  }
}
