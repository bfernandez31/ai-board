/**
 * Octokit adapter for outcome capture. Resolves the diff for a ticket via its branch:
 *
 *   1. Look up the merged pull request whose head is `branch` and whose base is the
 *      project's default branch. The PR's `merge_commit_sha` persists even after the
 *      feature branch is deleted (auto-delete enabled).
 *   2. Fetch the file diff for that single merge commit.
 *   3. Fallback: if no merged PR can be located but the branch ref still exists,
 *      compare the branch tip with the default-branch tip.
 *
 * This replaces the previous per-`Job.commitSha` aggregation: only one PR-lookup and
 * one diff fetch per ticket, regardless of job count.
 *
 * Behaviour:
 * - In test mode (`process.env.TEST_MODE === 'true'`), returns a deterministic mock so
 *   integration tests can run offline. Tests can override via `TEST_OUTCOME_FILES`.
 * - Auth uses the `accessToken` arg if provided, otherwise falls back to
 *   `process.env.GITHUB_TOKEN`. No new env vars or credentials.
 * - Per-call retries with backoff `[1s, 4s, 16s]` for transient errors.
 * - Distinguishes 404 on the repo (`repository_unreachable`) from "no merged PR found"
 *   (`merge_not_found`).
 * - Backfill rate-limit handling: if `x-ratelimit-remaining` < 100, sleep until reset.
 */

import { Octokit } from '@octokit/rest';
import type { CommitFile } from './types';

export type FetchFailureReason =
  | 'merge_not_found'
  | 'repository_unreachable'
  | 'fetch_failed_after_retry';

export interface FetchBranchDiffParams {
  owner: string;
  repo: string;
  branch: string;
  defaultBranch: string;
  accessToken?: string;
}

export interface FetchBranchDiffResult {
  files: CommitFile[];
  /** The merge commit SHA (when resolved via a merged PR). Null when fallback compare path was used. */
  mergeCommitSha: string | null;
  failure: FetchFailureReason | null;
}

const RETRY_DELAYS_MS = [1000, 4000, 16000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTestMode(): boolean {
  return process.env.TEST_MODE === 'true';
}

/**
 * Generate a deterministic mock files payload for a branch so integration tests can rely
 * on stable change-shape derivations without touching GitHub.
 */
function mockFilesForBranch(branch: string): CommitFile[] {
  const override = process.env.TEST_OUTCOME_FILES;
  if (override) {
    try {
      const parsed = JSON.parse(override) as CommitFile[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore and fall through to default mock
    }
  }
  // Default deterministic mock — used unless a test overrides it.
  const slug = branch.replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'branch';
  return [
    { filename: `app/api/${slug}.ts`, additions: 10, deletions: 2 },
    { filename: 'lib/foo.ts', additions: 5, deletions: 1 },
  ];
}

interface OctokitErrorLike {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string | undefined> };
}

function asOctokitError(err: unknown): OctokitErrorLike {
  return (err as OctokitErrorLike) ?? {};
}

function isRateLimitMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return /rate limit/i.test(msg) || /secondary rate limit/i.test(msg);
}

async function maybeYieldOnRateLimit(headers: Record<string, string | undefined> | undefined) {
  if (!headers) return;
  const remaining = Number(headers['x-ratelimit-remaining']);
  const resetAt = Number(headers['x-ratelimit-reset']);
  if (Number.isFinite(remaining) && Number.isFinite(resetAt) && remaining < 100) {
    const now = Math.floor(Date.now() / 1000);
    const sleepSeconds = Math.max(0, resetAt - now);
    if (sleepSeconds > 0) {
      console.warn(
        `[outcome-capture] rate-limit yield: remaining=${remaining}, sleeping ${sleepSeconds}s`
      );
      await sleep(sleepSeconds * 1000);
    }
  }
}

type RetryOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'not_found' }
  | { kind: 'repo_unreachable' }
  | { kind: 'transient' };

async function callWithRetry<T>(
  fn: () => Promise<{ data: T; headers: Record<string, string | undefined> }>
): Promise<RetryOutcome<T>> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fn();
      await maybeYieldOnRateLimit(response.headers);
      return { kind: 'ok', value: response.data };
    } catch (err) {
      const e = asOctokitError(err);
      const status = e.status ?? 0;
      const message = e.message;

      if (status === 404) {
        return { kind: 'not_found' };
      }
      if (status === 403 && isRateLimitMessage(message)) {
        await sleep(60_000);
        continue;
      }
      const isTransient = status === 0 || status >= 500;
      if (isTransient && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]!);
        continue;
      }
      return { kind: 'transient' };
    }
  }
  return { kind: 'transient' };
}

function toCommitFiles(
  files: ReadonlyArray<{ filename: string; additions?: number; deletions?: number; status?: string }> | undefined
): CommitFile[] {
  return (files ?? []).map((f) => {
    const file: CommitFile = {
      filename: f.filename,
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
    };
    if (f.status !== undefined) file.status = f.status;
    return file;
  });
}

interface OctokitResponse<T> {
  data: T;
  headers: Record<string, string | undefined>;
}

function asResponse<T>(r: { data: T; headers: object }): OctokitResponse<T> {
  return { data: r.data, headers: r.headers as Record<string, string | undefined> };
}

/**
 * Resolve the diff that the ticket's branch contributed to the default branch.
 * Returns either the file list (success) or a `failure` reason (partial outcome).
 */
export async function fetchBranchDiff(
  params: FetchBranchDiffParams
): Promise<FetchBranchDiffResult> {
  // Test-mode short-circuit
  if (isTestMode()) {
    return {
      files: mockFilesForBranch(params.branch),
      mergeCommitSha: `mock-merge-${params.branch}`,
      failure: null,
    };
  }

  const token = params.accessToken ?? process.env.GITHUB_TOKEN;
  if (!token) {
    return { files: [], mergeCommitSha: null, failure: 'repository_unreachable' };
  }

  const octokit = new Octokit({ auth: token });

  // 1. Find the merged PR for branch → defaultBranch.
  const prLookup = await callWithRetry(async () =>
    asResponse(
      await octokit.rest.pulls.list({
        owner: params.owner,
        repo: params.repo,
        head: `${params.owner}:${params.branch}`,
        base: params.defaultBranch,
        state: 'closed',
        per_page: 50,
      })
    )
  );

  if (prLookup.kind === 'not_found') {
    return { files: [], mergeCommitSha: null, failure: 'repository_unreachable' };
  }
  if (prLookup.kind === 'repo_unreachable') {
    return { files: [], mergeCommitSha: null, failure: 'repository_unreachable' };
  }
  if (prLookup.kind === 'transient') {
    return { files: [], mergeCommitSha: null, failure: 'fetch_failed_after_retry' };
  }

  const prs = prLookup.value;
  // Pick the most recent merged PR that has a merge_commit_sha.
  const mergedPr = prs
    .filter((pr) => pr.merged_at !== null && typeof pr.merge_commit_sha === 'string' && pr.merge_commit_sha.length > 0)
    .sort((a, b) => {
      const aT = a.merged_at ? Date.parse(a.merged_at) : 0;
      const bT = b.merged_at ? Date.parse(b.merged_at) : 0;
      return bT - aT;
    })[0];

  if (mergedPr && mergedPr.merge_commit_sha) {
    const sha = mergedPr.merge_commit_sha;
    const commitResp = await callWithRetry(async () =>
      asResponse(
        await octokit.rest.repos.getCommit({
          owner: params.owner,
          repo: params.repo,
          ref: sha,
        })
      )
    );
    if (commitResp.kind === 'ok') {
      return {
        files: toCommitFiles(commitResp.value.files),
        mergeCommitSha: sha,
        failure: null,
      };
    }
    if (commitResp.kind === 'not_found') {
      // The merge commit was rewritten or pruned — try fallback.
    } else if (commitResp.kind === 'transient') {
      return { files: [], mergeCommitSha: sha, failure: 'fetch_failed_after_retry' };
    }
  }

  // 2. Fallback: compare branch tip with default branch tip if branch ref still exists.
  const compareResp = await callWithRetry(async () =>
    asResponse(
      await octokit.rest.repos.compareCommits({
        owner: params.owner,
        repo: params.repo,
        base: params.defaultBranch,
        head: params.branch,
      })
    )
  );

  if (compareResp.kind === 'ok') {
    return {
      files: toCommitFiles(compareResp.value.files),
      mergeCommitSha: null,
      failure: null,
    };
  }
  if (compareResp.kind === 'not_found') {
    // Branch is gone and PR lookup also failed → no merge contribution discoverable.
    return { files: [], mergeCommitSha: null, failure: 'merge_not_found' };
  }
  if (compareResp.kind === 'repo_unreachable') {
    return { files: [], mergeCommitSha: null, failure: 'repository_unreachable' };
  }
  return { files: [], mergeCommitSha: null, failure: 'fetch_failed_after_retry' };
}
