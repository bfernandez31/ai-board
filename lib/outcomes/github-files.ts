/**
 * Octokit `repos.getCommit` adapter for outcome capture. Fetches the per-commit file diff
 * for each unique commit SHA on a shipped ticket.
 *
 * Behaviour:
 * - In test mode (`process.env.TEST_MODE === 'true'`), returns a deterministic mock
 *   based on the SHA so integration tests can run offline.
 * - Auth uses the `accessToken` arg if provided, otherwise falls back to
 *   `process.env.GITHUB_TOKEN`. No new env vars or credentials.
 * - Per-commit retries with backoff `[1s, 4s, 16s]` for transient errors.
 * - Distinguishes 404 on the repo (`repository_unreachable`) from 404 on a single SHA
 *   (skip but proceed).
 * - Backfill rate-limit handling: if `x-ratelimit-remaining` < 100, sleep until reset
 *   before the next call.
 */

import { Octokit } from '@octokit/rest';
import type { CommitFile } from './types';

export type FetchFailureReason =
  | 'repository_unreachable'
  | 'fetch_failed_after_retry';

export interface FetchCommitFilesParams {
  owner: string;
  repo: string;
  shas: readonly string[];
  accessToken?: string;
}

export interface FetchCommitFilesResult {
  files: CommitFile[];
  /** SHAs that were fetched successfully (200 + files present). */
  successfulShas: string[];
  /** SHAs that returned 404 individually (skipped but recorded). */
  notFoundShas: string[];
  /** A terminal failure that prevented any usable data. Null if at least one SHA returned data. */
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
 * Generate a deterministic mock files payload for a SHA so integration tests can rely on
 * stable change-shape derivations without touching GitHub. The mock uses a fixed list of
 * paths regardless of SHA so test fixtures stay simple.
 */
function mockFilesForSha(sha: string): CommitFile[] {
  // Tests can short-circuit by setting the env var TEST_OUTCOME_FILES to a JSON list of
  // {filename, additions, deletions}. This keeps individual tests in control of the
  // change-shape they assert on.
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
  return [
    { filename: `app/api/${sha.substring(0, 6)}.ts`, additions: 10, deletions: 2 },
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

export async function fetchCommitFiles(
  params: FetchCommitFilesParams
): Promise<FetchCommitFilesResult> {
  // Test-mode short-circuit
  if (isTestMode()) {
    const files: CommitFile[] = [];
    const successfulShas: string[] = [];
    for (const sha of params.shas) {
      files.push(...mockFilesForSha(sha));
      successfulShas.push(sha);
    }
    return { files, successfulShas, notFoundShas: [], failure: null };
  }

  const token = params.accessToken ?? process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      files: [],
      successfulShas: [],
      notFoundShas: [],
      failure: 'repository_unreachable',
    };
  }

  const octokit = new Octokit({ auth: token });
  const files: CommitFile[] = [];
  const successfulShas: string[] = [];
  const notFoundShas: string[] = [];
  let repoUnreachable = false;
  let allFailed = true;

  for (const sha of params.shas) {
    let lastErrorWas404OnRepo = false;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await octokit.repos.getCommit({
          owner: params.owner,
          repo: params.repo,
          ref: sha,
        });
        await maybeYieldOnRateLimit(response.headers as Record<string, string | undefined>);
        const commitFiles = (response.data.files ?? []).map((f) => ({
          filename: f.filename,
          additions: f.additions ?? 0,
          deletions: f.deletions ?? 0,
          status: f.status,
        }));
        files.push(...commitFiles);
        successfulShas.push(sha);
        allFailed = false;
        break;
      } catch (err) {
        const e = asOctokitError(err);
        const status = e.status ?? 0;
        const message = e.message;

        if (status === 404) {
          // Distinguish: was the *commit* not found, or the *repo*?
          // A repo-level 404 typically reports "Not Found" for the repository path; we
          // can't fully distinguish, so we attempt a one-time `repos.get` to confirm.
          try {
            await octokit.repos.get({ owner: params.owner, repo: params.repo });
            // repo exists → SHA is just missing; record and move on
            notFoundShas.push(sha);
          } catch {
            lastErrorWas404OnRepo = true;
          }
          break;
        }

        // Handle rate-limit-related 403 specially: sleep then retry once
        if (status === 403 && isRateLimitMessage(message)) {
          await sleep(60_000);
          continue;
        }

        // Transient errors (network, 5xx) → retry with backoff
        const isTransient = status === 0 || status >= 500;
        if (isTransient && attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]!);
          continue;
        }

        break;
      }
    }

    if (lastErrorWas404OnRepo) {
      repoUnreachable = true;
      break;
    }
  }

  let failure: FetchFailureReason | null = null;
  if (repoUnreachable) {
    failure = 'repository_unreachable';
  } else if (
    allFailed &&
    params.shas.length > 0 &&
    successfulShas.length === 0
  ) {
    failure = 'fetch_failed_after_retry';
  }

  return { files, successfulShas, notFoundShas, failure };
}
