/**
 * Fetch the change shape for a shipped ticket from GitHub.
 *
 * We aggregate file-level diff stats across the ticket's commits on its
 * feature branch. The branch is the only piece of state that survives a SHIP,
 * so we compare it against the project's default branch via the GitHub
 * `compareCommits` API — this naturally captures every commit landed for the
 * ticket without having to walk individual commit SHAs.
 */

import { Octokit } from '@octokit/rest';
import type { DiffStats, FileChange } from './types';

export interface FetchDiffParams {
  owner: string;
  repo: string;
  base: string;
  head: string;
  /** Optional pre-built Octokit (lets the backfill share rate-limit budget). */
  octokit?: Octokit;
}

const TEST_OWNER = '__test__';
function isTestMode(): boolean {
  return process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test';
}

function buildOctokit(provided?: Octokit): Octokit | null {
  if (provided) return provided;
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.includes('test') || token.includes('placeholder')) {
    return null;
  }
  return new Octokit({ auth: token });
}

/**
 * Fetch aggregated diff stats for a ticket's branch.
 *
 * Returns null when the diff is unavailable (no commit data, no token, branch
 * deleted, etc.). Callers should record this as `hasCommitData: false` rather
 * than failing the SHIP transition.
 */
export async function fetchTicketDiff(params: FetchDiffParams): Promise<DiffStats | null> {
  // Tests can short-circuit without hitting the network.
  if (isTestMode() && params.owner === TEST_OWNER) {
    return { files: [], totalAdditions: 0, totalDeletions: 0 };
  }

  const octokit = buildOctokit(params.octokit);
  if (!octokit) return null;

  try {
    const response = await octokit.rest.repos.compareCommits({
      owner: params.owner,
      repo: params.repo,
      base: params.base,
      head: params.head,
      // We only need files+stats; mediaType=diff would be larger and slower.
    });

    const apiFiles = response.data.files ?? [];
    const files: FileChange[] = apiFiles.map((f) => ({
      path: f.filename,
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      status: f.status,
    }));

    return {
      files,
      totalAdditions: files.reduce((s, f) => s + f.additions, 0),
      totalDeletions: files.reduce((s, f) => s + f.deletions, 0),
    };
  } catch (error) {
    // 404 / 422 (branch missing or comparison invalid) → treat as missing diff.
    // Network/rate-limit errors also fall through to the partial-record path.
    console.warn(
      `[outcomes] Failed to fetch diff for ${params.owner}/${params.repo} ${params.base}...${params.head}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
