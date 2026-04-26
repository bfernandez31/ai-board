import { describe, it, expect } from 'vitest';
import { extractChangeShape } from '@/lib/outcomes/derivation';

describe('extractChangeShape', () => {
  it('aggregates lines added/removed across deduped files', () => {
    const result = extractChangeShape({
      files: [
        { filename: 'app/foo.ts', additions: 10, deletions: 2 },
        { filename: 'app/foo.ts', additions: 5, deletions: 1 },
        { filename: 'lib/bar.ts', additions: 3, deletions: 0 },
      ],
      testPatterns: [],
    });
    expect(result.linesAdded).toBe(18);
    expect(result.linesRemoved).toBe(3);
    expect(result.filesTouched).toEqual(['app/foo.ts', 'lib/bar.ts']);
  });

  it('extracts top-level domains and file-count map', () => {
    const result = extractChangeShape({
      files: [
        { filename: 'app/foo.ts', additions: 1, deletions: 0 },
        { filename: 'app/bar.ts', additions: 1, deletions: 0 },
        { filename: 'lib/baz.ts', additions: 1, deletions: 0 },
        { filename: 'tests/x.test.ts', additions: 1, deletions: 0 },
      ],
      testPatterns: [],
    });
    expect(result.domains).toEqual(['app', 'lib', 'tests']);
    expect(result.domainFileCounts).toEqual({ app: 2, lib: 1, tests: 1 });
  });

  it('preserves the empty-string segment for root-level files', () => {
    const result = extractChangeShape({
      files: [
        { filename: 'README.md', additions: 1, deletions: 0 },
        { filename: 'package.json', additions: 1, deletions: 0 },
      ],
      testPatterns: [],
    });
    expect(result.domains).toEqual(['README.md', 'package.json']);
    // Single segment for files at root is the filename itself (no '/' present).
    expect(result.domainFileCounts).toEqual({ 'README.md': 1, 'package.json': 1 });
  });

  it('computes testCodeRatio = linesInTestPaths / max(total, 1)', () => {
    const result = extractChangeShape({
      files: [
        { filename: 'lib/foo.ts', additions: 50, deletions: 10 }, // total=60 (non-test)
        { filename: 'tests/foo.test.ts', additions: 30, deletions: 10 }, // total=40 (test)
      ],
      testPatterns: ['**/*.test.ts'],
    });
    expect(result.linesAdded).toBe(80);
    expect(result.linesRemoved).toBe(20);
    expect(result.testCodeRatio).toBeCloseTo(40 / 100, 5);
  });

  it('returns testCodeRatio = 0 when there are zero lines', () => {
    const result = extractChangeShape({
      files: [{ filename: 'app/foo.ts', additions: 0, deletions: 0 }],
      testPatterns: [],
    });
    expect(result.testCodeRatio).toBe(0);
  });

  it('returns empty arrays/maps when no files are passed', () => {
    const result = extractChangeShape({ files: [], testPatterns: [] });
    expect(result.filesTouched).toEqual([]);
    expect(result.domains).toEqual([]);
    expect(result.domainFileCounts).toEqual({});
    expect(result.linesAdded).toBe(0);
    expect(result.linesRemoved).toBe(0);
  });

  it('skips files with empty filename', () => {
    const result = extractChangeShape({
      files: [
        { filename: '', additions: 100, deletions: 100 },
        { filename: 'app/foo.ts', additions: 1, deletions: 0 },
      ],
      testPatterns: [],
    });
    expect(result.filesTouched).toEqual(['app/foo.ts']);
    expect(result.linesAdded).toBe(1);
  });
});
