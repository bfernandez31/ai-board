export function buildJobLogArtifactKey(projectId: number, ticketId: number, jobId: number): string {
  return `logs/${projectId}/${ticketId}/${jobId}.jsonl.gz`;
}

export function buildJobLogRawUrl(projectId: number, ticketId: number, jobId: number): string {
  return `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`;
}
