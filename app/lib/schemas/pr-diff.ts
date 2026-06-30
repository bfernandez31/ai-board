import { z } from 'zod';

/**
 * Zod schemas + inferred types for the in-app PR diff viewer (AIB-879).
 *
 * Two concerns live here:
 *  1. `LayerDecompositionArtifact` — the persisted snapshot emitted by the VERIFY
 *     code-review and stored on `Job.layerDecomposition` (JSON string). Parsed
 *     tolerantly on read (see `lib/pr-layers.ts`).
 *  2. The transient `GET …/pr-diff` response (`PrDiffResponse`) assembled per request
 *     from the live GitHub PR state + the reconciled layers. Never persisted.
 *
 * The `{ filename, status, additions, deletions, patch? }` core mirrors
 * `documentationDiffResponseSchema` (`app/lib/schemas/documentation.ts`) so the
 * existing diff-rendering style applies directly; `binary`/`patchTruncated`/`comments`
 * are additive.
 */

// ---------------------------------------------------------------------------
// 1. Persisted artifact (Job.layerDecomposition JSON string)
// ---------------------------------------------------------------------------

export const layerDescriptorSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  order: z.number().int(),
  files: z.array(z.string()),
});

export type LayerDescriptor = z.infer<typeof layerDescriptorSchema>;

export const layerDecompositionArtifactSchema = z.object({
  version: z.literal(1),
  computedAt: z.string(),
  layers: z.array(layerDescriptorSchema),
});

export type LayerDecompositionArtifact = z.infer<typeof layerDecompositionArtifactSchema>;

// ---------------------------------------------------------------------------
// 2. Runtime / API response types (NOT persisted)
// ---------------------------------------------------------------------------

export const inlineCommentSchema = z.object({
  id: z.number().int(),
  source: z.enum(['ai-board', 'bot', 'human']),
  author: z.string(),
  line: z.number().int().nullable(),
  body: z.string(),
  outdated: z.boolean(),
  createdAt: z.string(),
});

export type InlineComment = z.infer<typeof inlineCommentSchema>;

export const fileChangeSchema = z.object({
  filename: z.string(),
  status: z.enum(['added', 'modified', 'removed']),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  patch: z.string().optional(),
  binary: z.boolean(),
  patchTruncated: z.boolean(),
  comments: z.array(inlineCommentSchema),
});

export type FileChange = z.infer<typeof fileChangeSchema>;

export const resolvedLayerSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  order: z.number().int(),
  files: z.array(fileChangeSchema),
  fileCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  synthetic: z.boolean(),
});

export type ResolvedLayer = z.infer<typeof resolvedLayerSchema>;

export const prSummarySchema = z.object({
  number: z.number().int(),
  title: z.string(),
  state: z.enum(['open', 'closed', 'merged']),
  url: z.string(),
});

export type PrSummary = z.infer<typeof prSummarySchema>;

export const scoreThresholdSchema = z.enum(['Excellent', 'Good', 'Fair', 'Poor']);

export const prOverviewSchema = z.object({
  pr: prSummarySchema.nullable(),
  reviewSynthesis: z.string().nullable(),
  qualityScore: z.number().int().nullable(),
  qualityThreshold: scoreThresholdSchema.nullable(),
});

export type PrOverview = z.infer<typeof prOverviewSchema>;

export const prDiffResponseSchema = z.object({
  pr: prSummarySchema.nullable(),
  overview: prOverviewSchema,
  layers: z.array(resolvedLayerSchema),
  files: z.array(fileChangeSchema),
  truncated: z.boolean(),
});

export type PrDiffResponse = z.infer<typeof prDiffResponseSchema>;
