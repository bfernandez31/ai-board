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
  ticketKey: z.string().min(1).optional(),
  linesAdded: z.number().int().nonnegative().default(0),
  linesRemoved: z.number().int().nonnegative().default(0),
  linesChanged: z.number().int().nonnegative().default(0),
  filesChanged: z.number().int().nonnegative().default(0),
  changedFiles: z.array(z.string()).default([]),
  testFilesChanged: z.number().int().nonnegative().default(0),
  testCoverage: z.number().min(0).max(100).optional(),
  hasData: z.boolean().default(false),
});

const constitutionPrincipleSchema = z.object({
  name: z.string().min(1),
  section: z.string().default(''),
  passed: z.boolean().optional(),
  status: z.string().optional(),
  notes: z.string().default(''),
}).transform(({ status, ...p }) => ({
  ...p,
  passed: p.passed ?? (status != null ? /^(pass|yes|true)$/i.test(status) : false),
}));

const complianceScoreSchema = z.object({
  overall: z.number().min(0).max(100).default(0),
  totalPrinciples: z.number().int().nonnegative().default(0),
  passedPrinciples: z.number().int().nonnegative().default(0),
  principles: z.array(constitutionPrincipleSchema).default([]),
});

const telemetrySchema = z.object({
  ticketKey: z.string().min(1).optional(),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheCreationTokens: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative().default(0),
  durationMs: z.number().int().nonnegative().default(0),
  model: z.string().nullable().default(null),
  toolsUsed: z.array(z.string()).default([]),
  jobCount: z.number().int().nonnegative().default(0),
  hasData: z.boolean().default(false),
});

export const serializedComparisonReportSchema = z.object({
  metadata: reportMetadataSchema,
  summary: z.string(),
  alignment: z.object({
    overall: z.number().min(0).max(100).default(0),
    dimensions: z.object({
      requirements: z.number().min(0).max(100).default(0),
      scenarios: z.number().min(0).max(100).default(0),
      entities: z.number().min(0).max(100).default(0),
      keywords: z.number().min(0).max(100).default(0),
    }).default({ requirements: 0, scenarios: 0, entities: 0, keywords: 0 }),
    isAligned: z.boolean().default(false),
    matchingRequirements: z.array(z.string()).default([]),
    matchingEntities: z.array(z.string()).default([]),
  }),
  implementation: z.record(z.string(), implementationMetricsSchema),
  compliance: z.record(z.string(), complianceScoreSchema),
  telemetry: z.record(z.string(), telemetrySchema),
  recommendation: z.string().default(''),
  warnings: z.array(z.string()).default([]),
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

function injectRecordKeys(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const obj = input as Record<string, unknown>;
  const report = obj.report;
  if (!report || typeof report !== 'object') return input;

  const rep = report as Record<string, unknown>;
  for (const field of ['implementation', 'telemetry'] as const) {
    const record = rep[field];
    if (record && typeof record === 'object' && !Array.isArray(record)) {
      for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const entry = value as Record<string, unknown>;
          if (entry.ticketKey === undefined) {
            entry.ticketKey = key;
          }
        }
      }
    }
  }

  return input;
}

export function normalizeComparisonPersistenceRequest(
  input: unknown
): ComparisonPersistenceRequest {
  const preprocessed = injectRecordKeys(input);
  const parsed =
    serializedComparisonPersistenceRequestSchema.parse(preprocessed) as SerializedComparisonPersistenceRequest;

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
