/**
 * Unit Tests: PR-state pure mappers (AIB-879)
 *
 * Server-free coverage of the GitHub → FileChange/InlineComment derivation used by
 * the PR-diff route: binary/oversized file mapping, comment source attribution,
 * and current-line anchoring / outdated detection.
 */

import { describe, it, expect } from 'vitest';
import {
  mapPrFile,
  deriveCommentSource,
  attachReviewComments,
  MAX_PATCH_BYTES,
  type RawPrFile,
  type RawReviewComment,
} from '@/lib/github/pr-state';
import type { FileChange } from '@/app/lib/schemas/pr-diff';

describe('mapPrFile', () => {
  it('maps a text file with a patch', () => {
    const raw: RawPrFile = {
      filename: 'a.ts',
      status: 'modified',
      additions: 3,
      deletions: 1,
      patch: '@@ -1 +1 @@\n+x',
    };
    const { file, truncated } = mapPrFile(raw);
    expect(file.binary).toBe(false);
    expect(file.patchTruncated).toBe(false);
    expect(file.patch).toBe('@@ -1 +1 @@\n+x');
    expect(truncated).toBe(false);
  });

  it('marks a file with no patch as binary', () => {
    const { file } = mapPrFile({ filename: 'logo.png', status: 'modified', additions: 0, deletions: 0 });
    expect(file.binary).toBe(true);
    expect(file.patch).toBeUndefined();
  });

  it('drops and flags an oversized patch as truncated', () => {
    const bigPatch = '@@ -1 +1 @@\n' + '+x\n'.repeat(MAX_PATCH_BYTES);
    const { file, truncated } = mapPrFile({
      filename: 'big.ts',
      status: 'modified',
      additions: 1,
      deletions: 0,
      patch: bigPatch,
    });
    expect(file.patchTruncated).toBe(true);
    expect(file.patch).toBeUndefined();
    expect(truncated).toBe(true);
  });

  it('normalises unknown statuses to "modified"', () => {
    const { file } = mapPrFile({ filename: 'r.ts', status: 'renamed', additions: 0, deletions: 0, patch: '@@ -1 +1 @@\n x' });
    expect(file.status).toBe('modified');
  });
});

describe('deriveCommentSource', () => {
  it('classifies our bot as ai-board', () => {
    expect(deriveCommentSource({ login: 'ai-board[bot]', type: 'Bot' })).toBe('ai-board');
  });
  it('classifies other bots as bot', () => {
    expect(deriveCommentSource({ login: 'dependabot[bot]', type: 'Bot' })).toBe('bot');
  });
  it('classifies users as human', () => {
    expect(deriveCommentSource({ login: 'alice', type: 'User' })).toBe('human');
  });
  it('defaults a missing user to bot', () => {
    expect(deriveCommentSource(null)).toBe('bot');
  });
});

describe('attachReviewComments', () => {
  function file(filename: string, patch?: string): FileChange {
    return {
      filename,
      status: 'modified',
      additions: 1,
      deletions: 0,
      ...(patch !== undefined ? { patch } : {}),
      binary: patch === undefined,
      patchTruncated: false,
      comments: [],
    };
  }

  it('anchors a comment to a line present in the current patch', () => {
    // new-file lines: 1 (context), 2 (added), 3 (added)
    const f = file('a.ts', '@@ -1,1 +1,3 @@\n context\n+added2\n+added3');
    const raw: RawReviewComment = {
      id: 10,
      path: 'a.ts',
      line: 2,
      body: 'on line 2',
      created_at: '2026-06-30T00:00:00Z',
      user: { login: 'alice', type: 'User' },
    };
    attachReviewComments([f], [raw]);
    expect(f.comments).toHaveLength(1);
    expect(f.comments[0]!.line).toBe(2);
    expect(f.comments[0]!.outdated).toBe(false);
  });

  it('marks a comment outdated when its line is absent from the current patch', () => {
    const f = file('a.ts', '@@ -1,1 +1,2 @@\n context\n+added2');
    const raw: RawReviewComment = {
      id: 11,
      path: 'a.ts',
      line: 99,
      body: 'on a vanished line',
      created_at: '2026-06-30T00:00:00Z',
      user: { login: 'alice', type: 'User' },
    };
    attachReviewComments([f], [raw]);
    expect(f.comments[0]!.outdated).toBe(true);
    expect(f.comments[0]!.line).toBeNull();
  });

  it('marks a comment outdated when GitHub reports a null line', () => {
    const f = file('a.ts', '@@ -1,1 +1,2 @@\n context\n+added2');
    const raw: RawReviewComment = {
      id: 12,
      path: 'a.ts',
      line: null,
      body: 'no anchor',
      created_at: '2026-06-30T00:00:00Z',
      user: { login: 'ai-board[bot]', type: 'Bot' },
    };
    attachReviewComments([f], [raw]);
    expect(f.comments[0]!.outdated).toBe(true);
    expect(f.comments[0]!.source).toBe('ai-board');
  });

  it('ignores comments whose file is no longer in the diff', () => {
    const f = file('a.ts', '@@ -1 +1 @@\n+x');
    attachReviewComments([f], [
      { id: 13, path: 'gone.ts', line: 1, body: 'x', created_at: '2026-06-30T00:00:00Z', user: { login: 'a', type: 'User' } },
    ]);
    expect(f.comments).toHaveLength(0);
  });
});
