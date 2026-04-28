import { z } from 'zod';

export const FrictionRiskEnum = z.enum(['low', 'medium', 'high']);
export type FrictionRisk = z.infer<typeof FrictionRiskEnum>;

export const ConfidenceEnum = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof ConfidenceEnum>;

export const RecommendationEnum = z.enum(['QUICK', 'FULL']);
export type Recommendation = z.infer<typeof RecommendationEnum>;

export const ScopeWarningCategoryEnum = z.enum([
  'ambiguity_core_requirement',
  'multi_feature_bundling',
  'missing_acceptance_criteria',
  'missing_scope_boundary',
  'other',
]);

export const ScopeWarningSchema = z
  .object({
    category: ScopeWarningCategoryEnum,
    message: z.string().min(1).max(280),
  })
  .strict();
export type ScopeWarning = z.infer<typeof ScopeWarningSchema>;

export const AnchorCitationSchema = z
  .object({
    ticketId: z.number().int().positive(),
    ticketKey: z.string().regex(/^[A-Z]{2,6}-\d+$/),
    frictionFree: z.boolean(),
    qualityScore: z.number().int().min(0).max(100).nullable(),
    overlapStrength: z.number().int().min(1),
  })
  .strict();
export type AnchorCitation = z.infer<typeof AnchorCitationSchema>;

export const QualityGateRangeSchema = z
  .object({
    lower: z.number().int().min(0).max(100),
    upper: z.number().int().min(0).max(100),
  })
  .strict()
  .refine((r) => r.lower <= r.upper, { message: 'lower must be ≤ upper' });

export const CostRangeSchema = z
  .object({
    baselineLowerUsd: z.number().min(0),
    baselineUpperUsd: z.number().min(0),
    marginalFrictionLowerUsd: z.number().min(0),
    marginalFrictionUpperUsd: z.number().min(0),
  })
  .strict()
  .refine(
    (r) =>
      r.baselineLowerUsd <= r.baselineUpperUsd &&
      r.marginalFrictionLowerUsd <= r.marginalFrictionUpperUsd,
    { message: 'lower bounds must be ≤ upper bounds' }
  );

export const RecommendationSchema = z
  .object({
    choice: RecommendationEnum,
    confidence: ConfidenceEnum,
    justification: z.string().min(1).max(1000),
  })
  .strict();

export const AnalysisOutputSchema = z
  .object({
    frictionRisk: FrictionRiskEnum,
    qualityGateRange: QualityGateRangeSchema,
    recommendation: RecommendationSchema,
    costRange: CostRangeSchema,
    scopeWarnings: z.array(ScopeWarningSchema).max(5),
    anchors: z.array(AnchorCitationSchema).max(5),
  })
  .strict();
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

export const ColdStartOutputSchema = z
  .object({
    scopeWarnings: z.array(ScopeWarningSchema).max(5),
  })
  .strict();
export type ColdStartOutput = z.infer<typeof ColdStartOutputSchema>;
