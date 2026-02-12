import type { ImplementationMetrics } from '@/lib/types/comparison';
import { execSync } from 'child_process';

const NUMSTAT_LINE_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/;

const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /tests?\//i,
  /__tests__\//,
];

function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

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

function executeGitCommand(command: string, cwd?: string): string | null {
  try {
    const options = cwd ? { cwd, encoding: 'utf-8' as const } : { encoding: 'utf-8' as const };
    return execSync(command, { ...options, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch {
    return null;
  }
}

function getBaseBranch(cwd?: string): string {
  const output = executeGitCommand('git remote show origin 2>/dev/null | grep "HEAD branch" | cut -d: -f2', cwd);
  if (output?.trim()) return output.trim();

  const branches = executeGitCommand('git branch -a', cwd);
  if (branches?.includes('main')) return 'main';
  if (branches?.includes('master')) return 'master';

  return 'main';
}

/**
 * Extract implementation metrics from a git branch (async wrapper)
 */
export async function extractImplementationMetrics(
  ticketKey: string,
  branch?: string,
  cwd?: string
): Promise<ImplementationMetrics> {
  return extractImplementationMetricsSync(ticketKey, branch, cwd);
}

/**
 * Extract implementation metrics from a git branch (synchronous)
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

  return buildMetricsFromNumstat(ticketKey, numstatOutput);
}

/**
 * Build metrics from numstat output (shared by all extraction functions)
 */
function buildMetricsFromNumstat(
  ticketKey: string,
  numstatOutput: string | null
): ImplementationMetrics {
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
 */
export function extractMetricsFromMerge(
  ticketKey: string,
  mergeCommitSha: string,
  cwd?: string
): ImplementationMetrics {
  const numstatOutput = executeGitCommand(
    `git diff --numstat ${mergeCommitSha}^1...${mergeCommitSha}^2`,
    cwd
  );

  return buildMetricsFromNumstat(ticketKey, numstatOutput);
}

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

export function calculateTestRatio(metrics: ImplementationMetrics): number {
  if (metrics.filesChanged === 0) return 0;
  return metrics.testFilesChanged / metrics.filesChanged;
}

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
