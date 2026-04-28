import { z } from 'zod';

export const ANALYSIS_RULE_SET_VERSION = 1 as const;

export const AnalysisErrorReason = z.enum([
  'scoping_pass_failed',
  'grounded_pass_failed',
  'dispatch_failed',
  'timeout',
  'invalid_model_output',
  'credential_missing',
  'other',
]);
export type AnalysisErrorReasonType = z.infer<typeof AnalysisErrorReason>;

export const ColdStartReason = z.enum(['insufficient_comparable_history']);
export type ColdStartReasonType = z.infer<typeof ColdStartReason>;

const ServiceSummarySchema = z.object({
  type: z.enum(['postgres', 'redis', 'mysql', 'mongo']),
  version: z.string(),
});

export const StackContextSchema = z.object({
  language: z.string().nullable(),
  framework: z.string().nullable(),
  services: z.array(ServiceSummarySchema).max(10),
  testingFramework: z.string().nullable(),
  e2e: z.boolean(),
  e2eFramework: z.string().nullable(),
  agent: z.object({
    cli: z.string(),
    model: z.string().nullable(),
  }),
});
export type StackContext = z.infer<typeof StackContextSchema>;
