export function buildJobLogArtifactKey(projectId: number, ticketId: number, jobId: number): string {
  return `logs/${projectId}/${ticketId}/${jobId}.jsonl.gz`;
}

export function buildJobLogNativeArtifactKey(projectId: number, ticketId: number, jobId: number): string {
  return `logs/${projectId}/${ticketId}/${jobId}.native.jsonl.gz`;
}

export function buildJobLogRawUrl(projectId: number, ticketId: number, jobId: number): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`;
}

export function buildJobLogNativeUrl(projectId: number, ticketId: number, jobId: number): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/native`;
}
