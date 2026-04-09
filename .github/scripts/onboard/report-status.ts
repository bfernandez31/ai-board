import { readFile } from 'node:fs/promises';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const projectId = readArg('--project-id') ?? process.env.PROJECT_ID;
  const jobId = readArg('--job-id') ?? process.env.JOB_ID;
  const baseUrl = readArg('--base-url') ?? process.env.API_BASE_URL ?? process.env.APP_URL;
  const token = process.env.WORKFLOW_API_TOKEN;
  const status = readArg('--status');

  if (!projectId || !jobId || !baseUrl || !token || !status) {
    throw new Error('Missing required project/job/base-url/token/status inputs');
  }

  const artifactSummaryPath = readArg('--artifact-summary-path');
  const artifactSummary = artifactSummaryPath
    ? JSON.parse(await readFile(artifactSummaryPath, 'utf8')) as Record<string, unknown>
    : undefined;

  const payload = {
    status,
    workflowRunId: readArg('--workflow-run-id') ? Number(readArg('--workflow-run-id')) : undefined,
    partial: readArg('--partial') === 'true' ? true : undefined,
    commitSha: readArg('--commit-sha'),
    errorCode: readArg('--error-code'),
    errorMessage: readArg('--error-message'),
    logs: readArg('--logs'),
    artifactSummary,
  };

  const response = await fetch(
    `${baseUrl}/api/projects/${projectId}/setup/jobs/${jobId}/status`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Callback failed with HTTP ${response.status}: ${await response.text()}`);
  }
}

main().catch((error) => {
  console.error('[onboard/report-status] Failed:', error);
  process.exitCode = 1;
});
