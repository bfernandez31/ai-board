import { prisma } from '@/lib/db/client';
import type { QualityScoreDetails } from '@/lib/quality-score';
import type {
  ComparisonDetail,
  ComparisonEnrichmentValue,
  ComparisonSummary,
} from '@/lib/types/comparison';
import {
  aggregateJobTelemetry,
  buildComparisonDetail,
  createAvailableEnrichment,
  createPendingEnrichment,
  createUnavailableEnrichment,
  normalizeDecisionPoints,
  normalizeParticipantDetail,
  normalizeTelemetryEnrichment,
  toComparisonHistorySummary,
} from './comparison-record';

export async function listTicketComparisons(
  ticketId: number,
  limit: number
): Promise<{
  comparisons: ComparisonSummary[];
  total: number;
  limit: number;
}> {
  const [records, total] = await prisma.$transaction([
    prisma.comparisonRecord.findMany({
      where: {
        OR: [{ participants: { some: { ticketId } } }, { sourceTicketId: ticketId }],
      },
      orderBy: {
        generatedAt: 'desc',
      },
      take: limit,
      include: {
        sourceTicket: {
          select: {
            ticketKey: true,
          },
        },
        winnerTicket: {
          select: {
            ticketKey: true,
          },
        },
        participants: {
          orderBy: {
            rank: 'asc',
          },
          include: {
            ticket: {
              select: {
                ticketKey: true,
              },
            },
          },
        },
      },
    }),
    prisma.comparisonRecord.count({
      where: {
        OR: [{ participants: { some: { ticketId } } }, { sourceTicketId: ticketId }],
      },
    }),
  ]);

  return {
    comparisons: records.map(toComparisonHistorySummary),
    total,
    limit,
  };
}

export async function getTicketComparisonCheck(ticketId: number): Promise<{
  hasComparisons: boolean;
  count: number;
  latestComparisonId: number | null;
}> {
  const records = await prisma.comparisonRecord.findMany({
    where: {
      OR: [{ participants: { some: { ticketId } } }, { sourceTicketId: ticketId }],
    },
    select: {
      id: true,
      generatedAt: true,
    },
    orderBy: {
      generatedAt: 'desc',
    },
  });

  return {
    hasComparisons: records.length > 0,
    count: records.length,
    latestComparisonId: records.at(0)?.id ?? null,
  };
}

export function deriveQualityState(
  latestVerifyJob: { qualityScore: number | null } | null,
  hasVerifyJob: boolean
): ComparisonEnrichmentValue<number> {
  if (latestVerifyJob?.qualityScore != null) {
    return createAvailableEnrichment(latestVerifyJob.qualityScore);
  }

  if (hasVerifyJob) {
    return createPendingEnrichment<number>();
  }

  return createUnavailableEnrichment<number>();
}

export function deriveQualityBreakdown(
  latestVerifyJob: {
    qualityScore: number | null;
    qualityScoreDetails: string | null;
  } | null,
  hasVerifyJob: boolean
): ComparisonEnrichmentValue<QualityScoreDetails> {
  if (latestVerifyJob?.qualityScoreDetails) {
    try {
      const parsed = JSON.parse(latestVerifyJob.qualityScoreDetails) as QualityScoreDetails;
      if (parsed.dimensions && parsed.threshold) {
        return createAvailableEnrichment(parsed);
      }
    } catch {
      // Ignore malformed historical quality details.
    }
  }

  if (hasVerifyJob && latestVerifyJob?.qualityScore != null) {
    return createPendingEnrichment<QualityScoreDetails>();
  }

  return createUnavailableEnrichment<QualityScoreDetails>();
}

async function getComparisonDetailByWhere(where: {
  id: number;
  projectId?: number;
  OR?: Array<{ participants: { some: { ticketId: number } } } | { sourceTicketId: number }>;
}): Promise<ComparisonDetail | null> {
  const record = await prisma.comparisonRecord.findFirst({
    where,
    include: {
      sourceTicket: {
        select: {
          ticketKey: true,
        },
      },
      winnerTicket: {
        select: {
          ticketKey: true,
        },
      },
      participants: {
        orderBy: {
          rank: 'asc',
        },
        include: {
          metricSnapshot: true,
          ticket: {
            select: {
              id: true,
              ticketKey: true,
              title: true,
              stage: true,
            },
          },
        },
      },
      decisionPoints: {
        orderBy: {
          displayOrder: 'asc',
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  const participantIds = record.participants.map((participant) => participant.ticketId);
  const [completedJobs, inProgressJobs, latestVerifyJobs, complianceRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        ticketId: { in: participantIds },
        status: 'COMPLETED',
      },
      select: {
        ticketId: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        costUsd: true,
        model: true,
      },
    }),
    prisma.job.findMany({
      where: {
        ticketId: { in: participantIds },
        status: { in: ['PENDING', 'RUNNING'] },
      },
      select: {
        ticketId: true,
      },
    }),
    prisma.job.findMany({
      where: {
        ticketId: { in: participantIds },
        command: 'verify',
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      distinct: ['ticketId'],
      select: {
        ticketId: true,
        qualityScore: true,
        qualityScoreDetails: true,
      },
    }),
    prisma.complianceAssessment.findMany({
      where: {
        comparisonParticipant: {
          comparisonRecordId: record.id,
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { principleName: 'asc' }],
      include: {
        comparisonParticipant: {
          select: {
            ticketId: true,
            ticket: {
              select: {
                ticketKey: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const aggregatedTelemetry = aggregateJobTelemetry(completedJobs);
  const inProgressTicketIds = new Set(inProgressJobs.map((job) => job.ticketId));
  const latestVerifyJobByTicketId = new Map(
    latestVerifyJobs.map((job) => [job.ticketId, job] as const)
  );
  const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));

  const participants = record.participants.map((participant) =>
    normalizeParticipantDetail({
      participant,
      quality: deriveQualityState(
        latestVerifyJobByTicketId.get(participant.ticketId) ?? null,
        verifyJobTicketIds.has(participant.ticketId)
      ),
      qualityBreakdown: deriveQualityBreakdown(
        latestVerifyJobByTicketId.get(participant.ticketId) ?? null,
        verifyJobTicketIds.has(participant.ticketId)
      ),
      telemetry: normalizeTelemetryEnrichment(
        aggregatedTelemetry.get(participant.ticketId) ?? null,
        inProgressTicketIds.has(participant.ticketId)
      ),
    })
  );

  const groupedCompliance = new Map<
    string,
    {
      principleKey: string;
      principleName: string;
      displayOrder: number;
      assessments: ComparisonDetail['complianceRows'][number]['assessments'];
    }
  >();

  for (const row of complianceRows) {
    const existing = groupedCompliance.get(row.principleKey);
    const assessment = {
      participantTicketId: row.comparisonParticipant.ticketId,
      participantTicketKey: row.comparisonParticipant.ticket.ticketKey,
      status: row.status as 'pass' | 'mixed' | 'fail',
      notes: row.notes,
    };

    if (existing) {
      existing.assessments.push(assessment);
      continue;
    }

    groupedCompliance.set(row.principleKey, {
      principleKey: row.principleKey,
      principleName: row.principleName,
      displayOrder: row.displayOrder,
      assessments: [assessment],
    });
  }

  return buildComparisonDetail({
    record,
    participants,
    decisionPoints: normalizeDecisionPoints(record.decisionPoints).sort(
      (a, b) => a.displayOrder - b.displayOrder
    ),
    complianceRows: [...groupedCompliance.values()].sort(
      (a, b) => a.displayOrder - b.displayOrder
    ),
  });
}

export async function getComparisonDetailForTicket(
  ticketId: number,
  comparisonId: number
): Promise<ComparisonDetail | null> {
  return getComparisonDetailByWhere({
    id: comparisonId,
    OR: [{ participants: { some: { ticketId } } }, { sourceTicketId: ticketId }],
  });
}

export async function getComparisonDetailForProject(
  projectId: number,
  comparisonId: number
): Promise<ComparisonDetail | null> {
  return getComparisonDetailByWhere({
    id: comparisonId,
    projectId,
  });
}
