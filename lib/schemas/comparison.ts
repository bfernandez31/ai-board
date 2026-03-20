import { z } from 'zod';

export const comparisonEntrySchema = z.object({
  ticketId: z.number().int().positive(),
  rank: z.number().int().positive(),
  score: z.number().min(0).max(100),
  isWinner: z.boolean(),
  keyDifferentiators: z.string().min(1),
  linesAdded: z.number().int().min(0),
  linesRemoved: z.number().int().min(0),
  sourceFileCount: z.number().int().min(0),
  testFileCount: z.number().int().min(0),
  testRatio: z.number().min(0).max(1),
  complianceData: z.string().min(1),
});

export const comparisonDecisionPointSchema = z.object({
  topic: z.string().min(1),
  verdict: z.string().min(1),
  approaches: z.string().min(1),
});

export const createComparisonSchema = z.object({
  sourceTicketId: z.number().int().positive(),
  recommendation: z.string().min(1),
  notes: z.string().optional(),
  entries: z.array(comparisonEntrySchema).min(2),
  decisionPoints: z.array(comparisonDecisionPointSchema),
});

export type CreateComparisonInput = z.infer<typeof createComparisonSchema>;
export type ComparisonEntryInput = z.infer<typeof comparisonEntrySchema>;
export type ComparisonDecisionPointInput = z.infer<typeof comparisonDecisionPointSchema>;
