import type {
  Agent,
  Prisma,
  Stage,
  WorkflowType,
} from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { QualityScoreDetails } from '@/lib/quality-score';
import type {
  ComparisonDecisionPoint,
  ComparisonDetail,
  ComparisonEnrichmentValue,
  ComparisonMetricSnapshot,
  ComparisonParticipantDetail,
  ComparisonReport,
  ComparisonSummary,
  ComparisonTelemetryEnrichment,
} from '@/lib/types/comparison';

type PersistableTicket = {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;
  workflowType: WorkflowType;
  agent: Agent | null;
};

type PersistComparisonInput = {
  projectId: number;
  sourceTicket: PersistableTicket;
  participants: PersistableTicket[];
  compareRunKey?: string | null;
  markdownPath: string;
  report: ComparisonReport;
};

const DEFAULT_PRINCIPLES = [
  'TypeScript-First Development',
  'Component-Driven Architecture',
  'Test-Driven Development',
  'Security-First Design',
  'Database Integrity',
  'AI-First Development Model',
] as const;

const comparisonRecordInclude = {
  participants: {
    include: {
      metricSnapshot: true,
      complianceAssessments: true,
      ticket: true,
    },
  },
  decisionPoints: true,
} satisfies Prisma.ComparisonRecordInclude;

function getWinnerTicketKey(report: ComparisonReport): string {
  const complianceScores = Object.entries(report.compliance).sort(
    (a, b) => b[1].overall - a[1].overall
  );
  if (complianceScores[0]) {
    return complianceScores[0][0];
  }

  const metricsScores = Object.values(report.implementation)
    .filter((metric) => metric.hasData)
    .sort((a, b) => b.linesChanged - a.linesChanged);
  if (metricsScores[0]) {
    return metricsScores[0].ticketKey;
  }

  return report.metadata.comparedTickets[0] ?? report.metadata.sourceTicket;
}

function createPrincipleKey(principleName: string): string {
  return principleName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function buildRankings(report: ComparisonReport): Array<{
  ticketKey: string;
  rank: number;
  score: number;
  rankRationale: string;
}> {
  const sorted = report.metadata.comparedTickets
    .map((ticketKey) => {
      const compliance = report.compliance[ticketKey];
      const metrics = report.implementation[ticketKey];
      const score = compliance?.overall ?? (metrics?.hasData ? 50 : 0);
      const rankRationale =
        compliance?.principles
          ?.filter((principle) => principle.passed)
          .slice(0, 2)
          .map((principle) => principle.name)
          .join(', ') ||
        report.summary ||
        'Saved from comparison report';

      return { ticketKey, score, rankRationale };
    })
    .sort((a, b) => b.score - a.score || a.ticketKey.localeCompare(b.ticketKey));

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function buildBestValueFlags(metrics: ComparisonReport['implementation']): Record<string, Record<string, boolean>> {
  const entries = Object.values(metrics).filter((item) => item.hasData);
  if (entries.length === 0) {
    return Object.fromEntries(
      Object.values(metrics).map((item) => [
        item.ticketKey,
        {
          linesChanged: false,
          filesChanged: false,
          testFilesChanged: false,
        },
      ])
    );
  }

  const minima = {
    linesChanged: Math.min(...entries.map((item) => item.linesChanged)),
    filesChanged: Math.min(...entries.map((item) => item.filesChanged)),
    testFilesChanged: Math.max(...entries.map((item) => item.testFilesChanged)),
  };

  return Object.fromEntries(
    Object.values(metrics).map((item) => [
      item.ticketKey,
      {
        linesChanged: item.hasData && item.linesChanged === minima.linesChanged,
        filesChanged: item.hasData && item.filesChanged === minima.filesChanged,
        testFilesChanged:
          item.hasData && item.testFilesChanged === minima.testFilesChanged && minima.testFilesChanged > 0,
      },
    ])
  );
}

function buildDecisionPoints(
  report: ComparisonReport,
  ticketKeyToId: Map<string, number>
): Prisma.DecisionPointEvaluationUncheckedCreateWithoutComparisonRecordInput[] {
  const winnerTicketKey = getWinnerTicketKey(report);
  const differentiators = Array.isArray(report.alignment.matchingRequirements)
    ? report.alignment.matchingRequirements
    : [];

  const points = (differentiators.length > 0 ? differentiators : ['Overall recommendation']).map(
    (title, index) => ({
      title,
      verdictTicketId: ticketKeyToId.get(winnerTicketKey) ?? null,
      verdictSummary: report.recommendation || report.summary || 'See saved summary',
      rationale: report.summary || 'Derived from the saved comparison report.',
      participantApproaches: report.metadata.comparedTickets.map((ticketKey) => ({
        ticketId: ticketKeyToId.get(ticketKey),
        ticketKey,
        summary:
          report.implementation[ticketKey]?.hasData
            ? `${report.implementation[ticketKey]?.filesChanged ?? 0} files changed`
            : 'Metrics unavailable',
      })),
      displayOrder: index,
    })
  );

  return points;
}

function buildComplianceCreates(
  report: ComparisonReport,
  participantTicketKey: string
): Prisma.ComplianceAssessmentUncheckedCreateWithoutComparisonParticipantInput[] {
  const compliance = report.compliance[participantTicketKey];
  const principles =
    compliance?.principles.map((principle, index) => ({
      principleKey: createPrincipleKey(principle.name),
      principleName: principle.name,
      status: principle.passed ? 'pass' : 'fail',
      notes: principle.notes || 'No notes provided',
      displayOrder: index,
    })) ??
    DEFAULT_PRINCIPLES.map((principleName, index) => ({
      principleKey: createPrincipleKey(principleName),
      principleName,
      status: 'mixed',
      notes: 'No saved assessment for this principle.',
      displayOrder: index,
    }));

  return principles;
}

export function createComparisonRecordInput(
  input: PersistComparisonInput
): Prisma.ComparisonRecordCreateInput {
  const ticketKeyToTicket = new Map(
    input.participants.map((ticket) => [ticket.ticketKey, ticket] as const)
  );
  const rankings = buildRankings(input.report);
  const bestValueFlags = buildBestValueFlags(input.report.implementation);
  const winnerTicketKey = getWinnerTicketKey(input.report);
  const winnerTicket = ticketKeyToTicket.get(winnerTicketKey) ?? input.sourceTicket;

  return {
    project: { connect: { id: input.projectId } },
    sourceTicket: { connect: { id: input.sourceTicket.id } },
    winnerTicket: { connect: { id: winnerTicket.id } },
    compareRunKey: input.compareRunKey ?? null,
    markdownPath: input.markdownPath,
    summary: input.report.summary,
    overallRecommendation: input.report.recommendation || input.report.summary,
    keyDifferentiators: input.report.alignment.matchingRequirements,
    generatedAt: input.report.metadata.generatedAt,
    participants: {
      create: rankings.map((ranking) => {
        const ticket = ticketKeyToTicket.get(ranking.ticketKey);
        const metrics = input.report.implementation[ranking.ticketKey];

        if (!ticket) {
          throw new Error(`Comparison participant not found for ${ranking.ticketKey}`);
        }

        return {
          ticket: { connect: { id: ticket.id } },
          rank: ranking.rank,
          score: ranking.score,
          workflowTypeAtComparison: ticket.workflowType,
          agentAtComparison: ticket.agent,
          rankRationale: ranking.rankRationale,
          metricSnapshot: {
            create: {
              linesAdded: metrics?.hasData ? metrics.linesAdded : null,
              linesRemoved: metrics?.hasData ? metrics.linesRemoved : null,
              linesChanged: metrics?.hasData ? metrics.linesChanged : null,
              filesChanged: metrics?.hasData ? metrics.filesChanged : null,
              testFilesChanged: metrics?.hasData ? metrics.testFilesChanged : null,
              changedFiles: metrics?.changedFiles ?? [],
              bestValueFlags: bestValueFlags[ranking.ticketKey] ?? {},
            },
          },
          complianceAssessments: {
            create: buildComplianceCreates(input.report, ranking.ticketKey),
          },
        };
      }),
    },
    decisionPoints: {
      create: buildDecisionPoints(
        input.report,
        new Map(input.participants.map((ticket) => [ticket.ticketKey, ticket.id] as const))
      ),
    },
  };
}

export async function persistComparisonRecord(
  input: PersistComparisonInput
) {
  return prisma.$transaction(async (tx) => {
    if (input.compareRunKey) {
      const existingRecord = await tx.comparisonRecord.findFirst({
        where: {
          projectId: input.projectId,
          sourceTicketId: input.sourceTicket.id,
          compareRunKey: input.compareRunKey,
        },
        include: comparisonRecordInclude,
      });

      if (existingRecord) {
        return { record: existingRecord, isDuplicate: true };
      }
    }

    const recordInput = createComparisonRecordInput(input);
    const record = await tx.comparisonRecord.create({
      data: recordInput,
      include: comparisonRecordInclude,
    });
    return { record, isDuplicate: false };
  });
}

export function toComparisonHistorySummary(record: {
  id: number;
  generatedAt: Date;
  sourceTicket: { ticketKey: string };
  winnerTicket: { ticketKey: string };
  summary: string;
  overallRecommendation: string;
  participants: Array<{ ticket: { ticketKey: string } }>;
}): ComparisonSummary {
  return {
    id: record.id,
    generatedAt: record.generatedAt.toISOString(),
    sourceTicketKey: record.sourceTicket.ticketKey,
    participantTicketKeys: record.participants.map((participant) => participant.ticket.ticketKey),
    winnerTicketKey: record.winnerTicket.ticketKey,
    summary: record.summary,
    recommendation: record.overallRecommendation,
  };
}

export function createUnavailableEnrichment<T>(): ComparisonEnrichmentValue<T> {
  return {
    state: 'unavailable',
    value: null,
  };
}

export function createPendingEnrichment<T>(): ComparisonEnrichmentValue<T> {
  return {
    state: 'pending',
    value: null,
  };
}

export function createAvailableEnrichment<T>(value: T): ComparisonEnrichmentValue<T> {
  return {
    state: 'available',
    value,
  };
}

export function normalizeMetricSnapshot(
  snapshot: {
    linesAdded: number | null;
    linesRemoved: number | null;
    linesChanged: number | null;
    filesChanged: number | null;
    testFilesChanged: number | null;
    changedFiles: Prisma.JsonValue;
    bestValueFlags: Prisma.JsonValue;
  } | null
): ComparisonMetricSnapshot {
  const changedFiles = Array.isArray(snapshot?.changedFiles)
    ? snapshot.changedFiles.filter((value): value is string => typeof value === 'string')
    : [];
  const bestValueFlagsSource =
    snapshot?.bestValueFlags &&
    typeof snapshot.bestValueFlags === 'object' &&
    !Array.isArray(snapshot.bestValueFlags)
      ? snapshot.bestValueFlags
      : null;

  return {
    linesAdded: snapshot?.linesAdded ?? null,
    linesRemoved: snapshot?.linesRemoved ?? null,
    linesChanged: snapshot?.linesChanged ?? null,
    filesChanged: snapshot?.filesChanged ?? null,
    testFilesChanged: snapshot?.testFilesChanged ?? null,
    changedFiles,
    bestValueFlags: bestValueFlagsSource
      ? Object.fromEntries(
          Object.entries(bestValueFlagsSource).map(([key, value]) => [key, value === true])
        )
      : {},
  };
}

export function normalizeTelemetryEnrichment(
  aggregated: {
    _sum: {
      inputTokens: number | null;
      outputTokens: number | null;
      durationMs: number | null;
      costUsd: number | null;
    };
    _count: {
      id: number;
    };
  } | null,
  hasInProgress: boolean = false
): ComparisonTelemetryEnrichment {
  if (!aggregated) {
    return {
      inputTokens: createUnavailableEnrichment<number>(),
      outputTokens: createUnavailableEnrichment<number>(),
      totalTokens: createUnavailableEnrichment<number>(),
      durationMs: createUnavailableEnrichment<number>(),
      costUsd: createUnavailableEnrichment<number>(),
      jobCount: createUnavailableEnrichment<number>(),
      hasPartialData: hasInProgress,
    };
  }

  function createValue(value: number | null): ComparisonEnrichmentValue<number> {
    if (value == null) {
      return createPendingEnrichment<number>();
    }

    return createAvailableEnrichment(value);
  }

  const inputTokens = aggregated._sum.inputTokens;
  const outputTokens = aggregated._sum.outputTokens;
  const totalTokens =
    inputTokens != null && outputTokens != null
      ? inputTokens + outputTokens
      : null;

  return {
    inputTokens: createValue(inputTokens),
    outputTokens: createValue(outputTokens),
    totalTokens: createValue(totalTokens),
    durationMs: createValue(aggregated._sum.durationMs),
    costUsd: createValue(aggregated._sum.costUsd),
    jobCount: createAvailableEnrichment(aggregated._count.id),
    hasPartialData: hasInProgress,
  };
}

export function normalizeParticipantDetail(input: {
  participant: {
    ticketId: number;
    rank: number;
    score: number;
    rankRationale: string;
    agentAtComparison: Agent | null;
    workflowTypeAtComparison: WorkflowType;
    metricSnapshot: {
      linesAdded: number | null;
      linesRemoved: number | null;
      linesChanged: number | null;
      filesChanged: number | null;
      testFilesChanged: number | null;
      changedFiles: Prisma.JsonValue;
      bestValueFlags: Prisma.JsonValue;
    } | null;
    ticket: {
      ticketKey: string;
      title: string;
      stage: Stage;
    };
  };
  quality: ComparisonEnrichmentValue<number>;
  qualityScoreDetails?: QualityScoreDetails | null;
  telemetry: ComparisonTelemetryEnrichment;
  model?: string | null;
}): ComparisonParticipantDetail {
  return {
    ticketId: input.participant.ticketId,
    ticketKey: input.participant.ticket.ticketKey,
    title: input.participant.ticket.title,
    stage: input.participant.ticket.stage,
    workflowType: input.participant.workflowTypeAtComparison,
    agent: input.participant.agentAtComparison,
    rank: input.participant.rank,
    score: input.participant.score,
    rankRationale: input.participant.rankRationale,
    quality: input.quality,
    qualityScoreDetails: input.qualityScoreDetails ?? null,
    telemetry: input.telemetry,
    metrics: normalizeMetricSnapshot(input.participant.metricSnapshot),
    model: input.model ?? null,
  };
}

export function normalizeDecisionPoints(
  points: Array<{
    id: number;
    title: string;
    verdictTicketId: number | null;
    verdictSummary: string;
    rationale: string;
    displayOrder: number;
    participantApproaches: Prisma.JsonValue;
  }>
): ComparisonDecisionPoint[] {
  return points.map((point) => ({
    id: point.id,
    title: point.title,
    verdictTicketId: point.verdictTicketId,
    verdictSummary: point.verdictSummary,
    rationale: point.rationale,
    displayOrder: point.displayOrder,
    participantApproaches: Array.isArray(point.participantApproaches)
      ? point.participantApproaches.flatMap((approach) => {
          if (!approach || typeof approach !== 'object' || Array.isArray(approach)) {
            return [];
          }

          const ticketId =
            typeof approach.ticketId === 'number' ? approach.ticketId : null;
          const ticketKey =
            typeof approach.ticketKey === 'string' ? approach.ticketKey : null;
          const summary =
            typeof approach.summary === 'string' ? approach.summary : '';

          if (ticketId == null || ticketKey == null) {
            return [];
          }

          return [{ ticketId, ticketKey, summary }];
        })
      : [],
  }));
}

export function buildComparisonDetail(input: {
  record: {
    id: number;
    generatedAt: Date;
    sourceTicketId: number;
    markdownPath: string;
    summary: string;
    overallRecommendation: string;
    keyDifferentiators: Prisma.JsonValue;
    winnerTicketId: number;
    sourceTicket: { ticketKey: string };
    winnerTicket: { ticketKey: string };
  };
  participants: ComparisonParticipantDetail[];
  decisionPoints: ComparisonDecisionPoint[];
  complianceRows: ComparisonDetail['complianceRows'];
}): ComparisonDetail {
  return {
    id: input.record.id,
    generatedAt: input.record.generatedAt.toISOString(),
    sourceTicketId: input.record.sourceTicketId,
    sourceTicketKey: input.record.sourceTicket.ticketKey,
    markdownPath: input.record.markdownPath,
    summary: input.record.summary,
    overallRecommendation: input.record.overallRecommendation,
    keyDifferentiators: Array.isArray(input.record.keyDifferentiators)
      ? input.record.keyDifferentiators.filter((item): item is string => typeof item === 'string')
      : [],
    winnerTicketId: input.record.winnerTicketId,
    winnerTicketKey: input.record.winnerTicket.ticketKey,
    participants: input.participants,
    decisionPoints: input.decisionPoints,
    complianceRows: input.complianceRows,
  };
}
