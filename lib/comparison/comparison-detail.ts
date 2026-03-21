import { prisma } from '@/lib/db/client';
import { parseQualityScoreDetails } from '@/lib/quality-score';
import type { ComparisonDetail, ComparisonSummary } from '@/lib/types/comparison';
import {
  type AggregatedTelemetryInput,
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
        OR: [
          { participants: { some: { ticketId } } },
          { sourceTicketId: ticketId },
        ],
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
        OR: [
          { participants: { some: { ticketId } } },
          { sourceTicketId: ticketId },
        ],
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
      OR: [
        { participants: { some: { ticketId } } },
        { sourceTicketId: ticketId },
      ],
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

function deriveQualityState(
  latestVerifyJob: { qualityScore: number | null } | null,
  hasVerifyJob: boolean
): ReturnType<typeof createAvailableEnrichment<number>> {
  if (latestVerifyJob?.qualityScore != null) {
    return createAvailableEnrichment(latestVerifyJob.qualityScore);
  }

  if (hasVerifyJob) {
    return createPendingEnrichment<number>();
  }

  return createUnavailableEnrichment<number>();
}

export async function getComparisonDetailForTicket(
  ticketId: number,
  comparisonId: number
): Promise<ComparisonDetail | null> {
  const record = await prisma.comparisonRecord.findFirst({
    where: {
      id: comparisonId,
      OR: [
        { participants: { some: { ticketId } } },
        { sourceTicketId: ticketId },
      ],
    },
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
  const [allJobs, latestVerifyJobs, complianceRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        ticketId: {
          in: participantIds,
        },
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
        ticketId: {
          in: participantIds,
        },
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
          comparisonRecordId: comparisonId,
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

  // Aggregate telemetry across all jobs per ticket
  const aggregatedTelemetryByTicketId = new Map<number, AggregatedTelemetryInput>();
  for (const job of allJobs) {
    const existing = aggregatedTelemetryByTicketId.get(job.ticketId);
    if (!existing) {
      aggregatedTelemetryByTicketId.set(job.ticketId, {
        inputTokens: job.inputTokens,
        outputTokens: job.outputTokens,
        durationMs: job.durationMs,
        costUsd: job.costUsd,
        jobCount: 1,
        model: job.model,
      });
      continue;
    }
    existing.inputTokens =
      existing.inputTokens != null || job.inputTokens != null
        ? (existing.inputTokens ?? 0) + (job.inputTokens ?? 0)
        : null;
    existing.outputTokens =
      existing.outputTokens != null || job.outputTokens != null
        ? (existing.outputTokens ?? 0) + (job.outputTokens ?? 0)
        : null;
    existing.durationMs =
      existing.durationMs != null || job.durationMs != null
        ? (existing.durationMs ?? 0) + (job.durationMs ?? 0)
        : null;
    existing.costUsd =
      existing.costUsd != null || job.costUsd != null
        ? (existing.costUsd ?? 0) + (job.costUsd ?? 0)
        : null;
    existing.jobCount += 1;
    // Keep the model from the first job (most common pattern)
    if (!existing.model && job.model) {
      existing.model = job.model;
    }
  }

  const latestVerifyJobByTicketId = new Map(
    latestVerifyJobs.map((job) => [job.ticketId, job])
  );
  const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));

  const participants = record.participants.map((participant) => {
    const verifyJob = latestVerifyJobByTicketId.get(participant.ticketId) ?? null;
    const qualityDetails = verifyJob?.qualityScoreDetails
      ? parseQualityScoreDetails(verifyJob.qualityScoreDetails)
      : null;

    return normalizeParticipantDetail({
      participant,
      quality: deriveQualityState(
        verifyJob,
        verifyJobTicketIds.has(participant.ticketId)
      ),
      qualityDetails: qualityDetails
        ? createAvailableEnrichment(qualityDetails)
        : verifyJobTicketIds.has(participant.ticketId)
          ? createPendingEnrichment()
          : createUnavailableEnrichment(),
      telemetry: normalizeTelemetryEnrichment(
        aggregatedTelemetryByTicketId.get(participant.ticketId) ?? null
      ),
    });
  });

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
    decisionPoints: normalizeDecisionPoints(record.decisionPoints),
    complianceRows: [...groupedCompliance.values()].sort(
      (a, b) => a.displayOrder - b.displayOrder
    ),
  });
}
