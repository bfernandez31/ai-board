import { z } from 'zod';
import type {
  ComparisonPersistenceRequest,
  SerializedComparisonPersistenceRequest,
  SerializedComparisonReport,
  ComparisonReport,
} from '@/lib/types/comparison';

const reportMetadataSchema = z.object({
  generatedAt: z.string().datetime(),
  sourceTicket: z.string().min(1),
  comparedTickets: z.array(z.string().min(1)).min(1).max(5),
  filePath: z.string().min(1),
});

const implementationMetricsSchema = z.object({
  ticketKey: z.string().min(1),
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
  linesChanged: z.number().int().nonnegative(),
  filesChanged: z.number().int().nonnegative(),
  changedFiles: z.array(z.string()),
  testFilesChanged: z.number().int().nonnegative(),
  testCoverage: z.number().min(0).max(100).optional(),
  hasData: z.boolean(),
});

const constitutionPrincipleSchema = z.object({
  name: z.string().min(1),
  section: z.string().min(1),
  passed: z.boolean(),
  notes: z.string(),
});

const complianceScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  totalPrinciples: z.number().int().nonnegative(),
  passedPrinciples: z.number().int().nonnegative(),
  principles: z.array(constitutionPrincipleSchema),
});

const telemetrySchema = z.object({
  ticketKey: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  model: z.string().nullable(),
  toolsUsed: z.array(z.string()),
  jobCount: z.number().int().nonnegative(),
  hasData: z.boolean(),
});

export const serializedComparisonReportSchema = z.object({
  metadata: reportMetadataSchema,
  summary: z.string(),
  alignment: z.object({
    overall: z.number().min(0).max(100),
    dimensions: z.object({
      requirements: z.number().min(0).max(100),
      scenarios: z.number().min(0).max(100),
      entities: z.number().min(0).max(100),
      keywords: z.number().min(0).max(100),
    }),
    isAligned: z.boolean(),
    matchingRequirements: z.array(z.string()),
    matchingEntities: z.array(z.string()),
  }),
  implementation: z.record(z.string(), implementationMetricsSchema),
  compliance: z.record(z.string(), complianceScoreSchema),
  telemetry: z.record(z.string(), telemetrySchema),
  recommendation: z.string(),
  warnings: z.array(z.string()),
});

export const serializedComparisonPersistenceRequestSchema = z.object({
  compareRunKey: z.string().min(1),
  projectId: z.number().int().positive(),
  sourceTicketKey: z.string().min(1),
  participantTicketKeys: z.array(z.string().min(1)).min(1).max(5),
  markdownPath: z.string().regex(/^specs\/[^/]+\/comparisons\/.+\.md$/),
  report: serializedComparisonReportSchema,
});

function copyImplementationMetrics(
  implementation: SerializedComparisonReport['implementation']
): SerializedComparisonReport['implementation'] {
  return Object.fromEntries(
    Object.entries(implementation).map(([ticketKey, metrics]) => [
      ticketKey,
      {
        ...metrics,
        ...(metrics.testCoverage !== undefined
          ? { testCoverage: metrics.testCoverage }
          : {}),
      },
    ])
  );
}

function deserializeComparisonReport(
  report: SerializedComparisonReport
): ComparisonReport {
  return {
    ...report,
    metadata: {
      ...report.metadata,
      generatedAt: new Date(report.metadata.generatedAt),
    },
    implementation: copyImplementationMetrics(report.implementation),
  };
}

export function serializeComparisonReport(
  report: ComparisonReport
): SerializedComparisonReport {
  return {
    ...report,
    metadata: {
      ...report.metadata,
      generatedAt: report.metadata.generatedAt.toISOString(),
    },
    implementation: copyImplementationMetrics(report.implementation),
  };
}

export function normalizeComparisonPersistenceRequest(
  input: unknown
): ComparisonPersistenceRequest {
  const parsed =
    serializedComparisonPersistenceRequestSchema.parse(input) as SerializedComparisonPersistenceRequest;

  return {
    ...parsed,
    report: deserializeComparisonReport(parsed.report),
  };
}

export function createCompareRunKey(
  sourceTicketKey: string,
  comparedTickets: string[],
  generatedAt: Date
): string {
  const compactTimestamp = generatedAt.toISOString().replace(/[-:.]/g, '');
  return `cmp_${compactTimestamp}_${sourceTicketKey}_${comparedTickets.join('-')}`;
}

export function getComparisonDataArtifactPath(markdownPath: string): string {
  return markdownPath.replace(/[^/]+\.md$/, 'comparison-data.json');
}

export function createComparisonPersistenceRequest(input: {
  projectId: number;
  sourceTicketKey: string;
  participantTicketKeys: string[];
  markdownPath: string;
  compareRunKey: string;
  report: ComparisonReport;
}): SerializedComparisonPersistenceRequest {
  return {
    compareRunKey: input.compareRunKey,
    projectId: input.projectId,
    sourceTicketKey: input.sourceTicketKey,
    participantTicketKeys: input.participantTicketKeys,
    markdownPath: input.markdownPath,
    report: serializeComparisonReport(input.report),
  };
}
