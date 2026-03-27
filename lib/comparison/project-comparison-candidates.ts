import { prisma } from '@/lib/db/client';
import type { VerifyComparisonCandidate } from '@/lib/types/comparison';
import {
  createAvailableEnrichment,
  createPendingEnrichment,
  createUnavailableEnrichment,
} from './comparison-record';

export function normalizeCandidateQualityScore(
  latestVerifyJob: { qualityScore: number | null } | null,
  hasVerifyJob: boolean
) {
  if (latestVerifyJob?.qualityScore != null) {
    return createAvailableEnrichment(latestVerifyJob.qualityScore);
  }

  if (hasVerifyJob) {
    return createPendingEnrichment<number>();
  }

  return createUnavailableEnrichment<number>();
}

export async function listProjectComparisonCandidates(
  projectId: number
): Promise<VerifyComparisonCandidate[]> {
  const [tickets, latestVerifyJobs] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        projectId,
        stage: 'VERIFY',
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        ticketKey: true,
        title: true,
        stage: true,
        updatedAt: true,
        branch: true,
      },
    }),
    prisma.job.findMany({
      where: {
        projectId,
        command: 'verify',
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }, { id: 'desc' }],
      distinct: ['ticketId'],
      select: {
        ticketId: true,
        qualityScore: true,
      },
    }),
  ]);

  const latestVerifyJobByTicketId = new Map(
    latestVerifyJobs.map((job) => [job.ticketId, job] as const)
  );
  const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));

  return tickets.map((ticket) => ({
    id: ticket.id,
    ticketKey: ticket.ticketKey,
    title: ticket.title,
    stage: 'VERIFY',
    updatedAt: ticket.updatedAt.toISOString(),
    branch: ticket.branch,
    qualityScore: normalizeCandidateQualityScore(
      latestVerifyJobByTicketId.get(ticket.id) ?? null,
      verifyJobTicketIds.has(ticket.id)
    ),
  }));
}
