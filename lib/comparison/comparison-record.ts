import type {
  Agent,
  Prisma,
  Stage,
  WorkflowType,
} from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type {
  ComparisonDecisionPoint,
  ComparisonDetail,
  ComparisonEnrichmentValue,
  ComparisonMetricSnapshot,
  ComparisonParticipantDetail,
  ComparisonReportDecisionPointApproach,
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
  // Primary: highest constitution compliance score
  const complianceScores = Object.entries(report.compliance).sort(
    (a, b) => b[1].overall - a[1].overall
  );
  if (complianceScores[0]) {
    return complianceScores[0][0];
  }

  // Fallback: ticket with most decision point verdicts (qualitative, not code volume)
  const verdictCounts = new Map<string, number>();
  for (const dp of report.decisionPoints ?? []) {
    if (dp.verdictTicketKey) {
      verdictCounts.set(dp.verdictTicketKey, (verdictCounts.get(dp.verdictTicketKey) ?? 0) + 1);
    }
  }
  const byVerdicts = [...verdictCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (byVerdicts[0]) {
    return byVerdicts[0][0];
  }

  // Last resort: first compared ticket
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
      // Score from compliance; fallback to decision point win ratio (not code volume)
      const verdictWins = (report.decisionPoints ?? [])
        .filter(dp => dp.verdictTicketKey === ticketKey).length;
      const totalDPs = (report.decisionPoints ?? []).length;
      const score = compliance?.overall
        ?? (totalDPs > 0 ? Math.round((verdictWins / totalDPs) * 100) : 0);
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

function buildDecisionPointApproaches(
  participantApproaches: ComparisonReportDecisionPointApproach[],
  ticketKeyToId: Map<string, number>
): Array<{
  ticketId: number;
  ticketKey: string;
  summary: string;
}> {
  const approaches = [];

  for (const approach of participantApproaches) {
    const ticketId = ticketKeyToId.get(approach.ticketKey);
    if (ticketId == null) {
      continue;
    }

    approaches.push({
      ticketId,
      ticketKey: approach.ticketKey,
      summary: approach.summary,
    });
  }

  return approaches;
}

function buildDecisionPoints(
  report: ComparisonReport,
  ticketKeyToId: Map<string, number>
): Prisma.DecisionPointEvaluationUncheckedCreateWithoutComparisonRecordInput[] {
  return report.decisionPoints.map((point, index) => ({
    title: point.title,
    verdictTicketId:
      point.verdictTicketKey != null
        ? ticketKeyToId.get(point.verdictTicketKey) ?? null
        : null,
    verdictSummary: point.verdictSummary,
    rationale: point.rationale,
    participantApproaches: buildDecisionPointApproaches(
      point.participantApproaches,
      ticketKeyToId
    ),
    displayOrder: index,
  }));
}

function buildComplianceCreates(
  report: ComparisonReport,
  participantTicketKey: string
): Prisma.ComplianceAssessmentUncheckedCreateWithoutComparisonParticipantInput[] {
  const compliance = report.compliance[participantTicketKey];
  return (
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
    }))
  );
}

export function createComparisonRecordInput(
  input: PersistComparisonInput
): Prisma.ComparisonRecordCreateInput {
  const ticketKeyToTicket = new Map(
    input.participants.map((ticket) => [ticket.ticketKey, ticket] as const)
  );
  const ticketKeyToId = new Map(
    input.participants.map((ticket) => [ticket.ticketKey, ticket.id] as const)
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
      create: buildDecisionPoints(input.report, ticketKeyToId),
    },
  };
}

function normalizeDecisionPointApproaches(
  participantApproaches: Prisma.JsonValue
): ComparisonDecisionPoint['participantApproaches'] {
  if (!Array.isArray(participantApproaches)) {
    return [];
  }

  const normalizedApproaches = [];

  for (const approach of participantApproaches) {
    if (!approach || typeof approach !== 'object' || Array.isArray(approach)) {
      continue;
    }

    const ticketId =
      typeof approach.ticketId === 'number' ? approach.ticketId : null;
    const ticketKey =
      typeof approach.ticketKey === 'string' ? approach.ticketKey : null;
    const summary =
      typeof approach.summary === 'string' ? approach.summary : '';

    if (ticketId == null || ticketKey == null) {
      continue;
    }

    normalizedApproaches.push({
      ticketId,
      ticketKey,
      summary,
    });
  }

  return normalizedApproaches;
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

export interface AggregatedJobTelemetry {
  ticketId: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  costUsd: number;
  jobCount: number;
  primaryModel: string | null;
}

export function aggregateJobTelemetry(
  jobs: Array<{
    ticketId: number;
    inputTokens: number | null;
    outputTokens: number | null;
    durationMs: number | null;
    costUsd: number | null;
    model: string | null;
  }>
): Map<number, AggregatedJobTelemetry> {
  const groups = new Map<number, AggregatedJobTelemetry>();
  const maxTokensPerTicket = new Map<number, number>();

  for (const job of jobs) {
    const existing = groups.get(job.ticketId);
    const input = job.inputTokens ?? 0;
    const output = job.outputTokens ?? 0;
    const jobTokens = input + output;

    if (!existing) {
      groups.set(job.ticketId, {
        ticketId: job.ticketId,
        inputTokens: input,
        outputTokens: output,
        totalTokens: jobTokens,
        durationMs: job.durationMs ?? 0,
        costUsd: job.costUsd ?? 0,
        jobCount: 1,
        primaryModel: job.model,
      });
      maxTokensPerTicket.set(job.ticketId, jobTokens);
    } else {
      existing.inputTokens += input;
      existing.outputTokens += output;
      existing.totalTokens += jobTokens;
      existing.durationMs += job.durationMs ?? 0;
      existing.costUsd += job.costUsd ?? 0;
      existing.jobCount += 1;

      const currentMax = maxTokensPerTicket.get(job.ticketId) ?? 0;
      if (jobTokens > currentMax) {
        existing.primaryModel = job.model;
        maxTokensPerTicket.set(job.ticketId, jobTokens);
      }
    }
  }

  return groups;
}

export function normalizeTelemetryEnrichment(
  aggregated: AggregatedJobTelemetry | null,
  hasInProgressJobs?: boolean
): ComparisonTelemetryEnrichment {
  if (!aggregated || aggregated.jobCount === 0) {
    const createNumeric = hasInProgressJobs ? createPendingEnrichment<number> : createUnavailableEnrichment<number>;
    return {
      inputTokens: createNumeric(),
      outputTokens: createNumeric(),
      totalTokens: createNumeric(),
      durationMs: createNumeric(),
      costUsd: createNumeric(),
      jobCount: createNumeric(),
      primaryModel: hasInProgressJobs
        ? createPendingEnrichment<string>()
        : createUnavailableEnrichment<string>(),
    };
  }

  return {
    inputTokens: createAvailableEnrichment(aggregated.inputTokens),
    outputTokens: createAvailableEnrichment(aggregated.outputTokens),
    totalTokens: createAvailableEnrichment(aggregated.totalTokens),
    durationMs: createAvailableEnrichment(aggregated.durationMs),
    costUsd: createAvailableEnrichment(aggregated.costUsd),
    jobCount: createAvailableEnrichment(aggregated.jobCount),
    primaryModel: aggregated.primaryModel
      ? createAvailableEnrichment(aggregated.primaryModel)
      : createUnavailableEnrichment<string>(),
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
  qualityBreakdown: ComparisonEnrichmentValue<import('@/lib/quality-score').QualityScoreDetails>;
  telemetry: ComparisonTelemetryEnrichment;
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
    qualityBreakdown: input.qualityBreakdown,
    telemetry: input.telemetry,
    metrics: normalizeMetricSnapshot(input.participant.metricSnapshot),
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
    participantApproaches: normalizeDecisionPointApproaches(
      point.participantApproaches
    ),
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
