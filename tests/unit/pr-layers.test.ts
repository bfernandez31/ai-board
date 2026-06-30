/**
 * Unit Tests: PR Layer parse + reconcile (AIB-879)
 *
 * Sibling to tests/unit/quality-score.test.ts. Covers tolerant parsing of the
 * persisted layer-decomposition artifact and reconciliation of stored layers
 * against the live file set (ordering, empty-layer omission, synthetic
 * "Additional changes", post-merge counters).
 */

import { describe, it, expect } from 'vitest';
import { parseLayerDecomposition, reconcileLayers } from '@/lib/pr-layers';
import type { FileChange, InlineComment } from '@/app/lib/schemas/pr-diff';

function makeFile(filename: string, comments: InlineComment[] = []): FileChange {
  return {
    filename,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch: '@@ -1 +1 @@\n+x',
    binary: false,
    patchTruncated: false,
    comments,
  };
}

function makeComment(id: number): InlineComment {
  return {
    id,
    source: 'human',
    author: 'alice',
    line: 1,
    body: 'note',
    outdated: false,
    createdAt: '2026-06-30T00:00:00Z',
  };
}

describe('parseLayerDecomposition', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(parseLayerDecomposition(null)).toBeNull();
    expect(parseLayerDecomposition(undefined)).toBeNull();
    expect(parseLayerDecomposition('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseLayerDecomposition('{not json')).toBeNull();
  });

  it('returns null for JSON that violates the schema', () => {
    expect(parseLayerDecomposition(JSON.stringify({ version: 2, layers: [] }))).toBeNull();
    expect(parseLayerDecomposition(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it('parses a valid artifact', () => {
    const raw = JSON.stringify({
      version: 1,
      computedAt: '2026-06-30T00:00:00Z',
      layers: [{ id: 'foundations', title: 'Foundations', summary: 'schema', order: 1, files: ['a.ts'] }],
    });
    const parsed = parseLayerDecomposition(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.layers).toHaveLength(1);
    expect(parsed!.layers[0]!.id).toBe('foundations');
  });
});

describe('reconcileLayers', () => {
  it('returns [] when artifact is null (never reviewed → flat Files mode)', () => {
    const files = [makeFile('a.ts'), makeFile('b.ts')];
    expect(reconcileLayers(null, files)).toEqual([]);
  });

  it('returns [] when the artifact has no layers', () => {
    const artifact = { version: 1 as const, computedAt: 'x', layers: [] };
    expect(reconcileLayers(artifact, [makeFile('a.ts')])).toEqual([]);
  });

  it('orders layers ascending by order and resolves files against the current set', () => {
    const artifact = {
      version: 1 as const,
      computedAt: 'x',
      layers: [
        { id: 'ui', title: 'UI', summary: 'front-end', order: 2, files: ['ui.tsx'] },
        { id: 'foundations', title: 'Foundations', summary: 'schema', order: 1, files: ['schema.prisma'] },
      ],
    };
    const files = [makeFile('schema.prisma'), makeFile('ui.tsx')];
    const layers = reconcileLayers(artifact, files);

    expect(layers.map((l) => l.id)).toEqual(['foundations', 'ui']);
    expect(layers[0]!.files.map((f) => f.filename)).toEqual(['schema.prisma']);
    expect(layers[1]!.files.map((f) => f.filename)).toEqual(['ui.tsx']);
  });

  it('omits layers whose files were all removed without breaking ordering', () => {
    const artifact = {
      version: 1 as const,
      computedAt: 'x',
      layers: [
        { id: 'gone', title: 'Gone', summary: 'removed', order: 1, files: ['deleted.ts'] },
        { id: 'kept', title: 'Kept', summary: 'present', order: 2, files: ['present.ts'] },
      ],
    };
    const files = [makeFile('present.ts')];
    const layers = reconcileLayers(artifact, files);

    expect(layers.map((l) => l.id)).toEqual(['kept']);
  });

  it('routes unclassified files to a synthetic "additional-changes" layer appended last', () => {
    const artifact = {
      version: 1 as const,
      computedAt: 'x',
      layers: [{ id: 'foundations', title: 'Foundations', summary: 'schema', order: 1, files: ['schema.prisma'] }],
    };
    const files = [makeFile('schema.prisma'), makeFile('new-route.ts'), makeFile('extra.ts')];
    const layers = reconcileLayers(artifact, files);

    expect(layers).toHaveLength(2);
    const synthetic = layers[layers.length - 1]!;
    expect(synthetic.id).toBe('additional-changes');
    expect(synthetic.synthetic).toBe(true);
    expect(synthetic.files.map((f) => f.filename).sort()).toEqual(['extra.ts', 'new-route.ts']);
  });

  it('does not create a synthetic layer when all files are classified', () => {
    const artifact = {
      version: 1 as const,
      computedAt: 'x',
      layers: [{ id: 'foundations', title: 'Foundations', summary: 'schema', order: 1, files: ['schema.prisma'] }],
    };
    const layers = reconcileLayers(artifact, [makeFile('schema.prisma')]);
    expect(layers.some((l) => l.synthetic)).toBe(false);
  });

  it('assigns a file claimed by multiple layers to the first layer only', () => {
    const artifact = {
      version: 1 as const,
      computedAt: 'x',
      layers: [
        { id: 'first', title: 'First', summary: 'a', order: 1, files: ['shared.ts'] },
        { id: 'second', title: 'Second', summary: 'b', order: 2, files: ['shared.ts', 'other.ts'] },
      ],
    };
    const files = [makeFile('shared.ts'), makeFile('other.ts')];
    const layers = reconcileLayers(artifact, files);

    expect(layers[0]!.files.map((f) => f.filename)).toEqual(['shared.ts']);
    expect(layers[1]!.files.map((f) => f.filename)).toEqual(['other.ts']);
  });

  it('derives fileCount and commentCount after reconciliation', () => {
    const artifact = {
      version: 1 as const,
      computedAt: 'x',
      layers: [{ id: 'foundations', title: 'Foundations', summary: 'schema', order: 1, files: ['a.ts', 'b.ts'] }],
    };
    const files = [
      makeFile('a.ts', [makeComment(1), makeComment(2)]),
      makeFile('b.ts', [makeComment(3)]),
    ];
    const layers = reconcileLayers(artifact, files);

    expect(layers[0]!.fileCount).toBe(2);
    expect(layers[0]!.commentCount).toBe(3);
  });
});
