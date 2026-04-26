/**
 * Pure change-shape derivation: given the union of files reported across all commits of a
 * shipped ticket, compute filesTouched (sorted unique), linesAdded/linesRemoved,
 * testCodeRatio, structural domains, and the per-domain frequency map.
 *
 * Test-path identification is delegated to the caller (which passes in the project's
 * test patterns from STACK_INDICATORS) so that this module stays pure and testable.
 */

import type { ChangeShape, CommitFile } from './types';
import { matchesAny } from './stack-indicator-lookup';

export interface DerivationInput {
  files: CommitFile[];
  testPatterns: readonly string[];
}

/**
 * Aggregate the per-file additions/deletions across the (possibly duplicated) commit files
 * by filename. A file edited across multiple commits accumulates its additions/deletions.
 */
function dedupeFiles(files: CommitFile[]): Map<string, { additions: number; deletions: number }> {
  const map = new Map<string, { additions: number; deletions: number }>();
  for (const f of files) {
    if (!f.filename) continue;
    const prev = map.get(f.filename) ?? { additions: 0, deletions: 0 };
    map.set(f.filename, {
      additions: prev.additions + (f.additions ?? 0),
      deletions: prev.deletions + (f.deletions ?? 0),
    });
  }
  return map;
}

export function extractChangeShape(input: DerivationInput): ChangeShape {
  const deduped = dedupeFiles(input.files);

  let linesAdded = 0;
  let linesRemoved = 0;
  let linesInTestPaths = 0;

  const filesTouched: string[] = [];
  const domainFileCounts: Record<string, number> = {};

  for (const [filename, totals] of deduped) {
    filesTouched.push(filename);
    linesAdded += totals.additions;
    linesRemoved += totals.deletions;

    if (matchesAny(filename, input.testPatterns)) {
      linesInTestPaths += totals.additions + totals.deletions;
    }

    // Top-level path segment: split on '/', take [0]. Files at root yield '' which we
    // preserve as-is per spec edge case ("preserve root-segment empty-string").
    const segment = filename.split('/')[0] ?? '';
    domainFileCounts[segment] = (domainFileCounts[segment] ?? 0) + 1;
  }

  filesTouched.sort();

  const totalLines = linesAdded + linesRemoved;
  const testCodeRatio = linesInTestPaths / Math.max(totalLines, 1);

  const domains = Object.keys(domainFileCounts).sort();

  return {
    filesTouched,
    linesAdded,
    linesRemoved,
    testCodeRatio,
    domains,
    domainFileCounts,
  };
}
