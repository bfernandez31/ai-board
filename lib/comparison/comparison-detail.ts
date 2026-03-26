import { prisma } from '@/lib/db/client';
import type { ComparisonDetail, ComparisonSummary } from '@/lib/types/comparison';
import {
  buildComparisonDetail,
  createAvailableEnrichment,
  createPendingEnrichment,
  createUnavailableEnrichment,
  normalizeQualityDetailsEnrichment,
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
        status: true,
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

  const jobsByTicketId = new Map<
    number,
    Array<{
      ticketId: number;
      status: string;
      inputTokens: number | null;
      outputTokens: number | null;
      durationMs: number | null;
      costUsd: number | null;
      model: string | null;
    }>
  >();

  for (const job of allJobs) {
    const jobs = jobsByTicketId.get(job.ticketId) ?? [];
    jobs.push(job);
    jobsByTicketId.set(job.ticketId, jobs);
  }

  const latestVerifyJobByTicketId = new Map(
    latestVerifyJobs.map((job) => [job.ticketId, job])
  );
  const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));

  function sumField(
    jobs: Array<{
      inputTokens: number | null;
      outputTokens: number | null;
      durationMs: number | null;
      costUsd: number | null;
    }>,
    field: 'inputTokens' | 'outputTokens' | 'durationMs' | 'costUsd'
  ): number | null {
    const withValues = jobs.filter((job) => job[field] != null);
    if (withValues.length === 0) {
      return null;
    }

    return withValues.reduce((sum, job) => sum + (job[field] ?? 0), 0);
  }

  function aggregateModel(
    jobs: Array<{
      model: string | null;
    }>
  ): string | null {
    const modelCounts = new Map<string, number>();

    for (const job of jobs) {
      if (!job.model) {
        continue;
      }

      modelCounts.set(job.model, (modelCounts.get(job.model) ?? 0) + 1);
    }

    let selectedModel: string | null = null;
    let selectedCount = 0;
    for (const [model, count] of modelCounts.entries()) {
      if (count > selectedCount) {
        selectedModel = model;
        selectedCount = count;
      }
    }

    return selectedModel;
  }

  const participants = record.participants.map((participant) =>
    {
      const jobs = jobsByTicketId.get(participant.ticketId) ?? [];
      const inputTokens = sumField(jobs, 'inputTokens');
      const outputTokens = sumField(jobs, 'outputTokens');
      const durationMs = sumField(jobs, 'durationMs');
      const costUsd = sumField(jobs, 'costUsd');
      const totalTokens =
        inputTokens != null || outputTokens != null
          ? (inputTokens ?? 0) + (outputTokens ?? 0)
          : null;

      return normalizeParticipantDetail({
        participant,
        quality: deriveQualityState(
          latestVerifyJobByTicketId.get(participant.ticketId) ?? null,
          verifyJobTicketIds.has(participant.ticketId)
        ),
        qualityDetails: normalizeQualityDetailsEnrichment({
          qualityScoreDetails:
            latestVerifyJobByTicketId.get(participant.ticketId)?.qualityScoreDetails ?? null,
          workflowType: participant.workflowTypeAtComparison,
          stage: participant.ticket.stage,
        }),
        telemetry: normalizeTelemetryEnrichment(
          jobs.length > 0
            ? {
                inputTokens,
                outputTokens,
                durationMs,
                costUsd,
                totalTokens,
                jobCount: jobs.length,
                model: aggregateModel(jobs),
              }
            : null
        ),
      });
    }
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
    decisionPoints: normalizeDecisionPoints(record.decisionPoints),
    complianceRows: [...groupedCompliance.values()].sort(
      (a, b) => a.displayOrder - b.displayOrder
    ),
  });
}
