/**
 * Branch Resolver
 *
 * Implements three-tier branch resolution strategy for ticket comparison:
 * 1. Database lookup (primary)
 * 2. Branch pattern search (fallback 1)
 * 3. Merge commit analysis (fallback 2)
 */

import type { BranchResolutionResult } from '@/lib/types/comparison';

/**
 * Git command execution interface for testing/mocking
 */
export interface GitExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

/**
 * Default git executor using shell commands
 */
export class ShellGitExecutor implements GitExecutor {
  async exec(
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command);
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: execError.stdout?.trim() ?? '',
        stderr: execError.stderr?.trim() ?? '',
        exitCode: execError.code ?? 1,
      };
    }
  }
}

/**
 * Branch resolver with three-tier resolution strategy
 */
export class BranchResolver {
  private gitExecutor: GitExecutor;

  constructor(gitExecutor: GitExecutor = new ShellGitExecutor()) {
    this.gitExecutor = gitExecutor;
  }

  /**
   * Resolve a ticket's branch for comparison
   *
   * @param ticketKey - Ticket key (e.g., "AIB-123")
   * @param databaseBranch - Branch from database record (may be null)
   * @returns Resolution result with status and branch/commit info
   */
  async resolve(
    ticketKey: string,
    databaseBranch: string | null
  ): Promise<BranchResolutionResult> {
    // Tier 1: Database lookup
    if (databaseBranch) {
      const exists = await this.branchExists(databaseBranch);
      if (exists) {
        return {
          status: 'resolved',
          branch: databaseBranch,
        };
      }
    }

    // Tier 2: Branch pattern search
    const patternBranch = await this.searchBranchByPattern(ticketKey);
    if (patternBranch) {
      return {
        status: 'branch_missing',
        branch: patternBranch,
      };
    }

    // Tier 3: Merge commit analysis
    const mergeResult = await this.findMergeCommit(ticketKey);
    if (mergeResult) {
      const result: BranchResolutionResult = {
        status: 'merge_analyzed',
        mergeCommitSha: mergeResult.commitSha,
      };
      if (mergeResult.branchName) {
        result.branch = mergeResult.branchName;
      }
      return result;
    }

    // Unable to resolve
    return {
      status: 'unavailable',
      error: `Branch for ticket ${ticketKey} could not be resolved`,
    };
  }

  /**
   * Check if a branch exists locally or remotely
   */
  async branchExists(branchName: string): Promise<boolean> {
    // Check local branch
    const localResult = await this.gitExecutor.exec(
      `git show-ref --verify --quiet refs/heads/${branchName}`
    );
    if (localResult.exitCode === 0) {
      return true;
    }

    // Check remote branch
    const remoteResult = await this.gitExecutor.exec(
      `git show-ref --verify --quiet refs/remotes/origin/${branchName}`
    );
    return remoteResult.exitCode === 0;
  }

  /**
   * Search for a branch matching the ticket key pattern
   */
  async searchBranchByPattern(ticketKey: string): Promise<string | null> {
    // Search local and remote branches
    const result = await this.gitExecutor.exec(
      `git branch -a --list "*${ticketKey}*" | head -1`
    );

    if (result.exitCode === 0 && result.stdout) {
      // Clean up branch name (remove remotes/origin/ prefix if present)
      let branch = result.stdout.trim();
      branch = branch.replace(/^\*?\s*/, ''); // Remove leading * and spaces
      branch = branch.replace(/^remotes\/origin\//, ''); // Remove remote prefix
      return branch || null;
    }

    return null;
  }

  /**
   * Find a merge commit containing the ticket key
   */
  async findMergeCommit(
    ticketKey: string
  ): Promise<{ commitSha: string; branchName: string | null } | null> {
    // Search merge commits with ticket key in message
    const result = await this.gitExecutor.exec(
      `git log --merges --grep="${ticketKey}" --format="%H %s" -1`
    );

    if (result.exitCode === 0 && result.stdout) {
      const [commitSha, ...messageParts] = result.stdout.split(' ');
      if (commitSha) {
        // Try to extract branch name from merge message
        const message = messageParts.join(' ');
        const branchMatch = message.match(
          /Merge (branch|pull request #\d+ from) ['"]?([^'"]+)['"]?/i
        );
        const branchName = branchMatch?.[2] ?? null;

        return { commitSha, branchName };
      }
    }

    return null;
  }

  /**
   * Get diff stats for a branch compared to main
   */
  async getBranchDiff(
    branchOrCommit: string,
    baseBranch: string = 'main'
  ): Promise<{
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
    changedFiles: string[];
  } | null> {
    // Get numstat for detailed diff
    const result = await this.gitExecutor.exec(
      `git diff --numstat ${baseBranch}...${branchOrCommit}`
    );

    if (result.exitCode !== 0) {
      return null;
    }

    let linesAdded = 0;
    let linesRemoved = 0;
    const changedFiles: string[] = [];

    for (const line of result.stdout.split('\n').filter(Boolean)) {
      const [added, removed, file] = line.split('\t');
      if (file) {
        changedFiles.push(file);
        // Handle binary files (shown as -)
        if (added !== '-') linesAdded += parseInt(added ?? '0', 10);
        if (removed !== '-') linesRemoved += parseInt(removed ?? '0', 10);
      }
    }

    return {
      linesAdded,
      linesRemoved,
      filesChanged: changedFiles.length,
      changedFiles,
    };
  }

  /**
   * Get diff from a merge commit
   */
  async getMergeCommitDiff(commitSha: string): Promise<{
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
    changedFiles: string[];
  } | null> {
    // Get the first parent to compare against
    const parentResult = await this.gitExecutor.exec(
      `git log --format="%P" -1 ${commitSha}`
    );

    if (parentResult.exitCode !== 0 || !parentResult.stdout) {
      return null;
    }

    const parents = parentResult.stdout.split(' ');
    if (parents.length < 2) {
      return null;
    }

    // Compare first parent with merge commit
    const firstParent = parents[0]!;
    return this.getBranchDiff(commitSha, firstParent);
  }
}

/**
 * Create a branch resolver instance
 */
export function createBranchResolver(
  gitExecutor?: GitExecutor
): BranchResolver {
  return new BranchResolver(gitExecutor);
}

/**
 * Resolve multiple tickets' branches
 */
export async function resolveTicketBranches(
  tickets: Array<{ ticketKey: string; branch: string | null }>,
  resolver: BranchResolver = new BranchResolver()
): Promise<Map<string, BranchResolutionResult>> {
  const results = new Map<string, BranchResolutionResult>();

  for (const ticket of tickets) {
    const result = await resolver.resolve(ticket.ticketKey, ticket.branch);
    results.set(ticket.ticketKey, result);
  }

  return results;
}

/**
 * Format resolution status for display
 */
export function formatResolutionStatus(
  result: BranchResolutionResult
): string {
  switch (result.status) {
    case 'resolved':
      return `✅ Branch: ${result.branch}`;
    case 'branch_missing':
      return `⚠️ Branch found via pattern: ${result.branch}`;
    case 'merge_analyzed':
      return `📦 Analyzed from merge: ${result.mergeCommitSha?.slice(0, 7)}`;
    case 'unavailable':
      return `❌ ${result.error ?? 'Branch unavailable'}`;
  }
}
