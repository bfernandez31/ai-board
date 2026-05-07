export function buildJobLogArtifactKey(projectId: number, ticketId: number, jobId: number): string {
  return `logs/${projectId}/${ticketId}/${jobId}.jsonl.gz`;
}

// AIB-776: Native Claude Code session JSONL stored under a parallel suffix so
// retention/pruning can find both artifacts via the same projectId/ticketId
// prefix while keeping the normalized and raw payloads distinct.
export function buildJobLogRawArtifactKey(
  projectId: number,
  ticketId: number,
  jobId: number
): string {
  return `logs/${projectId}/${ticketId}/${jobId}.native.jsonl.gz`;
}

export function buildJobLogRawUrl(projectId: number, ticketId: number, jobId: number): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`;
}

export function buildJobLogRawNativeUrl(
  projectId: number,
  ticketId: number,
  jobId: number
): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw-native`;
}
