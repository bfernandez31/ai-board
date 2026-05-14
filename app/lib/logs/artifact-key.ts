export function buildJobLogArtifactKey(projectId: number, ticketId: number, jobId: number): string {
  return `logs/${projectId}/${ticketId}/${jobId}.jsonl.gz`;
}

export function buildJobLogRawUrl(projectId: number, ticketId: number, jobId: number): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`;
}

// The native session artifact is uploaded as a tar.gz that preserves Claude
// Code's per-session JSONL file structure (`~/.claude/projects/<cwd>/<sid>.jsonl`
// — one file per session keyed by UUID). The legacy format was a gzipped
// concatenation of all sessions into a single jsonl.gz, which loses the
// filename-derived sessionId that `/insights` requires. Both formats exist in
// Vercel Blob; downstream code dispatches on the extension via
// `isLegacyRawArtifactKey` / `isRawArtifactKey`.
export function buildJobLogRawArtifactKey(
  projectId: number,
  ticketId: number,
  jobId: number,
): string {
  return `raw-logs/${projectId}/${ticketId}/${jobId}.tar.gz`;
}

const LEGACY_RAW_EXT = '.jsonl.gz';

function buildJobLogRawArtifactKeyLegacy(
  projectId: number,
  ticketId: number,
  jobId: number,
): string {
  return `raw-logs/${projectId}/${ticketId}/${jobId}${LEGACY_RAW_EXT}`;
}

/**
 * Validates that a stored raw artifact key matches the canonical path for the
 * given (projectId, ticketId, jobId) under either the new tar.gz layout or the
 * legacy jsonl.gz layout. Returns the key unchanged when canonical, null
 * otherwise.
 */
export function canonicalizeRawArtifactKey(
  stored: string,
  projectId: number,
  ticketId: number,
  jobId: number,
): string | null {
  const current = buildJobLogRawArtifactKey(projectId, ticketId, jobId);
  const legacy = buildJobLogRawArtifactKeyLegacy(projectId, ticketId, jobId);
  return stored === current || stored === legacy ? stored : null;
}

export function isLegacyRawArtifactKey(key: string): boolean {
  return key.endsWith(LEGACY_RAW_EXT);
}

export function buildJobLogRawNativeUrl(
  projectId: number,
  ticketId: number,
  jobId: number,
): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw-native`;
}
