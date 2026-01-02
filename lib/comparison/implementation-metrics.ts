/**
 * Implementation Metrics Extraction
 *
 * Extracts code change metrics from git diff for ticket comparison.
 */

import type { ImplementationMetrics } from '@/lib/types/comparison';
import { execSync } from 'child_process';

/**
 * Git diff numstat line pattern
 * Matches: "10\t5\tpath/to/file.ts"
 */
const NUMSTAT_LINE_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/;

/**
 * Test file patterns
 */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /tests?\//i,
  /__tests__\//,
];

/**
 * Check if a file path is a test file
 */
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Parse git diff --numstat output
 *
 * @param output - Raw numstat output
 * @returns Object with lines added/removed and file list
 */
function parseNumstat(output: string): {
  linesAdded: number;
  linesRemoved: number;
  files: string[];
  testFiles: number;
} {
  const lines = output.trim().split('\n').filter(Boolean);

  let linesAdded = 0;
  let linesRemoved = 0;
  const files: string[] = [];
  let testFiles = 0;

  for (const line of lines) {
    const match = line.match(NUMSTAT_LINE_REGEX);
    if (match) {
      // Binary files show as "-" for additions/deletions
      const added = match[1] === '-' ? 0 : parseInt(match[1]!, 10);
      const removed = match[2] === '-' ? 0 : parseInt(match[2]!, 10);
      const filePath = match[3]!;

      linesAdded += added;
      linesRemoved += removed;
      files.push(filePath);

      if (isTestFile(filePath)) {
        testFiles++;
      }
    }
  }

  return { linesAdded, linesRemoved, files, testFiles };
}

/**
 * Execute git command and return output
 *
 * @param command - Git command to execute
 * @param cwd - Working directory
 * @returns Command output or null if error
 */
function executeGitCommand(command: string, cwd?: string): string | null {
  try {
    const options = cwd ? { cwd, encoding: 'utf-8' as const } : { encoding: 'utf-8' as const };
    return execSync(command, { ...options, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch {
    return null;
  }
}

/**
 * Get base branch name (usually 'main' or 'master')
 *
 * @param cwd - Working directory
 * @returns Base branch name
 */
function getBaseBranch(cwd?: string): string {
  // Try to get default branch from origin
  const output = executeGitCommand('git remote show origin 2>/dev/null | grep "HEAD branch" | cut -d: -f2', cwd);
  if (output) {
    const branch = output.trim();
    if (branch) return branch;
  }

  // Fallback: check if main or master exists
  const branches = executeGitCommand('git branch -a', cwd);
  if (branches?.includes('main')) return 'main';
  if (branches?.includes('master')) return 'master';

  return 'main'; // Default
}

/**
 * Extract implementation metrics from a git branch
 *
 * @param ticketKey - Ticket key for the branch
 * @param branch - Branch name (optional, will construct from ticketKey if not provided)
 * @param cwd - Working directory (defaults to current)
 * @returns Implementation metrics
 */
export async function extractImplementationMetrics(
  ticketKey: string,
  branch?: string,
  cwd?: string
): Promise<ImplementationMetrics> {
  const baseBranch = getBaseBranch(cwd);
  const targetBranch = branch || ticketKey;

  // Get numstat for detailed metrics
  const numstatOutput = executeGitCommand(
    `git diff --numstat ${baseBranch}...${targetBranch}`,
    cwd
  );

  if (!numstatOutput) {
    return createEmptyMetrics(ticketKey);
  }

  const { linesAdded, linesRemoved, files, testFiles } = parseNumstat(numstatOutput);

  return {
    ticketKey,
    linesAdded,
    linesRemoved,
    linesChanged: linesAdded + linesRemoved,
    filesChanged: files.length,
    changedFiles: files,
    testFilesChanged: testFiles,
    hasData: true,
  };
}

/**
 * Extract metrics synchronously (for simpler use cases)
 */
export function extractImplementationMetricsSync(
  ticketKey: string,
  branch?: string,
  cwd?: string
): ImplementationMetrics {
  const baseBranch = getBaseBranch(cwd);
  const targetBranch = branch || ticketKey;

  const numstatOutput = executeGitCommand(
    `git diff --numstat ${baseBranch}...${targetBranch}`,
    cwd
  );

  if (!numstatOutput) {
    return createEmptyMetrics(ticketKey);
  }

  const { linesAdded, linesRemoved, files, testFiles } = parseNumstat(numstatOutput);

  return {
    ticketKey,
    linesAdded,
    linesRemoved,
    linesChanged: linesAdded + linesRemoved,
    filesChanged: files.length,
    changedFiles: files,
    testFilesChanged: testFiles,
    hasData: true,
  };
}

/**
 * Create empty metrics for unavailable data
 */
export function createEmptyMetrics(ticketKey: string): ImplementationMetrics {
  return {
    ticketKey,
    linesAdded: 0,
    linesRemoved: 0,
    linesChanged: 0,
    filesChanged: 0,
    changedFiles: [],
    testFilesChanged: 0,
    hasData: false,
  };
}

/**
 * Extract metrics from a merge commit
 *
 * @param ticketKey - Ticket key
 * @param mergeCommitSha - SHA of the merge commit
 * @param cwd - Working directory
 * @returns Implementation metrics
 */
export function extractMetricsFromMerge(
  ticketKey: string,
  mergeCommitSha: string,
  cwd?: string
): ImplementationMetrics {
  // Get the diff between merge commit parents
  const numstatOutput = executeGitCommand(
    `git diff --numstat ${mergeCommitSha}^1...${mergeCommitSha}^2`,
    cwd
  );

  if (!numstatOutput) {
    return createEmptyMetrics(ticketKey);
  }

  const { linesAdded, linesRemoved, files, testFiles } = parseNumstat(numstatOutput);

  return {
    ticketKey,
    linesAdded,
    linesRemoved,
    linesChanged: linesAdded + linesRemoved,
    filesChanged: files.length,
    changedFiles: files,
    testFilesChanged: testFiles,
    hasData: true,
  };
}

/**
 * Compare metrics between multiple tickets
 *
 * @param metrics - Array of metrics to compare
 * @returns Comparison summary
 */
export function compareMetrics(
  metrics: ImplementationMetrics[]
): {
  largest: ImplementationMetrics | null;
  smallest: ImplementationMetrics | null;
  average: { linesChanged: number; filesChanged: number };
} {
  if (metrics.length === 0) {
    return {
      largest: null,
      smallest: null,
      average: { linesChanged: 0, filesChanged: 0 },
    };
  }

  const validMetrics = metrics.filter((m) => m.hasData);

  if (validMetrics.length === 0) {
    return {
      largest: null,
      smallest: null,
      average: { linesChanged: 0, filesChanged: 0 },
    };
  }

  const sorted = [...validMetrics].sort(
    (a, b) => b.linesChanged - a.linesChanged
  );

  const totalLines = validMetrics.reduce((sum, m) => sum + m.linesChanged, 0);
  const totalFiles = validMetrics.reduce((sum, m) => sum + m.filesChanged, 0);

  return {
    largest: sorted[0]!,
    smallest: sorted[sorted.length - 1]!,
    average: {
      linesChanged: Math.round(totalLines / validMetrics.length),
      filesChanged: Math.round(totalFiles / validMetrics.length),
    },
  };
}

/**
 * Calculate test coverage ratio
 *
 * @param metrics - Implementation metrics
 * @returns Test file ratio (0-1)
 */
export function calculateTestRatio(metrics: ImplementationMetrics): number {
  if (metrics.filesChanged === 0) return 0;
  return metrics.testFilesChanged / metrics.filesChanged;
}

/**
 * Generate metrics summary text
 *
 * @param metrics - Implementation metrics
 * @returns Human-readable summary
 */
export function generateMetricsSummary(metrics: ImplementationMetrics): string {
  if (!metrics.hasData) {
    return `${metrics.ticketKey}: Metrics unavailable`;
  }

  const testRatio = calculateTestRatio(metrics);
  const testRatioPercent = Math.round(testRatio * 100);

  return [
    `${metrics.ticketKey}:`,
    `  Lines changed: ${metrics.linesChanged} (+${metrics.linesAdded}/-${metrics.linesRemoved})`,
    `  Files changed: ${metrics.filesChanged} (${metrics.testFilesChanged} test files, ${testRatioPercent}% coverage)`,
  ].join('\n');
}
