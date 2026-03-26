import { prisma } from '@/lib/db/client';
import type {
  ComparisonDetail,
  ComparisonSummary,
  QualityScoreBreakdown,
  QualityScoreDimension,
} from '@/lib/types/comparison';
import {
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
  latestVerifyJob: { qualityScore: number | null; qualityScoreDetails: string | null } | null,
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

export function getQualityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Acceptable';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor';
}

function parseQualityScoreDetails(
  latestVerifyJob: { qualityScore: number | null; qualityScoreDetails: string | null } | null,
  hasVerifyJob: boolean
): ReturnType<typeof createAvailableEnrichment<QualityScoreBreakdown>> {
  if (!latestVerifyJob?.qualityScore || !latestVerifyJob.qualityScoreDetails) {
    return hasVerifyJob
      ? createPendingEnrichment<QualityScoreBreakdown>()
      : createUnavailableEnrichment<QualityScoreBreakdown>();
  }

  try {
    const parsed = JSON.parse(latestVerifyJob.qualityScoreDetails) as {
      dimensions?: Array<{ name?: string; score?: number; weight?: number }>;
      label?: string;
    };
    const dimensions: QualityScoreDimension[] = (parsed.dimensions ?? [])
      .filter(
        (d): d is { name: string; score: number; weight: number } =>
          typeof d.name === 'string' &&
          typeof d.score === 'number' &&
          typeof d.weight === 'number'
      )
      .map((d) => ({ name: d.name, score: d.score, weight: d.weight }));

    const breakdown: QualityScoreBreakdown = {
      overall: latestVerifyJob.qualityScore,
      label: typeof parsed.label === 'string' ? parsed.label : getQualityLabel(latestVerifyJob.qualityScore),
      dimensions,
    };

    return createAvailableEnrichment(breakdown);
  } catch {
    return createAvailableEnrichment<QualityScoreBreakdown>({
      overall: latestVerifyJob.qualityScore,
      label: getQualityLabel(latestVerifyJob.qualityScore),
      dimensions: [],
    });
  }
}

interface AggregatedJobTelemetry {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number;
  jobCount: number;
  model: string | null;
  hasData: boolean;
}

function aggregateJobsForTicket(
  jobs: Array<{
    ticketId: number;
    inputTokens: number | null;
    outputTokens: number | null;
    durationMs: number | null;
    costUsd: number | null;
    model: string | null;
  }>
): AggregatedJobTelemetry {
  if (jobs.length === 0) {
    return { inputTokens: 0, outputTokens: 0, durationMs: 0, costUsd: 0, jobCount: 0, model: null, hasData: false };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let durationMs = 0;
  let costUsd = 0;
  const modelCounts = new Map<string, number>();

  for (const job of jobs) {
    inputTokens += job.inputTokens ?? 0;
    outputTokens += job.outputTokens ?? 0;
    durationMs += job.durationMs ?? 0;
    costUsd += job.costUsd ?? 0;
    if (job.model) {
      modelCounts.set(job.model, (modelCounts.get(job.model) ?? 0) + 1);
    }
  }

  let primaryModel: string | null = null;
  let maxCount = 0;
  for (const [model, count] of modelCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryModel = model;
    }
  }

  const hasData = inputTokens > 0 || outputTokens > 0 || costUsd > 0 || durationMs > 0;

  return { inputTokens, outputTokens, durationMs, costUsd, jobCount: jobs.length, model: primaryModel, hasData };
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

  const jobsByTicketId = new Map<number, typeof allJobs>();
  for (const job of allJobs) {
    const existing = jobsByTicketId.get(job.ticketId);
    if (existing) {
      existing.push(job);
    } else {
      jobsByTicketId.set(job.ticketId, [job]);
    }
  }

  const latestVerifyJobByTicketId = new Map(
    latestVerifyJobs.map((job) => [job.ticketId, job])
  );
  const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));

  const participants = record.participants.map((participant) => {
    const ticketJobs = jobsByTicketId.get(participant.ticketId) ?? [];
    const verifyJob = latestVerifyJobByTicketId.get(participant.ticketId) ?? null;

    return normalizeParticipantDetail({
      participant,
      quality: deriveQualityState(
        verifyJob,
        verifyJobTicketIds.has(participant.ticketId)
      ),
      qualityDetails: parseQualityScoreDetails(
        verifyJob,
        verifyJobTicketIds.has(participant.ticketId)
      ),
      telemetry: normalizeTelemetryEnrichment(
        aggregateJobsForTicket(ticketJobs)
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
