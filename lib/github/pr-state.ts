/**
 * Live PR-state retrieval for the in-app diff viewer (AIB-879).
 *
 * Resolves the ticket's PR, its changed files, and (US2) its inline review
 * comments from GitHub on open — read-only, no mutation. Follows the retry +
 * large-PR cap pattern of `lib/outcomes/github-files.ts`; the caller supplies a
 * per-user authenticated Octokit (`createUserGitHubClient`).
 */

import type { Octokit } from '@octokit/rest';
import type { FileChange, InlineComment, PrSummary } from '@/app/lib/schemas/pr-diff';

/**
 * GitHub caps `listFiles` at 3000 files (30 pages of 100). We bound retrieval to
 * keep very large PRs responsive and flag the result as truncated when hit.
 */
export const GITHUB_FILES_CAP = 300;

/** Per-file patch byte cap; oversized patches are dropped + flagged `patchTruncated`. */
export const MAX_PATCH_BYTES = 100_000;

const RETRY_DELAYS_MS = [1000, 4000, 16000];

/** Error thrown by PR-state helpers, carrying a typed code for route mapping. */
export class PrStateError extends Error {
  code: 'GITHUB_FORBIDDEN' | 'GITHUB_API_ERROR';
  constructor(code: 'GITHUB_FORBIDDEN' | 'GITHUB_API_ERROR', message: string) {
    super(message);
    this.name = 'PrStateError';
    this.code = code;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A 403 carrying a rate-limit message is a transient throttle, not an auth failure. */
function isRateLimitMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return /rate limit/i.test(msg) || /secondary rate limit/i.test(msg);
}

interface OctokitErrorLike {
  status?: number;
  message?: string;
}

/**
 * Invoke a GitHub call with retry/backoff for transient (5xx/network/rate-limit)
 * failures. 404 resolves to `null`; rate-limit 403s back off and retry; other
 * 401/403 throw `GITHUB_FORBIDDEN`; exhausted retries or unknown failures throw
 * `GITHUB_API_ERROR`.
 */
async function callWithRetry<T>(fn: () => Promise<{ data: T }>): Promise<T | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fn();
      return response.data;
    } catch (err) {
      const e = (err as OctokitErrorLike) ?? {};
      const status = e.status ?? 0;

      if (status === 404) return null;
      // Secondary/abuse rate limits surface as 403 with a rate-limit message; back
      // off and retry rather than mistaking them for an auth/scope failure.
      if (status === 403 && isRateLimitMessage(e.message) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]!);
        continue;
      }
      if (status === 401 || status === 403) {
        throw new PrStateError('GITHUB_FORBIDDEN', e.message ?? 'GitHub access forbidden');
      }
      const isTransient = status === 0 || status >= 500;
      if (isTransient && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]!);
        continue;
      }
      throw new PrStateError('GITHUB_API_ERROR', e.message ?? 'GitHub API error');
    }
  }
  throw new PrStateError('GITHUB_API_ERROR', 'GitHub API error after retries');
}

export interface ResolvePrParams {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Resolve the PR for a branch via `pulls.list({ head: "owner:branch", state: 'all' })`.
 * Prefers an open PR, else the most recently updated. Returns null when none exist.
 */
export async function resolvePr(
  octokit: Octokit,
  { owner, repo, branch }: ResolvePrParams
): Promise<PrSummary | null> {
  const prs = await callWithRetry(() =>
    octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'all',
      per_page: 50,
    })
  );

  if (!prs || prs.length === 0) return null;

  const open = prs.filter((pr) => pr.state === 'open');
  const pool = open.length > 0 ? open : prs;
  const chosen = [...pool].sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
  )[0]!;

  const state: PrSummary['state'] = chosen.merged_at
    ? 'merged'
    : (chosen.state as 'open' | 'closed');

  return {
    number: chosen.number,
    title: chosen.title,
    state,
    url: chosen.html_url,
  };
}

export interface RawPrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * Map a raw GitHub PR file to a `FileChange`, marking `binary` (no patch) and
 * `patchTruncated` (patch dropped for exceeding `MAX_PATCH_BYTES`).
 */
export function mapPrFile(file: RawPrFile): { file: FileChange; truncated: boolean } {
  const status: FileChange['status'] =
    file.status === 'added' || file.status === 'removed' ? file.status : 'modified';

  // GitHub omits `patch` for binary/generated files → no line content.
  const binary = file.patch === undefined || file.patch === null;
  let patch = file.patch ?? undefined;
  let patchTruncated = false;

  if (patch !== undefined && Buffer.byteLength(patch, 'utf8') > MAX_PATCH_BYTES) {
    patch = undefined;
    patchTruncated = true;
  }

  const mapped: FileChange = {
    filename: file.filename,
    status,
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    binary,
    patchTruncated,
    comments: [],
  };
  if (patch !== undefined) mapped.patch = patch;

  return { file: mapped, truncated: patchTruncated };
}

export interface ListPrFilesResult {
  files: FileChange[];
  truncated: boolean;
}

/**
 * Fetch the PR's changed files (paginated, capped at `GITHUB_FILES_CAP`).
 * Sets `binary`/`patchTruncated` per file; `truncated` is true when the file cap
 * was hit or any patch was dropped for size.
 */
export async function listPrFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ListPrFilesResult> {
  const collected: FileChange[] = [];
  let truncated = false;
  const perPage = 100;
  const maxPages = Math.ceil(GITHUB_FILES_CAP / perPage);

  for (let page = 1; page <= maxPages; page++) {
    const data = await callWithRetry(() =>
      octokit.rest.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: perPage, page })
    );
    if (!data || data.length === 0) break;

    for (const raw of data as RawPrFile[]) {
      if (collected.length >= GITHUB_FILES_CAP) {
        truncated = true;
        break;
      }
      const { file, truncated: patchTruncated } = mapPrFile(raw);
      if (patchTruncated) truncated = true;
      collected.push(file);
    }

    if (collected.length >= GITHUB_FILES_CAP) {
      truncated = true;
      break;
    }
    if (data.length < perPage) break;
  }

  return { files: collected, truncated };
}

export interface RawReviewComment {
  id: number;
  path: string;
  line: number | null;
  original_line?: number | null;
  body: string;
  created_at: string;
  user: { login: string; type: string } | null;
}

/** Map a raw GitHub `user` to an attribution source. */
export function deriveCommentSource(
  user: { login: string; type: string } | null
): InlineComment['source'] {
  if (!user) return 'bot';
  if (user.login === 'ai-board[bot]') return 'ai-board';
  if (user.type === 'Bot') return 'bot';
  return 'human';
}

/** Extract the line numbers present in a unified-diff patch's hunks. */
function patchLineSet(patch: string | undefined): Set<number> {
  const lines = new Set<number>();
  if (!patch) return lines;
  let current = 0;
  for (const raw of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      current = parseInt(hunk[1]!, 10);
      continue;
    }
    if (raw.startsWith('-')) continue; // deletion: not present in the new file
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    // context (' ') and additions ('+') advance the new-file line counter
    if (current > 0) {
      lines.add(current);
      current++;
    }
  }
  return lines;
}

/**
 * Map raw review comments and attach them to their file (by `path`), anchored to
 * the current line. A comment is `outdated` when GitHub reports no current `line`
 * or (for patched files) the target line is absent from the file's current patch
 * hunks; binary/oversized files with no patch trust GitHub's own `line`. Outdated
 * comments are kept (surfaced at the file header), never dropped. Pure: mutates
 * the passed files' `comments` arrays.
 */
export function attachReviewComments(files: FileChange[], rawComments: RawReviewComment[]): void {
  const byPath = new Map<string, FileChange>();
  for (const file of files) byPath.set(file.filename, file);

  const lineSets = new Map<string, Set<number>>();
  for (const file of files) lineSets.set(file.filename, patchLineSet(file.patch));

  for (const raw of rawComments) {
    const file = byPath.get(raw.path);
    if (!file) continue; // comment on a file no longer in the diff → not surfaced here

    const presentLines = lineSets.get(raw.path)!;
    // Binary files and oversized (dropped) patches have no hunks to anchor against,
    // so we fall back to GitHub's own current `line`: a comment GitHub still anchors
    // is current, not outdated. Patched files verify against the hunk line set.
    const hasPatch = file.patch !== undefined;
    const hasAnchor = raw.line != null && (hasPatch ? presentLines.has(raw.line) : true);

    const comment: InlineComment = {
      id: raw.id,
      source: deriveCommentSource(raw.user),
      author: raw.user?.login ?? 'unknown',
      line: hasAnchor ? raw.line! : null,
      body: raw.body,
      outdated: !hasAnchor,
      createdAt: raw.created_at,
    };
    file.comments.push(comment);
  }
}

/**
 * Fetch PR inline review comments (paginated) and attach them to their files.
 * Thin GitHub-fetching wrapper around `attachReviewComments`.
 */
export async function listPrReviewComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  files: FileChange[]
): Promise<void> {
  const perPage = 100;
  for (let page = 1; page <= 30; page++) {
    const data = await callWithRetry(() =>
      octokit.rest.pulls.listReviewComments({ owner, repo, pull_number: prNumber, per_page: perPage, page })
    );
    if (!data || data.length === 0) break;
    attachReviewComments(files, data as RawReviewComment[]);
    if (data.length < perPage) break;
  }
}
