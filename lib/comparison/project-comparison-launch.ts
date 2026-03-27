import type { Agent, Ticket } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import { formatMention } from '@/app/lib/utils/mention-parser';
import { dispatchAIBoardWorkflow } from '@/app/lib/workflows/dispatch-ai-board';
import type { ComparisonLaunchRequest } from '@/lib/types/comparison';

type LaunchTicket = Pick<
  Ticket,
  'id' | 'ticketKey' | 'title' | 'branch' | 'projectId' | 'stage' | 'agent' | 'updatedAt'
> & {
  project: {
    githubOwner: string;
    githubRepo: string;
    defaultAgent: Agent | null;
  };
};

export function getDeterministicSourceTicket<T extends { updatedAt: Date; id: number }>(
  tickets: T[]
): T {
  return [...tickets].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id - b.id
  )[0]!;
}

export async function buildComparisonLaunchComment(
  selectedTickets: Array<{ id: number; ticketKey: string; updatedAt: Date }>
): Promise<{
  sourceTicketId: number;
  sourceTicketKey: string;
  orderedTicketIds: number[];
  orderedTicketKeys: string[];
  commentContent: string;
}> {
  const aiBoardUserId = await getAIBoardUserId();
  const sourceTicket = getDeterministicSourceTicket(selectedTickets);
  const orderedTickets = [sourceTicket].concat(
    selectedTickets
      .filter((ticket) => ticket.id !== sourceTicket.id)
      .sort((a, b) => a.ticketKey.localeCompare(b.ticketKey))
  );
  const compareTargets = orderedTickets
    .filter((ticket) => ticket.id !== sourceTicket.id)
    .map((ticket) => `#${ticket.ticketKey}`)
    .join(' ');

  return {
    sourceTicketId: sourceTicket.id,
    sourceTicketKey: sourceTicket.ticketKey,
    orderedTicketIds: orderedTickets.map((ticket) => ticket.id),
    orderedTicketKeys: orderedTickets.map((ticket) => ticket.ticketKey),
    commentContent: `${formatMention(aiBoardUserId, 'AI-BOARD')} ${compareTargets ? `/compare ${compareTargets}` : '/compare'}`,
  };
}

export async function createProjectComparisonLaunch(input: {
  projectId: number;
  userId: string;
  userName: string;
  selectedTickets: LaunchTicket[];
}): Promise<ComparisonLaunchRequest> {
  const { projectId, userId, userName, selectedTickets } = input;
  const launchComment = await buildComparisonLaunchComment(selectedTickets);
  const sourceTicket = selectedTickets.find(
    (ticket) => ticket.id === launchComment.sourceTicketId
  );

  if (!sourceTicket) {
    throw new Error('SOURCE_TICKET_NOT_FOUND');
  }

  const { comment, job } = await prisma.$transaction(async (tx) => {
    const existingJob = await tx.job.findFirst({
      where: {
        ticketId: sourceTicket.id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      select: { id: true },
    });

    if (existingJob) {
      throw new Error('ACTIVE_JOB_EXISTS');
    }

    const comment = await tx.comment.create({
      data: {
        ticketId: sourceTicket.id,
        userId,
        content: launchComment.commentContent,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const job = await tx.job.create({
      data: {
        ticketId: sourceTicket.id,
        projectId,
        command: 'comment-verify',
        status: 'PENDING',
        branch: sourceTicket.branch,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
      },
    });

    return { comment, job };
  });

  await dispatchAIBoardWorkflow({
    ticket_id: sourceTicket.id.toString(),
    stage: 'verify',
    branch: sourceTicket.branch ?? '',
    user_id: userId,
    user: userName,
    comment: launchComment.commentContent,
    job_id: job.id.toString(),
    project_id: projectId.toString(),
    githubRepository: `${sourceTicket.project.githubOwner}/${sourceTicket.project.githubRepo}`,
    agent: sourceTicket.agent ?? sourceTicket.project.defaultAgent ?? 'CLAUDE',
  });

  return {
    jobId: job.id,
    commentId: comment.id,
    projectId,
    sourceTicketId: sourceTicket.id,
    sourceTicketKey: sourceTicket.ticketKey,
    selectedTicketIds: launchComment.orderedTicketIds,
    selectedTicketKeys: launchComment.orderedTicketKeys,
    status: job.status,
    commentContent: launchComment.commentContent,
    createdAt: comment.createdAt.toISOString(),
  };
}
