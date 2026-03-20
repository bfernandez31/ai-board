import { parseQualityScoreDetails } from '@/lib/quality-score';
import type {
  ComparisonCheckResult,
  ComparisonDecisionPoint,
  ComparisonDetail,
  ComparisonStoredConstitution,
  ComparisonStoredMetrics,
  ComparisonSummary,
  ComparisonTicketReference,
} from '@/lib/types/comparison';
import { aggregateJobTelemetry } from './telemetry-extractor';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const comparisonStoredMetricsSchema = z.object({
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
  sourceFiles: z.number().int().nonnegative(),
  testFiles: z.number().int().nonnegative(),
  testRatio: z.number().min(0),
});

const comparisonStoredPrincipleSchema = z.object({
  principle: z.string().min(1),
  status: z.enum(['pass', 'warning', 'fail']),
  summary: z.string().min(1),
});

const comparisonStoredConstitutionSchema = z.object({
  overall: z.number().int().min(0).max(100),
  principles: z.array(comparisonStoredPrincipleSchema),
});

const comparisonDecisionApproachSchema = z.object({
  ticketId: z.number().int().positive(),
  approach: z.string().min(1),
  rationale: z.string().min(1),
});

const comparisonDecisionPointSchema = z.object({
  title: z.string().min(1),
  verdict: z.string().min(1),
  winningTicketId: z.number().int().positive().nullable(),
  approaches: z.array(comparisonDecisionApproachSchema).min(1),
});

const comparisonTicketPayloadSchema = z.object({
  ticketId: z.number().int().positive(),
  rank: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  verdictSummary: z.string().min(1).max(4000),
  keyDifferentiators: z.array(z.string().min(1)).default([]),
  metrics: comparisonStoredMetricsSchema,
  constitution: comparisonStoredConstitutionSchema,
});

export const comparisonIngestSchema = z.object({
  sourceTicketId: z.number().int().positive(),
  reportFilename: z
    .string()
    .regex(/^\d{8}(?:-\d{6})?-vs-[A-Z0-9-]+\.md$/, 'Expected comparison report filename'),
  reportPath: z.string().min(1).max(500),
  generatedAt: z.coerce.date().optional(),
  summary: z.string().min(1).max(4000),
  recommendation: z.string().min(1).max(4000),
  winnerTicketId: z.number().int().positive().nullable().optional(),
  decisionPoints: z.array(comparisonDecisionPointSchema).default([]),
  tickets: z.array(comparisonTicketPayloadSchema).min(2),
}).superRefine((value, ctx) => {
  const ticketIds = value.tickets.map((ticket) => ticket.ticketId);
  const uniqueTicketIds = new Set(ticketIds);
  if (uniqueTicketIds.size !== ticketIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each ticket may only appear once in a comparison.',
      path: ['tickets'],
    });
  }

  if (!uniqueTicketIds.has(value.sourceTicketId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source ticket must be included in tickets[].',
      path: ['sourceTicketId'],
    });
  }

  const ranks = value.tickets.map((ticket) => ticket.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== ranks.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each ticket must have a unique rank.',
      path: ['tickets'],
    });
  }

  if (value.winnerTicketId != null && !uniqueTicketIds.has(value.winnerTicketId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Winner ticket must be included in tickets[].',
      path: ['winnerTicketId'],
    });
  }
});

export type ComparisonIngestPayload = z.infer<typeof comparisonIngestSchema>;

export const comparisonWithEntriesInclude = Prisma.validator<Prisma.TicketComparisonInclude>()({
  sourceTicket: {
    select: {
      id: true,
      ticketKey: true,
      title: true,
    },
  },
  winnerTicket: {
    select: {
      id: true,
      ticketKey: true,
      title: true,
    },
  },
  tickets: {
    include: {
      ticket: {
        select: {
          id: true,
          ticketKey: true,
          title: true,
          workflowType: true,
          stage: true,
          agent: true,
          jobs: {
            select: {
              command: true,
              status: true,
              startedAt: true,
              completedAt: true,
              inputTokens: true,
              outputTokens: true,
              cacheReadTokens: true,
              cacheCreationTokens: true,
              costUsd: true,
              durationMs: true,
              model: true,
              toolsUsed: true,
              qualityScore: true,
              qualityScoreDetails: true,
            },
          },
        },
      },
    },
  },
});

export type ComparisonWithEntries = Prisma.TicketComparisonGetPayload<{
  include: typeof comparisonWithEntriesInclude;
}>;

function parseMetrics(value: Prisma.JsonValue): ComparisonStoredMetrics {
  return comparisonStoredMetricsSchema.parse(value);
}

function parseConstitution(value: Prisma.JsonValue): ComparisonStoredConstitution {
  return comparisonStoredConstitutionSchema.parse(value);
}

function parseDecisionPoints(value: Prisma.JsonValue): ComparisonDecisionPoint[] {
  return z.array(comparisonDecisionPointSchema).parse(value);
}

function buildTicketReference(ticket: {
  id: number;
  ticketKey: string;
  title: string;
}): ComparisonTicketReference {
  return {
    id: ticket.id,
    ticketKey: ticket.ticketKey,
    title: ticket.title,
  };
}

export function buildComparisonSummary(
  comparison: ComparisonWithEntries,
  currentTicketId?: number
): ComparisonSummary {
  const winnerEntry = comparison.tickets.find(
    (ticketEntry) => ticketEntry.ticketId === comparison.winnerTicketId
  ) ?? comparison.tickets.slice().sort((left, right) => left.rank - right.rank)[0];

  const comparedTickets = comparison.tickets
    .filter((ticketEntry) => ticketEntry.ticketId !== (currentTicketId ?? comparison.sourceTicketId))
    .map((ticketEntry) => ticketEntry.ticket.ticketKey);

  const summary: ComparisonSummary = {
    filename: comparison.reportFilename,
    generatedAt: comparison.generatedAt.toISOString(),
    sourceTicket: comparison.sourceTicket.ticketKey,
    comparedTickets,
    alignmentScore: winnerEntry?.score ?? 0,
    isAligned: true,
  };

  if (comparison.winnerTicket?.ticketKey) {
    summary.winnerTicketKey = comparison.winnerTicket.ticketKey;
  }

  if (winnerEntry?.score != null) {
    summary.winnerScore = winnerEntry.score;
  }

  return summary;
}

export function buildComparisonCheckResult(
  comparisons: Array<{ reportFilename: string }>
): ComparisonCheckResult {
  return {
    hasComparisons: comparisons.length > 0,
    count: comparisons.length,
    latestReport: comparisons[0]?.reportFilename ?? null,
  };
}

export function buildComparisonDetail(
  comparison: ComparisonWithEntries
): ComparisonDetail {
  const tickets = comparison.tickets
    .slice()
    .sort((left, right) => left.rank - right.rank)
    .map((ticketEntry) => {
      const completedJobs = ticketEntry.ticket.jobs.filter((job) => job.status === 'COMPLETED');
      const telemetry = aggregateJobTelemetry(ticketEntry.ticket.ticketKey, completedJobs);
      const latestScoredVerifyJob = completedJobs
        .filter((job) => job.command === 'verify' && job.qualityScore != null)
        .sort((left, right) => {
          const leftTime = left.completedAt?.getTime() ?? left.startedAt.getTime();
          const rightTime = right.completedAt?.getTime() ?? right.startedAt.getTime();
          return rightTime - leftTime;
        })[0];
      const qualityScoreDetails = parseQualityScoreDetails(
        latestScoredVerifyJob?.qualityScoreDetails
      );

      return {
        ticketId: ticketEntry.ticket.id,
        ticketKey: ticketEntry.ticket.ticketKey,
        title: ticketEntry.ticket.title,
        workflowType: ticketEntry.ticket.workflowType,
        stage: ticketEntry.ticket.stage,
        agent: ticketEntry.ticket.agent ?? null,
        rank: ticketEntry.rank,
        score: ticketEntry.score,
        verdictSummary: ticketEntry.verdictSummary,
        keyDifferentiators: ticketEntry.keyDifferentiators,
        metrics: parseMetrics(ticketEntry.metrics),
        telemetry,
        qualityScore: {
          score: latestScoredVerifyJob?.qualityScore ?? null,
          threshold: qualityScoreDetails?.threshold ?? null,
        },
        constitution: parseConstitution(ticketEntry.constitution),
      };
    });

  return {
    id: comparison.id,
    filename: comparison.reportFilename,
    reportPath: comparison.reportPath,
    generatedAt: comparison.generatedAt.toISOString(),
    summary: comparison.summary,
    recommendation: comparison.recommendation,
    sourceTicket: buildTicketReference(comparison.sourceTicket),
    winnerTicket: comparison.winnerTicket ? buildTicketReference(comparison.winnerTicket) : null,
    tickets,
    decisionPoints: parseDecisionPoints(comparison.decisionPoints),
  };
}
