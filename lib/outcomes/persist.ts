/**
 * Persistence guard for ticket outcomes.
 *
 * Validates the DerivedOutcome against the data-model invariants via Zod, then
 * `prisma.ticketOutcome.create({ data })` wrapped in a try/catch that swallows
 * P2002 (unique-constraint violation = idempotent re-attempt). Any other Prisma
 * error is re-thrown.
 */

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { QUALITY_THRESHOLD_FRICTION_FREE, RULE_SET_VERSION } from './types';
import type { DerivedOutcome } from './types';

const PARTIAL_REASONS = [
  'no_jobs',
  'no_commit_reference',
  'repository_unreachable',
  'fetch_failed_after_retry',
] as const;

const derivedOutcomeSchema = z
  .object({
    ticketId: z.number().int().positive(),
    projectId: z.number().int().positive(),
    workflowType: z.enum(['FULL', 'QUICK', 'CLEAN']),
    shippedAt: z.date(),
    ruleSetVersion: z.literal(RULE_SET_VERSION),

    totalCostUsd: z.number().nullable(),
    totalDurationMs: z.number().int().nullable(),
    totalInputTokens: z.number().int().nullable(),
    totalOutputTokens: z.number().int().nullable(),
    totalThinkingTokens: z.number().int().nullable(),
    totalCacheReadTokens: z.number().int().nullable(),
    totalCacheCreationTokens: z.number().int().nullable(),
    toolsUsed: z.array(z.string()),

    pipelineJobCount: z.number().int().nonnegative(),
    frictionJobCount: z.number().int().nonnegative(),
    totalJobCount: z.number().int().nonnegative(),
    jobCountByPrefix: z.record(z.string(), z.number().int().nonnegative()),

    qualityScore: z.number().int().nullable(),

    filesTouched: z.array(z.string()),
    linesAdded: z.number().int().nullable(),
    linesRemoved: z.number().int().nullable(),
    testCodeRatio: z.number().nullable(),

    domains: z.array(z.string()),
    domainFileCounts: z.record(z.string(), z.number().int().nonnegative()),

    touchedDbSchema: z.boolean(),
    touchedTests: z.boolean(),
    touchedCi: z.boolean(),

    frictionFree: z.boolean(),

    partial: z.boolean(),
    partialReason: z.enum(PARTIAL_REASONS).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.pipelineJobCount + data.frictionJobCount !== data.totalJobCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pipeline + friction must equal total job count',
        path: ['totalJobCount'],
      });
    }
    if (data.frictionFree) {
      if (
        data.frictionJobCount !== 0 ||
        data.qualityScore === null ||
        data.qualityScore < QUALITY_THRESHOLD_FRICTION_FREE
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'frictionFree requires frictionJobCount=0 and qualityScore>=threshold',
          path: ['frictionFree'],
        });
      }
    }
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
    if (data.partial) {
      if (
        data.linesAdded !== null ||
        data.linesRemoved !== null ||
        data.domains.length !== 0 ||
        data.filesTouched.length !== 0 ||
        data.touchedDbSchema ||
        data.touchedTests ||
        data.touchedCi
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'partial=true requires empty change-shape and false semantic tags',
          path: ['partial'],
        });
      }
    }
  });

export interface PersistResult {
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

export async function persistOutcome(derived: DerivedOutcome): Promise<PersistResult> {
  const parsed = derivedOutcomeSchema.parse(derived);

  const data: Prisma.TicketOutcomeUncheckedCreateInput = {
    ticketId: parsed.ticketId,
    projectId: parsed.projectId,
    workflowType: parsed.workflowType,
    shippedAt: parsed.shippedAt,
    ruleSetVersion: parsed.ruleSetVersion,
    totalCostUsd: parsed.totalCostUsd,
    totalDurationMs: parsed.totalDurationMs,
    totalInputTokens: parsed.totalInputTokens,
    totalOutputTokens: parsed.totalOutputTokens,
    totalThinkingTokens: parsed.totalThinkingTokens,
    totalCacheReadTokens: parsed.totalCacheReadTokens,
    totalCacheCreationTokens: parsed.totalCacheCreationTokens,
    toolsUsed: parsed.toolsUsed,
    pipelineJobCount: parsed.pipelineJobCount,
    frictionJobCount: parsed.frictionJobCount,
    totalJobCount: parsed.totalJobCount,
    jobCountByPrefix: parsed.jobCountByPrefix as Prisma.InputJsonValue,
    qualityScore: parsed.qualityScore,
    filesTouched: parsed.filesTouched,
    linesAdded: parsed.linesAdded,
    linesRemoved: parsed.linesRemoved,
    testCodeRatio: parsed.testCodeRatio,
    domains: parsed.domains,
    domainFileCounts: parsed.domainFileCounts as Prisma.InputJsonValue,
    touchedDbSchema: parsed.touchedDbSchema,
    touchedTests: parsed.touchedTests,
    touchedCi: parsed.touchedCi,
    frictionFree: parsed.frictionFree,
    partial: parsed.partial,
    partialReason: parsed.partialReason,
  };

  try {
    await prisma.ticketOutcome.create({ data });
    return { created: true };
  } catch (err) {
    if (isP2002(err)) {
      return { created: false, reason: 'duplicate' };
    }
    throw err;
  }
}
