import { z } from 'zod';
import type { ScanReport, HealthModuleType } from './types';

const reportIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  description: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  category: z.string().optional(),
  confidence: z.number().optional(),
  exploitScenario: z.string().optional(),
  recommendation: z.string().optional(),
});

const generatedTicketSchema = z.object({
  ticketKey: z.string(),
  stage: z.string(),
});

const securityReportSchema = z.object({
  type: z.literal('SECURITY'),
  issues: z.array(reportIssueSchema),
  generatedTickets: z.array(generatedTicketSchema),
});

const complianceReportSchema = z.object({
  type: z.literal('COMPLIANCE'),
  issues: z.array(reportIssueSchema),
  generatedTickets: z.array(generatedTicketSchema),
});

const testsReportSchema = z.object({
  type: z.literal('TESTS'),
  autoFixed: z.array(reportIssueSchema),
  nonFixable: z.array(reportIssueSchema),
  generatedTickets: z.array(generatedTicketSchema),
});

const specSyncEntrySchema = z.object({
  specPath: z.string(),
  status: z.enum(['synced', 'drifted']),
  drift: z.string().optional(),
});

const specSyncReportSchema = z.object({
  type: z.literal('SPEC_SYNC'),
  specs: z.array(specSyncEntrySchema),
  generatedTickets: z.array(generatedTicketSchema),
});

const qualityDimensionSchema = z.object({
  name: z.string(),
  score: z.number().nullable(),
});

const qualityTicketSchema = z.object({
  ticketKey: z.string(),
  score: z.number().nullable(),
});

const qualityGateReportSchema = z.object({
  type: z.literal('QUALITY_GATE'),
  dimensions: z.array(qualityDimensionSchema),
  recentTickets: z.array(qualityTicketSchema),
});

const lastCleanReportSchema = z.object({
  type: z.literal('LAST_CLEAN'),
  filesCleaned: z.number(),
  remainingIssues: z.number(),
  summary: z.string(),
});

const scanReportSchema = z.discriminatedUnion('type', [
  securityReportSchema,
  complianceReportSchema,
  testsReportSchema,
  specSyncReportSchema,
  qualityGateReportSchema,
  lastCleanReportSchema,
]);

/**
 * Parse a raw JSON string into a typed ScanReport.
 * Returns null if the JSON is invalid, null, or doesn't match the expected schema.
 */
export function parseScanReport(scanType: HealthModuleType, rawJson: string | null | undefined): ScanReport | null {
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson);

    // If parsed object doesn't have a type field, inject it from scanType
    if (typeof parsed === 'object' && parsed !== null && !parsed.type) {
      parsed.type = scanType;
    }

    const result = scanReportSchema.safeParse(parsed);
    if (!result.success) return null;

    // Verify the report type matches the scan type
    if (result.data.type !== scanType) return null;

    return result.data;
  } catch {
    return null;
  }
}

export { scanReportSchema };
