/**
 * PR Layer helpers (AIB-879)
 *
 * `parseLayerDecomposition` tolerantly parses the persisted layer-decomposition
 * artifact (mirrors `parseQualityScoreDetails` in `lib/quality-score.ts`), and
 * `reconcileLayers` merges the stored layer snapshot with the live file set at
 * view time — intersecting member files, omitting empty layers, routing
 * unclassified files to a synthetic "Additional changes" layer, and deriving
 * counters after reconciliation (data-model.md §3).
 */

import {
  layerDecompositionArtifactSchema,
  type LayerDecompositionArtifact,
  type FileChange,
  type ResolvedLayer,
} from '@/app/lib/schemas/pr-diff';

/** Stable id of the synthetic layer collecting files claimed by no stored layer. */
export const ADDITIONAL_CHANGES_LAYER_ID = 'additional-changes';

/**
 * Tolerantly parse the `Job.layerDecomposition` JSON string.
 * Returns null for null/empty input, malformed JSON, or a payload that fails
 * schema validation — all treated as "no decomposition" → flat Files mode.
 */
export function parseLayerDecomposition(
  raw: string | null | undefined
): LayerDecompositionArtifact | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = layerDecompositionArtifactSchema.safeParse(json);
  return result.success ? result.data : null;
}

function countComments(files: FileChange[]): number {
  return files.reduce((sum, file) => sum + file.comments.length, 0);
}

/**
 * Reconcile the stored layer snapshot against the current PR file set.
 *
 * - No artifact / empty layers → `[]` (client defaults to flat Files mode, FR-014).
 * - Layers are emitted in ascending `order`; a file is claimed by the first layer
 *   that lists it (de-duped across layers).
 * - Layers left with no current files are omitted without breaking ordering.
 * - Files claimed by no layer are collected into a synthetic "Additional changes"
 *   layer appended last (FR-015).
 * - `fileCount`/`commentCount` are derived after reconciliation so they reflect
 *   what is actually shown.
 */
export function reconcileLayers(
  artifact: LayerDecompositionArtifact | null,
  files: FileChange[]
): ResolvedLayer[] {
  if (!artifact || artifact.layers.length === 0) return [];

  const byFilename = new Map<string, FileChange>();
  for (const file of files) byFilename.set(file.filename, file);

  const claimed = new Set<string>();
  const resolved: ResolvedLayer[] = [];

  const orderedLayers = [...artifact.layers].sort((a, b) => a.order - b.order);

  for (const layer of orderedLayers) {
    const layerFiles: FileChange[] = [];
    for (const filename of layer.files) {
      if (claimed.has(filename)) continue;
      const file = byFilename.get(filename);
      if (!file) continue;
      claimed.add(filename);
      layerFiles.push(file);
    }

    // Omit layers whose files were all removed since review time.
    if (layerFiles.length === 0) continue;

    resolved.push({
      id: layer.id,
      title: layer.title,
      summary: layer.summary,
      order: layer.order,
      files: layerFiles,
      fileCount: layerFiles.length,
      commentCount: countComments(layerFiles),
      synthetic: false,
    });
  }

  // Collect files not claimed by any stored layer into the synthetic layer.
  const unclassified = files.filter((file) => !claimed.has(file.filename));
  if (unclassified.length > 0) {
    const lastOrder = resolved.length > 0 ? resolved[resolved.length - 1]!.order : 0;
    resolved.push({
      id: ADDITIONAL_CHANGES_LAYER_ID,
      title: 'Additional changes',
      summary: 'Files changed after the review snapshot',
      order: lastOrder + 1,
      files: unclassified,
      fileCount: unclassified.length,
      commentCount: countComments(unclassified),
      synthetic: true,
    });
  }

  return resolved;
}
