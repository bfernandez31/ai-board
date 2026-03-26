import { prisma } from '@/lib/db/client';
import type { QualityScoreDetails } from '@/lib/quality-score';
import type {
  ComparisonComplianceCell,
  ComparisonDashboardMetricCell,
  ComparisonDashboardMetricDirection,
  ComparisonDashboardMetricKey,
  ComparisonDashboardMetricRow,
  ComparisonDetail,
  ComparisonEnrichmentValue,
  ComparisonParticipantDetail,
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

const HEADLINE_METRIC_KEYS: ComparisonDashboardMetricKey[] = [
  'costUsd',
  'durationMs',
  'qualityScore',
  'filesChanged',
];

const DETAIL_METRIC_KEYS: ComparisonDashboardMetricKey[] = [
  'linesChanged',
  'filesChanged',
  'testFilesChanged',
  'totalTokens',
  'inputTokens',
  'outputTokens',
  'durationMs',
  'costUsd',
  'jobCount',
  'qualityScore',
];

const METRIC_LABELS: Record<ComparisonDashboardMetricKey, string> = {
  costUsd: 'Cost',
  durationMs: 'Duration',
  qualityScore: 'Quality Score',
  filesChanged: 'Files Changed',
  linesChanged: 'Lines Changed',
  testFilesChanged: 'Test Files Changed',
  totalTokens: 'Total Tokens',
  inputTokens: 'Input Tokens',
  outputTokens: 'Output Tokens',
  jobCount: 'Job Count',
};

const METRIC_DIRECTIONS: Record<
  ComparisonDashboardMetricKey,
  ComparisonDashboardMetricDirection
> = {
  costUsd: 'lowest',
  durationMs: 'lowest',
  qualityScore: 'highest',
  filesChanged: 'lowest',
  linesChanged: 'lowest',
  testFilesChanged: 'highest',
  totalTokens: 'lowest',
  inputTokens: 'lowest',
  outputTokens: 'lowest',
  jobCount: 'lowest',
};

function getComparisonRecordWhere(ticketId: number) {
  return {
    OR: [
      { participants: { some: { ticketId } } },
      { sourceTicketId: ticketId },
    ],
  };
}

function getScoreBand(score: number): ComparisonParticipantDetail['scoreBand'] {
  if (score >= 85) {
    return 'strong';
  }
  if (score >= 70) {
    return 'moderate';
  }
  if (score > 0) {
    return 'weak';
  }
  return 'neutral';
}

function formatMetricValue(
  key: ComparisonDashboardMetricKey,
  enrichment: ComparisonEnrichmentValue<number>
): string {
  if (enrichment.state === 'pending') {
    return 'Pending';
  }
  if (enrichment.state === 'unavailable' || enrichment.value == null) {
    return 'Unavailable';
  }

  if (key === 'costUsd') {
    return `$${enrichment.value.toFixed(2)}`;
  }

  if (key === 'durationMs') {
    const totalSeconds = Math.round(enrichment.value / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
  }

  return enrichment.value.toLocaleString();
}

function getMetricEnrichment(
  participant: ComparisonParticipantDetail,
  key: ComparisonDashboardMetricKey
): ComparisonEnrichmentValue<number> {
  if (key === 'qualityScore') {
    return participant.quality;
  }

  if (key in participant.telemetry) {
    return participant.telemetry[
      key as keyof ComparisonParticipantDetail['telemetry']
    ] as ComparisonEnrichmentValue<number>;
  }

  const metricValue = getSnapshotMetricValue(participant, key);

  return {
    state: metricValue == null ? 'unavailable' : 'available',
    value: metricValue,
  };
}

function getSnapshotMetricValue(
  participant: ComparisonParticipantDetail,
  key: ComparisonDashboardMetricKey
): number | null {
  switch (key) {
    case 'linesChanged':
      return participant.metrics.linesChanged;
    case 'filesChanged':
      return participant.metrics.filesChanged;
    case 'testFilesChanged':
      return participant.metrics.testFilesChanged;
    default:
      return null;
  }
}

function buildMetricRow(
  participants: ComparisonParticipantDetail[],
  winnerTicketId: number,
  key: ComparisonDashboardMetricKey,
  category: ComparisonDashboardMetricRow['category']
): ComparisonDashboardMetricRow {
  const bestDirection = METRIC_DIRECTIONS[key];
  const availableValues = participants
    .map((participant) => ({
      ticketId: participant.ticketId,
      enrichment: getMetricEnrichment(participant, key),
    }))
    .filter(
      (entry) =>
        entry.enrichment.state === 'available' && entry.enrichment.value != null
    );

  let bestValues = new Set<number>();

  if (availableValues.length > 0 && bestDirection !== 'none') {
    const numericValues = availableValues.map(
      (entry) => entry.enrichment.value!
    );
    const bestValue =
      bestDirection === 'highest'
        ? Math.max(...numericValues)
        : Math.min(...numericValues);

    bestValues = new Set(
      availableValues
        .filter((entry) => entry.enrichment.value === bestValue)
        .map((entry) => entry.ticketId)
    );
  }

  const cells: ComparisonDashboardMetricCell[] = participants.map(
    (participant) => {
      const enrichment = getMetricEnrichment(participant, key);

      return {
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: enrichment.state,
        value: enrichment.value,
        displayValue: formatMetricValue(key, enrichment),
        isBest:
          enrichment.state === 'available' &&
          enrichment.value != null &&
          bestValues.has(participant.ticketId),
        isWinner: participant.ticketId === winnerTicketId,
        supportsPopover: key === 'qualityScore',
      };
    }
  );

  return {
    key,
    label: METRIC_LABELS[key],
    category,
    bestDirection,
    cells,
  };
}

function normalizeHeadlineMetrics(
  participants: ComparisonParticipantDetail[],
  winnerTicketId: number
): ComparisonDashboardMetricRow[] {
  return HEADLINE_METRIC_KEYS.map((key) =>
    buildMetricRow(participants, winnerTicketId, key, 'headline')
  );
}

function normalizeMetricMatrix(
  participants: ComparisonParticipantDetail[],
  winnerTicketId: number
): ComparisonDashboardMetricRow[] {
  return DETAIL_METRIC_KEYS.map((key) =>
    buildMetricRow(participants, winnerTicketId, key, 'detail')
  );
}

function normalizeComplianceRows(
  rows: ComparisonDetail['complianceRows'],
  participants: ComparisonParticipantDetail[]
): ComparisonDetail['complianceRows'] {
  return rows.map((row) => {
    const assessments = participants.map((participant) => {
      const existing = row.assessments.find(
        (assessment) => assessment.participantTicketId === participant.ticketId
      );

      const missingAssessment: ComparisonComplianceCell = {
        participantTicketId: participant.ticketId,
        participantTicketKey: participant.ticketKey,
        status: 'missing',
        notes: 'No saved assessment for this participant.',
      };

      return existing ?? missingAssessment;
    });

    return {
      ...row,
      assessments,
    };
  });
}

function getDecisionVerdictLabel(
  verdictTicketId: number | null,
  winnerTicketId: number,
  winnerTicketKey: string
): string {
  if (verdictTicketId == null) {
    return 'No verdict';
  }

  if (verdictTicketId === winnerTicketId) {
    return `Supports ${winnerTicketKey}`;
  }

  return 'Diverges from winner';
}

function getDecisionVerdictAlignment(
  verdictTicketId: number | null,
  winnerTicketId: number
): ComparisonDetail['decisionPoints'][number]['verdictAlignment'] {
  if (verdictTicketId == null) {
    return 'neutral';
  }

  if (verdictTicketId === winnerTicketId) {
    return 'supports-winner';
  }

  return 'diverges-from-winner';
}

function normalizeDecisionVerdicts(
  decisionPoints: ComparisonDetail['decisionPoints'],
  winnerTicketId: number,
  winnerTicketKey: string
): ComparisonDetail['decisionPoints'] {
  return decisionPoints.map((point) => ({
    ...point,
    verdictLabel: getDecisionVerdictLabel(
      point.verdictTicketId,
      winnerTicketId,
      winnerTicketKey
    ),
    verdictAlignment: getDecisionVerdictAlignment(
      point.verdictTicketId,
      winnerTicketId
    ),
  }));
}

function normalizeDashboardDetail(detail: ComparisonDetail): ComparisonDetail {
  const participants = detail.participants.map((participant) => ({
    ...participant,
    isWinner: participant.ticketId === detail.winnerTicketId,
    scoreBand: getScoreBand(participant.score),
  }));
  const decisionPoints = normalizeDecisionVerdicts(
    detail.decisionPoints,
    detail.winnerTicketId,
    detail.winnerTicketKey
  );
  const complianceRows = normalizeComplianceRows(
    detail.complianceRows,
    participants
  );

  return {
    ...detail,
    participants,
    headlineMetrics: normalizeHeadlineMetrics(
      participants,
      detail.winnerTicketId
    ),
    metricMatrix: normalizeMetricMatrix(participants, detail.winnerTicketId),
    decisionPoints,
    complianceRows,
  };
}

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
      where: getComparisonRecordWhere(ticketId),
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
      where: getComparisonRecordWhere(ticketId),
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
    where: getComparisonRecordWhere(ticketId),
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
): ComparisonEnrichmentValue<number> {
  if (latestVerifyJob?.qualityScore != null) {
    return createAvailableEnrichment(latestVerifyJob.qualityScore);
  }

  if (hasVerifyJob) {
    return createPendingEnrichment<number>();
  }

  return createUnavailableEnrichment<number>();
}

function deriveQualityBreakdown(
  latestVerifyJob: {
    qualityScore: number | null;
    qualityScoreDetails: string | null;
  } | null,
  hasVerifyJob: boolean
): ComparisonEnrichmentValue<QualityScoreDetails> {
  if (latestVerifyJob?.qualityScoreDetails) {
    try {
      const parsed = JSON.parse(
        latestVerifyJob.qualityScoreDetails
      ) as QualityScoreDetails;
      if (parsed.dimensions && parsed.threshold) {
        return createAvailableEnrichment(parsed);
      }
    } catch {
      // Fall through to unavailable
    }
  }

  if (hasVerifyJob && latestVerifyJob?.qualityScore != null) {
    return createPendingEnrichment<QualityScoreDetails>();
  }

  return createUnavailableEnrichment<QualityScoreDetails>();
}

export async function getComparisonDetailForTicket(
  ticketId: number,
  comparisonId: number
): Promise<ComparisonDetail | null> {
  const record = await prisma.comparisonRecord.findFirst({
    where: {
      id: comparisonId,
      ...getComparisonRecordWhere(ticketId),
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

  const participantIds = record.participants.map(
    (participant) => participant.ticketId
  );
  const [completedJobs, inProgressJobs, latestVerifyJobs, complianceRows] =
    await Promise.all([
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

  const aggregatedTelemetry = aggregateJobTelemetry(completedJobs);
  const inProgressTicketIds = new Set(
    inProgressJobs.map((job) => job.ticketId)
  );
  const latestVerifyJobByTicketId = new Map(
    latestVerifyJobs.map((job) => [job.ticketId, job])
  );
  const verifyJobTicketIds = new Set(
    latestVerifyJobs.map((job) => job.ticketId)
  );

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

  return normalizeDashboardDetail(
    buildComparisonDetail({
      record,
      participants,
      decisionPoints: normalizeDecisionPoints(record.decisionPoints).sort(
        (a, b) => a.displayOrder - b.displayOrder
      ),
      complianceRows: [...groupedCompliance.values()].sort(
        (a, b) => a.displayOrder - b.displayOrder
      ),
    })
  );
}
