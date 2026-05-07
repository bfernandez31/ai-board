export function buildJobLogArtifactKey(projectId: number, ticketId: number, jobId: number): string {
  return `logs/${projectId}/${ticketId}/${jobId}.jsonl.gz`;
}

export function buildJobLogRawArtifactKey(projectId: number, ticketId: number, jobId: number): string {
  return `logs/${projectId}/${ticketId}/${jobId}-raw.jsonl.gz`;
}

export function buildJobLogRawUrl(projectId: number, ticketId: number, jobId: number): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`;
}

export function buildJobLogNativeRawUrl(projectId: number, ticketId: number, jobId: number): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw?type=native`;
}
