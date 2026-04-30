/**
 * Persistence guard for analysis calibration rows.
 *
 * Validates the PairedCalibration against the data-model invariants via Zod
 * superRefine, then `prisma.analysisCalibration.create({ data })` wrapped in a
 * try/catch that swallows P2002 (unique-constraint violation = idempotent
 * re-attempt). Mirrors `lib/outcomes/persist.ts`.
 */
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import {
  CALIBRATION_RULE_SET_VERSION,
  FrictionCellValues,
  VerdictValues,
  type PairedCalibration,
} from './types';

const PARTIAL_REASONS = [
  'no_jobs',
  'no_branch_reference',
  'merge_not_found',
  'repository_unreachable',
  'fetch_failed_after_retry',
  'diff_truncated',
] as const;

const pairedCalibrationSchema = z
  .object({
    ticketId: z.number().int().positive(),
    projectId: z.number().int().positive(),
    analysisId: z.number().int().positive(),
    outcomeId: z.number().int().positive(),

    ruleSetVersion: z.literal(CALIBRATION_RULE_SET_VERSION),
    shippedAt: z.date(),

    frictionPredictedRating: z.enum(['low', 'medium', 'high']),
    frictionPredictedClean: z.boolean(),
    frictionActualFree: z.boolean(),
    frictionCell: z.enum(FrictionCellValues),

    qualityPredictedLower: z.number().int().min(0).max(100),
    qualityPredictedUpper: z.number().int().min(0).max(100),
    qualityActual: z.number().int().nullable(),
    qualityVerdict: z.enum(VerdictValues),

    costPredictedBaselineLowerUsd: z.number().min(0),
    costPredictedBaselineUpperUsd: z.number().min(0),
    costPredictedMarginalLowerUsd: z.number().min(0),
    costPredictedMarginalUpperUsd: z.number().min(0),
    costPredictedSummedLowerUsd: z.number().min(0),
    costPredictedSummedUpperUsd: z.number().min(0),
    costActualUsd: z.number().nullable(),
    costVerdict: z.enum(VerdictValues),

    recommendationPredicted: z.enum(['QUICK', 'FULL']),
    recommendationConfidence: z.enum(['low', 'medium', 'high']),
    workflowActual: z.enum(['FULL', 'QUICK', 'CLEAN']),
    recommendationMatched: z.boolean(),
    recommendationFrictionAligned: z.boolean(),

    partial: z.boolean(),
    partialReason: z.enum(PARTIAL_REASONS).nullable(),
  })
  .superRefine((data, ctx) => {
    // 1. Friction binarisation matches predicted rating
    const expectedClean = data.frictionPredictedRating === 'low';
    if (data.frictionPredictedClean !== expectedClean) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'frictionPredictedClean must equal (frictionPredictedRating === "low")',
        path: ['frictionPredictedClean'],
      });
    }

    // 2. Confusion cell matches predicted/actual booleans
    const expectedCell =
      data.frictionPredictedClean && data.frictionActualFree
        ? 'TP'
        : !data.frictionPredictedClean && !data.frictionActualFree
          ? 'TN'
          : data.frictionPredictedClean && !data.frictionActualFree
            ? 'FP'
            : 'FN';
    if (data.frictionCell !== expectedCell) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `frictionCell must equal ${expectedCell} for the given predicted/actual booleans`,
        path: ['frictionCell'],
      });
    }

    // 3. Quality bounds order
    if (data.qualityPredictedLower > data.qualityPredictedUpper) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'qualityPredictedLower must be <= qualityPredictedUpper',
        path: ['qualityPredictedLower'],
      });
    }

    // 4. Quality verdict matches actual + bounds
    let expectedQualityVerdict: 'hit' | 'miss' | 'n_a';
    if (data.qualityActual === null) {
      expectedQualityVerdict = 'n_a';
    } else if (
      data.qualityActual >= data.qualityPredictedLower &&
      data.qualityActual <= data.qualityPredictedUpper
    ) {
      expectedQualityVerdict = 'hit';
    } else {
      expectedQualityVerdict = 'miss';
    }
    if (data.qualityVerdict !== expectedQualityVerdict) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualityVerdict must equal ${expectedQualityVerdict} for the given actual + bounds`,
        path: ['qualityVerdict'],
      });
    }

    // 5. Cost bounds order
    if (data.costPredictedBaselineLowerUsd > data.costPredictedBaselineUpperUsd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'costPredictedBaselineLowerUsd must be <= costPredictedBaselineUpperUsd',
        path: ['costPredictedBaselineLowerUsd'],
      });
    }
    if (data.costPredictedMarginalLowerUsd > data.costPredictedMarginalUpperUsd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'costPredictedMarginalLowerUsd must be <= costPredictedMarginalUpperUsd',
        path: ['costPredictedMarginalLowerUsd'],
      });
    }

    // 6. Cost summed range consistency
    const expectedSummedLower =
      data.costPredictedBaselineLowerUsd + data.costPredictedMarginalLowerUsd;
    const expectedSummedUpper =
      data.costPredictedBaselineUpperUsd + data.costPredictedMarginalUpperUsd;
    if (
      Math.abs(data.costPredictedSummedLowerUsd - expectedSummedLower) > 1e-9
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'costPredictedSummedLowerUsd must equal baseline+marginal lower',
        path: ['costPredictedSummedLowerUsd'],
      });
    }
    if (
      Math.abs(data.costPredictedSummedUpperUsd - expectedSummedUpper) > 1e-9
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'costPredictedSummedUpperUsd must equal baseline+marginal upper',
        path: ['costPredictedSummedUpperUsd'],
      });
    }

    // 7. Cost verdict matches actual + summed range
    let expectedCostVerdict: 'hit' | 'miss' | 'n_a';
    if (data.costActualUsd === null) {
      expectedCostVerdict = 'n_a';
    } else if (
      data.costActualUsd >= data.costPredictedSummedLowerUsd &&
      data.costActualUsd <= data.costPredictedSummedUpperUsd
    ) {
      expectedCostVerdict = 'hit';
    } else {
      expectedCostVerdict = 'miss';
    }
    if (data.costVerdict !== expectedCostVerdict) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `costVerdict must equal ${expectedCostVerdict} for the given actual + summed range`,
        path: ['costVerdict'],
      });
    }

    // 8. Recommendation matched
    const expectedMatched =
      (data.recommendationPredicted as string) === (data.workflowActual as string);
    if (data.recommendationMatched !== expectedMatched) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'recommendationMatched must equal (predicted === workflowActual)',
        path: ['recommendationMatched'],
      });
    }

    // 9. Recommendation friction-aligned
    const expectedFrictionAligned =
      (data.recommendationPredicted === 'QUICK' && data.frictionActualFree) ||
      (data.recommendationPredicted === 'FULL' && !data.frictionActualFree);
    if (data.recommendationFrictionAligned !== expectedFrictionAligned) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'recommendationFrictionAligned must equal (QUICK&frictionFree) || (FULL&!frictionFree)',
        path: ['recommendationFrictionAligned'],
      });
    }

    // 10. Partial mirror
    if (data.partial && data.partialReason === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'partial=true requires partialReason',
        path: ['partialReason'],
      });
    }
    if (!data.partial && data.partialReason !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'partialReason must be null when partial=false',
        path: ['partialReason'],
      });
    }
  });

export interface PersistCalibrationResult {
  created: boolean;
  reason?: 'duplicate';
}

function isP2002(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

export async function persistCalibration(
  input: PairedCalibration
): Promise<PersistCalibrationResult> {
  const parsed = pairedCalibrationSchema.parse(input);

  const data: Prisma.AnalysisCalibrationUncheckedCreateInput = {
    ticketId: parsed.ticketId,
    projectId: parsed.projectId,
    analysisId: parsed.analysisId,
    outcomeId: parsed.outcomeId,
    ruleSetVersion: parsed.ruleSetVersion,
    shippedAt: parsed.shippedAt,
    frictionPredictedRating: parsed.frictionPredictedRating,
    frictionPredictedClean: parsed.frictionPredictedClean,
    frictionActualFree: parsed.frictionActualFree,
    frictionCell: parsed.frictionCell,
    qualityPredictedLower: parsed.qualityPredictedLower,
    qualityPredictedUpper: parsed.qualityPredictedUpper,
    qualityActual: parsed.qualityActual,
    qualityVerdict: parsed.qualityVerdict,
    costPredictedBaselineLowerUsd: parsed.costPredictedBaselineLowerUsd,
    costPredictedBaselineUpperUsd: parsed.costPredictedBaselineUpperUsd,
    costPredictedMarginalLowerUsd: parsed.costPredictedMarginalLowerUsd,
    costPredictedMarginalUpperUsd: parsed.costPredictedMarginalUpperUsd,
    costPredictedSummedLowerUsd: parsed.costPredictedSummedLowerUsd,
    costPredictedSummedUpperUsd: parsed.costPredictedSummedUpperUsd,
    costActualUsd: parsed.costActualUsd,
    costVerdict: parsed.costVerdict,
    recommendationPredicted: parsed.recommendationPredicted,
    recommendationConfidence: parsed.recommendationConfidence,
    workflowActual: parsed.workflowActual,
    recommendationMatched: parsed.recommendationMatched,
    recommendationFrictionAligned: parsed.recommendationFrictionAligned,
    partial: parsed.partial,
    partialReason: parsed.partialReason,
  };

  try {
    await prisma.analysisCalibration.create({ data });
    return { created: true };
  } catch (err) {
    if (isP2002(err)) {
      return { created: false, reason: 'duplicate' };
    }
    throw err;
  }
}
